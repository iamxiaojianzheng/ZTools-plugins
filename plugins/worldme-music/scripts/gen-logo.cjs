// 生成插件 Logo：与插件界面左上角的品牌图标保持一致
// 紫色→粉色渐变圆角方块 + 白色线性音符（复用 Icon.vue 的 music 路径）
// 4x 超采样后降采样，保证边缘平滑。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;
const SS = 4;
const W = SIZE * SS;

const buf = new Float32Array(W * W * 4);

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function blend(i, r, g, b, a) {
  if (a <= 0) return;
  const sa = a / 255;
  const da = buf[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[i] = (r * sa + buf[i] * da * (1 - sa)) / oa;
  buf[i + 1] = (g * sa + buf[i + 1] * da * (1 - sa)) / oa;
  buf[i + 2] = (b * sa + buf[i + 2] * da * (1 - sa)) / oa;
  buf[i + 3] = oa * 255;
}

/* ---------------- 背景：圆角方块 + 品牌渐变 ---------------- */

// 与界面一致的 14 / 42 圆角比例
const RADIUS = SIZE * (14 / 42);
// --accent-1: #8b5cf6  --accent-2: #ec4899
const C0 = [139, 92, 246];
const C1 = [236, 72, 153];

function insideRoundedRect(x, y) {
  const half = SIZE / 2;
  const dx = Math.max(Math.abs(x - half) - (half - RADIUS), 0);
  const dy = Math.max(Math.abs(y - half) - (half - RADIUS), 0);
  return Math.hypot(dx, dy) <= RADIUS;
}

for (let py = 0; py < W; py++) {
  for (let px = 0; px < W; px++) {
    const x = (px + 0.5) / SS;
    const y = (py + 0.5) / SS;
    if (!insideRoundedRect(x, y)) continue;

    // linear-gradient(120deg, accent-1, accent-2)
    const t = clamp01((x + y) / (SIZE * 2));
    const r = lerp(C0[0], C1[0], t);
    const g = lerp(C0[1], C1[1], t);
    const b = lerp(C0[2], C1[2], t);
    blend((py * W + px) * 4, r, g, b, 255);
  }
}

/* ---------------- 绘制工具 ---------------- */

function eachBBox(x0, y0, x1, y1, fn) {
  const px0 = Math.max(0, Math.floor(x0 * SS));
  const py0 = Math.max(0, Math.floor(y0 * SS));
  const px1 = Math.min(W - 1, Math.ceil(x1 * SS));
  const py1 = Math.min(W - 1, Math.ceil(y1 * SS));
  for (let py = py0; py <= py1; py++) {
    for (let px = px0; px <= px1; px++) {
      const x = (px + 0.5) / SS;
      const y = (py + 0.5) / SS;
      const a = fn(x, y);
      if (a > 0) blend((py * W + px) * 4, 255, 255, 255, Math.min(255, a));
    }
  }
}

function distToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - x1) * dx + (y - y1) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function strokeLine(x1, y1, x2, y2, width) {
  const r = width / 2;
  const pad = r + 2;
  eachBBox(
    Math.min(x1, x2) - pad,
    Math.min(y1, y2) - pad,
    Math.max(x1, x2) + pad,
    Math.max(y1, y2) + pad,
    (x, y) => {
      const d = distToSegment(x, y, x1, y1, x2, y2);
      return smoothstep(r + 0.8, r - 0.8, d) * 255;
    }
  );
}

function strokeCircle(cx, cy, r, width) {
  const half = width / 2;
  const pad = r + half + 2;
  eachBBox(cx - pad, cy - pad, cx + pad, cy + pad, (x, y) => {
    const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
    return smoothstep(half + 0.8, half - 0.8, d) * 255;
  });
}

/* ---------------- 音符：复刻 Icon.vue 的 music 路径 ---------------- */
// viewBox 24 → 画布 56% 大小；stroke-width 2.15（略加粗以保证小尺寸清晰）
const ICON_RATIO = 0.56;
const ICON_PX = SIZE * ICON_RATIO;
const K = ICON_PX / 24;
const OFF = (SIZE - ICON_PX) / 2;
const SW = 2.15 * K;

const P = (x, y) => [OFF + x * K, OFF + y * K];

// path: M9 18 V6 L19 4 V16
const p1 = P(9, 18);
const p2 = P(9, 6);
const p3 = P(19, 4);
const p4 = P(19, 16);
strokeLine(p1[0], p1[1], p2[0], p2[1], SW);
strokeLine(p2[0], p2[1], p3[0], p3[1], SW);
strokeLine(p3[0], p3[1], p4[0], p4[1], SW);

// circles: (6.5,18) r2.5 / (16.5,16) r2.5
const c1 = P(6.5, 18);
const c2 = P(16.5, 16);
strokeCircle(c1[0], c1[1], 2.5 * K, SW);
strokeCircle(c2[0], c2[1], 2.5 * K, SW);

/* ---------------- 降采样 ---------------- */

const out = Buffer.alloc(SIZE * SIZE * 4);
const block = SS * SS;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let pr = 0, pg = 0, pb = 0, pa = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        const a = buf[i + 3];
        pr += buf[i] * a;
        pg += buf[i + 1] * a;
        pb += buf[i + 2] * a;
        pa += a;
      }
    }
    const o = (y * SIZE + x) * 4;
    if (pa <= 0) continue;
    out[o] = Math.round(pr / pa);
    out[o + 1] = Math.round(pg / pa);
    out[o + 2] = Math.round(pb / pa);
    out[o + 3] = Math.round(pa / block);
  }
}

/* ---------------- PNG 编码 ---------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const target = path.join(__dirname, '..', 'src-ztools', 'logo.png');
fs.writeFileSync(target, encodePNG(out, SIZE));
console.log('✅ logo.png generated:', target, '(' + fs.statSync(target).size + ' bytes)');
