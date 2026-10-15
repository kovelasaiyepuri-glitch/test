import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BACKEND_URL = 'http://localhost:5000';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to parse frontend/.env
function getFrontendEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    BACKEND_API_URL: BACKEND_URL
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        env[key] = val;
      }
    }
  }
  return env;
}

const server = http.createServer((req, res) => {
  // 1. Dynamic /env.js route
  if (req.url === '/env.js') {
    const env = getFrontendEnv();
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.end(`window.__ENV__ = ${JSON.stringify(env)};`);
  }

  // 2. Proxy API calls to backend (port 5000)
  if (req.url.startsWith('/api/')) {
    const backendReq = http.request(
      `${BACKEND_URL}${req.url}`,
      {
        method: req.method,
        headers: req.headers
      },
      (backendRes) => {
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res);
      }
    );

    backendReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend server unreachable at ' + BACKEND_URL, details: err.message }));
    });

    return req.pipe(backendReq);
  }

  // 3. Serve static files
  let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('File not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log(`🎨 Gemini Chatbot Frontend Dev Server`);
  console.log(`🌐 Running on: http://localhost:${PORT}`);
  console.log(`🔗 Proxying /api to Backend: ${BACKEND_URL}`);
  console.log('=======================================================');
});
