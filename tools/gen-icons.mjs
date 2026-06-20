// Generate SplitLane PWA icons as PNGs — pure Node (zlib only, no deps).
// Motif: deep-pool navy background + three lane "split" bars (red/amber/aqua),
// left-aligned like a start wall. Content stays inside the maskable safe zone.
//
//   node tools/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../docs/app/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const NAVY  = [8, 22, 35];     // --bg #081623
const LANES = [[255,77,109],[255,176,32],[25,227,198]]; // lane-1 / lane-2 / lane-3

// ---- tiny PNG encoder (RGBA, 8-bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, colour type 6 (RGBA)
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// capsule (rounded-end horizontal bar) coverage at pixel centre, with AA
function capsule(px, py, x0, x1, cy, h) {
  const r = h / 2;
  const ax = x0 + r, bx = x1 - r;            // cap centres
  let d;                                       // distance to capsule spine
  if (px < ax)      d = Math.hypot(px - ax, py - cy);
  else if (px > bx) d = Math.hypot(px - bx, py - cy);
  else              d = Math.abs(py - cy);
  return Math.max(0, Math.min(1, r + 0.5 - d)); // ~1px anti-aliased edge
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const left = 0.21 * size, innerW = 0.58 * size;
  const h = 0.118 * size, gap = 0.072 * size;
  const blockH = 3 * h + 2 * gap, top = (size - blockH) / 2;
  const lens = [0.72, 0.52, 0.93];             // varied lengths -> dynamic
  const bars = lens.map((f, i) => ({
    x0: left, x1: left + innerW * f,
    cy: top + h / 2 + i * (h + gap), col: LANES[i],
  }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x + 0.5, py = y + 0.5;
    let r = NAVY[0], g = NAVY[1], b = NAVY[2];
    for (const bar of bars) {
      const a = capsule(px, py, bar.x0, bar.x1, bar.cy, h);
      if (a > 0) { r = r + (bar.col[0]-r)*a; g = g + (bar.col[1]-g)*a; b = b + (bar.col[2]-b)*a; }
    }
    const o = (y * size + x) * 4;
    buf[o] = Math.round(r); buf[o+1] = Math.round(g); buf[o+2] = Math.round(b); buf[o+3] = 255;
  }
  return buf;
}

for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, OUT), encodePNG(size, draw(size)));
  console.log('wrote icon-' + size + '.png');
}
// maskable = same art (already within the safe zone) at 512
writeFileSync(new URL('icon-maskable-512.png', OUT), encodePNG(512, draw(512)));
console.log('wrote icon-maskable-512.png');
