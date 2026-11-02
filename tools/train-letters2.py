# 字母模型 v2：笔画合成（手写风格，大小写）+ 字体合成；网络加宽（24/48 卷积，dense 128）。
import numpy as np, jax, jax.numpy as jnp, json, base64, time, sys, os
from jax.scipy.ndimage import map_coordinates
import train_letters as TL
from handsynth import samples_for

rng = np.random.default_rng(3)
LETTERS = TL.LETTERS
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
HAND_PER = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
FONT_PER = int(sys.argv[3]) if len(sys.argv) > 3 else 10

t0 = time.time()
X, Y = [], []
for i, L in enumerate(LETTERS):
    for im in samples_for(L, HAND_PER):
        m = TL.to_mnist(TL.augment_np(im) if rng.random() < 0.5 else im)
        if m is not None: X.append(m); Y.append(i)
xh, yh = np.stack(X).astype(np.float32), np.array(Y, dtype=np.int32)
print('hand', xh.shape, f'({time.time()-t0:.0f}s)', flush=True)
xf, yf = TL.make_set(TL.train_fonts, FONT_PER)
xte_f, yte_f = TL.make_set(TL.hold, 5)
print('font', xf.shape, flush=True)
# 手写风格的验证集：用不同随机种子再合成一小批
import handsynth; handsynth.rng = np.random.default_rng(99)
Xv, Yv = [], []
for i, L in enumerate(LETTERS):
    for im in samples_for(L, 120):
        m = TL.to_mnist(im)
        if m is not None: Xv.append(m); Yv.append(i)
xte_h, yte_h = np.stack(Xv).astype(np.float32), np.array(Yv, dtype=np.int32)
xtr = np.concatenate([xh, xf]); ytr = np.concatenate([yh, yf])
p_ = rng.permutation(len(xtr)); xtr, ytr = xtr[p_], ytr[p_]
print('train total', xtr.shape, flush=True)

C1, C2, HID = 24, 48, 128
def init(key):
    k = jax.random.split(key, 4)
    def he(k, shape, fan_in): return jax.random.normal(k, shape) * np.sqrt(2.0 / fan_in)
    return {'c1w': he(k[0], (3, 3, 1, C1), 9), 'c1b': jnp.zeros(C1), 'c2w': he(k[1], (3, 3, C1, C2), 9 * C1), 'c2b': jnp.zeros(C2),
            'f1w': he(k[2], (7 * 7 * C2, HID), 7 * 7 * C2), 'f1b': jnp.zeros(HID), 'f2w': he(k[3], (HID, 26), HID), 'f2b': jnp.zeros(26)}
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

p = init(jax.random.PRNGKey(0)); st = adam_init(p); t = 0; key = jax.random.PRNGKey(1); BS = 128
for ep in range(EPOCHS):
    lr = 1e-3 if ep < EPOCHS - 3 else 3e-4
    idx = rng.permutation(len(xtr)); t1 = time.time(); tot = 0
    for i in range(0, len(idx) - BS + 1, BS):
        b = idx[i:i+BS]; key, sub = jax.random.split(key)
        xb = augment(jnp.asarray(xtr[b]), jax.random.split(sub, BS)); t += 1
        p, st, l = step(p, st, t, xb, jnp.asarray(ytr[b]), lr); tot += float(l)
    print(f'epoch {ep+1}: loss {tot/(len(idx)//BS):.4f}  hand-val {accuracy(p, xte_h, yte_h):.4f}  font-val {accuracy(p, xte_f, yte_f):.4f} ({time.time()-t1:.0f}s)', flush=True)

out = {'format': 'int8-per-tensor', 'labels': LETTERS, 'input': '28x28 float 0..1, white on black, MNIST-style centered',
       'layers': [f'conv3x3 {C1} relu pool2', f'conv3x3 {C2} relu pool2', 'flatten HWC', f'dense {HID} relu', 'dense 26'], 'tensors': {}}
for k, v in p.items():
    a = np.asarray(v, dtype=np.float32); scale = float(np.max(np.abs(a)) / 127.0) or 1.0
    q = np.clip(np.round(a / scale), -127, 127).astype(np.int8)
    out['tensors'][k] = {'shape': list(a.shape), 'scale': scale, 'data': base64.b64encode(q.tobytes()).decode()}
json.dump(out, open('letters-model.json', 'w'))
print('model bytes', os.path.getsize('letters-model.json'))
