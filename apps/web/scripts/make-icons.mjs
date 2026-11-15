// Generates the PWA icons (eye inside a shield) as PNGs without image tools.
// Usage: node apps/web/scripts/make-icons.mjs   → apps/web/public/icons/*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [5, 7, 11];
const SURFACE = [11, 16, 24];
const BRAND = [61, 224, 255];

// Shield outline in a 32-unit box (matches favicon.svg), bottom curves sampled.
function shieldPolygon() {
  const pts = [
    [16, 2.5],
    [27.5, 6.8],
    [27.5, 15.2],
  ];
  // quadratic-ish curve from (27.5,15.2) to (16,29.5) and back up to (4.5,15.2)
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push([27.5 - 11.5 * t ** 1.6, 15.2 + 14.3 * Math.sin((t * Math.PI) / 2)]);
  }
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push([16 - 11.5 * (1 - (1 - t) ** 1.6), 29.5 - 14.3 * (1 - Math.cos((t * Math.PI) / 2))]);
  }
  pts.push([4.5, 6.8]);
  return pts;
}

const SHIELD = shieldPolygon();

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPoly(x, y, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j];
    const [x2, y2] = poly[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return best;
}

/** Colour at a point of the 32-unit logo, or null for background. */
function logoAt(x, y) {
  const stroke = 1.0;
  const inside = inPoly(x, y, SHIELD);
  const edge = distToPoly(x, y, SHIELD);
  if (edge <= stroke) return BRAND;
  if (!inside) return null;
  // eye: almond ring + pupil
  const ex = (x - 16) / 7.4;
  const ey = (y - 16) / 5;
  const r = Math.hypot(ex, ey);
  if (Math.hypot(x - 16, y - 16) <= 2.4) return BRAND;
  if (r <= 1 && r >= 0.78) return BRAND;
  return SURFACE;
}

function render(size, { padding = 0.1, maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const pad = size * (maskable ? 0.2 : padding);
  const scale = (size - pad * 2) / 32;
  const SS = 3; // 3×3 supersampling
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const lx = (pxl + (sx + 0.5) / SS - pad) / scale;
          const ly = (py + (sy + 0.5) / SS - pad) / scale;
          // opaque everywhere: install icons get the app background behind the logo
          const c = logoAt(lx, ly) ?? BG;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 255;
        }
      }
      const n = SS * SS;
      const o = (py * size + pxl) * 4;
      px[o] = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
      px[o + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const files = {
  'icon-192.png': render(192),
  'icon-512.png': render(512),
  'icon-maskable-512.png': render(512, { maskable: true }),
  'apple-touch-icon.png': render(180),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, buf.length, 'bytes');
}
