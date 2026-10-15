import { Router } from 'express';
import { geminiService } from '../services/geminiService.js';
import { supabaseService } from '../services/supabaseService.js';
import { config } from '../config.js';

const router = Router();

/**
 * GET /api/models
 * Returns the list of supported models and active default.
 */
router.get('/models', (req, res) => {
  res.json({
    success: true,
    defaultModel: config.defaultModel,
    models: config.supportedModels
  });
});

/**
 * GET /api/chats
 * Returns list of saved conversations from Supabase if connected.
 */
router.get('/chats', async (req, res) => {
  const chats = await supabaseService.getChats();
  res.json({
    success: true,
    supabaseConnected: supabaseService.isConfigured(),
    chats
  });
});

/**
 * GET /api/chats/:id/messages
 * Returns message history for a conversation from Supabase.
 */
router.get('/chats/:id/messages', async (req, res) => {
  const messages = await supabaseService.getMessages(req.params.id);
  res.json({
    success: true,
    messages
  });
});

/**
 * POST /api/chat
 * Standard (non-streaming) chat endpoint.
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { messages, model, temperature, systemInstruction, chatId } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Request body must include a non-empty "messages" array.'
      });
    }

    const apiKey = req.headers['x-gemini-key'] || null;

    // Asynchronously log to Supabase if configured
    const lastUserMsg = messages[messages.length - 1];
    if (chatId && lastUserMsg && supabaseService.isConfigured()) {
      supabaseService.saveChat(chatId, lastUserMsg.content.slice(0, 40), model || config.defaultModel);
      supabaseService.saveMessage(chatId, lastUserMsg.role || 'user', lastUserMsg.content);
    }

    const result = await geminiService.generateResponse({
      messages,
      model: model || config.defaultModel,
      temperature,
      systemInstruction,
      apiKey
    });

    if (chatId && result.text && supabaseService.isConfigured()) {
      supabaseService.saveMessage(chatId, 'assistant', result.text);
    }

    res.json({
      success: true,
      message: {
        role: 'assistant',
        content: result.text
      },
      model: result.model,
      usage: result.usage,
      savedToSupabase: supabaseService.isConfigured()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat/stream
 * Streaming chat endpoint using Server-Sent Events (SSE).
 */
router.post('/chat/stream', async (req, res) => {
  const { messages, model, temperature, systemInstruction, chatId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Request body must include a non-empty "messages" array.'
    });
  }

  const apiKey = req.headers['x-gemini-key'] || null;

  // Asynchronously log to Supabase if configured
  const lastUserMsg = messages[messages.length - 1];
  if (chatId && lastUserMsg && supabaseService.isConfigured()) {
    supabaseService.saveChat(chatId, lastUserMsg.content.slice(0, 40), model || config.defaultModel);
    supabaseService.saveMessage(chatId, lastUserMsg.role || 'user', lastUserMsg.content);
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await geminiService.streamResponse({
      messages,
      model: model || config.defaultModel,
      temperature,
      systemInstruction,
      apiKey,
      onChunk: (chunk) => {
        sendEvent('chunk', { text: chunk });
      },
      onComplete: (data) => {
        sendEvent('done', data);
        if (chatId && data.text && supabaseService.isConfigured()) {
          supabaseService.saveMessage(chatId, 'assistant', data.text);
        }
        res.end();
      },
      onError: (err) => {
        sendEvent('error', {
          error: err.code || 'STREAM_ERROR',
          message: err.message
        });
        res.end();
      }
    });
  } catch (err) {
    sendEvent('error', {
      error: err.code || 'STREAM_ERROR',
      message: err.message || 'Stream processing failed'
    });
    res.end();
  }
});

export default router;
