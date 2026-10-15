/**
 * Minimal, dependency-free PNG encoder + 5×7 bitmap font.
 *
 * Used by the demo seed to synthesize a realistic "phishing email" screenshot
 * without pulling in a native image library (which would bloat the 2 vCPU /
 * 4 GB target box). Produces a true 8-bit RGBA PNG via Node's zlib.
 */

import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Encode an RGBA buffer (width × height × 4) as a PNG. */
export function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
};

/** Tiny immediate-mode RGBA canvas. */
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 255);
  }

  setPixel(x, y, [r, g, b, a = 255]) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  fill(color) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) this.setPixel(x, y, color);
    }
  }

  fillRect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) this.setPixel(xx, yy, color);
    }
  }

  roundRect(x, y, w, h, radius, color) {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        const dx = Math.min(xx, w - 1 - xx);
        const dy = Math.min(yy, h - 1 - yy);
        if (dx < radius && dy < radius) {
          const cx = radius - dx;
          const cy = radius - dy;
          if (cx * cx + cy * cy > radius * radius) continue;
        }
        this.setPixel(x + xx, y + yy, color);
      }
    }
  }

  /** Draw uppercase text using the 5×7 font. Returns the advance width. */
  text(x, y, value, color, { scale = 2, tracking = 1 } = {}) {
    let cursor = x;
    const advance = (5 + tracking) * scale;
    for (const raw of String(value).toUpperCase()) {
      const glyph = FONT[raw] ?? FONT["?"];
      for (let gy = 0; gy < 7; gy += 1) {
        const row = glyph[gy];
        for (let gx = 0; gx < 5; gx += 1) {
          if (row[gx] !== "1") continue;
          this.fillRect(cursor + gx * scale, y + gy * scale, scale, scale, color);
        }
      }
      cursor += advance;
    }
    return cursor - x;
  }

  /** Width in pixels of a text run at the given scale. */
  measure(value, { scale = 2, tracking = 1 } = {}) {
    return String(value).length * (5 + tracking) * scale - tracking * scale;
  }

  toPng() {
    return encodePng(this.width, this.height, this.data);
  }
}

const hex = (value) => {
  const n = parseInt(value.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
};

/**
 * Render a fictitious phishing email screenshot (1200×800) with clear red flags:
 * a mismatched `.ru` look-alike sender domain, urgency and a deceptive button.
 */
export function renderPhishingEmail() {
  const canvas = new Canvas(1200, 800);
  canvas.fill(hex("#eef2f7"));

  // Mail-client window.
  const winX = 60;
  const winY = 50;
  const winW = 1080;
  const winH = 700;
  canvas.roundRect(winX, winY, winW, winH, 18, hex("#ffffff"));
  canvas.roundRect(winX, winY, winW, 64, 18, hex("#1f2937"));
  canvas.fillRect(winX, winY + 40, winW, 24, hex("#1f2937"));
  canvas.text(winX + 32, winY + 22, "BANDEJA DE ENTRADA", hex("#f9fafb"), { scale: 2 });

  // Three coloured window dots.
  canvas.roundRect(winX + winW - 90, winY + 24, 16, 16, 8, hex("#ef4444"));
  canvas.roundRect(winX + winW - 64, winY + 24, 16, 16, 8, hex("#f59e0b"));
  canvas.roundRect(winX + winW - 38, winY + 24, 16, 16, 8, hex("#22c55e"));

  // Subject line — urgency red flag.
  canvas.text(winX + 40, winY + 110, "URGENTE: VERIFICA TU CUENTA AHORA", hex("#dc2626"), { scale: 3 });

  // From / sender — mismatched look-alike domain highlighted.
  const fromY = winY + 190;
  canvas.text(winX + 40, fromY, "DE:", hex("#475569"), { scale: 2 });
  const prefixWidth = canvas.measure("DE: SOPORTE@", { scale: 2 });
  canvas.text(winX + 40, fromY, "DE: SOPORTE@", hex("#475569"), { scale: 2 });
  canvas.text(winX + 40 + prefixWidth, fromY, "SECUREBANK-VERIFY.RU", hex("#dc2626"), { scale: 2 });

  // A subtle "reply-to differs" line.
  canvas.text(winX + 40, fromY + 44, "RESPONDER A: AYUDA@MAIL-SEGURO.INFO", hex("#94a3b8"), { scale: 2 });

  // Body placeholder lines (implying paragraphs).
  const bodyX = winX + 40;
  let bodyY = winY + 300;
  const lines = [640, 720, 560, 680, 420];
  for (const width of lines) {
    canvas.roundRect(bodyX, bodyY, width, 14, 6, hex("#cbd5e1"));
    bodyY += 34;
  }

  // Deceptive call-to-action button.
  const buttonY = winY + 520;
  canvas.roundRect(bodyX, buttonY, 460, 96, 14, hex("#dc2626"));
  const buttonLabel = "VERIFICAR CUENTA AHORA";
  const labelWidth = canvas.measure(buttonLabel, { scale: 3 });
  canvas.text(bodyX + (460 - labelWidth) / 2, buttonY + 34, buttonLabel, hex("#ffffff"), { scale: 3 });

  // Attachment hint.
  canvas.text(bodyX + 520, buttonY + 36, "ADJUNTO: FACTURA.PDF", hex("#64748b"), { scale: 2 });

  // Footer.
  canvas.text(bodyX, winY + 650, "SECUREBANK 2026 - CORREO NO SOLICITADO", hex("#94a3b8"), { scale: 2 });

  return canvas.toPng();
}
