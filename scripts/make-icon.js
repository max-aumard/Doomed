// Generates the 1024x1024 app icon (RGB, no alpha — App Store requirement).
// Usage: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const BG = [17, 17, 20];
const FG = [236, 72, 72];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// "No entry" sign over a phone-shaped rounded rectangle.
const c = SIZE / 2;
const ringOuter = 400;
const ringInner = 330;
const barHalf = 36;
function coverage(x, y) {
  const dx = x - c;
  const dy = y - c;
  const r = Math.hypot(dx, dy);
  const ring = r <= ringOuter && r >= ringInner;
  // diagonal bar from top-left to bottom-right, inside the ring
  const distToDiag = Math.abs(dx - dy) / Math.SQRT2;
  const bar = r < ringInner && distToDiag <= barHalf;
  if (ring || bar) return 'fg';
  // phone outline
  const pw = 150, ph = 250, pr = 40, stroke = 24;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const inside = (w, h, rad) => {
    if (ax > w || ay > h) return false;
    const qx = ax - (w - rad), qy = ay - (h - rad);
    return qx <= 0 || qy <= 0 || Math.hypot(qx, qy) <= rad;
  };
  if (inside(pw, ph, pr) && !inside(pw - stroke, ph - stroke, pr - stroke)) return 'phone';
  return 'bg';
}

const SS = 3; // supersampling for smooth edges
const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 3 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const k = coverage(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        const col = k === 'fg' ? FG : k === 'phone' ? [200, 200, 210] : BG;
        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
      }
    }
    const o = y * (SIZE * 3 + 1) + 1 + x * 3;
    raw[o] = Math.round(acc[0] / (SS * SS));
    raw[o + 1] = Math.round(acc[1] / (SS * SS));
    raw[o + 2] = Math.round(acc[2] / (SS * SS));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const dir = path.join(__dirname, '..', 'Doomed', 'Assets.xcassets', 'AppIcon.appiconset');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon.png'), png);
fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({
  images: [{ filename: 'icon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');
fs.writeFileSync(path.join(dir, '..', 'Contents.json'), JSON.stringify({
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');
console.log('icon written to', dir);
