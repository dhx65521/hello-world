# 用本机字体合成手写风格字母（A–Z，大小写合并为 26 类），训练小卷积网络，导出 int8 JSON。
import numpy as np, jax, jax.numpy as jnp, json, base64, time, sys, glob, random, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage
from jax.scipy.ndimage import map_coordinates

rng = np.random.default_rng(0); random.seed(0)
LETTERS = [chr(ord('A') + i) for i in range(26)]

# ---- 字体 ----
files = []
for pat in ['/usr/share/fonts/**/*.ttf', '/usr/share/fonts/**/*.otf', os.path.expanduser('~/.fonts/**/*.ttf')]:
    files += glob.glob(pat, recursive=True)
bad = ['IPA', 'ipag', 'ipam', 'CJK', 'Emoji', 'Symbol', 'Dingbat', 'Unifont', 'Math', 'unifont', 'Loma']
files = sorted({f for f in files if not any(b.lower() in f.lower() for b in bad)})
fonts = []
for f in files:
    try:
        ft = ImageFont.truetype(f, 48)
        im = Image.new('L', (64, 64), 0); ImageDraw.Draw(im).text((8, 4), 'A', fill=255, font=ft)
        if np.asarray(im).sum() > 0: fonts.append(ft)
    except Exception: pass
print('fonts', len(fonts), flush=True)
hold = fonts[::9]; train_fonts = [f for f in fonts if f not in hold]

def render(ch, font):
    S = 64
    im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im)
    try: bbox = d.textbbox((0, 0), ch, font=font)
    except Exception: bbox = (0, 0, 40, 40)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((S - w) / 2 - bbox[0], (S - h) / 2 - bbox[1]), ch, fill=255, font=font)
    return np.asarray(im, dtype=np.float32) / 255.0

def elastic(img, alpha, sigma):
    dx = ndimage.gaussian_filter((rng.random(img.shape) * 2 - 1), sigma) * alpha
    dy = ndimage.gaussian_filter((rng.random(img.shape) * 2 - 1), sigma) * alpha
    y, x = np.meshgrid(np.arange(img.shape[0]), np.arange(img.shape[1]), indexing='ij')
    return ndimage.map_coordinates(img, [y + dy, x + dx], order=1, mode='constant')

def augment_np(img):
    # 粗细
    bw = img > 0.5
    r = rng.random()
    if r < 0.35: bw = ndimage.binary_erosion(bw, iterations=rng.integers(1, 3))
    elif r < 0.75: bw = ndimage.binary_dilation(bw, iterations=rng.integers(1, 3))
    img = bw.astype(np.float32)
    if img.sum() < 10: img = (ndimage.binary_dilation(img > 0, iterations=2)).astype(np.float32)
    # 弹性
    img = elastic(img, alpha=rng.uniform(4, 14), sigma=rng.uniform(4, 7))
    # 仿射：旋转、剪切、缩放
    ang = rng.uniform(-18, 18); sh = rng.uniform(-0.3, 0.3); sc = rng.uniform(0.75, 1.2)
    a = np.deg2rad(ang); c, s = np.cos(a), np.sin(a)
    M = np.array([[c, -s + sh], [s, c]]) * (1 / sc)
    cen = np.array(img.shape) / 2
    img = ndimage.affine_transform(img, M, offset=cen - M @ cen, order=1, mode='constant')
    img = np.clip(ndimage.gaussian_filter(img, rng.uniform(0.3, 0.9)), 0, 1)
    return img

def to_mnist(img):
    # 和运行时一样：裁出包围盒，等比缩到 20x20，质心放到 28x28 中央
    ys, xs = np.where(img > 0.15)
    if len(xs) == 0: return None
    crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = crop.shape; scale = 20 / max(h, w)
    nh, nw = max(1, int(round(h * scale))), max(1, int(round(w * scale)))
    pil = Image.fromarray((crop * 255).astype(np.uint8)).resize((nw, nh), Image.BILINEAR)
    out = np.zeros((28, 28), np.float32)
    oy, ox = (28 - nh) // 2, (28 - nw) // 2
    out[oy:oy + nh, ox:ox + nw] = np.asarray(pil, dtype=np.float32) / 255.0
    cy, cx = ndimage.center_of_mass(out)
    out = ndimage.shift(out, (round(13.5 - cy), round(13.5 - cx)), order=0, mode='constant')
    return out

def make_set(font_list, per):
    X, Y = [], []
    for i, L in enumerate(LETTERS):
        for ft in font_list:
            for ch in (L, L.lower()):
                base = render(ch, ft)
                if base.sum() < 5: continue
                for _ in range(per):
                    im = to_mnist(augment_np(base))
                    if im is None: continue
                    X.append(im); Y.append(i)
    X = np.stack(X).astype(np.float32); Y = np.array(Y, dtype=np.int32)
    p = rng.permutation(len(X)); return X[p], Y[p]

t0 = time.time()
PER = int(sys.argv[2]) if len(sys.argv) > 2 else 14
xtr, ytr = make_set(train_fonts, PER)
xte, yte = make_set(hold, 6)
print('train', xtr.shape, 'test', xte.shape, f'({time.time()-t0:.0f}s)', flush=True)

# ---- 模型（同 digits，输出 26，dense 96） ----
def init(key):
    k = jax.random.split(key, 4)
    def he(k, shape, fan_in): return jax.random.normal(k, shape) * np.sqrt(2.0 / fan_in)
    return {'c1w': he(k[0], (3, 3, 1, 16), 9), 'c1b': jnp.zeros(16), 'c2w': he(k[1], (3, 3, 16, 32), 144), 'c2b': jnp.zeros(32),
            'f1w': he(k[2], (7 * 7 * 32, 96), 1568), 'f1b': jnp.zeros(96), 'f2w': he(k[3], (96, 26), 96), 'f2b': jnp.zeros(26)}
def conv(x, w, b): return jax.lax.conv_general_dilated(x, w, (1, 1), 'SAME', dimension_numbers=('NHWC', 'HWIO', 'NHWC')) + b
def pool(x): return jax.lax.reduce_window(x, -jnp.inf, jax.lax.max, (1, 2, 2, 1), (1, 2, 2, 1), 'VALID')
def forward(p, x):
    x = x[..., None]; x = pool(jax.nn.relu(conv(x, p['c1w'], p['c1b']))); x = pool(jax.nn.relu(conv(x, p['c2w'], p['c2b'])))
    x = x.reshape((x.shape[0], -1)); x = jax.nn.relu(x @ p['f1w'] + p['f1b']); return x @ p['f2w'] + p['f2b']
def loss_fn(p, x, y): return jnp.mean(-jax.nn.log_softmax(forward(p, x))[jnp.arange(y.shape[0]), y])

def augment_one(img, key):
    k = jax.random.split(key, 5)
    ang = jax.random.uniform(k[0], (), minval=-0.2, maxval=0.2); sc = jax.random.uniform(k[1], (), minval=0.85, maxval=1.15)
    tx = jax.random.uniform(k[2], (), minval=-2, maxval=2); ty = jax.random.uniform(k[3], (), minval=-2, maxval=2)
    ys, xs = jnp.meshgrid(jnp.arange(28.0), jnp.arange(28.0), indexing='ij'); cy = cx = 13.5
    c, s = jnp.cos(ang), jnp.sin(ang)
    sx = ((xs - cx) * c + (ys - cy) * s) / sc + cx - tx; sy = (-(xs - cx) * s + (ys - cy) * c) / sc + cy - ty
    out = map_coordinates(img, [sy, sx], order=1, mode='constant', cval=0.0)
    thick = jax.random.uniform(k[4], ()) < 0.3
    dil = jax.lax.reduce_window(out[None, ..., None], -jnp.inf, jax.lax.max, (1, 3, 3, 1), (1, 1, 1, 1), 'SAME')[0, ..., 0]
    return jnp.clip(jnp.where(thick, dil, out), 0, 1)
augment = jax.jit(jax.vmap(augment_one))

def adam_init(p): return {k: (jnp.zeros_like(v), jnp.zeros_like(v)) for k, v in p.items()}
@jax.jit
def step(p, st, t, x, y, lr):
    l, g = jax.value_and_grad(loss_fn)(p, x, y); b1, b2, eps = 0.9, 0.999, 1e-8; np_, ns = {}, {}
    for k in p:
        m, v = st[k]; m = b1 * m + (1 - b1) * g[k]; v = b2 * v + (1 - b2) * g[k] ** 2
        np_[k] = p[k] - lr * (m / (1 - b1 ** t)) / (jnp.sqrt(v / (1 - b2 ** t)) + eps); ns[k] = (m, v)
    return np_, ns, l
@jax.jit
def predict(p, x): return jnp.argmax(forward(p, x), axis=-1)
def accuracy(p, x, y):
    c = 0
    for i in range(0, len(x), 1000): c += int(jnp.sum(predict(p, jnp.asarray(x[i:i+1000])) == y[i:i+1000]))
    return c / len(x)

p = init(jax.random.PRNGKey(0)); st = adam_init(p); t = 0; key = jax.random.PRNGKey(1)
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12; BS = 128
for ep in range(EPOCHS):
    lr = 1e-3 if ep < EPOCHS - 3 else 3e-4
    idx = rng.permutation(len(xtr)); t0 = time.time(); tot = 0
    for i in range(0, len(idx) - BS + 1, BS):
        b = idx[i:i+BS]; key, sub = jax.random.split(key)
        xb = augment(jnp.asarray(xtr[b]), jax.random.split(sub, BS)); t += 1
        p, st, l = step(p, st, t, xb, jnp.asarray(ytr[b]), lr); tot += float(l)
    print(f'epoch {ep+1}: loss {tot/(len(idx)//BS):.4f}  held-out-font acc {accuracy(p, xte, yte):.4f} ({time.time()-t0:.0f}s)', flush=True)

out = {'format': 'int8-per-tensor', 'labels': LETTERS, 'input': '28x28 float 0..1, white on black, MNIST-style centered',
       'layers': ['conv3x3 16 relu pool2', 'conv3x3 32 relu pool2', 'flatten HWC', 'dense 96 relu', 'dense 26'], 'tensors': {}}
for k, v in p.items():
    a = np.asarray(v, dtype=np.float32); scale = float(np.max(np.abs(a)) / 127.0) or 1.0
    q = np.clip(np.round(a / scale), -127, 127).astype(np.int8)
    out['tensors'][k] = {'shape': list(a.shape), 'scale': scale, 'data': base64.b64encode(q.tobytes()).decode()}
json.dump(out, open('letters-model.json', 'w'))
print('model bytes', os.path.getsize('letters-model.json'))
