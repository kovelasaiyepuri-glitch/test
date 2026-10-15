import { Router } from 'express';
import { config } from '../config.js';
import { geminiService } from '../services/geminiService.js';
import { supabaseService } from '../services/supabaseService.js';

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Returns backend service status, Gemini status, and Supabase status.
 */
router.get('/health', (req, res) => {
  const hasGeminiKey = Boolean(config.geminiApiKey && config.geminiApiKey.length > 5);
  const maskedGeminiKey = hasGeminiKey
    ? `${config.geminiApiKey.substring(0, 4)}...${config.geminiApiKey.substring(config.geminiApiKey.length - 4)}`
    : null;

  const hasSupabase = supabaseService.isConfigured();
  const maskedSupabaseKey = config.supabaseAnonKey
    ? `${config.supabaseAnonKey.substring(0, 5)}...${config.supabaseAnonKey.substring(config.supabaseAnonKey.length - 4)}`
    : null;

  res.json({
    status: 'online',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    geminiConfigured: hasGeminiKey,
    maskedGeminiKey,
    supabaseConfigured: hasSupabase,
    supabaseUrl: config.supabaseUrl || null,
    maskedSupabaseKey,
    defaultModel: config.defaultModel
  });
});

/**
 * GET /api/config/public
 * Returns public configuration safe for the frontend browser.
 */
router.get('/config/public', (req, res) => {
  res.json({
    success: true,
    ...config.publicConfig
  });
});

/**
 * GET /env.js
 * Serves public frontend configuration dynamically as an executable JavaScript variable.
 */
router.get('/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const safeEnv = JSON.stringify(config.publicConfig);
  res.send(`window.__ENV__ = ${safeEnv};`);
});

/**
 * GET /api/supabase/status
 * Returns Supabase status and connectivity information.
 */
router.get('/supabase/status', async (req, res) => {
  const isConfigured = supabaseService.isConfigured();
  res.json({
    configured: isConfigured,
    url: config.supabaseUrl || null,
    hasAnonKey: Boolean(config.supabaseAnonKey),
    hasServiceRoleKey: Boolean(config.supabaseServiceRoleKey)
  });
});

/**
 * POST /api/supabase/test
 * Tests the connection to Supabase database.
 */
router.post('/supabase/test', async (req, res) => {
  const { url, key } = req.body || {};
  if (url || key) {
    config.setSupabaseConfig({
      url,
      anonKey: key,
      serviceRoleKey: req.body.serviceRoleKey
    });
  }

  const result = await supabaseService.testConnection();
  res.json(result);
});

/**
 * POST /api/config/test
 * Tests if a provided Gemini API key is valid.
 */
router.post('/config/test', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyToTest = apiKey || config.geminiApiKey;

    if (!keyToTest) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'No Gemini API key provided to test.'
      });
    }

    const testResult = await geminiService.testApiKey(keyToTest);
    res.json({
      success: testResult.valid,
      ...testResult
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      valid: false,
      message: err.message || 'Error testing Gemini API key'
    });
  }
});

/**
 * POST /api/config/key
 * Saves or updates the Gemini API key in backend memory.
 */
router.post('/config/key', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Invalid API key format.'
    });
  }

  const testResult = await geminiService.testApiKey(apiKey);
  if (!testResult.valid) {
    return res.status(400).json({
      success: false,
      message: `Key validation failed: ${testResult.message}`
    });
  }

  config.setApiKey(apiKey);

  res.json({
    success: true,
    message: 'Gemini API key successfully validated and configured in backend!',
    geminiConfigured: true,
    maskedKey: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
  });
});

export default router;
