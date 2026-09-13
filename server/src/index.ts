import express from 'express';
import http from 'http';
import https from 'https';
import net from 'net';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { initDb } from './db';
import { setupSocketIO } from './socket';
import roomsRouter from './routes/rooms';
import framesRouter from './routes/frames';
import { cleanupExpiredRooms } from './services/roomService';
import { UPLOADS_DIR, RENDERS_DIR } from './services/compositeService';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

const app = express();

// Anti-Hacker Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", 'data:', 'blob:', '*'],
      mediaSrc: ["'self'", 'blob:', 'data:'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:', 'http:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  xFrameOptions: { action: 'deny' },
}));

// Global API rate limiter (protects against DDoS, scraping, and brute-force)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan dari IP ini, silakan coba beberapa saat lagi.' },
});
app.use('/api/', apiLimiter);

// Strict rate limiter for room creation
const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Batas pembuatan room tercapai. Silakan coba 15 menit lagi.' },
});

// Normalize /socket.io paths so stripped trailing slashes never 404
app.use((req, _res, next) => {
  if (req.path === '/socket.io') {
    req.url = req.url.replace('/socket.io', '/socket.io/');
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

[UPLOADS_DIR, RENDERS_DIR].forEach((dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// Serve static photos & renders with security options (no directory index, strictly cached)
app.use('/uploads', express.static(UPLOADS_DIR, { dotfiles: 'ignore', index: false }));
app.use('/renders', express.static(RENDERS_DIR, { dotfiles: 'ignore', index: false }));

app.use('/api/rooms', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') {
    return createRoomLimiter(req, res, next);
  }
  next();
}, roomsRouter);

app.use('/api/frames', framesRouter);
app.get('/health', (req, res) => {
  const isEncrypted = 'encrypted' in req.socket && Boolean((req.socket as import('tls').TLSSocket).encrypted);
  res.json({ status: 'ok', protocol: isEncrypted ? 'https' : 'http', ts: Date.now() });
});

// Certificate discovery for HTTPS support in dev and production
function findCertificates(): { cert: string; key: string } | null {
  const candidates = [
    {
      cert: path.resolve(__dirname, '../../client/certificates/localhost.pem'),
      key: path.resolve(__dirname, '../../client/certificates/localhost-key.pem'),
    },
    {
      cert: path.resolve(process.cwd(), '../client/certificates/localhost.pem'),
      key: path.resolve(process.cwd(), '../client/certificates/localhost-key.pem'),
    },
    {
      cert: path.resolve(process.cwd(), 'client/certificates/localhost.pem'),
      key: path.resolve(process.cwd(), 'client/certificates/localhost-key.pem'),
    },
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand.cert) && fs.existsSync(cand.key)) {
      return cand;
    }
  }
  return null;
}

const certs = findCertificates();
const httpServer = http.createServer(app);
let httpsServer: https.Server | null = null;

if (certs && process.env.HTTPS !== 'false') {
  try {
    httpsServer = https.createServer({
      cert: fs.readFileSync(certs.cert),
      key: fs.readFileSync(certs.key),
    }, app);
    console.log('[Security] Loaded SSL/TLS certificates for HTTPS support');
  } catch (err) {
    console.warn('[Security] Could not initialize HTTPS server with certificates:', err);
  }
}

const io = new Server({
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 20e6,
});

io.attach(httpServer);
if (httpsServer) {
  io.attach(httpsServer);
}

app.set('io', io);
setupSocketIO(io, SERVER_URL);

setInterval(async () => {
  const cleaned = await cleanupExpiredRooms();
  if (cleaned > 0) console.log(`[Privacy Cleanup] Successfully purged ${cleaned} expired room(s) and associated photo files`);
}, 5 * 60 * 1000);

async function main() {
  await initDb();
  const initialCleaned = await cleanupExpiredRooms();
  if (initialCleaned > 0) console.log(`[Startup Cleanup] Purged ${initialCleaned} expired room(s) and photo files`);

  if (httpsServer) {
    // Dual protocol dispatcher: seamlessly handles both HTTP and HTTPS/WSS on the same port
    const netServer = net.createServer((socket) => {
      socket.once('data', (buffer) => {
        // 0x16 is TLS ClientHello record type
        const isTls = buffer[0] === 22;
        socket.pause();
        socket.unshift(buffer);
        if (isTls && httpsServer) {
          httpsServer.emit('connection', socket);
        } else {
          httpServer.emit('connection', socket);
        }
        process.nextTick(() => socket.resume());
      });
    });

    netServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎞️  Synced Photobooth Server`);
      console.log(`   HTTP  → http://0.0.0.0:${PORT}`);
      console.log(`   HTTPS → https://0.0.0.0:${PORT}`);
      console.log(`   WS    → ws://0.0.0.0:${PORT}`);
      console.log(`   WSS   → wss://0.0.0.0:${PORT}\n`);
    });
  } else {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎞️  Synced Photobooth Server`);
      console.log(`   HTTP  → http://0.0.0.0:${PORT}`);
      console.log(`   WS    → ws://0.0.0.0:${PORT}\n`);
    });
  }
}

main().catch(console.error);

export default app;
