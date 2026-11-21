// Generates the PNG app icons (blue rounded square with a white coin ring)
// without any image library: raw scanlines are deflated into PNG chunks.
// Run once with `node scripts/generate-icons.mjs`; the outputs are committed.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'images', 'icons');
mkdirSync(iconsDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function renderPng(size, pixelAt) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0 (None) + RGBA
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      row[1 + x * 4] = r;
      row[2 + x * 4] = g;
      row[3 + x * 4] = b;
      row[4 + x * 4] = a;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const BLUE = [66, 153, 225, 255];
const WHITE = [255, 255, 255, 255];

function iconPixel(size) {
  const corner = size * 0.18;
  const center = size / 2;
  return (x, y) => {
    // Rounded-square mask
    const edgeX = Math.min(x, size - 1 - x);
    const edgeY = Math.min(y, size - 1 - y);
    if (edgeX < corner && edgeY < corner) {
      const dx = corner - edgeX;
      const dy = corner - edgeY;
      if (dx * dx + dy * dy > corner * corner) {
        return [0, 0, 0, 0];
      }
    }
    // White coin ring on the blue background
    const d = Math.hypot(x + 0.5 - center, y + 0.5 - center) / size;
    if (d <= 0.20) return BLUE;
    if (d <= 0.30) return WHITE;
    return BLUE;
  };
}

for (const size of [192, 512]) {
  writeFileSync(join(iconsDir, `icon-${size}.png`), renderPng(size, iconPixel(size)));
  console.log(`Wrote icon-${size}.png`);
}
