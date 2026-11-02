# 用笔画模板合成手写风格字母
import numpy as np, math, random
from PIL import Image, ImageDraw
from strokes import UPPER, LOWER
rng = np.random.default_rng(1)

def render_strokes(strokes, S=64, jitter=0.012, width=None, slant=None, rot=None, scale=None, aspect=None):
    width = width if width is not None else rng.uniform(0.045, 0.11)
    slant = slant if slant is not None else rng.uniform(-0.25, 0.25)
    rot = rot if rot is not None else rng.uniform(-10, 10)
    scale = scale if scale is not None else rng.uniform(0.7, 0.95)
    aspect = aspect if aspect is not None else rng.uniform(0.8, 1.25)
    # 归一化：把所有点的包围盒映射到中心
    pts = [p for st in strokes for p in st]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    h = max(ys) - min(ys) or 1; w = max(xs) - min(xs) or 1
    k = scale / max(h, w * aspect)
    a = math.radians(rot); ca, sa = math.cos(a), math.sin(a)
    im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im)
    lw = max(2, int(width * S))
    for st in strokes:
        out = []
        for (x, y) in st:
            x = (x - cx) * aspect * k; y = (y - cy) * k
            x = x + slant * y
            xr = x * ca - y * sa; yr = x * sa + y * ca
            xr += rng.normal(0, jitter) * k; yr += rng.normal(0, jitter) * k
            out.append(((0.5 + xr) * S, (0.5 + yr) * S))
        # 笔画略微弯曲：用小的低频扰动
        if len(out) > 2:
            amp = rng.uniform(0, 0.03) * S; ph = rng.uniform(0, 6.28)
            out = [(x + amp * math.sin(ph + i * 0.7), y + amp * math.cos(ph + i * 0.5)) for i, (x, y) in enumerate(out)]
        if len(out) == 1: out = out + [(out[0][0] + 0.5, out[0][1] + 0.5)]
        d.line(out, fill=255, width=lw, joint='curve')
        for (x, y) in (out[0], out[-1]): d.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0

def samples_for(letter, n):
    variants = UPPER[letter] + LOWER.get(letter.lower(), [])
    # 大写变体权重更高（小朋友先学大写）
    weights = [2.0] * len(UPPER[letter]) + [1.0] * len(LOWER.get(letter.lower(), []))
    weights = np.array(weights) / sum(weights)
    out = []
    for _ in range(n):
        v = variants[rng.choice(len(variants), p=weights)]
        out.append(render_strokes(v))
    return out

if __name__ == '__main__':
    # 预览图：每个字母 6 个样本
    letters = [chr(65 + i) for i in range(26)]
    sheet = Image.new('L', (6 * 64, 26 * 64), 0)
    for i, L in enumerate(letters):
        for j, im in enumerate(samples_for(L, 6)):
            sheet.paste(Image.fromarray((im * 255).astype(np.uint8)), (j * 64, i * 64))
    sheet.save('preview.png'); print('preview saved')
