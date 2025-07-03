import express from "express";
import { createServer } from "http";
import { setupRoutes } from "./routes.js";
import path from "path";

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;

// Vercel için özel middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Build edilmiş client dosyalarını serve et
const publicPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'dist')
  : path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// API rotalarını ayarla
setupRoutes(app);

// Client için fallback
app.get('*', (req, res) => {
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.resolve(publicPath, 'index.html')
    : path.resolve(publicPath, 'index.html');
  res.sendFile(indexPath);
});

// Development için server başlat
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Vercel için export
export default app;
