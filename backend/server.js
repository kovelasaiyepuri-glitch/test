import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import chatRoutes from './routes/chat.js';
import healthRoutes from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware: Enable CORS for cross-origin requests from any frontend port
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key']
}));

// Middleware: Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Request logging middleware for backend visibility
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Backend] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve dynamic frontend env.js file directly from root
app.get('/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(`window.__ENV__ = ${JSON.stringify(config.publicConfig)};`);
});

// API Routes
app.use('/api', healthRoutes);
app.use('/api', chatRoutes);

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback route for SPA: serve frontend index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/env.js') {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Backend Error]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred on the backend server.'
  });
});

// Start Server
app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🤖 Gemini Chatbot Backend running on http://localhost:${config.port}`);
  console.log(`🔑 Gemini Key Status: ${config.geminiApiKey ? 'Configured ✅' : 'Missing (Set in .env or via Web UI) ⚠️'}`);
  console.log(`⚡ Supabase Status: ${config.supabaseUrl ? 'URL Present' : 'Not Configured ⚠️'}`);
  console.log(`🎯 Default Model: ${config.defaultModel}`);
  console.log(`🌐 Frontend accessible at: http://localhost:${config.port}`);
  console.log(`=======================================================`);
});
