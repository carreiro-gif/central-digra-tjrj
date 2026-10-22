import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdr = makeChunk('IHDR', ihdrData);

  // 3. Raw Scanlines (1 filter byte + width * 4 bytes per row)
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);

  // 4. IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel drawing function for TJRJ DIGRA Icon
function drawTJRJIcon(x, y, w, h) {
  // Normalize coordinates 0 to 1
  const nx = x / w;
  const ny = y / h;

  // Corner rounding check (squircle / rounded rect rx=0.22)
  const radius = 0.22;
  const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - radius));
  const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - radius));
  const distCorner = Math.sqrt(dx * dx + dy * dy);

  if (distCorner > radius) {
    return [0, 0, 0, 0]; // Transparent outside rounded corner
  }

  // Inner border distance
  const borderDist = Math.max(
    Math.abs(nx - 0.5) * 2,
    Math.abs(ny - 0.5) * 2
  );

  // Gold border (outer ring between 0.88 and 0.94)
  if (borderDist >= 0.88 && borderDist <= 0.94 && distCorner < radius - 0.02) {
    // Gold shimmer: #D4AF37 to #F5DE7A
    return [229, 190, 74, 255];
  }

  // Background deep TJRJ Navy gradient: #001f48 to #003366
  const grad = ny;
  const bgR = Math.round(0 * (1 - grad) + 0 * grad);
  const bgG = Math.round(31 * (1 - grad) + 51 * grad);
  const bgB = Math.round(72 * (1 - grad) + 102 * grad);

  // Draw Scales of Justice Emblem
  const cx = 0.5;
  const cy = 0.40;

  // Center vertical pole
  if (Math.abs(nx - cx) < 0.025 && ny >= 0.22 && ny <= 0.62) {
    return [240, 205, 95, 255];
  }

  // Center circle top
  const distPoleTop = Math.hypot(nx - cx, ny - 0.20);
  if (distPoleTop < 0.04) {
    return [255, 225, 120, 255];
  }

  // Horizontal balance beam
  if (ny >= 0.28 && ny <= 0.31 && Math.abs(nx - cx) <= 0.32) {
    return [240, 205, 95, 255];
  }

  // Left pan strings & dish
  const leftX = 0.22;
  if ((Math.abs((nx - leftX) - (ny - 0.30) * 0.3) < 0.015 || Math.abs((nx - leftX) + (ny - 0.30) * 0.3) < 0.015) && ny >= 0.30 && ny <= 0.46) {
    return [229, 190, 74, 255];
  }
  if (Math.hypot((nx - leftX) / 0.12, (ny - 0.46) / 0.04) <= 1 && ny >= 0.46) {
    return [240, 205, 95, 255];
  }

  // Right pan strings & dish
  const rightX = 0.78;
  if ((Math.abs((nx - rightX) - (ny - 0.30) * 0.3) < 0.015 || Math.abs((nx - rightX) + (ny - 0.30) * 0.3) < 0.015) && ny >= 0.30 && ny <= 0.46) {
    return [229, 190, 74, 255];
  }
  if (Math.hypot((nx - rightX) / 0.12, (ny - 0.46) / 0.04) <= 1 && ny >= 0.46) {
    return [240, 205, 95, 255];
  }

  // Base stand
  if (Math.abs(nx - cx) <= 0.18 && ny >= 0.62 && ny <= 0.66) {
    return [229, 190, 74, 255];
  }

  // Bottom text banner: "DIGRA" box
  if (ny >= 0.72 && ny <= 0.88 && Math.abs(nx - cx) <= 0.38) {
    // Inner box
    if (Math.abs(nx - cx) >= 0.36 || ny <= 0.735 || ny >= 0.865) {
      return [229, 190, 74, 255]; // Gold outline
    }
    // Inside badge: dark navy with gold highlight
    return [0, 22, 54, 255];
  }

  return [bgR, bgG, bgB, 255];
}

// Generate files in ./public
import path from 'path';
const pubDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

console.log('Generating public/icon-512.png...');
const p512 = createPNG(512, 512, drawTJRJIcon);
fs.writeFileSync(path.join(pubDir, 'icon-512.png'), p512);

console.log('Generating public/icon-192.png...');
const p192 = createPNG(192, 192, drawTJRJIcon);
fs.writeFileSync(path.join(pubDir, 'icon-192.png'), p192);

console.log('Generating public/apple-touch-icon.png...');
const p180 = createPNG(180, 180, drawTJRJIcon);
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), p180);

// Simple favicon.ico using 32x32 PNG embed in standard ICO container
const p32 = createPNG(32, 32, drawTJRJIcon);
fs.writeFileSync(path.join(pubDir, 'favicon.png'), p32);

// ICO header (6 bytes) + Directory entry (16 bytes) + PNG data
const icoHeader = Buffer.from([
  0, 0, // reserved
  1, 0, // ICO type
  1, 0  // 1 image
]);
const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(32, 0); // width
icoEntry.writeUInt8(32, 1); // height
icoEntry.writeUInt8(0, 2);  // color palette
icoEntry.writeUInt8(0, 3);  // reserved
icoEntry.writeUInt16LE(1, 4); // color planes
icoEntry.writeUInt16LE(32, 6); // bpp
icoEntry.writeUInt32LE(p32.length, 8); // size of image
icoEntry.writeUInt32LE(22, 12); // offset (6 + 16)

fs.writeFileSync(path.join(pubDir, 'favicon.ico'), Buffer.concat([icoHeader, icoEntry, p32]));

console.log('Successfully generated all icon assets in public directory!');
