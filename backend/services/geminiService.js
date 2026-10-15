import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

/**
 * Service to handle all interactions with the Google Gemini API.
 * Encapsulates client initialization, history conversion, streaming, and error handling.
 */
class GeminiService {
  /**
   * Retrieves an active API key from the request or backend config.
   * @param {string} [overrideKey] Optional API key provided in request headers
   * @returns {string} Valid API key
   */
  getApiKey(overrideKey) {
    const key = overrideKey?.trim() || config.geminiApiKey?.trim();
    if (!key) {
      const err = new Error(
        'Gemini API Key is missing. Please set GEMINI_API_KEY in backend/.env or configure it in the web interface settings.'
      );
      err.statusCode = 401;
      err.code = 'API_KEY_MISSING';
      throw err;
    }
    return key;
  }

  /**
   * Get an instance of GoogleGenAI client with the specified or default key.
   * @param {string} [apiKey]
   * @returns {GoogleGenAI}
   */
  getClient(apiKey) {
    const key = this.getApiKey(apiKey);
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Format message array from standard frontend chat format to Gemini API format.
   * Frontend: [{ role: 'user'|'assistant'|'system', content: 'text' }]
   * Gemini: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
   *
   * @param {Array<{role: string, content: string}>} messages
   * @returns {{ systemInstruction: string|undefined, contents: Array<{role: string, parts: Array<{text: string}>}> }}
   */
  formatChatHistory(messages = []) {
    let systemInstruction = undefined;
    const contents = [];

    for (const msg of messages) {
      if (!msg || !msg.content) continue;

      if (msg.role === 'system') {
        // Collect system instructions
        systemInstruction = (systemInstruction ? systemInstruction + '\n\n' : '') + msg.content;
      } else {
        const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: String(msg.content) }]
        });
      }
    }

    // Ensure the conversation starts with a user turn if there are any contents
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({
        role: 'user',
        parts: [{ text: 'Hello' }]
      });
    }

    return { systemInstruction, contents };
  }

  /**
   * Generate a complete text response (non-streaming).
   */
  async generateResponse({
    messages = [],
    model = config.defaultModel,
    temperature = 0.7,
    systemInstruction = '',
    apiKey = null
  }) {
    try {
      const ai = this.getClient(apiKey);
      const formatted = this.formatChatHistory(messages);

      const finalSystemInstruction = systemInstruction || formatted.systemInstruction || 'You are an intelligent, helpful, and concise AI assistant powered by Google Gemini.';

      const response = await ai.models.generateContent({
        model: model || config.defaultModel,
        contents: formatted.contents,
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: typeof temperature === 'number' ? temperature : 0.7
        }
      });

      return {
        text: response.text || '',
        model: model || config.defaultModel,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        usage: response.usageMetadata || null
      };
    } catch (err) {
      this.handleGeminiError(err);
    }
  }

  /**
   * Generate a streaming response using Server-Sent Events (SSE).
   */
  async streamResponse({
    messages = [],
    model = config.defaultModel,
    temperature = 0.7,
    systemInstruction = '',
    apiKey = null,
    onChunk,
    onComplete,
    onError
  }) {
    try {
      const ai = this.getClient(apiKey);
      const formatted = this.formatChatHistory(messages);

      const finalSystemInstruction = systemInstruction || formatted.systemInstruction || 'You are an intelligent, helpful, and concise AI assistant powered by Google Gemini.';

      const responseStream = await ai.models.generateContentStream({
        model: model || config.defaultModel,
        contents: formatted.contents,
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: typeof temperature === 'number' ? temperature : 0.7
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
          fullText += chunkText;
          if (onChunk) {
            onChunk(chunkText);
          }
        }
      }

      if (onComplete) {
        onComplete({
          text: fullText,
          model: model || config.defaultModel
        });
      }
    } catch (err) {
      const handled = this.mapGeminiError(err);
      if (onError) {
        onError(handled);
      } else {
        throw handled;
      }
    }
  }

  /**
   * Test an API key by making a lightweight request.
   */
  async testApiKey(apiKey) {
    try {
      const ai = this.getClient(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say "OK" to test API connectivity.',
        config: { maxOutputTokens: 10 }
      });

      return {
        valid: true,
        message: 'Connection to Gemini API successful!',
        sampleResponse: response.text?.trim()
      };
    } catch (err) {
      const handled = this.mapGeminiError(err);
      return {
        valid: false,
        message: handled.message,
        code: handled.code
      };
    }
  }

  /**
   * Helper to map raw Gemini API errors into clean, informative user messages.
   */
  mapGeminiError(err) {
    const errorStr = (err.message || '').toLowerCase();
    let status = 500;
    let message = err.message || 'An error occurred while communicating with Gemini API';
    let code = 'GEMINI_API_ERROR';

    if (errorStr.includes('api_key_missing') || err.code === 'API_KEY_MISSING') {
      status = 401;
      code = 'API_KEY_MISSING';
      message = 'Gemini API key is not configured. Please set your key in backend/.env or in UI Settings.';
    } else if (errorStr.includes('api key not valid') || errorStr.includes('invalid api key') || errorStr.includes('400')) {
      status = 400;
      code = 'INVALID_API_KEY';
      message = 'The provided Gemini API key is invalid. Please verify your key at Google AI Studio (https://aistudio.google.com/app/apikey).';
    } else if (errorStr.includes('quota') || errorStr.includes('resource_exhausted') || errorStr.includes('429')) {
      status = 429;
      code = 'RATE_LIMIT_EXCEEDED';
      message = 'Gemini API rate limit or quota exceeded. Please wait a moment and try again.';
    } else if (errorStr.includes('safety') || errorStr.includes('blocked')) {
      status = 400;
      code = 'CONTENT_BLOCKED';
      message = 'The request was flagged by Gemini content safety filters.';
    } else if (errorStr.includes('not found') || errorStr.includes('404')) {
      status = 404;
      code = 'MODEL_NOT_FOUND';
      message = 'The requested Gemini model was not found or is unavailable for this key.';
    }

    const enhancedError = new Error(message);
    enhancedError.statusCode = status;
    enhancedError.code = code;
    enhancedError.originalError = err.message;
    return enhancedError;
  }

  handleGeminiError(err) {
    throw this.mapGeminiError(err);
  }
}

export const geminiService = new GeminiService();
