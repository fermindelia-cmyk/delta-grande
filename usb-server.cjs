const http = require('http');
const fs = require('fs');
const path = require('path');

// __dirname and __filename are provided by CommonJS

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

function sendFile(req, res, filePath) {
  const mime = getMimeType(filePath);
  const cacheable = !mime.startsWith('text/html');

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const fileSize = stats.size;
    const range = req.headers.range;

    // Headers comunes
    const headers = {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes'
    };

    if (cacheable) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': 'text/plain; charset=utf-8'
        });
        res.end('Requested Range Not Satisfiable');
        return;
      }

      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      headers['Content-Length'] = chunksize;
      
      res.writeHead(206, headers);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', (streamErr) => {
        console.error('Stream error:', streamErr);
        res.end();
      });
      res.on('close', () => {
        stream.destroy();
      });
      stream.pipe(res);
    } else {
      headers['Content-Length'] = fileSize;
      res.writeHead(200, headers);
      
      const stream = fs.createReadStream(filePath);
      stream.on('error', (streamErr) => {
        console.error('Stream error:', streamErr);
        res.end();
      });
      res.on('close', () => {
        stream.destroy();
      });
      stream.pipe(res);
    }
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
          sendFile(req, res, indexPath);
          return;
        }
        sendNotFound(req, res);
      });
      return;
    }

    if (err) {
      sendNotFound(req, res);
      return;
    }

    sendFile(req, res, filePath);
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
