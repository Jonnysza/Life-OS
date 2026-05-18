import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import zlib from "node:zlib";

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixels(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function gradientPixel(x, y, size, opts = {}) {
  const inset = opts.inset ?? 0;
  if (x < inset || y < inset || x >= size - inset || y >= size - inset) {
    return [0, 0, 0, 0];
  }
  const t = (x + y) / (2 * size);
  const r = lerp(0x8b, 0x63, t);
  const g = lerp(0x5c, 0x66, t);
  const b = lerp(0xf6, 0xf1, t);
  return [r, g, b, 255];
}

function drawL(buf, size, padding) {
  const strokeW = Math.floor(size * 0.16);
  const xL = Math.floor(size * 0.32);
  const yT = Math.floor(size * 0.26);
  const yB = size - Math.floor(size * 0.26);
  const xR = size - Math.floor(size * 0.26);
  for (let y = yT; y < yB; y++) {
    for (let x = xL; x < xL + strokeW; x++) {
      const o = (y * size + x) * 4;
      buf[o] = 255;
      buf[o + 1] = 255;
      buf[o + 2] = 255;
      buf[o + 3] = 255;
    }
  }
  for (let y = yB - strokeW; y < yB; y++) {
    for (let x = xL; x < xR; x++) {
      const o = (y * size + x) * 4;
      buf[o] = 255;
      buf[o + 1] = 255;
      buf[o + 2] = 255;
      buf[o + 3] = 255;
    }
  }
}

function makeIcon(size, opts = {}) {
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = gradientPixel(x, y, size, opts);
      const o = (y * size + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = a;
    }
  }
  drawL(buf, size, opts.inset ?? 0);

  // Encode the pre-rendered buf as PNG
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * 4 + 1) + 1 + x * 4;
      raw[dst] = buf[src];
      raw[dst + 1] = buf[src + 1];
      raw[dst + 2] = buf[src + 2];
      raw[dst + 3] = buf[src + 3];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = "public";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "icon-192.png"), makeIcon(192));
writeFileSync(join(outDir, "icon-512.png"), makeIcon(512));
writeFileSync(join(outDir, "icon-maskable.png"), makeIcon(512, { inset: 64 }));
writeFileSync(join(outDir, "apple-touch-icon.png"), makeIcon(180));
console.log("✓ icons generated");
