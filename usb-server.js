import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(__dirname, args.dir || 'dist');
const port = Number(args.port || 4173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) parsed.port = argv[i + 1];
    if (arg === '--dir' && argv[i + 1]) parsed.dir = argv[i + 1];
  }
  return parsed;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function safeJoin(base, target) {
  const targetPath = path.normalize(target).replace(/^([.][./\\])+/, '');
  return path.join(base, targetPath);
}

function sendFile(res, filePath, statusCode = 200) {
  const mime = getMimeType(filePath);
  const cacheable = !mime.startsWith('text/html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(statusCode, {
      'Content-Type': mime,
      'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

function serve(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const requestUrl = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = safeJoin(rootDir, pathname);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr) => {
        if (!indexErr) {
          sendFile(res, indexPath);
          return;
        }
        sendNotFound(req, res);
      });
      return;
    }

    if (!err && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    if (!path.extname(pathname)) {
      const fallback = path.join(rootDir, 'index.html');
      fs.stat(fallback, (fallbackErr) => {
        if (!fallbackErr) {
          sendFile(res, fallback);
          return;
        }
        sendNotFound(req, res);
      });
      return;
    }

    sendNotFound(req, res);
  });
}

function sendNotFound(req, res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Not Found: ${req.url}`);
}

const server = http.createServer(serve);
server.listen(port, () => {
  console.log(`Serving ${rootDir} on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
