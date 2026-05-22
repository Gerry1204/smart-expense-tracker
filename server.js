import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// Proxy API requests to FastAPI backend
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
});

app.use((req, res, next) => {
  if (req.path.startsWith('/transactions') || 
      req.path.startsWith('/stats') || 
      req.path === '/register' || 
      req.path === '/login' ||
      req.path === '/forgot-password' ||
      req.path === '/change-password') {
    return apiProxy(req, res, next);
  }
  next();
});

// Serve static frontend files
const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

// Handle React Router fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running at http://localhost:${PORT}`);
  console.log(`Proxying API requests to ${BACKEND_URL}`);
});
