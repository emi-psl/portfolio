/* Tiny inference engine for the portfolio demos.
   Plain JavaScript, no libraries. Tensors are Float32Arrays in channels-last
   (height, width, channels) layout, matching how the models were trained in Keras. */
(function (root) {
  "use strict";

  // ---------- loading ----------
  function halfToFloat(h) {
    const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : (s ? -Infinity : Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  }

  function unpack(manifest, buffer) {
    const out = {};
    for (const t of manifest.tensors) {
      const n = t.shape.reduce((a, b) => a * b, 1);
      let data;
      if (manifest.dtype === "f16") {
        const src = new Uint16Array(buffer, t.offset, n);
        data = new Float32Array(n);
        for (let i = 0; i < n; i++) data[i] = halfToFloat(src[i]);
      } else {
        data = new Float32Array(buffer.slice(t.offset, t.offset + n * 4));
      }
      out[t.name] = { data, shape: t.shape };
    }
    return out;
  }

  async function load(base, name) {
    const [m, b] = await Promise.all([
      fetch(`${base}/${name}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${base}/${name}.bin`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    return unpack(m, b);
  }

  // ---------- layers ----------
  // x: [H*W*C], kernel [kh,kw,Cin,Cout], stride 1, "same" padding
  function conv2d(x, H, W, C, k, bias) {
    const [kh, kw, , Co] = k.shape, K = k.data;
    const ph = (kh - 1) >> 1, pw = (kw - 1) >> 1;
    const y = new Float32Array(H * W * Co);
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const o = (i * W + j) * Co;
      if (bias) for (let c = 0; c < Co; c++) y[o + c] = bias.data[c];
      for (let di = 0; di < kh; di++) {
        const ii = i + di - ph; if (ii < 0 || ii >= H) continue;
        for (let dj = 0; dj < kw; dj++) {
          const jj = j + dj - pw; if (jj < 0 || jj >= W) continue;
          const xi = (ii * W + jj) * C, ki = (di * kw + dj) * C * Co;
          for (let ci = 0; ci < C; ci++) {
            const v = x[xi + ci]; if (v === 0) continue;
            const kr = ki + ci * Co;
            for (let c = 0; c < Co; c++) y[o + c] += v * K[kr + c];
          }
        }
      }
    }
    return y;
  }

  // Keras Conv2DTranspose, stride 2, "same" padding. kernel [kh,kw,Cout,Cin]
  function convT2d(x, H, W, C, k, bias) {
    const [kh, kw, Co] = k.shape, K = k.data, s = 2;
    const OH = H * s, OW = W * s;
    const ph = Math.floor((kh - s) / 2), pw = Math.floor((kw - s) / 2);
    const y = new Float32Array(OH * OW * Co);
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const xi = (i * W + j) * C;
      for (let di = 0; di < kh; di++) {
        const oi = i * s + di - ph; if (oi < 0 || oi >= OH) continue;
        for (let dj = 0; dj < kw; dj++) {
          const oj = j * s + dj - pw; if (oj < 0 || oj >= OW) continue;
          const yo = (oi * OW + oj) * Co, ko = (di * kw + dj) * Co * C;
          for (let co = 0; co < Co; co++) {
            let acc = 0; const kr = ko + co * C;
            for (let ci = 0; ci < C; ci++) acc += x[xi + ci] * K[kr + ci];
            y[yo + co] += acc;
          }
        }
      }
    }
    if (bias) for (let p = 0; p < OH * OW; p++) for (let c = 0; c < Co; c++) y[p * Co + c] += bias.data[c];
    return y;
  }

  function batchNorm(x, C, w, prefix, eps = 1e-3) {
    const g = w[prefix + ".gamma"].data, b = w[prefix + ".beta"].data,
      m = w[prefix + ".moving_mean"].data, v = w[prefix + ".moving_variance"].data;
    const sc = new Float32Array(C), sh = new Float32Array(C);
    for (let c = 0; c < C; c++) { sc[c] = g[c] / Math.sqrt(v[c] + eps); sh[c] = b[c] - m[c] * sc[c]; }
    for (let i = 0; i < x.length; i++) { const c = i % C; x[i] = x[i] * sc[c] + sh[c]; }
    return x;
  }

  const relu = x => { for (let i = 0; i < x.length; i++) if (x[i] < 0) x[i] = 0; return x; };
  const tanh = x => { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i]); return x; };

  function maxPool2(x, H, W, C) {
    const OH = H >> 1, OW = W >> 1, y = new Float32Array(OH * OW * C);
    for (let i = 0; i < OH; i++) for (let j = 0; j < OW; j++) for (let c = 0; c < C; c++) {
      const a = x[((2 * i) * W + 2 * j) * C + c], b = x[((2 * i) * W + 2 * j + 1) * C + c],
        d = x[((2 * i + 1) * W + 2 * j) * C + c], e = x[((2 * i + 1) * W + 2 * j + 1) * C + c];
      y[(i * OW + j) * C + c] = Math.max(a, b, d, e);
    }
    return y;
  }

  function globalAvgPool(x, HW, C) {
    const y = new Float32Array(C);
    for (let p = 0; p < HW; p++) for (let c = 0; c < C; c++) y[c] += x[p * C + c];
    for (let c = 0; c < C; c++) y[c] /= HW;
    return y;
  }

  // Keras Dense: kernel [in,out]
  function dense(x, k, b) {
    const [I, O] = k.shape, K = k.data, y = new Float32Array(O);
    if (b) y.set(b.data);
    for (let i = 0; i < I; i++) { const v = x[i]; if (v === 0) continue; const r = i * O; for (let o = 0; o < O; o++) y[o] += v * K[r + o]; }
    return y;
  }

  // PyTorch Linear: weight [out,in]
  function linear(x, w, b) {
    const [O, I] = w.shape, W = w.data, y = new Float32Array(O);
    for (let o = 0; o < O; o++) { let a = b ? b.data[o] : 0; const r = o * I; for (let i = 0; i < I; i++) a += x[i] * W[r + i]; y[o] = a; }
    return y;
  }

  function softmax(x) {
    let m = -Infinity; for (const v of x) if (v > m) m = v;
    const y = new Float32Array(x.length); let s = 0;
    for (let i = 0; i < x.length; i++) { y[i] = Math.exp(x[i] - m); s += y[i]; }
    for (let i = 0; i < x.length; i++) y[i] /= s;
    return y;
  }

  function layerNorm(x, w, b, eps = 1e-5) {
    let m = 0; for (const v of x) m += v; m /= x.length;
    let s = 0; for (const v of x) s += (v - m) * (v - m); s /= x.length;
    const d = Math.sqrt(s + eps), y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = (x[i] - m) / d * w.data[i] + b.data[i];
    return y;
  }

  // Exact GELU (erf form), as in torch.nn.GELU()
  function erf(x) {
    // Abramowitz–Stegun 7.1.26 refined with one Newton step is overkill; use a high-precision series/continued form.
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  const gelu = v => 0.5 * v * (1 + erf(v / Math.SQRT2));

  // ---------- models ----------
  function emnist(w, img) { // img: Float32Array(784), 0..1, upright
    let x = img, H = 28, W = 28, C = 1;
    const f = [32, 32, 64, 64, 128];
    for (let i = 0; i < 5; i++) {
      x = conv2d(x, H, W, C, w[`conv${i}.k`], w[`conv${i}.b`]); C = f[i];
      relu(batchNorm(x, C, w, `bn${i}`));
      if (i === 1 || i === 3) { x = maxPool2(x, H, W, C); H >>= 1; W >>= 1; }
    }
    x = globalAvgPool(x, H * W, C);
    x = relu(dense(x, w["d0.k"], w["d0.b"]));
    return softmax(dense(x, w["d1.k"], w["d1.b"]));
  }

  function cgan(w, z, label) { // z: Float32Array(100), label 0..9 -> Float32Array(32*32*3) in [-1,1]
    const e = w.emb.data, inp = new Float32Array(200);
    inp.set(z, 0); inp.set(e.subarray(label * 100, label * 100 + 100), 100);
    let x = relu(batchNorm(dense(inp, w["dense.k"]), 4096, w, "bn0"));
    x = relu(batchNorm(convT2d(x, 4, 4, 256, w["ct0.k"]), 256, w, "bn1"));
    x = relu(batchNorm(convT2d(x, 8, 8, 256, w["ct1.k"]), 128, w, "bn2"));
    x = relu(batchNorm(conv2d(x, 16, 16, 128, w["c2.k"]), 128, w, "bn3"));
    return tanh(convT2d(x, 16, 16, 128, w["ct3.k"], w["ct3.b"]));
  }

  function qnet(w, s) { // s: [cos, sin, thdot/8]
    let x = tanh(dense(s, w["l0.k"], w["l0.b"]));
    x = tanh(dense(x, w["l1.k"], w["l1.b"]));
    return dense(x, w["l2.k"], w["l2.b"]);
  }

  // Tiny causal Transformer (PyTorch weights). ids: int array (<= context). Returns {logits:[T][V], attn:[H][T][T]}
  function transformer(w, ids, heads = 4) {
    const D = w["embedding.weight"].shape[1], T = ids.length, dh = D / heads;
    const E = w["embedding.weight"].data, PE = w.pe.data;
    const x = [];
    for (let t = 0; t < T; t++) { const v = new Float32Array(D); for (let d = 0; d < D; d++) v[d] = E[ids[t] * D + d] + PE[t * D + d]; x.push(v); }
    const h = x.map(v => layerNorm(v, w["block.ln1.weight"], w["block.ln1.bias"]));
    const q = h.map(v => linear(v, w["block.attn.q_proj.weight"], w["block.attn.q_proj.bias"]));
    const k = h.map(v => linear(v, w["block.attn.k_proj.weight"], w["block.attn.k_proj.bias"]));
    const vv = h.map(v => linear(v, w["block.attn.v_proj.weight"], w["block.attn.v_proj.bias"]));
    const attn = [], joined = x.map(() => new Float32Array(D));
    for (let hd = 0; hd < heads; hd++) {
      const rows = [];
      for (let i = 0; i < T; i++) {
        const sc = new Float32Array(i + 1);
        for (let j = 0; j <= i; j++) { let a = 0; for (let d = 0; d < dh; d++) a += q[i][hd * dh + d] * k[j][hd * dh + d]; sc[j] = a / Math.sqrt(dh); }
        const p = softmax(sc), row = new Float32Array(T); row.set(p);
        for (let j = 0; j <= i; j++) for (let d = 0; d < dh; d++) joined[i][hd * dh + d] += p[j] * vv[j][hd * dh + d];
        rows.push(row);
      }
      attn.push(rows);
    }
    const logits = [];
    for (let t = 0; t < T; t++) {
      const o = linear(joined[t], w["block.attn.proj.weight"], w["block.attn.proj.bias"]);
      const r = new Float32Array(D); for (let d = 0; d < D; d++) r[d] = x[t][d] + o[d];
      const f = linear(layerNorm(r, w["block.ln2.weight"], w["block.ln2.bias"]), w["block.ff.0.weight"], w["block.ff.0.bias"]).map(gelu);
      const f2 = linear(f, w["block.ff.2.weight"], w["block.ff.2.bias"]);
      for (let d = 0; d < D; d++) r[d] += f2[d];
      logits.push(linear(layerNorm(r, w["norm.weight"], w["norm.bias"]), w["output.weight"], w["output.bias"]));
    }
    return { logits, attn };
  }

  // Gym 0.17.3 Pendulum-v0 dynamics
  function pendulumStep(th, thdot, u, g) {
    const m = 1, l = 1, dt = 0.05;
    u = Math.max(-2, Math.min(2, u));
    const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const cost = norm(th) ** 2 + 0.1 * thdot ** 2 + 0.001 * u ** 2;
    let nthdot = thdot + (-3 * g / (2 * l) * Math.sin(th + Math.PI) + 3 / (m * l * l) * u) * dt;
    const nth = th + nthdot * dt;
    nthdot = Math.max(-8, Math.min(8, nthdot));
    return { th: nth, thdot: nthdot, reward: -cost };
  }

  // Box–Muller normal sampler
  function randn(n) {
    const z = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      const u = 1 - Math.random(), v = Math.random(), r = Math.sqrt(-2 * Math.log(u));
      z[i] = r * Math.cos(2 * Math.PI * v); if (i + 1 < n) z[i + 1] = r * Math.sin(2 * Math.PI * v);
    }
    return z;
  }

  const api = { load, unpack, emnist, cgan, qnet, transformer, pendulumStep, randn, softmax };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NN = api;
})(typeof window !== "undefined" ? window : globalThis);
