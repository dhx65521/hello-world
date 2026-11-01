# 训练一个小卷积网络识别手写数字（MNIST + 随机仿射/粗细增强），导出为 int8 量化 JSON 供浏览器纯 JS 推理。
import numpy as np, jax, jax.numpy as jnp, json, base64, time, sys
from jax.scipy.ndimage import map_coordinates

rng = np.random.default_rng(0)
d = np.load('mnist.npz')
xtr = d['x_train'].astype(np.float32) / 255.0; ytr = d['y_train'].astype(np.int32)
xte = d['x_test'].astype(np.float32) / 255.0; yte = d['y_test'].astype(np.int32)

def init(key):
    k = jax.random.split(key, 4)
    def he(k, shape, fan_in): return jax.random.normal(k, shape) * np.sqrt(2.0 / fan_in)
    return {
        'c1w': he(k[0], (3, 3, 1, 16), 9), 'c1b': jnp.zeros(16),
        'c2w': he(k[1], (3, 3, 16, 32), 144), 'c2b': jnp.zeros(32),
        'f1w': he(k[2], (7 * 7 * 32, 64), 1568), 'f1b': jnp.zeros(64),
        'f2w': he(k[3], (64, 10), 64), 'f2b': jnp.zeros(10),
    }

def conv(x, w, b):  # x: N,H,W,C ; w: kh,kw,Cin,Cout ; SAME padding
    y = jax.lax.conv_general_dilated(x, w, (1, 1), 'SAME', dimension_numbers=('NHWC', 'HWIO', 'NHWC'))
    return y + b

def pool(x):
    return jax.lax.reduce_window(x, -jnp.inf, jax.lax.max, (1, 2, 2, 1), (1, 2, 2, 1), 'VALID')

def forward(p, x):
    x = x[..., None]
    x = pool(jax.nn.relu(conv(x, p['c1w'], p['c1b'])))
    x = pool(jax.nn.relu(conv(x, p['c2w'], p['c2b'])))
    x = x.reshape((x.shape[0], -1))  # 顺序 H,W,C —— JS 里要保持一致
    x = jax.nn.relu(x @ p['f1w'] + p['f1b'])
    return x @ p['f2w'] + p['f2b']

def loss_fn(p, x, y):
    logits = forward(p, x)
    return jnp.mean(-jax.nn.log_softmax(logits)[jnp.arange(y.shape[0]), y])

# ---- 增强：随机旋转/缩放/平移 + 随机加粗 ----
def augment_one(img, key):
    k = jax.random.split(key, 6)
    ang = jax.random.uniform(k[0], (), minval=-0.3, maxval=0.3)
    sc = jax.random.uniform(k[1], (), minval=0.8, maxval=1.25)
    tx = jax.random.uniform(k[2], (), minval=-3, maxval=3)
    ty = jax.random.uniform(k[3], (), minval=-3, maxval=3)
    ys, xs = jnp.meshgrid(jnp.arange(28.0), jnp.arange(28.0), indexing='ij')
    cy, cx = 13.5, 13.5
    c, s = jnp.cos(ang), jnp.sin(ang)
    sx = ((xs - cx) * c + (ys - cy) * s) / sc + cx - tx
    sy = (-(xs - cx) * s + (ys - cy) * c) / sc + cy - ty
    out = map_coordinates(img, [sy, sx], order=1, mode='constant', cval=0.0)
    # 随机加粗（3x3 最大值）
    thick = jax.random.uniform(k[4], ()) < 0.35
    dil = jax.lax.reduce_window(out[None, ..., None], -jnp.inf, jax.lax.max, (1, 3, 3, 1), (1, 1, 1, 1), 'SAME')[0, ..., 0]
    out = jnp.where(thick, dil, out)
    # 随机变细（3x3 最小值）
    thin = jax.random.uniform(k[5], ()) < 0.15
    ero = -jax.lax.reduce_window(-out[None, ..., None], -jnp.inf, jax.lax.max, (1, 3, 3, 1), (1, 1, 1, 1), 'SAME')[0, ..., 0]
    out = jnp.where(thin, ero, out)
    return jnp.clip(out, 0, 1)

augment = jax.jit(jax.vmap(augment_one))

# ---- Adam ----
def adam_init(p): return {k: (jnp.zeros_like(v), jnp.zeros_like(v)) for k, v in p.items()}
@jax.jit
def step(p, st, t, x, y, lr):
    l, g = jax.value_and_grad(loss_fn)(p, x, y)
    b1, b2, eps = 0.9, 0.999, 1e-8
    newp, newst = {}, {}
    for k in p:
        m, v = st[k]
        m = b1 * m + (1 - b1) * g[k]; v = b2 * v + (1 - b2) * g[k] ** 2
        mh = m / (1 - b1 ** t); vh = v / (1 - b2 ** t)
        newp[k] = p[k] - lr * mh / (jnp.sqrt(vh) + eps)
        newst[k] = (m, v)
    return newp, newst, l

@jax.jit
def predict(p, x): return jnp.argmax(forward(p, x), axis=-1)

def accuracy(p, x, y):
    correct = 0
    for i in range(0, len(x), 1000):
        correct += int(jnp.sum(predict(p, jnp.asarray(x[i:i+1000])) == y[i:i+1000]))
    return correct / len(x)

p = init(jax.random.PRNGKey(0)); st = adam_init(p); t = 0
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
BS = 128
key = jax.random.PRNGKey(1)
for ep in range(EPOCHS):
    lr = 1e-3 if ep < EPOCHS - 2 else 3e-4
    idx = rng.permutation(len(xtr)); t0 = time.time(); tot = 0
    for i in range(0, len(idx) - BS + 1, BS):
        b = idx[i:i+BS]
        key, sub = jax.random.split(key)
        xb = augment(jnp.asarray(xtr[b]), jax.random.split(sub, BS))
        t += 1
        p, st, l = step(p, st, t, xb, jnp.asarray(ytr[b]), lr); tot += float(l)
    print(f'epoch {ep+1}: loss {tot/(len(idx)//BS):.4f}  test acc {accuracy(p, xte, yte):.4f}  ({time.time()-t0:.0f}s)', flush=True)

# 增强后的测试集准确率（更接近小朋友的书写）
key, sub = jax.random.split(key)
xa = np.asarray(augment(jnp.asarray(xte[:5000]), jax.random.split(sub, 5000)))
print('augmented test acc', accuracy(p, xa, yte[:5000]))

# ---- 导出 int8 量化 ----
out = {'format': 'int8-per-tensor', 'input': '28x28 float 0..1, white digit on black, MNIST-style centered', 'layers': ['conv3x3 16 relu pool2', 'conv3x3 32 relu pool2', 'flatten HWC', 'dense 64 relu', 'dense 10'], 'tensors': {}}
for k, v in p.items():
    a = np.asarray(v, dtype=np.float32)
    scale = float(np.max(np.abs(a)) / 127.0) or 1.0
    q = np.clip(np.round(a / scale), -127, 127).astype(np.int8)
    out['tensors'][k] = {'shape': list(a.shape), 'scale': scale, 'data': base64.b64encode(q.tobytes()).decode()}
json.dump(out, open('digits-model.json', 'w'))
# 验证量化后精度
pq = {k: jnp.asarray(np.frombuffer(base64.b64decode(out['tensors'][k]['data']), dtype=np.int8).astype(np.float32).reshape(out['tensors'][k]['shape']) * out['tensors'][k]['scale']) for k in p}
print('quantized test acc', accuracy(pq, xte, yte))
import os; print('model bytes', os.path.getsize('digits-model.json'))
