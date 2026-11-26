import express, { type Request, type Response } from 'express';
import zlib from 'node:zlib';

export const pwaThemeRouter = express.Router();

const pngCache = new Map<string, Buffer>();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function normalizeHexColor(raw: unknown): string {
  if (typeof raw !== 'string') return 'FF5722';
  const cleaned = raw.trim().replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : 'FF5722';
}

function parseRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function isInsideLetterN(x512: number, y512: number): boolean {
  if (y512 < 96 || y512 > 416) return false;
  if (x512 >= 120 && x512 <= 200) return true;
  if (x512 >= 312 && x512 <= 392) return true;
  if (x512 > 200 && x512 < 312) {
    const t = (x512 - 200) / 112;
    const yTop = 96 + t * 240;
    const yBot = 176 + t * 240;
    return y512 >= yTop && y512 <= yBot;
  }
  return false;
}

export function renderThemeLogoPng(hexColor: string, size: number, maskable = false): Buffer {
  const cacheKey = `${hexColor}:${size}:${maskable ? 1 : 0}`;
  const cached = pngCache.get(cacheKey);
  if (cached) return cached;

  const [bgR, bgG, bgB] = parseRgb(hexColor);
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(stride * size);
  const scale = maskable ? 0.78 : 1;
  const subOffsets = [0.25, 0.75];

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (const sy of subOffsets) {
        const ny = ((((y + sy) / size) * 512 - 256) / scale) + 256;
        for (const sx of subOffsets) {
          const nx = ((((x + sx) / size) * 512 - 256) / scale) + 256;
          if (isInsideLetterN(nx, ny)) hits++;
        }
      }
      const alpha = hits / 4;
      const px = rowStart + 1 + x * 3;
      raw[px] = Math.round(bgR + (255 - bgR) * alpha);
      raw[px + 1] = Math.round(bgG + (255 - bgG) * alpha);
      raw[px + 2] = Math.round(bgB + (255 - bgB) * alpha);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 6 });
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  if (pngCache.size > 80) {
    pngCache.clear();
  }
  pngCache.set(cacheKey, png);
  return png;
}

pwaThemeRouter.get('/api/pwa/icon.png', (req: Request, res: Response) => {
  const hex = normalizeHexColor(req.query.color);
  const rawSize = Number(req.query.size);
  const size = rawSize === 512 ? 512 : rawSize === 180 ? 180 : 192;
  const maskable = req.query.maskable === '1' || req.query.maskable === 'true';

  const buffer = renderThemeLogoPng(hex, size, maskable);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buffer);
});

pwaThemeRouter.get('/api/pwa/manifest.webmanifest', (req: Request, res: Response) => {
  const hex = normalizeHexColor(req.query.color);
  const isDark = req.query.dark === '1' || req.query.dark === 'true';
  const themeColor = `#${hex}`;
  const backgroundColor = isDark ? '#0a0a0a' : '#ffffff';

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    id: '/',
    name: 'News Reader',
    short_name: 'News Reader',
    description: 'Lettore rss installabile con lettura offline',
    theme_color: themeColor,
    background_color: backgroundColor,
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: `/api/pwa/icon.png?color=${hex}&size=192`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/pwa/icon.png?color=${hex}&size=512`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/pwa/icon.png?color=${hex}&size=512&maskable=1`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  });
});
