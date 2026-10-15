/**
 * ============================================================================
 * FRONTEND API SERVICE LAYER
 * ============================================================================
 * ARCHITECTURAL ROLE:
 * This module is part of the FRONTEND client.
 * Notice: It NEVER calls Google's Gemini servers directly, and it NEVER stores
 * or exposes raw Gemini API keys or Supabase Service Role keys.
 *
 * All requests are routed to our dedicated BACKEND (/api/chat, /api/health).
 * The Backend is solely responsible for authenticating with Google Gemini,
 * maintaining security boundaries, and streaming tokens back to the browser.
 * ============================================================================
 */

export class ChatApi {
  constructor(baseUrl = '') {
    if (!baseUrl && window.location.port !== '5000' && window.location.protocol.startsWith('http')) {
      this.baseUrl = 'http://localhost:5000';
    } else {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * Check backend health, Gemini status, and Supabase connectivity.
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Backend health check failed with status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('[Frontend API] Health check error:', err);
      return {
        status: 'offline',
        geminiConfigured: false,
        supabaseConfigured: false,
        error: err.message
      };
    }
  }

  /**
   * Fetch available models from backend.
   */
  async getModels() {
    const response = await fetch(`${this.baseUrl}/api/models`);
    if (!response.ok) {
      throw new Error('Failed to retrieve model list from backend');
    }
    return await response.json();
  }

  /**
   * Test an API key via backend verification endpoint.
   */
  async testApiKey(apiKey) {
    const response = await fetch(`${this.baseUrl}/api/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    return await response.json();
  }

  /**
   * Save / set an API key on the backend.
   */
  async saveApiKey(apiKey) {
    const response = await fetch(`${this.baseUrl}/api/config/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    return await response.json();
  }

  /**
   * Send a standard (non-streaming) chat request to the backend.
   */
  async sendMessage({ messages, model, temperature, systemInstruction, customApiKey, chatId }) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (customApiKey) {
      headers['x-gemini-key'] = customApiKey;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        model,
        temperature,
        systemInstruction,
        chatId
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Chat request failed with status ${response.status}`);
    }

    return data;
  }

  /**
   * Stream chat response tokens from backend using Server-Sent Events (SSE).
   */
  async streamMessage({
    messages,
    model,
    temperature,
    systemInstruction,
    customApiKey,
    chatId,
    onChunk,
    onComplete,
    onError,
    signal
  }) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (customApiKey) {
      headers['x-gemini-key'] = customApiKey;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          model,
          temperature,
          systemInstruction,
          chatId
        }),
        signal
      });

      if (!response.ok) {
        let errMessage = `Streaming request failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.message) errMessage = errData.message;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = 'message';
          let eventData = '';

          const blockLines = block.split('\n');
          for (const line of blockLines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventType === 'chunk' && onChunk) {
                onChunk(parsed.text);
              } else if (eventType === 'done' && onComplete) {
                onComplete(parsed);
              } else if (eventType === 'error') {
                if (onError) onError(new Error(parsed.message || 'Stream error'));
                return;
              }
            } catch (err) {
              console.warn('[Frontend API] SSE parse error:', err, eventData);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[Frontend API] Streaming was stopped by user.');
        return;
      }
      if (onError) onError(err);
      else throw err;
    }
  }
}

export const api = new ChatApi();
