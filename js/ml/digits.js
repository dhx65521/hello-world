// 手写数字识别：小卷积网络（MNIST 训练，int8 量化），纯 JS 推理，离线可用。
// 用法：await loadModel(); const { digit, prob } = recognize(strokes, boxSize)
let model = null;

function dequant(t) {
  const bin = atob(t.data); const n = bin.length; const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; out[i] = v * t.scale; }
  return { shape: t.shape, data: out };
}
export async function loadModel() {
  if (model) return model;
  const res = await fetch(new URL('./digits-model.json', import.meta.url));
  const j = await res.json();
  model = {}; for (const [k, t] of Object.entries(j.tensors)) model[k] = dequant(t);
  return model;
}

// ---- 算子（NHWC，单张图） ----
function conv3x3(x, H, W, Cin, w, b, Cout) {
  const out = new Float32Array(H * W * Cout);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const o = (y * W + xx) * Cout;
    for (let co = 0; co < Cout; co++) out[o + co] = b[co];
    for (let ky = 0; ky < 3; ky++) {
      const iy = y + ky - 1; if (iy < 0 || iy >= H) continue;
      for (let kx = 0; kx < 3; kx++) {
        const ix = xx + kx - 1; if (ix < 0 || ix >= W) continue;
        const ibase = (iy * W + ix) * Cin; const wbase = (ky * 3 + kx) * Cin * Cout;
        for (let ci = 0; ci < Cin; ci++) {
          const v = x[ibase + ci]; if (v === 0) continue;
          const wb = wbase + ci * Cout;
          for (let co = 0; co < Cout; co++) out[o + co] += v * w[wb + co];
        }
      }
    }
    for (let co = 0; co < Cout; co++) if (out[o + co] < 0) out[o + co] = 0; // relu
  }
  return out;
}
function pool2(x, H, W, C) {
  const h = H >> 1, w = W >> 1; const out = new Float32Array(h * w * C);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) for (let c = 0; c < C; c++) {
    const a = x[((2 * y) * W + 2 * xx) * C + c], b = x[((2 * y) * W + 2 * xx + 1) * C + c], d = x[((2 * y + 1) * W + 2 * xx) * C + c], e = x[((2 * y + 1) * W + 2 * xx + 1) * C + c];
    out[(y * w + xx) * C + c] = Math.max(a, b, d, e);
  }
  return out;
}
function dense(x, w, b, nOut, relu) {
  const nIn = x.length; const out = new Float32Array(nOut);
  for (let o = 0; o < nOut; o++) {
    let s = b[o]; for (let i = 0; i < nIn; i++) s += x[i] * w[i * nOut + o];
    out[o] = relu && s < 0 ? 0 : s;
  }
  return out;
}
function softmax(z) { const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); }

/** 输入 28x28 Float32Array（0..1，白字黑底），返回 { digit, prob, probs } */
export function predict(img) {
  const m = model;
  let x = conv3x3(img, 28, 28, 1, m.c1w.data, m.c1b.data, 16); x = pool2(x, 28, 28, 16);
  x = conv3x3(x, 14, 14, 16, m.c2w.data, m.c2b.data, 32); x = pool2(x, 14, 14, 32);
  x = dense(x, m.f1w.data, m.f1b.data, 64, true);
  const logits = dense(x, m.f2w.data, m.f2b.data, 10, false);
  const probs = softmax(Array.from(logits));
  let digit = 0; for (let i = 1; i < 10; i++) if (probs[i] > probs[digit]) digit = i;
  return { digit, prob: probs[digit], probs };
}

// ---- 预处理：把笔画渲染成 MNIST 风格的 28x28 ----
const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
/**
 * strokes: [[{x,y}, ...], ...]，坐标在 0..size 的正方形内
 * 步骤：按 MNIST 规范——裁出墨迹包围盒，等比缩到 20x20 以内，按质心放到 28x28 中央
 */
export function strokesToTensor(strokes, size) {
  const S = 256; off.width = S; off.height = S;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = S * 0.075; // 笔画粗细占画布比例（接近 MNIST 的笔画粗细）
  const k = S / size;
  let minX = S, minY = S, maxX = 0, maxY = 0, any = false;
  for (const st of strokes) {
    if (!st.length) continue; any = true;
    ctx.beginPath();
    ctx.moveTo(st[0].x * k, st[0].y * k);
    if (st.length === 1) ctx.lineTo(st[0].x * k + 0.1, st[0].y * k + 0.1);
    for (let i = 1; i < st.length; i++) ctx.lineTo(st[i].x * k, st[i].y * k);
    ctx.stroke();
    for (const p of st) { minX = Math.min(minX, p.x * k); maxX = Math.max(maxX, p.x * k); minY = Math.min(minY, p.y * k); maxY = Math.max(maxY, p.y * k); }
  }
  if (!any) return null;
  const pad = ctx.lineWidth / 2 + 1;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(S, maxX + pad); maxY = Math.min(S, maxY + pad);
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  // 缩放到 20x20 盒子里
  const scale = 20 / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const c2 = document.createElement('canvas'); c2.width = 28; c2.height = 28;
  const g = c2.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 28, 28);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(off, minX, minY, bw, bh, Math.round((28 - tw) / 2), Math.round((28 - th) / 2), tw, th);
  let data = g.getImageData(0, 0, 28, 28).data;
  let img = new Float32Array(784);
  let sx = 0, sy = 0, sum = 0;
  for (let i = 0; i < 784; i++) { const v = data[i * 4] / 255; img[i] = v; sx += (i % 28) * v; sy += Math.floor(i / 28) * v; sum += v; }
  // 按质心平移到中心
  if (sum > 0) {
    const dx = Math.round(13.5 - sx / sum), dy = Math.round(13.5 - sy / sum);
    if (dx || dy) {
      const shifted = new Float32Array(784);
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
        const ny = y + dy, nx = x + dx; if (ny < 0 || ny >= 28 || nx < 0 || nx >= 28) continue;
        shifted[ny * 28 + nx] = img[y * 28 + x];
      }
      img = shifted;
    }
  }
  return img;
}

export function recognize(strokes, size) {
  const t = strokesToTensor(strokes, size);
  if (!t) return null;
  return predict(t);
}
