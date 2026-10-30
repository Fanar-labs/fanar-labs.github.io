import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// v34 «мир»: the door at the back of the stage, the walk in, the clock, the candles, the theatre across going dark, the tram (HOUSE.arrival, HOUSE.world); knob «mir».
// v33 «вместе»: the dolls take from the music what the lab's figures take (HOUSE.withMusic) — the gaze, the lead, breath, rest, the beat, nods;
// Otto's knees go with the bellows, Bo gives with his knees on the beat, Nell turns to the hand that plays; knob «vmeste».
// v32 «меха и пиццикато»: Otto's bellows and buttons and Bo's pizzicato read the notes too (HOUSE.bellows, HOUSE.bass), knob «igra».
// v31 «дом в объёме»: the doll house in volume, grown from the look test kukolnyj-dom/proba-3d.html (the author 30.10: «Да, именно так.
// Соединим реализм с кукольностью… (отдаленно… Тим Бертон)»; «Собирай v31»). The page's own script plays the music and draws the lab; this
// module only draws the house, in its own canvas over the lab's, when the view is the house and tonight is Buenos Aires. It reads and never
// writes: window.HOUSE gives the picture's clock (the sound's, less what the speakers take, less the hand-set shift), where each of Nell's
// hands is — a pitch along the keys and a lift in metres, from the strokes the engine has already scheduled — the keys as they stand,
// tonight's place, the three knobs of the look (kukla, glaza, teplo). Units are metres, as if the dolls were people; all is made by code.

const $ = (id) => document.getElementById(id);
const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z), V2 = (x, y) => new THREE.Vector2(x, y), UP = V3(0, 1, 0);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const HS = window.HOUSE, K0 = HS.knobs(), K = { kuk: K0.kukla, eyes: K0.glaza, warm: K0.teplo, igra: K0.igra, vmeste: K0.vmeste, mir: K0.mir, har: K0.harakter };   // the three knobs of the look: the page's kukla, glaza, teplo

// ── the renderer and the film it makes
const cv = $('c3d');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { window.DOM3D = { ok: false, failed: true, show() {}, frame() {}, resize() {} }; throw e; }   // no WebGL: the page keeps the flat house
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090605);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);

const FILM = {   // grain and a soft vignette, after the tone mapping — the look of a film, not of a screen
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.045 }, vig: { value: 0.5 }, res: { value: V2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vig; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5; q.x *= res.x / res.y;
      c.rgb *= mix(1.0, smoothstep(1.05, 0.2, length(q)), vig);
      float n = h(gl_FragCoord.xy + fract(time * 7.13) * 91.7) - 0.5;
      c.rgb += n * grain * (0.35 + 0.65 * (1.0 - dot(c.rgb, vec3(0.333))));
      gl_FragColor = vec4(c.rgb, 1.0);
    }`
};
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 16, 16);
gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 1.0, scale: 1.0, samples: 12 });
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.0009, maxblur: 0.005 });
composer.addPass(bokeh);
composer.addPass(new OutputPass());
const film = new ShaderPass(FILM);
composer.addPass(film);
function resize() {   // the lab's canvas size, under the bar
  const s = HS.size(), w = s.w, h = s.h; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix(); film.uniforms.res.value.set(w, h);
}
addEventListener('resize', resize);

// ── noise and canvases: every surface is painted here
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noise2(seed) {
  const R = rng(seed), N = 256, P = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) P[i] = R();
  return (x, y, px = 256, py = 256) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const wx = (a) => (((a % px) + px) % px) % N, wy = (a) => (((a % py) + py) % py) % N;
    const x0 = wx(xi), x1 = wx(xi + 1), y0 = wy(yi), y1 = wy(yi + 1), u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = P[x0 + y0 * N], b = P[x1 + y0 * N], c = P[x0 + y1 * N], d = P[x1 + y1 * N];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}
function fbm(n, x, y, oct = 4, px = 256, py = 256) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, px * f, py * f); t += a; a *= 0.5; f *= 2; } return s / t; }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function pix3(w, h, fn) {   // colour, bump and roughness of one surface in one pass: fn(u, v, C, o) sets C[0..2] and o.b, o.r (0..1)
  const cs = [cnv(w, h), cnv(w, h), cnv(w, h)], gs = cs.map((c) => c.getContext('2d')), im = gs.map((g) => g.createImageData(w, h));
  const C = [0, 0, 0], o = { b: 0.5, r: 0.5 }, A = im[0].data, B = im[1].data, Rr = im[2].data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    fn(x / w, y / h, C, o); const i = (y * w + x) * 4;
    A[i] = C[0]; A[i + 1] = C[1]; A[i + 2] = C[2]; A[i + 3] = 255;
    B[i] = B[i + 1] = B[i + 2] = clamp(o.b, 0, 1) * 255; B[i + 3] = 255; Rr[i] = Rr[i + 1] = Rr[i + 2] = clamp(o.r, 0, 1) * 255; Rr[i + 3] = 255;
  }
  gs.forEach((g, k) => g.putImageData(im[k], 0, 0)); return cs;
}
function tex(c, srgb, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = ANISO; return t; }
function texSet(cs) { return { map: tex(cs[0], true), bumpMap: tex(cs[1], false), roughnessMap: tex(cs[2], false) }; }
function rep(set, rx, ry) { const o = {}; for (const k in set) { o[k] = set[k].clone(); o[k].repeat.set(rx, ry); } return o; }

function crackleCanvas(seed) {   // the craquelure of old paint: the edges of a jittered cell pattern, tileable
  const S = 512, N = 44, R = rng(seed), P = [], n = noise2(seed + 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) P.push([(i + 0.1 + R() * 0.8) / N, (j + 0.1 + R() * 0.8) / N]);
  const c = cnv(S, S), g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, ci = Math.floor(u * N), cj = Math.floor(v * N); let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, p = P[((ii + N) % N) + ((jj + N) % N) * N];
      const px = p[0] + (ii < 0 ? -1 : ii >= N ? 1 : 0), py = p[1] + (jj < 0 ? -1 : jj >= N ? 1 : 0), dd = (px - u) ** 2 + (py - v) ** 2;
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    const line = 1 - smooth(0, 0.0022, Math.sqrt(d2) - Math.sqrt(d1)), val = 255 * (1 - line * (0.35 + 0.5 * fbm(n, u * 16, v * 16, 3, 16, 16)));
    const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function woodCanvases(seed, light, dark, lines, figure) {   // grain along v: the length of a turned part, of a board
  const n = noise2(seed), m = noise2(seed + 11);
  return pix3(512, 512, (u, v, C, o) => {
    const w = fbm(n, u * 4, v * 2, 4, 4, 2), s = u * lines + w * 4 + fbm(m, u * 8, v, 2, 8, 1) * 1.2;
    const ring = Math.pow(1 - Math.abs(Math.sin(s * PI)), 5), k = clamp(ring * 0.55 + (w - 0.5) * figure + 0.18, 0, 1);
    for (let i = 0; i < 3; i++) C[i] = light[i] + (dark[i] - light[i]) * k;
    o.b = 0.55 - ring * 0.3; o.r = 0.5 + ring * 0.25 + (w - 0.5) * 0.2;
  });
}
function clothCanvases(seed, base, kind) {   // wool twill (with a pinstripe or a check), plain cotton, satin; coarse, as doll's cloth is
  const n = noise2(seed);
  return pix3(256, 256, (u, v, C, o) => {
    const f = fbm(n, u * 32, v * 32, 3, 32, 32) - 0.5;
    const rib = kind === 'plain' ? 0.5 + 0.25 * (Math.sin(u * PI * 2 * 48) + Math.sin(v * PI * 2 * 48)) : 0.5 + 0.5 * Math.sin((u + v) * PI * 2 * (kind === 'satin' ? 40 : 28));
    let k = 0.84 + 0.12 * rib + 0.26 * f, add = 0;
    if (kind === 'pin' && Math.abs(((u * 5) % 1) - 0.5) < 0.02) add = 34;
    if (kind === 'check') add = (Math.abs(((u * 3) % 1) - 0.5) < 0.024 ? 22 : 0) + (Math.abs(((v * 3) % 1) - 0.5) < 0.024 ? 22 : 0);
    for (let i = 0; i < 3; i++) C[i] = clamp(base[i] * k + add * (1 - i * 0.12), 0, 255);
    o.b = 0.35 + 0.4 * rib + 0.35 * f; o.r = 0.92 - 0.12 * rib;
  });
}
function marbleCanvases(seed) {
  const n = noise2(seed);
  return pix3(512, 512, (u, v, C, o) => {
    const t = fbm(n, u * 4, v * 4, 5, 4, 4);
    const a = 1 - smooth(0, 0.07, Math.abs(Math.sin((u * 1.7 + v * 0.8 + t * 2.4) * PI * 2))), b = 1 - smooth(0, 0.04, Math.abs(Math.sin((u * 0.6 - v * 1.3 + t * 3.2) * PI * 3)));
    const k = a * 0.42 + b * 0.22 + (t - 0.5) * 0.14;
    C[0] = 232 - 74 * k; C[1] = 228 - 70 * k; C[2] = 219 - 60 * k; o.b = 0.5 - k * 0.1; o.r = 0.22 + k * 0.2;
  });
}
function boardsCanvases(seed) {   // the stage: oak boards, four across a tile, the varnish worn
  const n = noise2(seed), m = noise2(seed + 3), R = rng(seed), tone = [0, 1, 2, 3].map(() => 0.82 + R() * 0.32), ends = [0, 1, 2, 3].map(() => R());
  return pix3(512, 512, (u, v, C, o) => {
    const p = Math.floor(u * 4), pu = u * 4 - p, seam = Math.min(pu, 1 - pu) < 0.012 || Math.abs(((v + ends[p]) % 1) - 0.5) < 0.004;
    const w = fbm(n, u * 4, v * 2, 3, 4, 2), g = Math.pow(1 - Math.abs(Math.sin((u * 28 + w * 3 + fbm(m, u * 8, v * 2, 2, 8, 2)) * PI)), 6);
    const k = tone[p] * (0.85 + 0.25 * w) * (1 - 0.35 * g) * (seam ? 0.35 : 1), base = [116, 80, 50];
    for (let i = 0; i < 3; i++) C[i] = clamp(base[i] * k, 0, 255);
    o.b = seam ? 0.1 : 0.55 - g * 0.15; o.r = seam ? 0.9 : 0.55 + g * 0.15 + (w - 0.5) * 0.2;
  });
}
function tileCanvases(seed) {   // a calcáreo floor, as in the cafés of Buenos Aires: cream, terracotta, black; a 2×2 block of 20 cm tiles
  const S = 512, T = S / 2, cs = [cnv(S, S), cnv(S, S), cnv(S, S)], [g, gb, gr] = cs.map((c) => c.getContext('2d'));
  const cream = '#c4b393', terra = '#7a3e2c', black = '#2c2622';
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.save(); g.translate(i * T, j * T); g.beginPath(); g.rect(0, 0, T, T); g.clip();
    g.fillStyle = cream; g.fillRect(0, 0, T, T);
    const disc = (r, col) => { g.fillStyle = col; [[0, 0], [T, 0], [0, T], [T, T]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }); };
    disc(T * 0.3, terra); disc(T * 0.24, cream); disc(T * 0.08, black);
    g.fillStyle = black; g.beginPath(); g.moveTo(T / 2, T * 0.18); g.quadraticCurveTo(T * 0.57, T * 0.43, T * 0.82, T / 2); g.quadraticCurveTo(T * 0.57, T * 0.57, T / 2, T * 0.82); g.quadraticCurveTo(T * 0.43, T * 0.57, T * 0.18, T / 2); g.quadraticCurveTo(T * 0.43, T * 0.43, T / 2, T * 0.18); g.fill();
    g.fillStyle = terra; g.beginPath(); g.arc(T / 2, T / 2, T * 0.07, 0, PI * 2); g.fill();
    g.restore();
  }
  gb.fillStyle = '#c8c8c8'; gb.fillRect(0, 0, S, S); gr.fillStyle = '#787878'; gr.fillRect(0, 0, S, S);
  [g, gb, gr].forEach((x, k) => { x.strokeStyle = ['#5e574d', '#202020', '#e0e0e0'][k]; x.lineWidth = 4; for (let q = 0; q <= 2; q++) { x.beginPath(); x.moveTo(q * T, 0); x.lineTo(q * T, S); x.moveTo(0, q * T); x.lineTo(S, q * T); x.stroke(); } });
  const n = noise2(seed), im = g.getImageData(0, 0, S, S), d = im.data;   // grime, and the paths of the waiters
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.8 + 0.32 * fbm(n, x / S * 8, y / S * 8, 4, 8, 8), i = (y * S + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k * 0.97; }
  g.putImageData(im, 0, 0);
  return cs;
}
function wallpaperCanvases(seed) {   // a flocked damask in oxblood: the ornament a little raised and velvet
  const S = 512, cs = [cnv(S, S), cnv(S, S), cnv(S, S)], [g, gb, gr] = cs.map((c) => c.getContext('2d'));
  g.fillStyle = '#3c1c17'; g.fillRect(0, 0, S, S); gb.fillStyle = '#606060'; gb.fillRect(0, 0, S, S); gr.fillStyle = '#c0c0c0'; gr.fillRect(0, 0, S, S);
  const motif = (x, cx, cy) => { x.save(); x.translate(cx, cy); for (const sd of [1, -1]) { x.save(); x.scale(sd, 1);
    x.beginPath(); x.moveTo(0, -100); x.bezierCurveTo(34, -78, 52, -38, 20, -8); x.bezierCurveTo(62, -18, 84, 22, 52, 52); x.bezierCurveTo(30, 72, 10, 62, 0, 92); x.closePath(); x.fill();
    x.beginPath(); x.ellipse(58, -58, 11, 24, 0.6, 0, PI * 2); x.fill(); x.beginPath(); x.ellipse(72, 74, 9, 19, -0.7, 0, PI * 2); x.fill(); x.restore(); } x.restore(); };
  [[g, '#552c1d'], [gb, '#a8a8a8'], [gr, '#f4f4f4']].forEach(([x, col]) => { x.fillStyle = col; motif(x, 128, 128); motif(x, 384, 384); });
  const n = noise2(seed), im = g.getImageData(0, 0, S, S), d = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.86 + 0.22 * fbm(n, x / S * 64, y / S * 4, 2, 64, 4), i = (y * S + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  g.putImageData(im, 0, 0);
  return cs;
}
function tinCanvases() {   // the pressed tin of the ceiling, smoked
  const S = 256, cs = [cnv(S, S), cnv(S, S), cnv(S, S)], [g, gb, gr] = cs.map((c) => c.getContext('2d'));
  g.fillStyle = '#7d6f56'; g.fillRect(0, 0, S, S); gb.fillStyle = '#808080'; gb.fillRect(0, 0, S, S); gr.fillStyle = '#909090'; gr.fillRect(0, 0, S, S);
  [[g, '#938361', '#5f533e'], [gb, '#d0d0d0', '#303030']].forEach(([x, hi, lo]) => { x.lineWidth = 10; x.strokeStyle = hi; x.strokeRect(8, 8, S - 16, S - 16); x.lineWidth = 4; x.strokeStyle = lo; x.strokeRect(26, 26, S - 52, S - 52); x.fillStyle = hi; x.beginPath(); x.arc(S / 2, S / 2, 34, 0, PI * 2); x.fill(); x.fillStyle = lo; x.beginPath(); x.arc(S / 2, S / 2, 14, 0, PI * 2); x.fill(); });
  return cs;
}
function sheetCanvas(seed) {   // the music on the stand: El choclo, the tango their forms are cut from (v29)
  const W = 256, H = 352, c = cnv(W, H), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = '#ddd0b0'; g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,60,20,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a2018'; g.textAlign = 'center'; g.font = 'italic 16px Georgia, serif'; g.fillText('El choclo', W / 2, 30); g.font = '9px Georgia, serif'; g.fillText('tango criollo', W / 2, 43);
  for (let s = 0; s < 7; s++) { const y0 = 62 + s * 40; g.strokeStyle = 'rgba(40,30,20,0.75)'; g.lineWidth = 0.8; for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(16, y0 + l * 4); g.lineTo(W - 16, y0 + l * 4); g.stroke(); }
    for (let x = 30; x < W - 20; x += 9 + R() * 8) { const y = y0 + Math.floor(R() * 9) * 2; g.fillStyle = '#1c1510'; g.beginPath(); g.ellipse(x, y, 2.6, 1.9, -0.4, 0, PI * 2); g.fill(); g.fillRect(x + 2, y - 12, 0.9, 12); }
    for (let x = 16 + 58; x < W - 16; x += 58) { g.fillRect(x, y0, 0.8, 16); } }
  return c;
}
function streetCanvas() {   // Corrientes past midnight: the Teatro Nuevo across the street, its doors lit yellow; a green tram, a lamp
  const W = 2048, H = 1024, c = cnv(W, H), g = c.getContext('2d'), px = W / 12, X = (x) => (x + 3.6) * px, Y = (y) => (5.5 - y) * px;
  let gr = g.createLinearGradient(0, 0, 0, Y(0)); gr.addColorStop(0, '#03050b'); gr.addColorStop(1, '#141c33'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(8,8,12,0.9)'; g.lineWidth = 2; [4.9, 5.05].forEach((y) => { g.beginPath(); g.moveTo(0, Y(y)); g.quadraticCurveTo(W / 2, Y(y - 0.12), W, Y(y)); g.stroke(); });
  g.fillStyle = '#17161a'; g.fillRect(X(-3.6), Y(4.3), X(0.9) - X(-3.6), Y(0) - Y(4.3));
  g.fillStyle = '#141318'; g.fillRect(X(6.9), Y(4.6), X(8.4) - X(6.9), Y(0) - Y(4.6));
  [[-2.6, 2.9], [-1.4, 3.4], [-0.2, 2.9], [7.4, 3.3]].forEach(([x, y]) => { g.fillStyle = '#c9963f'; g.fillRect(X(x), Y(y + 0.7), 0.42 * px, 0.7 * px); g.fillStyle = 'rgba(40,24,10,0.55)'; g.fillRect(X(x) + 0.2 * px, Y(y + 0.7), 0.03 * px, 0.7 * px); });
  const tx0 = 0.9, tx1 = 6.9;
  gr = g.createLinearGradient(0, Y(4.8), 0, Y(0)); gr.addColorStop(0, '#6f695e'); gr.addColorStop(1, '#8d8576'); g.fillStyle = gr; g.fillRect(X(tx0), Y(4.8), X(tx1) - X(tx0), Y(0) - Y(4.8));
  g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 1.5; for (let y = 0.3; y < 2.8; y += 0.3) { g.beginPath(); g.moveTo(X(tx0), Y(y)); g.lineTo(X(tx1), Y(y)); g.stroke(); }
  g.fillStyle = '#5d584f'; g.fillRect(X(tx0 - 0.1), Y(4.95), X(tx1 + 0.1) - X(tx0 - 0.1), 0.18 * px); g.fillRect(X(tx0 - 0.06), Y(2.95), X(tx1 + 0.06) - X(tx0 - 0.06), 0.12 * px);
  [1.3, 2.9, 4.9, 6.5].forEach((x) => { g.fillStyle = '#7d766a'; g.fillRect(X(x - 0.14), Y(4.8), 0.28 * px, Y(0) - Y(4.8)); });
  g.fillStyle = '#3e3a33'; g.font = `bold ${Math.round(0.32 * px)}px Georgia, serif`; g.textAlign = 'center'; g.fillText('TEATRO NUEVO', X(3.9), Y(4.25));
  [1.9, 3.9, 5.9].forEach((x) => { g.fillStyle = '#2a2622'; g.fillRect(X(x - 0.35), Y(4.0), 0.7 * px, 0.85 * px); g.fillStyle = 'rgba(200,150,70,0.35)'; g.fillRect(X(x - 0.3), Y(3.95), 0.6 * px, 0.75 * px); });
  [2.1, 3.9, 5.7].forEach((x) => {
    const w = 0.8, h = 2.3, r = w / 2;
    gr = g.createRadialGradient(X(x), Y(1.1), 0.1 * px, X(x), Y(1.1), 1.6 * px); gr.addColorStop(0, 'rgba(255,196,96,0.45)'); gr.addColorStop(1, 'rgba(255,196,96,0)'); g.fillStyle = gr; g.fillRect(X(x - 1.6), Y(2.7), 3.2 * px, 2.7 * px);
    const dg = g.createLinearGradient(0, Y(h), 0, Y(0)); dg.addColorStop(0, '#d9a24c'); dg.addColorStop(1, '#a8702c'); g.fillStyle = dg; g.beginPath(); g.moveTo(X(x - r), Y(0)); g.lineTo(X(x - r), Y(h - r)); g.arc(X(x), Y(h - r), r * px, PI, 0); g.lineTo(X(x + r), Y(0)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(50,30,12,0.75)'; g.lineWidth = 3; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(X(x - r), Y(k * 0.5)); g.lineTo(X(x + r), Y(k * 0.5)); g.stroke(); } g.beginPath(); g.arc(X(x), Y(h - r), r * px * 0.6, PI, 0); g.stroke();
    g.fillStyle = 'rgba(120,70,20,0.5)'; g.fillRect(X(x - 0.03), Y(h), 0.06 * px, h * px); g.fillStyle = 'rgba(60,34,10,0.6)'; g.fillRect(X(x - r), Y(1.2), w * px, 0.05 * px);
  });
  // v34: the passers-by walk on their own planes now (WORLD3.people)
  g.fillStyle = '#0c0c0e'; g.fillRect(X(1.25), Y(3.3), 0.07 * px, 3.3 * px);
  gr = g.createRadialGradient(X(1.28), Y(3.4), 0.03 * px, X(1.28), Y(3.4), 1.1 * px); gr.addColorStop(0, 'rgba(255,226,150,1)'); gr.addColorStop(0.12, 'rgba(255,200,110,0.7)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gr; g.fillRect(X(0.2), Y(4.5), 2.2 * px, 2.2 * px);
  // v34: the tram runs on its own plane now (WORLD3.tram)
  g.fillStyle = '#2b2a2c'; g.fillRect(0, Y(0.12), W, 0.14 * px);
  gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(20,30,60,0.25)'); gr.addColorStop(1, 'rgba(20,30,60,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return c;
}
function cobbleCanvas(seed) {   // the wet setts of the street; the doors and the lamp lie in them as streaks
  const W = 1024, H = 512, c = cnv(W, H), g = c.getContext('2d'), R = rng(seed), sx = (x) => (x + 3.6) / 12 * W;
  g.fillStyle = '#0d0e12'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 9) for (let x = (y / 9) % 2 ? 0 : 6; x < W; x += 12) { const k = 18 + R() * 16; g.fillStyle = `rgb(${k},${k + 2},${k + 8})`; g.beginPath(); g.ellipse(x, y + 4, 5.2, 3.6, 0, 0, PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(150,150,160,0.5)'; g.lineWidth = 2; [H * 0.42, H * 0.47].forEach((y) => { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); });
  [[2.1, 'rgba(255,190,90,'], [3.9, 'rgba(255,190,90,'], [5.7, 'rgba(255,190,90,'], [1.28, 'rgba(255,220,150,']].forEach(([x, col]) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col + '0.42)'); gr.addColorStop(1, col + '0)'); g.fillStyle = gr; g.fillRect(sx(x) - 14, 0, 28, H); });
  return c;
}
function caneCanvas() {
  const S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#3a2a18'; g.fillRect(0, 0, S, S); g.strokeStyle = '#c4a068'; g.lineWidth = 3;
  for (let i = -S; i < 2 * S; i += 16) { [[i, 0, i, S], [0, i, S, i], [i, 0, i + S, S], [i + S, 0, i, S]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }); }
  return c;
}
function pearlCanvas() {   // the end boards of the bandoneón: black, with mother-of-pearl
  const S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#0f0d0d'; g.fillRect(0, 0, S, S); g.strokeStyle = '#d9d4c8'; g.lineWidth = 3; g.strokeRect(16, 16, S - 32, S - 32); g.lineWidth = 1.5; g.strokeRect(24, 24, S - 48, S - 48);
  g.fillStyle = '#e8e2d6'; [[24, 24], [S - 24, 24], [24, S - 24], [S - 24, S - 24]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, PI * 2); g.fill(); });
  g.save(); g.translate(S / 2, S / 2); for (let k = 0; k < 8; k++) { g.rotate(PI / 4); g.beginPath(); g.ellipse(0, -26, 7, 18, 0, 0, PI * 2); g.fill(); } g.fillStyle = '#b89a5a'; g.beginPath(); g.arc(0, 0, 9, 0, PI * 2); g.fill(); g.restore();
  return c;
}
function bellowsCanvas(folds) {
  const W = 64, H = 512, c = cnv(W, H), g = c.getContext('2d'), band = H / (folds * 2);
  for (let i = 0; i < folds * 2; i++) { g.fillStyle = i % 2 ? '#171414' : '#211b1a'; g.fillRect(0, i * band, W, band); }
  for (let i = 0; i <= folds * 2; i += 2) { g.fillStyle = '#7a2a22'; g.fillRect(0, i * band - 3, W, 6); g.fillStyle = '#c9a85a'; for (let x = 4; x < W; x += 10) g.fillRect(x, i * band - 1, 3, 2); }
  return c;
}
function newsCanvas(seed) {
  const W = 256, H = 180, c = cnv(W, H), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = '#cfc6b0'; g.fillRect(0, 0, W, H); g.fillStyle = '#2a2622'; g.font = 'bold 22px Georgia, serif'; g.fillText('CRÍTICA', 10, 26);
  for (let col = 0; col < 4; col++) for (let y = 40; y < H - 6; y += 5) g.fillRect(8 + col * 62, y, 50 * (0.6 + R() * 0.4), 1.6);
  return c;
}
function bassTopCanvas(outline) {   // the top of the double bass: an old amber varnish, spruce grain, the purfling, the f-holes
  const W = 640, H = 1014, c = cnv(W, H), g = c.getContext('2d'), X = (x) => (x + 0.36) / 0.72 * W, Y = (y) => (1 - (y + 0.03) / 1.14) * H, R = rng(5);
  g.fillStyle = '#3a1808'; g.fillRect(0, 0, W, H);
  const path = (k) => { g.beginPath(); outline.forEach((p, i) => { const x = p.x * k, y = 0.53 + (p.y - 0.53) * (1 - (1 - k) * 0.8); i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }); g.closePath(); };
  g.save(); path(1); g.clip();
  const gr = g.createRadialGradient(X(0), Y(0.42), 30, X(0), Y(0.5), 420); gr.addColorStop(0, '#a5602a'); gr.addColorStop(0.6, '#7a3b16'); gr.addColorStop(1, '#3c1909'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 3 + R() * 3) { g.strokeStyle = `rgba(40,16,4,${0.12 + R() * 0.18})`; g.lineWidth = 1 + R(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 6, H); g.stroke(); }
  g.restore();
  [[0.955, '#120804', 3], [0.948, '#c9a46a', 1.5], [0.941, '#120804', 3]].forEach(([k, col, w]) => { g.strokeStyle = col; g.lineWidth = w; path(k); g.stroke(); });
  g.strokeStyle = '#080402'; g.fillStyle = '#080402'; g.lineCap = 'round'; g.lineWidth = 7;
  [-1, 1].forEach((s) => { g.save(); g.translate(X(s * 0.105), Y(0.5)); const hy = 0.15 / 1.14 * H;
    g.beginPath(); g.moveTo(-2 * s, -hy); g.bezierCurveTo(18 * s, -hy * 0.35, -18 * s, hy * 0.35, 2 * s, hy); g.stroke();
    g.beginPath(); g.arc(-4 * s, -hy - 4, 8, 0, PI * 2); g.fill(); g.beginPath(); g.arc(4 * s, hy + 4, 9, 0, PI * 2); g.fill(); g.fillRect(-13, -2, 26, 4); g.restore(); });
  return c;
}
function hairCanvases(seed) {   // painted hair: combed strokes from the hairline to the crown
  const n = noise2(seed);
  return pix3(256, 256, (u, v, C, o) => {
    const s = fbm(n, u * 48, v * 2, 3, 48, 2), line = Math.pow(Math.abs(Math.sin((u * 48 + s * 2) * PI)), 3), k = 0.75 + 0.6 * line * s;
    C[0] = 30 * k; C[1] = 21 * k; C[2] = 16 * k; o.b = 0.4 + 0.4 * line; o.r = 0.3 + 0.2 * (1 - line);
  });
}
function eyeCanvas(iris) {   // a painted glass eye: the iris at the front of the ball (u 0.25, v 0.5)
  const W = 512, H = 256, c = cnv(W, H), g = c.getContext('2d'), [r, gg, b] = hexRGB(iris), css = (k) => `rgb(${clamp(r * k, 0, 255) | 0},${clamp(gg * k, 0, 255) | 0},${clamp(b * k, 0, 255) | 0})`;
  g.fillStyle = '#f1ebe0'; g.fillRect(0, 0, W, H);
  const cx = W * 0.25, cy = H / 2, R = H * 0.15;
  const g0 = g.createRadialGradient(cx, cy, H * 0.2, cx, cy, H * 0.62); g0.addColorStop(0, 'rgba(0,0,0,0)'); g0.addColorStop(1, 'rgba(150,90,80,0.35)'); g.fillStyle = g0; g.fillRect(0, 0, W, H);
  const gi = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R); gi.addColorStop(0, css(1.35)); gi.addColorStop(0.7, css(1)); gi.addColorStop(1, css(0.6)); g.fillStyle = gi; g.beginPath(); g.arc(cx, cy, R, 0, PI * 2); g.fill();
  g.strokeStyle = css(0.55); g.lineWidth = 1.2; for (let i = 0; i < 70; i++) { const a = i / 70 * PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); g.stroke(); }
  g.strokeStyle = 'rgba(16,10,8,0.85)'; g.lineWidth = R * 0.1; g.beginPath(); g.arc(cx, cy, R * 0.96, 0, PI * 2); g.stroke();
  g.fillStyle = '#080605'; g.beginPath(); g.arc(cx, cy, R * 0.42, 0, PI * 2); g.fill();
  return c;
}
function mirrorCanvases() {   // an old café mirror: the silver dark and foxed at the edges, the name in gilt on the back of the glass
  const W = 512, H = 832, cs = [cnv(W, H), cnv(W, H), cnv(W, H)], [g, gr, ge] = cs.map((c) => c.getContext('2d')), R = rng(77);
  const gg = g.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, '#4a443c'); gg.addColorStop(1, '#36312b'); g.fillStyle = gg; g.fillRect(0, 0, W, H);
  gr.fillStyle = '#202020'; gr.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { const e = R() < 0.5, x = e ? (R() < 0.5 ? R() * 70 : W - R() * 70) : R() * W, y = e ? R() * H : (R() < 0.5 ? R() * 70 : H - R() * 70), r = 4 + R() * 24;
    const f = g.createRadialGradient(x, y, 0, x, y, r); f.addColorStop(0, 'rgba(58,44,28,0.6)'); f.addColorStop(1, 'rgba(58,44,28,0)'); g.fillStyle = f; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    gr.fillStyle = 'rgba(140,140,140,0.22)'; for (let q = 0; q < 3; q++) { gr.beginPath(); gr.ellipse(x + (R() - 0.5) * r, y + (R() - 0.5) * r, r * (0.25 + R() * 0.35), r * (0.2 + R() * 0.3), R() * PI, 0, PI * 2); gr.fill(); } }
  [[g, '#c9a24e'], [gr, '#5c5c5c'], [ge, '#c9a24e']].forEach(([x, col]) => { x.fillStyle = col; x.strokeStyle = col; x.textAlign = 'center';
    x.lineWidth = 3; x.strokeRect(26, 26, W - 52, H - 52); x.lineWidth = 1.2; x.strokeRect(38, 38, W - 76, H - 76);
    x.font = 'italic 74px Georgia, serif'; x.fillText('Café', W / 2, 150); x.font = 'bold 50px Georgia, serif'; x.fillText('DOMÍNGUEZ', W / 2, 212);
    x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 120, 240); x.quadraticCurveTo(W / 2, 262, W / 2 + 120, 240); x.stroke();
    x.font = 'italic 25px Georgia, serif'; x.fillText('orquesta típica', W / 2, H - 96); x.fillText('todas las noches', W / 2, H - 64); });
  return cs;
}
function phantomCanvas() {   // only for the environment: the café's other half, dim, where the doll's house is open — what the mirror and the varnish reflect
  const W = 512, H = 256, c = cnv(W, H), g = c.getContext('2d');
  const gg = g.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, '#120a06'); gg.addColorStop(0.5, '#3a2414'); gg.addColorStop(1, '#1a0f08'); g.fillStyle = gg; g.fillRect(0, 0, W, H);
  [[0.18, 0.34, 26], [0.25, 0.3, 30], [0.32, 0.36, 22], [0.08, 0.4, 18], [0.42, 0.38, 18]].forEach(([u, v, r]) => { const f = g.createRadialGradient(u * W, v * H, 0, u * W, v * H, r); f.addColorStop(0, 'rgba(255,190,110,0.9)'); f.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = f; g.fillRect(u * W - r, v * H - r, 2 * r, 2 * r); });
  return c;
}
function clockCanvas() {   // v34: an enamel face, Roman hours, the minutes ticked
  const S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#efe6d0'; g.fillRect(0, 0, S, S); g.strokeStyle = '#2a2018'; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 10, 0, PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * PI * 2, r0 = S / 2 - (i % 5 ? 16 : 22), r1 = S / 2 - 11; g.lineWidth = i % 5 ? 1.5 : 3; g.beginPath(); g.moveTo(S / 2 + Math.sin(a) * r0, S / 2 - Math.cos(a) * r0); g.lineTo(S / 2 + Math.sin(a) * r1, S / 2 - Math.cos(a) * r1); g.stroke(); }
  g.fillStyle = '#2a2018'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = i / 12 * PI * 2, r = S / 2 - 44; g.fillText(n, S / 2 + Math.sin(a) * r, S / 2 - Math.cos(a) * r); });
  return c;
}
function tramCanvas() {   // v34: the green tram of Corrientes, its windows lit, its pole up to the wire — 3.4 by 3.6 m
  const W = 512, H = 544, c = cnv(W, H), g = c.getContext('2d'), px = W / 3.4, X = (x) => x * px, Y = (y) => (3.6 - y) * px;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#244c35'; g.fillRect(X(0.05), Y(2.6), X(3.35) - X(0.05), 2.25 * px); g.fillStyle = '#1a3a28'; g.fillRect(X(0.05), Y(2.74), X(3.35) - X(0.05), 0.16 * px);
  g.fillStyle = '#c9b98e'; g.fillRect(X(0.05), Y(1.35), X(3.35) - X(0.05), 0.12 * px);
  for (let x = 0.3; x < 3.0; x += 0.55) { g.fillStyle = '#e8c878'; g.fillRect(X(x), Y(2.4), 0.42 * px, 0.75 * px); g.fillStyle = 'rgba(80,50,20,0.35)'; g.fillRect(X(x), Y(2.4) + 0.5 * px, 0.42 * px, 0.25 * px); }
  g.fillStyle = '#0c0c0c'; g.fillRect(X(0.05), Y(0.38), X(3.35) - X(0.05), 0.3 * px); [0.7, 2.7].forEach((x) => { g.beginPath(); g.arc(X(x), Y(0.3), 0.28 * px, 0, PI * 2); g.fill(); });
  g.strokeStyle = '#0c0c0c'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(1.4), Y(2.74)); g.lineTo(X(2.4), Y(3.58)); g.stroke();
  return c;
}
function peopleCanvas(k) {   // v34: a passer-by, dark against the lit doors — a man in a hat (0), a woman in a long coat (1)
  const W = 128, H = 264, c = cnv(W, H), g = c.getContext('2d'), px = H / 1.9, X = (x) => W / 2 + x * px, Y = (y) => H - y * px;
  g.clearRect(0, 0, W, H); g.fillStyle = '#0d0b0a'; g.beginPath(); g.ellipse(X(0), Y(1.6), 0.1 * px, 0.12 * px, 0, 0, PI * 2); g.fill();
  if (!k) { g.fillRect(X(-0.17), Y(1.74), 0.34 * px, 0.04 * px); g.fillRect(X(-0.1), Y(1.86), 0.2 * px, 0.13 * px); g.fillRect(X(-0.19), Y(1.48), 0.38 * px, 0.8 * px); g.fillRect(X(-0.16), Y(0.7), 0.13 * px, 0.7 * px); g.fillRect(X(0.03), Y(0.7), 0.13 * px, 0.7 * px); }
  else { g.beginPath(); g.moveTo(X(-0.16), Y(1.46)); g.lineTo(X(0.16), Y(1.46)); g.lineTo(X(0.26), Y(0.05)); g.lineTo(X(-0.26), Y(0.05)); g.closePath(); g.fill(); g.beginPath(); g.ellipse(X(0), Y(1.78), 0.16 * px, 0.05 * px, 0, 0, PI * 2); g.fill(); }
  return c;
}
function shadeCanvas() { const S = 128, c = cnv(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(6,6,8,0.92)'); gr.addColorStop(1, 'rgba(6,6,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); return c; }   // v34: the warm air round a lit door, put out
function dotCanvas() { const S = 64, c = cnv(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); return c; }

// ── materials
const TX = {}, M = {};
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const srgb = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
async function buildMaterials() {   // v34: the heavy painting one canvas at a time, the page breathing between them — the music needs the main thread
  TX.crackle = crackleCanvas(7); await tick();
  const L = texSet(woodCanvases(3, [222, 192, 150], [176, 136, 94], 40, 0.3)); await tick();
  const MA = texSet(woodCanvases(5, [92, 40, 22], [42, 15, 8], 30, 0.6)); await tick();
  const WA = texSet(woodCanvases(9, [74, 46, 28], [34, 20, 12], 34, 0.5)); await tick();
  const SE = texSet(woodCanvases(31, [196, 160, 112], [150, 112, 72], 22, 0.25)); await tick();
  const MP = texSet(woodCanvases(15, [96, 36, 14], [56, 18, 6], 60, 0.4)); await tick();
  const OA = texSet(boardsCanvases(13)); await tick();
  const MB = texSet(marbleCanvases(17)); await tick();
  const TI = texSet(tileCanvases(19)); await tick();
  const PA = texSet(wallpaperCanvases(23)); await tick();
  const TN = texSet(tinCanvases()); await tick();
  TX.crackleB = tex(TX.crackle, false, 3, 2);
  M.linden = phys({ ...rep(L, 1, 1), roughness: 1, bumpScale: 0.6, clearcoat: 0.55, clearcoatRoughness: 0.35 });
  M.lacquer = phys({ ...rep(MA, 1.5, 1.5), roughness: 0.9, bumpScale: 0.25, clearcoat: 1, clearcoatRoughness: 0.14 });
  M.lacquer2 = phys({ ...rep(MA, 0.8, 0.8), color: 0xd8c0b0, roughness: 0.9, bumpScale: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 });
  M.walnut = phys({ ...rep(WA, 1, 3), roughness: 0.95, bumpScale: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.4 });
  M.bent = phys({ ...rep(WA, 0.25, 3), roughness: 0.9, bumpScale: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  M.maple = phys({ ...rep(MP, 2, 1), roughness: 0.8, bumpScale: 0.2, clearcoat: 1, clearcoatRoughness: 0.2 });
  M.ivory = phys({ color: 0xece0c4, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  M.ebony = phys({ color: 0x141011, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  M.brass = phys({ color: 0xc49a50, metalness: 1, roughness: 0.32 });
  M.gilt = phys({ color: 0xb88f3e, metalness: 1, roughness: 0.42 });
  M.gold = phys({ color: 0xd6ae5a, metalness: 1, roughness: 0.25 });
  M.iron = phys({ color: 0x1b1a1a, metalness: 0.6, roughness: 0.55 });
  M.steel = phys({ color: 0x9a9890, metalness: 1, roughness: 0.3 });
  M.marble = phys({ ...MB, roughness: 1, bumpScale: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  M.tiles = (rx, ry) => phys({ ...rep(TI, rx, ry), roughness: 1, bumpScale: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  M.oak = (rx, ry) => phys({ ...rep(OA, rx, ry), roughness: 1, bumpScale: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  M.paper = (rx, ry) => phys({ ...rep(PA, rx, ry), roughness: 1, bumpScale: 0.6, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x7a3a2a) });
  M.tin = (rx, ry) => phys({ ...rep(TN, rx, ry), roughness: 0.8, bumpScale: 1.2, metalness: 0.3 });
  M.section = phys({ ...rep(SE, 1, 4), roughness: 1, bumpScale: 0.4 });
  M.outer = phys({ color: 0x1a120c, roughness: 0.9 });
  M.felt = phys({ color: 0x6e1b1b, roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xa04040) });
  M.velvet = phys({ color: 0x5a1a1e, roughness: 1, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xb05060) });
  M.sheet = new THREE.MeshStandardMaterial({ map: tex(sheetCanvas(37), true), roughness: 0.9, side: THREE.DoubleSide }); await tick();
  M.news = new THREE.MeshStandardMaterial({ map: tex(newsCanvas(53), true), roughness: 0.95 }); await tick();
  M.candle = phys({ color: 0xf0e8d6, roughness: 0.6, sheen: 0.3 });
  const MI = mirrorCanvases(); M.mirror = phys({ map: tex(MI[0], true), roughnessMap: tex(MI[1], false), emissiveMap: tex(MI[2], true), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.12, metalness: 1, roughness: 1, envMapIntensity: 1.3 }); await tick();
  M.cane = phys({ map: tex(caneCanvas(), true, 2, 2), roughness: 0.85 }); await tick();
  M.street = new THREE.MeshBasicMaterial({ map: tex(streetCanvas(), true), color: 0x7c7c7c }); await tick();
  M.cobble = new THREE.MeshBasicMaterial({ map: tex(cobbleCanvas(41), true), color: 0x8a8a8a }); await tick();
  M.leather = phys({ color: 0x0e0b0a, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  M.felt2 = phys({ color: 0x121010, roughness: 1, sheen: 0.8, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x3a3434) });
  M.pearl = phys({ map: tex(pearlCanvas(), true), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }); await tick();
  M.bandWood = phys({ color: 0x120e0d, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 });
  M.pearlBtn = phys({ color: 0xece6da, roughness: 0.25, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.4 });
  M.bellows = phys({ map: tex(bellowsCanvas(9), true), roughness: 0.6, flatShading: true }); await tick();
  M.hair = phys({ ...texSet(hairCanvases(43)), roughness: 1, bumpScale: 0.8, clearcoat: 0.8, clearcoatRoughness: 0.3 }); await tick();
  M.lash = phys({ color: 0x1a110c, roughness: 0.6 });
  const SH = texSet(clothCanvases(61, [232, 226, 212], 'plain')); await tick();
  M.shirt = (rx, ry) => phys({ ...rep(SH, rx, ry), roughness: 1, bumpScale: 0.5, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff) });
  M.silk = (hex) => phys({ color: new THREE.Color(hex), roughness: 0.42, sheen: 1, sheenRoughness: 0.32, sheenColor: new THREE.Color(hex).multiplyScalar(1.4), clearcoat: 0.2 });
  M.horn = phys({ color: 0x2a1c14, roughness: 0.3, clearcoat: 0.8 });
  M.amber = phys({ color: 0xd88a28, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(0x4a2000), emissiveIntensity: 0.4 });
  M.glassGreen = phys({ color: 0x1f3a22, roughness: 0.08, clearcoat: 1, metalness: 0.1 });
  M.wine = phys({ color: 0x4a0a10, roughness: 0.1, clearcoat: 1 });
  M.coffee = phys({ color: 0x1a0d06, roughness: 0.15, clearcoat: 1 });
  M.china = phys({ color: 0xf2eee6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.string = phys({ color: 0xb8b0a0, metalness: 1, roughness: 0.35 });
}

// ── geometry helpers
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; }
function rbox(w, h, d, r = 0.01, seg = 2) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.05, h / 2.05, d / 2.05)); }
const lathe = (pts, segs = 32, a = 0, b = PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(r, 0.0001), y)), segs, a, b);
function tubeGeo(pts, r, seg = 32, rs = 8) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(p[0], p[1], p[2])))), seg, r, rs); }
function setSeg(m, a, b) { const d = b.clone().sub(a); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.normalize()); }
function taperBox(len, w0, w1, d0, d1) {   // a box along y, its width and depth eased from one end to the other
  const g = new THREE.BoxGeometry(1, len, 1, 1, 4, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len + 0.5; p.setX(i, p.getX(i) * lerp(w0, w1, t)); p.setZ(i, p.getZ(i) * lerp(d0, d1, t)); }
  g.computeVertexNormals(); return g;
}
function ringsFn(rings) {   // a body as rings of ellipses up its height, eased between them (Catmull-Rom)
  return (y) => {
    const n = rings.length; if (y <= rings[0].y) return rings[0]; if (y >= rings[n - 1].y) return rings[n - 1];
    let i = 0; while (rings[i + 1].y < y) i++;
    const a = rings[Math.max(0, i - 1)], b = rings[i], c = rings[i + 1], d = rings[Math.min(n - 1, i + 2)], t = (y - b.y) / (c.y - b.y);
    const cr = (k) => { const p0 = a[k] || 0, p1 = b[k] || 0, p2 = c[k] || 0, p3 = d[k] || 0; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); };
    return { y, rx: cr('rx'), rz: cr('rz'), cx: cr('cx'), cz: cr('cz') };
  };
}
function gridGeo(rows, cols, at, closed) {   // a surface from a function at(i, j) → [x, y, z]; uv = (j / cols, i / rows); normals outward
  const P = [], U = [], I = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { P.push(...at(i, j)); U.push(j / cols, i / rows); }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; I.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  if (closed) { const N = g.attributes.normal; for (let i = 0; i <= rows; i++) { const a = i * (cols + 1), b = a + cols; const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); } }
  return g;
}
function loftGeo(R, y0, y1, rows, cols, pa = -PI, pb = PI, off = 0) {
  const F = (f, y) => (typeof f === 'function' ? f(y) : f);
  return gridGeo(rows, cols, (i, j) => { const y = lerp(y0, y1, i / rows), r = R(y), a = F(pa, y), b = F(pb, y), p = lerp(a, b, j / cols), o = typeof off === 'function' ? off(y, j / cols) : off;
    return [(r.cx || 0) + (r.rx + o) * Math.sin(p), y, (r.cz || 0) + (r.rz + o) * Math.cos(p)]; }, pa === -PI && pb === PI);
}
function surfacePoint(R, y, p, off) { const r = R(y); return V3((r.cx || 0) + (r.rx + off) * Math.sin(p), y, (r.cz || 0) + (r.rz + off) * Math.cos(p)); }

// ── the room: Café Domínguez, Corrientes 1500, cut open in front like a doll's house
const RW = 3.6, RB = -2.4, RF = 1.3, RH = 3.4, WT = 0.2, STAGE = 0.32;
const room = new THREE.Group(); scene.add(room);
const LAMPS = [], SCONCES = [], WORLD3 = {};
let windowLight = null;
function wainscot(len, h, x, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; room.add(g);
  mesh(rbox(len, 0.14, 0.035, 0.008), M.walnut, 0, 0.07, 0.0175, g);
  mesh(new THREE.BoxGeometry(len, h - 0.14, 0.012), M.walnut, 0, 0.14 + (h - 0.14) / 2, 0.006, g);
  mesh(rbox(len, 0.05, 0.05, 0.012), M.walnut, 0, h, 0.025, g);
  const n = Math.max(1, Math.round(len / 0.62)); for (let i = 0; i < n; i++) mesh(rbox(len / n - 0.12, h - 0.34, 0.02, 0.006), M.walnut, -len / 2 + (i + 0.5) * len / n, 0.14 + (h - 0.14) / 2, 0.016, g);
}
function lamp(x, y, z, power) {   // a pendant on its cord: brass, an opal shade, a bulb; a soft spot down and a little glow all round
  mesh(new THREE.CylinderGeometry(0.006, 0.006, RH - y, 6), M.iron, x, (RH + y) / 2, z, room, false, false);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 16), M.brass, x, RH - 0.015, z, room);
  mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.08, 16), M.brass, x, y + 0.02, z, room);
  const shadeM = phys({ color: 0xf0e2c8, emissive: new THREE.Color(0xffc070), emissiveIntensity: 0.55, roughness: 0.5, side: THREE.DoubleSide });
  mesh(lathe([[0.025, 0], [0.06, -0.025], [0.13, -0.09], [0.2, -0.17], [0.215, -0.19], [0.21, -0.2]].map(([a, b]) => [a, b]).reverse().map(([a, b]) => [a, b]), 40), shadeM, x, y, z, room, false, false);
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
  mesh(new THREE.SphereGeometry(0.04, 16, 12), bulbM, x, y - 0.1, z, room, false, false);
  const spot = new THREE.SpotLight(0xffffff, power, 0, 1.08, 0.9, 2);
  spot.position.set(x, y - 0.12, z); spot.target.position.set(x, 0, z + 0.02);
  spot.castShadow = true; spot.shadow.mapSize.setScalar(power > 8 ? 1536 : 1024); spot.shadow.radius = 4; spot.shadow.bias = -0.00015; spot.shadow.normalBias = 0.015; spot.shadow.camera.near = 0.15; spot.shadow.camera.far = 6;
  const glow = new THREE.PointLight(0xffffff, power * 0.16, 0, 2); glow.position.set(x, y - 0.05, z);
  room.add(spot, spot.target, glow);
  LAMPS.push({ spot, glow, shadeM, bulbM, base: power, ph: x * 13.7 });
}
function sconce(x, y) {   // a brass arm from the wall, a tulip of opal glass
  const z = RB;
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), M.brass, x, y, z + 0.01, room).rotation.x = PI / 2;
  mesh(tubeGeo([[x, y, z + 0.02], [x, y + 0.02, z + 0.1], [x, y + 0.09, z + 0.16]], 0.008, 16, 6), M.brass, 0, 0, 0, room);
  const shadeM = phys({ color: 0xf0e2c8, emissive: new THREE.Color(0xffc070), emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide });
  mesh(lathe([[0.012, 0], [0.04, 0.03], [0.055, 0.08], [0.06, 0.1]], 24), shadeM, x, y + 0.09, z + 0.16, room, false, false);
  const pl = new THREE.PointLight(0xffffff, 0.7, 0, 2); pl.position.set(x, y + 0.14, z + 0.2); room.add(pl);
  SCONCES.push({ pl, shadeM, base: 0.7 });
}
function thonet(seatTop) {   // a bentwood chair, the No. 14 of every café: the back legs run up into the back in one bent piece
  const g = new THREE.Group(), r = 0.2, s = seatTop / 0.46, tb = (pts, rad) => mesh(tubeGeo(pts.map(([x, y, z]) => [x, y * s, z]), rad, 40, 8), M.bent, 0, 0, 0, g);
  const ring = mesh(new THREE.TorusGeometry(r, 0.016, 10, 48), M.bent, 0, seatTop - 0.01, 0, g); ring.rotation.x = PI / 2;
  mesh(new THREE.CylinderGeometry(r - 0.005, r - 0.005, 0.012, 40), [M.bent, M.cane, M.cane], 0, seatTop - 0.004, 0, g);
  [-1, 1].forEach((sx) => tb([[sx * 0.135, 0.455, 0.135], [sx * 0.15, 0.2, 0.15], [sx * 0.17, 0, 0.17]], 0.014));
  tb([[-0.18, 0, -0.2], [-0.15, 0.25, -0.16], [-0.14, 0.455, -0.15], [-0.15, 0.7, -0.2], [-0.12, 0.88, -0.24], [0, 0.93, -0.25], [0.12, 0.88, -0.24], [0.15, 0.7, -0.2], [0.14, 0.455, -0.15], [0.15, 0.25, -0.16], [0.18, 0, -0.2]], 0.014);
  tb([[-0.13, 0.48, -0.16], [-0.12, 0.64, -0.2], [0, 0.72, -0.215], [0.12, 0.64, -0.2], [0.13, 0.48, -0.16]], 0.011);
  const lr = mesh(new THREE.TorusGeometry(0.155, 0.009, 8, 40), M.bent, 0, 0.2 * s, 0, g); lr.rotation.x = PI / 2;
  return g;
}
function table(x, z, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); room.add(g);
  mesh(new THREE.CylinderGeometry(r, r, 0.03, 48), M.marble, 0, 0.745, 0, g);
  mesh(lathe([[0, 0], [0.2, 0], [0.2, 0.015], [0.06, 0.05], [0.03, 0.12], [0.022, 0.4], [0.03, 0.6], [0.05, 0.7], [0.08, 0.73], [0, 0.73]], 32), M.iron, 0, 0, 0, g);
  return g;
}
function cupOn(g, x, z) {
  mesh(lathe([[0, 0], [0.07, 0], [0.075, 0.008], [0.06, 0.012], [0, 0.012]], 32), M.china, x, 0.76, z, g);
  mesh(lathe([[0, 0], [0.025, 0], [0.04, 0.02], [0.045, 0.055], [0.044, 0.06], [0.04, 0.06], [0.038, 0.025], [0, 0.02]], 32), M.china, x, 0.772, z, g);
  mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.002, 24), M.coffee, x, 0.825, z, g, false);
  const h = mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 16, PI * 1.3), M.china, x + 0.05, 0.805, z, g); h.rotation.z = -PI * 0.65;
}
function buildRoom() {
  const fw = 2 * (RW + WT), fd = RF - (RB - WT), fzc = (RF + RB - WT) / 2, wh = RH + 0.52;
  mesh(new THREE.BoxGeometry(fw, 0.3, fd), [M.outer, M.outer, M.tiles(fw / 0.6, fd / 0.6), M.outer, M.section, M.outer], 0, -0.15, fzc, room);
  mesh(new THREE.BoxGeometry(WT, wh, fd), [M.paper(fd / 0.52, wh / 0.52), M.outer, M.outer, M.outer, M.section, M.outer], -RW - WT / 2, wh / 2 - 0.3, fzc, room);
  mesh(new THREE.BoxGeometry(WT, wh, fd), [M.outer, M.paper(fd / 0.52, wh / 0.52), M.outer, M.outer, M.section, M.outer], RW + WT / 2, wh / 2 - 0.3, fzc, room);
  mesh(new THREE.BoxGeometry(fw, 0.22, fd), [M.outer, M.outer, M.outer, M.tin(fw / 0.6, fd / 0.6), M.section, M.outer], 0, RH + 0.11, fzc, room);
  const wx0 = 1.55, wx1 = 3.25, wy0 = 0.95, wy1 = 3.0, bz = RB - WT / 2;
  const back = (x0, x1, y0, y1) => mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, WT), [M.walnut, M.walnut, M.walnut, M.walnut, M.paper((x1 - x0) / 0.52, (y1 - y0) / 0.52), M.outer], (x0 + x1) / 2, (y0 + y1) / 2, bz, room);
  const dx0 = 0.15, dx1 = 0.95, dy1 = STAGE + 2.1;   // v34: the musicians' door at the back of the stage, from the room behind
  back(-RW, dx0, 0, RH); back(dx0, dx1, dy1, RH); back(dx0, dx1, 0, STAGE); back(dx1, wx0, 0, RH); back(wx1, RW, 0, RH); back(wx0, wx1, 0, wy0); back(wx0, wx1, wy1, RH);
  wainscot(dx0 + RW, 0.95, (dx0 - RW) / 2, RB, 0); wainscot(RW - dx1, 0.95, (dx1 + RW) / 2, RB, 0); wainscot(RF - RB, 0.95, -RW, (RF + RB) / 2, PI / 2); wainscot(RF - RB, 0.95, RW, (RF + RB) / 2, -PI / 2);
  mesh(rbox(2 * RW, 0.12, 0.1, 0.02), M.walnut, 0, RH - 0.06, RB + 0.05, room);   // the cornice
  // the stage, low, at the back left
  const sx0 = -RW, sx1 = 1.3, sz0 = RB, sz1 = -0.25;
  mesh(new THREE.BoxGeometry(sx1 - sx0, STAGE, sz1 - sz0), [M.walnut, M.walnut, M.oak((sx1 - sx0) / 0.48, (sz1 - sz0) / 1.2), M.walnut, M.walnut, M.walnut], (sx0 + sx1) / 2, STAGE / 2, (sz0 + sz1) / 2, room);
  mesh(rbox(sx1 - sx0 + 0.02, 0.04, 0.07, 0.015), M.walnut, (sx0 + sx1) / 2, STAGE, sz1, room);
  mesh(rbox(0.07, 0.04, sz1 - sz0, 0.015), M.walnut, sx1, STAGE, (sz0 + sz1) / 2, room);
  // the window onto Corrientes: its frame and cross, the sill; outside, the street and the theatre
  const wcx = (wx0 + wx1) / 2, wcy = (wy0 + wy1) / 2, fwd = 0.07;
  [[wx0 + fwd / 2, wcy, fwd, wy1 - wy0], [wx1 - fwd / 2, wcy, fwd, wy1 - wy0], [wcx, wy0 + fwd / 2, wx1 - wx0, fwd], [wcx, wy1 - fwd / 2, wx1 - wx0, fwd], [wcx, wcy, 0.05, wy1 - wy0], [wcx, wy0 + (wy1 - wy0) * 0.62, wx1 - wx0, 0.05]]
    .forEach(([x, y, w, h]) => mesh(rbox(w, h, 0.09, 0.01), M.walnut, x, y, RB - 0.1, room));
  mesh(rbox(wx1 - wx0 + 0.16, 0.05, 0.22, 0.01), M.walnut, wcx, wy0 - 0.02, RB + 0.02, room);
  // the street is a little set behind the window, in a dark box, as in a theatre: seen only through the glass
  const bx0 = 0.2, bx1 = RW + WT - 0.02, by0 = -0.2, by1 = RH + 0.2, bz1 = -4.6, crop = (tx, u0, u1, v0, v1) => { tx.repeat.set(u1 - u0, v1 - v0); tx.offset.set(u0, v0); };
  crop(M.street.map, (bx0 + 3.6) / 12, (bx1 + 3.6) / 12, (by0 + 0.5) / 6, (by1 + 0.5) / 6); crop(M.cobble.map, (bx0 + 3.6) / 12, (bx1 + 3.6) / 12, 0.565, 1);
  mesh(new THREE.PlaneGeometry(bx1 - bx0, by1 - by0), M.street, (bx0 + bx1) / 2, (by0 + by1) / 2, bz1, room, false, false);
  mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - (RB - WT)), M.cobble, (bx0 + bx1) / 2, -0.01, (bz1 + RB - WT) / 2, room, false, false).rotation.x = -PI / 2;
  const boxM = new THREE.MeshBasicMaterial({ color: 0x040407, side: THREE.DoubleSide }), none = new THREE.MeshBasicMaterial({ visible: false });
  // v34: across the street the theatre's doors can close and its windows go dark; the tram and the passers-by on planes of their own
  const shutM = () => new THREE.MeshBasicMaterial({ color: 0x0b0a09, transparent: true, opacity: 0, depthWrite: false }), glowM = () => new THREE.MeshBasicMaterial({ map: tex(shadeCanvas(), true), transparent: true, opacity: 0, depthWrite: false });
  WORLD3.doors = [3.9, 2.1].map((x) => mesh(new THREE.PlaneGeometry(0.92, 2.4), shutM(), x, 1.18, bz1 + 0.012, room, false, false));
  WORLD3.glows = [3.9, 2.1].map((x) => mesh(new THREE.PlaneGeometry(3.0, 3.0), glowM(), x, 1.1, bz1 + 0.008, room, false, false));
  WORLD3.wins = [3.9, 1.9].map((x) => mesh(new THREE.PlaneGeometry(0.74, 0.92), shutM(), x, 3.58, bz1 + 0.012, room, false, false));
  WORLD3.tram = mesh(new THREE.PlaneGeometry(3.4, 3.6), new THREE.MeshBasicMaterial({ map: tex(tramCanvas(), true), alphaTest: 0.5, color: 0xb0b0b0 }), -10, 1.78, (RB - WT + bz1) / 2 - 0.2, room, false, false); WORLD3.tram.visible = false;
  WORLD3.people = [0, 1].map((k) => { const p = mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshBasicMaterial({ map: tex(peopleCanvas(k), true), alphaTest: 0.5, color: 0x9a9a9a }), -10, 0.93, bz1 + 0.15, room, false, false); p.visible = false; return p; });
  mesh(new THREE.BoxGeometry(bx1 - bx0 + 0.04, by1 - by0 + 0.04, RB - WT - bz1 + 0.1), [boxM, boxM, boxM, boxM, none, none], (bx0 + bx1) / 2, (by0 + by1) / 2, (bz1 + RB - WT) / 2 - 0.03, room, false, false);
  windowLight = new THREE.SpotLight(0x6f88c6, 7, 0, 0.42, 0.7, 2);   // the street light through the glass: blue, and the cross of the frame on the floor
  windowLight.position.set(2.6, 3.7, -4.4); windowLight.target.position.set(1.6, 0, -0.5);
  windowLight.castShadow = true; windowLight.shadow.mapSize.set(1024, 1024); windowLight.shadow.radius = 3; windowLight.shadow.bias = -0.0002; windowLight.shadow.camera.near = 1; windowLight.shadow.camera.far = 14;
  room.add(windowLight, windowLight.target);
  // a tall mirror in a gilt frame, behind the band
  const mx = -0.55, my0 = 1.3, my1 = 2.85, mw = 0.95, mz = RB + 0.02, fr = 0.085;
  const mir = mesh(new THREE.PlaneGeometry(mw, my1 - my0), M.mirror, mx, (my0 + my1) / 2, mz + 0.012, room, false, true); mir.material.map.wrapS = mir.material.map.wrapT = THREE.ClampToEdgeWrapping;
  [[mx, my1 + fr / 2, mw + 2 * fr, fr], [mx, my0 - fr / 2, mw + 2 * fr, fr], [mx - mw / 2 - fr / 2, (my0 + my1) / 2, fr, my1 - my0], [mx + mw / 2 + fr / 2, (my0 + my1) / 2, fr, my1 - my0]]
    .forEach(([x, y, w, h]) => mesh(rbox(w, h, 0.06, 0.02, 3), M.gilt, x, y, mz + 0.03, room));
  mesh(rbox(0.36, 0.12, 0.05, 0.03, 3), M.gilt, mx, my1 + fr + 0.05, mz + 0.03, room);
  // the light: warm and dim (the author 29.10: «теплый и тусклый»)
  lamp(-2.05, 2.62, -1.2, 9); lamp(-0.25, 2.62, -0.95, 9); lamp(2.35, 2.55, -0.15, 7);
  sconce(-1.45, 1.95); sconce(1.27, 1.95);
  // v34: the door — a frame, a leaf on its hinge (it opens outward, into the room behind), a dim corridor with a warm light far in
  const dk = new THREE.MeshBasicMaterial({ color: 0x0a0705, side: THREE.DoubleSide }), nn = new THREE.MeshBasicMaterial({ visible: false });
  [[dx0 - 0.04, (STAGE + dy1) / 2, 0.08, dy1 - STAGE + 0.08], [dx1 + 0.04, (STAGE + dy1) / 2, 0.08, dy1 - STAGE + 0.08], [(dx0 + dx1) / 2, dy1 + 0.04, dx1 - dx0 + 0.16, 0.08]].forEach(([x, y, w, h]) => mesh(rbox(w, h, 0.05, 0.01), M.walnut, x, y, RB + 0.025, room));
  const hinge = new THREE.Group(); hinge.position.set(dx1 - 0.005, STAGE, RB - WT / 2); room.add(hinge);
  const lw = dx1 - dx0 - 0.012, lh = dy1 - STAGE - 0.01;
  mesh(rbox(lw, lh, 0.05, 0.008), M.walnut, -lw / 2, lh / 2, 0, hinge);
  [0.72, 0.28].forEach((f) => mesh(rbox(lw - 0.2, lh * 0.36, 0.02, 0.006), M.walnut, -lw / 2, lh * f, 0.03, hinge));
  mesh(new THREE.SphereGeometry(0.024, 12, 10), M.brass, -lw + 0.08, 1.0, 0.05, hinge);
  mesh(new THREE.BoxGeometry(dx1 - dx0 + 0.3, dy1 - STAGE + 0.3, 1.3), [dk, dk, dk, dk, nn, dk], (dx0 + dx1) / 2, (STAGE + dy1) / 2, RB - WT - 0.65, room, false, false);
  mesh(new THREE.PlaneGeometry(0.5, 1.3), new THREE.MeshBasicMaterial({ color: 0x40281a }), (dx0 + dx1) / 2 + 0.1, STAGE + 1.0, RB - WT - 1.28, room, false, false);
  WORLD3.door = hinge;
  // v34: the café's clock above the left sconce: the evening's own time, from a quarter past midnight
  const clk = new THREE.Group(); clk.position.set(-1.45, 2.72, RB + 0.03); room.add(clk);
  mesh(new THREE.CircleGeometry(0.19, 48), new THREE.MeshStandardMaterial({ map: tex(clockCanvas(), true), roughness: 0.4 }), 0, 0, 0.012, clk, false, true);
  mesh(new THREE.TorusGeometry(0.2, 0.02, 10, 48), M.brass, 0, 0, 0.015, clk);
  const hand = (len, w) => { const hg = new THREE.BoxGeometry(w, len, 0.006); hg.translate(0, len / 2 - 0.02, 0); return hg; };
  WORLD3.clock = { g: clk, h: mesh(hand(0.11, 0.014), M.ebony, 0, 0, 0.022, clk, false, false), m: mesh(hand(0.16, 0.009), M.ebony, 0, 0, 0.026, clk, false, false) };
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), M.brass, 0, 0, 0.03, clk, false, false).rotation.x = PI / 2;
  const hemi = new THREE.HemisphereLight(0x3a2a20, 0x0a0604, 0.12); scene.add(hemi);
  const fill = new THREE.PointLight(0xffffff, 2.2, 0, 2); fill.position.set(-0.6, 1.9, 2.4); room.add(fill); SCONCES.push({ pl: fill, shadeM: { emissive: new THREE.Color() }, base: 2.2 });   // a soft light from the open side, where we stand: it lifts the faces
  // the café floor: marble tables, bentwood chairs; signs of an evening — a cup, a paper, a glass of wine, a hat
  const t1 = table(2.0, 0.45, 0.32), t2 = table(3.0, -0.75, 0.3), t3 = table(2.9, 0.95, 0.28);
  [[2.0, 0.92, PI], [1.55, 0.3, PI / 2.2], [3.0, -1.22, 0.1], [2.55, -0.62, -PI / 2.3], [2.9, 1.42, PI + 0.3]].forEach(([x, z, ry]) => { const c = thonet(0.46); c.position.set(x, 0, z); c.rotation.y = ry; room.add(c); });
  cupOn(t1, 0.1, 0.05);
  const np = mesh(new THREE.BoxGeometry(0.26, 0.004, 0.18), [M.news, M.news, M.news, M.news, M.news, M.news], -0.12, 0.763, -0.08, t1); np.rotation.y = 0.4;
  mesh(lathe([[0, 0], [0.03, 0], [0.032, 0.005], [0.008, 0.012], [0.006, 0.1], [0.03, 0.13], [0.036, 0.19], [0.032, 0.2], [0, 0.19]], 24), M.glassGreen, -0.08, 0.76, 0.06, t2);
  mesh(lathe([[0, 0], [0.028, 0], [0.028, 0.003], [0.004, 0.006], [0.004, 0.07], [0.03, 0.09], [0.033, 0.13], [0, 0.13]], 24), M.china, 0.1, 0.76, -0.05, t2).material = M.wine;
  mesh(lathe([[0, 0], [0.035, 0], [0.036, 0.25], [0.025, 0.3], [0.012, 0.33], [0.013, 0.38], [0, 0.38]], 24), M.glassGreen, 0.02, 0.76, 0.1, t3);
  const hat = new THREE.Group(); hat.position.set(2.9, 0.47, 1.42); room.add(hat);   // a bowler on the chair by the door
  mesh(lathe([[0, 0], [0.16, 0], [0.17, 0.01], [0.1, 0.012], [0.098, 0.06], [0.09, 0.1], [0.06, 0.125], [0, 0.13]], 40), M.felt2, 0, 0, 0, hat);
}

// ── the upright piano, her stool
let PIANO = null;
function buildPiano() {
  const g = new THREE.Group(), W = 1.5, Hc = 1.3, Dp = 0.6, cm = M.lacquer;
  const B = (geo, m, x, y, z) => mesh(geo, m, x, y, z, g);
  B(rbox(W, Hc, Dp, 0.018, 3), cm, 0, Hc / 2, -Dp / 2);
  B(rbox(W + 0.04, 0.035, Dp + 0.04, 0.012), cm, 0, Hc + 0.017, -Dp / 2 + 0.01);
  B(rbox(1.3, 0.38, 0.03, 0.008), M.lacquer2, 0, 1.06, 0.0);
  B(rbox(1.28, 0.5, 0.03, 0.008), M.lacquer2, 0, 0.36, 0.0);
  B(rbox(1.44, 0.07, 0.32, 0.01), cm, 0, 0.695, 0.15);
  B(rbox(1.32, 0.05, 0.025, 0.008), cm, 0, 0.735, 0.302);
  [-1, 1].forEach((s) => { B(rbox(0.06, 0.13, 0.33, 0.012), cm, s * 0.69, 0.765, 0.15); B(lathe([[0, 0], [0.035, 0], [0.035, 0.03], [0.026, 0.06], [0.03, 0.2], [0.022, 0.42], [0.032, 0.5], [0.03, 0.6], [0, 0.6]], 20), cm, s * 0.66, 0.06, 0.25); B(rbox(0.08, 0.06, 0.34, 0.01), cm, s * 0.66, 0.03, 0.12); });
  const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12), whites = [], blacks = [];
  let wi = 0; for (let m = 21; m <= 108; m++) { if (isBlack(m)) blacks.push({ m, wi }); else { whites.push({ m, wi }); wi++; } }
  const kw = 0.0235, x0 = -whites.length * kw / 2 + kw / 2, keyX = {};
  Object.assign(keyX, HS.keys.x);   // the page's own table of where each key stands: the hands and the keys are the same numbers
  const wIM = new THREE.InstancedMesh(rbox(kw - 0.0012, 0.022, 0.15, 0.002, 1), M.ivory, whites.length), bIM = new THREE.InstancedMesh(rbox(0.0125, 0.024, 0.095, 0.002, 1), M.ebony, blacks.length), m4 = new THREE.Matrix4();
  whites.forEach((k, i) => wIM.setMatrixAt(i, m4.makeTranslation(keyX[k.m], 0.749, 0.215))); blacks.forEach((k, i) => bIM.setMatrixAt(i, m4.makeTranslation(keyX[k.m], 0.766, 0.185)));
  [wIM, bIM].forEach((im) => { im.castShadow = im.receiveShadow = true; g.add(im); });
  B(new THREE.BoxGeometry(whites.length * kw, 0.01, 0.012), M.felt, 0, 0.752, 0.134).castShadow = false;
  B(rbox(1.26, 0.09, 0.016, 0.006), cm, 0, 0.81, 0.11).rotation.x = -0.18;
  B(rbox(0.66, 0.025, 0.06, 0.006), cm, 0, 0.885, 0.06);
  const sheet = B(new THREE.PlaneGeometry(0.42, 0.3), M.sheet, 0, 1.04, 0.035); sheet.rotation.x = -0.2; sheet.castShadow = false;
  const cands = [];   // v34: the candles burn down through the evening, their flames tremble
  [-1, 1].forEach((s) => { B(tubeGeo([[s * 0.58, 1.0, 0.0], [s * 0.6, 1.02, 0.08], [s * 0.62, 1.06, 0.12]], 0.007, 12, 6), M.brass, 0, 0, 0); B(lathe([[0, 0], [0.03, 0], [0.034, 0.012], [0.016, 0.02], [0, 0.02]], 16), M.brass, s * 0.62, 1.06, 0.12);
    const cg = new THREE.CylinderGeometry(0.011, 0.011, 0.12, 12); cg.translate(0, 0.06, 0); const cm = B(cg, M.candle, s * 0.62, 1.08, 0.12);
    const fl = B(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.68, 0.32).multiplyScalar(3) }), s * 0.62, 1.215, 0.12); fl.castShadow = false; fl.scale.set(1, 2.3, 1); fl.visible = false;
    const cl = new THREE.PointLight(0xffb060, 0, 0, 2); cl.position.set(s * 0.62, 1.23, 0.12); g.add(cl); cands.push({ m: cm, f: fl, l: cl, x: s * 0.62 }); });
  [-0.07, 0.07].forEach((px) => B(rbox(0.035, 0.012, 0.1, 0.004), M.brass, px, 0.05, 0.06));
  g.userData.keyX = keyX; g.userData.keyTop = 0.76; g.userData.candles = cands;
  return g;
}
function pianoStool(seatTop) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 36), [M.velvet, M.velvet, M.walnut], 0, seatTop - 0.03, 0, g);
  mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 32), M.walnut, 0, seatTop - 0.075, 0, g);
  mesh(lathe([[0, 0.12], [0.05, 0.12], [0.03, 0.17], [0.036, (seatTop + 0.12) / 2], [0.026, seatTop - 0.12], [0.045, seatTop - 0.08], [0, seatTop - 0.08]], 20), M.walnut, 0, 0, 0, g);
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + 0.5, c = Math.cos(a), s = Math.sin(a); mesh(tubeGeo([[c * 0.03, 0.15, s * 0.03], [c * 0.12, 0.1, s * 0.12], [c * 0.2, 0.03, s * 0.2]], 0.014, 16, 8), M.walnut, 0, 0, 0, g); mesh(new THREE.SphereGeometry(0.025, 12, 10), M.brass, c * 0.205, 0.022, s * 0.205, g); }
  return g;
}

// ── the bandoneón and the double bass
function buildBandoneon() {
  const g = new THREE.Group(), S = 0.21, E = 0.068, folds = 9, ends = [];
  const pts = []; for (let i = 0; i <= folds * 2; i++) pts.push(V2(i % 2 ? S * 0.6 : S * 0.69, -0.1 + 0.2 * i / (folds * 2)));
  const bg = new THREE.LatheGeometry(pts, 4, PI / 4); bg.rotateZ(-PI / 2);
  const bel = mesh(bg, M.bellows, 0, 0, 0, g);
  const btn = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 10);
  [-1, 1].forEach((s) => { const m = mesh(rbox(E, S, S, 0.012, 3), [M.pearl, M.pearl, M.bandWood, M.bandWood, M.bandWood, M.bandWood], 0, 0, 0, g); ends.push(m);
    for (let i = 0; i < 18; i++) mesh(btn, M.pearlBtn, s * (-0.012 + (i % 3) * 0.012), S / 2 + 0.003, -S / 2 + 0.035 + Math.floor(i / 3) * 0.028, m, false); });
  g.userData = { S, E, ends, setOpen(len) { bel.scale.x = len / 0.2; ends[0].position.x = -len / 2 - E / 2; ends[1].position.x = len / 2 + E / 2; } };
  g.userData.setOpen(0.26);
  return g;
}
function buildBass() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); inner.scale.setScalar(0.9);
  const R = [[0.0, 0.0], [0.17, 0.02], [0.29, 0.12], [0.33, 0.3], [0.3, 0.47], [0.21, 0.58], [0.19, 0.64], [0.22, 0.74], [0.245, 0.86], [0.2, 0.98], [0.09, 1.06], [0.0, 1.08]];
  const shape = new THREE.Shape(); shape.moveTo(0, 0);
  shape.splineThru(R.slice(1).map(([x, y]) => V2(x, y))); shape.splineThru(R.slice(0, -1).reverse().map(([x, y]) => V2(-x, y)));
  const depth = 0.14, geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 5, curveSegments: 40, steps: 1 });
  geo.translate(0, 0, -depth / 2);
  const tt = tex(bassTopCanvas(shape.getPoints(120)), true); tt.wrapS = tt.wrapT = THREE.ClampToEdgeWrapping; tt.repeat.set(1 / 0.72, 1 / 1.14); tt.offset.set(0.5, 0.03 / 1.14);
  const mTop = phys({ map: tt, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.18 });
  const I = (gg, m, x, y, z) => mesh(gg, m, x, y, z, inner);
  I(geo, [mTop, M.maple], 0, 0.24, 0);
  const zf = depth / 2 + 0.035;   // the face of the top
  // the neck and the fingerboard on one line: the board lies on the neck from the nut to the heel and runs on over the body, rising off it
  const zNF = (y) => 0.125 - (y - 1.32) * 0.0769, tilt = -0.0768;   // the neck's face (the board's underside) at each height
  I(taperBox(0.6, 0.06, 0.045, 0.07, 0.06), M.maple, 0, 1.58, zNF(1.58) - 0.0325).rotation.x = tilt;   // the neck
  I(taperBox(0.9, 0.115, 0.062, 0.016, 0.016), M.ebony, 0, 1.39, zNF(1.39) + 0.008).rotation.x = tilt;   // the fingerboard
  I(rbox(0.066, 0.012, 0.022, 0.004), M.ebony, 0, 1.845, zNF(1.845) + 0.012);   // the nut
  I(rbox(0.07, 0.19, 0.06, 0.012), M.maple, 0, 1.97, 0.052).rotation.x = tilt;   // the pegbox
  I(tubeGeo(Array.from({ length: 14 }, (_, i) => { const a = i / 13 * PI * 2.2, r = 0.045 * (1 - i / 17); return [0, 2.08 + Math.sin(a) * r, 0.05 + Math.cos(a) * r]; }), 0.017, 40, 10), M.maple, 0, 0, 0);
  [-1, 1].forEach((s) => [1.93, 2.01].forEach((y) => { const k = I(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10), M.brass, s * 0.06, y, 0.05); k.rotation.z = PI / 2; I(rbox(0.012, 0.03, 0.02, 0.004), M.brass, s * 0.095, y, 0.05); }));
  const br = new THREE.Shape(); br.moveTo(-0.075, 0); br.lineTo(-0.05, 0); br.quadraticCurveTo(0, 0.035, 0.05, 0); br.lineTo(0.075, 0); br.lineTo(0.052, 0.082); br.quadraticCurveTo(0, 0.093, -0.052, 0.082); br.closePath();
  const bgeo = new THREE.ExtrudeGeometry(br, { depth: 0.012, bevelEnabled: false }); bgeo.rotateX(PI / 2);
  I(bgeo, M.linden, 0, 0.24 + 0.5, zf);   // the bridge
  I(taperBox(0.26, 0.09, 0.05, 0.015, 0.015), M.ebony, 0, 0.24 + 0.24, zf + 0.012);   // the tailpiece
  I(new THREE.CylinderGeometry(0.006, 0.004, 0.25, 8), M.steel, 0, 0.125, 0);   // the endpin
  const sX = [[-0.03, -0.045, -0.02], [-0.01, -0.015, -0.007], [0.01, 0.015, 0.007], [0.03, 0.045, 0.02]];
  sX.forEach(([a, b, c], i) => { const r = 0.0028 - i * 0.0004, pA = V3(a, 0.6, zf + 0.022), pB = V3(b, 0.74, zf + 0.093), pC = V3(c, 1.845, zNF(1.845) + 0.021);
    [[pA, pB], [pB, pC]].forEach(([p, q]) => { const s = I(new THREE.CylinderGeometry(r, r, p.distanceTo(q), 6), M.string, 0, 0, 0); s.castShadow = false; s.geometry.translate(0, p.distanceTo(q) / 2, 0); setSeg(s, p, q); }); });
  // where his hands go, in the bass's own frame: the left beside the neck, its fingers over the board; the right in front of the strings by the board's end
  const strAt = (k, y) => { const f = (y - 0.74) / (1.845 - 0.74), a = sX[Math.max(0, Math.min(3, Math.floor(k)))], b = sX[Math.max(0, Math.min(3, Math.ceil(k)))], q = k - Math.floor(k), xb = a[1] + (b[1] - a[1]) * q, xn = a[2] + (b[2] - a[2]) * q;
    return V3(xb + (xn - xb) * f, y, zf + 0.093 + (zNF(1.845) + 0.021 - zf - 0.093) * f); };
  g.userData = { inner, strAt, neckL: V3(0.085, 1.42, 0.075), neckF: V3(-0.25, 0.2, 0.95), neckD: V3(1, 0.1, -0.1), pluck: V3(-0.12, 1.15, 0.25), pluckF: V3(0.85, -0.4, -0.2), pluckD: V3(0, 0.25, 1), elbowR: V3(-0.3, 1.3, 0.55), pluckY: 1.15 };   // v39: he plucks over the end of the board, a little higher than before, his elbow in front — the arm bends and lies before the bass, not through it (measured on the shapes: 0 points of the arm inside the body)
  return g;
}

// ── the dolls: turned wood, painted faces, the clothes of the place; one maker's hand, three silhouettes
const CAST = {
  nell: { seated: true, H: [1.6, 1.46], head: [1, 1.55], hw: [0.66, 0.8], egg: [0.12, 0.2], neckL: [1, 1.15], neckR: [1, 0.82],
    torsoL: [1, 0.92], legL: [1, 0.95], torsoW: [0.9, 0.92], limbR: [1, 0.72], legR: [1, 0.8], armL: [1, 1.06], fingerL: [1, 1.35], belly: [1, 1],
    paint: '#efd2b4', cheek: [214, 96, 86, 0.5], iris: '#8a5a26', socket: [0.08, 0.26], nose: 'button', brows: 'fine', lip: '#a6463c', hair: 'nell', dress: 'blouse', lid: -0.42 },
  otto: { seated: true, H: [1.84, 2.02], head: [1, 1.32], hw: [0.63, 0.68], egg: [0.1, 0.14], neckL: [1, 1.45], neckR: [1, 0.7],
    torsoL: [1, 1.14], legL: [1, 1.08], torsoW: [0.95, 0.76], limbR: [1, 0.6], legR: [1, 0.62], armL: [1, 1.14], fingerL: [1, 1.5], belly: [1, 0.9],
    paint: '#e8c8a6', cheek: [200, 100, 90, 0.2], iris: '#6c8896', socket: [0.12, 0.38], nose: 'long', brows: 'arched', lip: '#8e4a40', hair: 'otto',
    dress: 'suit', cloth: 'pin', clothCol: [44, 44, 50], vestCol: [36, 36, 42], tie: '#3f9fb2', lid: 0.02 },
  bo: { seated: false, H: [1.76, 1.72], head: [1, 1.42], hw: [0.68, 0.84], egg: [0.04, 0.02], neckL: [1, 0.55], neckR: [1.1, 1.25],
    torsoL: [1, 0.98], legL: [1, 0.86], torsoW: [1.1, 1.4], limbR: [1, 0.8], legR: [1, 0.6], armL: [1, 1.04], fingerL: [1, 1.22], belly: [1.15, 1.75],
    paint: '#e2bb98', cheek: [216, 92, 80, 0.55], iris: '#42291a', socket: [0.07, 0.2], nose: 'round', brows: 'bushy', lip: '#9a4a3e', hair: 'bo', moustache: true,
    dress: 'suit', cloth: 'check', clothCol: [72, 56, 42], vestCol: [56, 42, 32], tie: '#8064c0', open: true, lid: -0.34 },
};
function dims(id, kuk, eyeK) {
  const C = CAST[id], L = (k) => lerp(C[k][0], C[k][1], kuk), H = L('H'), female = C.dress === 'blouse';
  const headH = 0.13 * H * L('head'), headW = headH * L('hw'), neck = 0.05 * H * L('neckL'), body = H - headH - neck;
  const wa = 0.039, ws = 0.246 * L('legL'), wt = 0.245 * L('legL'), wT = 0.29 * L('torsoL'), k = body / (wa + ws + wt + wT);
  const tw = L('torsoW'), lr = L('limbR'), gr = L('legR');
  return { H, headH, headW, neck, ankle: wa * k, shin: ws * k, thigh: wt * k, torso: wT * k, yKnee: (wa + ws) * k, yHip: (wa + ws + wt) * k, egg: L('egg'),
    shoulderHW: 0.118 * H * tw * (female ? 0.9 : 1), chestHW: 0.1 * H * tw * (female ? 0.92 : 1), waistHW: 0.084 * H * tw * (female ? 0.78 : 1), hipHW: 0.09 * H * Math.sqrt(tw) * (female ? 1.08 : 0.96),
    belly: L('belly'), neckR: 0.026 * H * L('neckR'), upper: 0.186 * H * L('armL'), fore: 0.152 * H * L('armL'), rUpper: 0.031 * H * lr, rFore: 0.026 * H * lr, rWrist: 0.017 * H * lr,
    rThigh: 0.054 * H * gr, rKnee: 0.039 * H * gr, rShin: 0.031 * H * gr, hipJW: 0.052 * H,
    palmL: 0.056 * H * lerp(1, 1.08, kuk), palmW: 0.05 * H * lerp(1, 0.94, kuk), fingL: 0.05 * H * L('fingerL'), fingR: 0.0068 * H * lerp(1, 0.85, kuk),
    footL: 0.15 * H * lerp(1, 0.94, kuk), eyeR: headH * lerp(0.062, 0.1, kuk) * eyeK };
}
function headProfile(D) { const Ry = D.headH / 2, Rx = D.headW / 2, e = D.egg; return (th) => ({ r: Rx * Math.cos(th) * (1 + e * Math.sin(th)), y: Ry * (1 + Math.sin(th)) }); }
function profNormal(prof, th) { const a = prof(th - 0.001), b = prof(th + 0.001), dr = b.r - a.r, dy = b.y - a.y, l = Math.hypot(dr, dy) || 1; return { r: dy / l, y: -dr / l }; }
const wrapA = (p) => (p > PI ? p - 2 * PI : p);
const HAIR = {   // the hair as a carved, painted cap on the head: from where it starts (lo) to where it ends (hi), and how thick
  nell: (D) => ({ pa: -PI, pb: PI, lo: (p) => { const a = Math.abs(p); return lerp(0.44, -0.3, smooth(0.25, 1.35, a)) - 0.16 * smooth(1.7, 3.1, a); }, hi: () => PI / 2,
    off: (p, th, t) => { const a = Math.abs(p), h = D.headH; return h * (0.002 + (0.01 + 0.028 * smooth(0.3, 1.3, a) * (1 - smooth(0.6, 1.4, th))) * smooth(0, 0.14, t) * (0.55 + 0.45 * smooth(0, 0.09, a))) + h * 0.004 * Math.sin(th * 18 + a * 3) * smooth(0.4, 1.2, a) * smooth(0, 0.2, t); } }),
  otto: (D) => ({ pa: -PI, pb: PI, lo: (p) => { const a = Math.abs(p); return lerp(0.62, 0.34, smooth(0.1, 1.0, a)) - 0.62 * smooth(1.5, 3.0, a) - 0.06 * (1 - smooth(0, 0.16, a)); }, hi: () => PI / 2,
    off: (p, th, t) => D.headH * (0.002 + 0.009 * smooth(0, 0.1, t)) }),
  bo: (D) => { const end = (p) => smooth(1.38, 2.0, Math.abs(wrapA(p))); return { pa: 1.38, pb: 2 * PI - 1.38, lo: (p) => -0.1 - 0.26 * smooth(2.2, 3.1, Math.abs(wrapA(p))), hi: (p) => -0.1 - 0.26 * smooth(2.2, 3.1, Math.abs(wrapA(p))) + 0.04 + 0.5 * end(p) + 0.12 * smooth(2.4, 3.1, Math.abs(wrapA(p))),
    off: (p, th, t) => D.headH * (0.002 + 0.026 * Math.sin(PI * t) * end(p)) + D.headH * 0.004 * Math.sin(th * 30) * end(p) }; },
};
function headPatchGeo(prof, rows, cols, hs) {
  return gridGeo(rows, cols, (i, j) => { const p = lerp(hs.pa, hs.pb, j / cols), t = i / rows, th = lerp(hs.lo(p), hs.hi(p), t), q = prof(th), n = profNormal(prof, th), o = hs.off(p, th, t), r = q.r + n.r * o;
    return [r * Math.sin(p), q.y + n.y * o, r * Math.cos(p)]; }, hs.pa === -PI && hs.pb === PI);
}
function faceCanvas(C, F, kuk) {   // the painted face: on the head's own map (u around, 0.5 in front; v from the chin to the crown)
  const S = 1024, c = cnv(S, S), g = c.getContext('2d'), X = (u) => u * S, Y = (v) => (1 - v) * S;
  g.fillStyle = C.paint; g.fillRect(0, 0, S, S);
  const sock = lerp(C.socket[0], C.socket[1], kuk);
  const blob = (u, v, ru, rv, col0, col1, inner = 0) => { g.save(); g.translate(X(u), Y(v)); g.scale(ru * S, rv * S); const gr = g.createRadialGradient(0, 0, inner, 0, 0, 1); gr.addColorStop(0, col0); gr.addColorStop(1, col1); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, PI * 2); g.fill(); g.restore(); };
  F.eyes.forEach((e) => blob(e.u, e.v, e.du * 2.3, e.dv * 2.1, `rgba(78,44,52,${sock})`, 'rgba(78,44,52,0)', 0.4));
  const [cr, cg, cb, ca] = C.cheek; F.cheeks.forEach((ch) => blob(ch.u, ch.v, ch.du, ch.dv, `rgba(${cr},${cg},${cb},${ca})`, `rgba(${cr},${cg},${cb},0)`));
  g.strokeStyle = C.hair === 'nell' ? '#3d2a1e' : '#21170f'; g.lineCap = 'round';
  F.eyes.forEach((e, k) => { const s = k ? 1 : -1, bx = X(e.u), by = Y(e.v + e.dv * 1.5), w = e.du * S * 1.25, h = e.dv * S;
    if (C.brows === 'bushy') { g.lineWidth = h * 0.2; for (let i = -7; i <= 7; i++) { const x = bx + i / 7 * w * s, y = by - Math.cos(i / 7 * 1.2) * h * 0.2 + (i < 0 ? h * 0.1 : 0); g.beginPath(); g.moveTo(x, y + h * 0.1); g.lineTo(x + 0.07 * w * s, y - h * 0.12); g.stroke(); } }
    else { const arch = C.brows === 'arched'; g.lineWidth = h * (arch ? 0.09 : 0.075); g.beginPath(); g.moveTo(bx - w * s, by + h * (arch ? 0.3 : 0.12)); g.quadraticCurveTo(bx + w * 0.15 * s, by - h * (arch ? 0.6 : 0.32), bx + w * s, by + h * 0.22); g.stroke(); } });
  const m = F.mouth, mx = X(m.u), my = Y(m.v), mw = m.du * S, mh = m.dv * S;
  g.fillStyle = C.lip; g.beginPath(); g.moveTo(mx - mw, my); g.quadraticCurveTo(mx - mw * 0.5, my - mh * 0.75, mx, my - mh * 0.25); g.quadraticCurveTo(mx + mw * 0.5, my - mh * 0.75, mx + mw, my); g.quadraticCurveTo(mx, my + mh * 0.95, mx - mw, my); g.fill();
  g.strokeStyle = 'rgba(70,20,16,0.7)'; g.lineWidth = mh * 0.12; g.beginPath(); g.moveTo(mx - mw * 0.92, my); g.quadraticCurveTo(mx, my + mh * 0.12, mx + mw * 0.92, my); g.stroke();
  const hs = F.hair; g.fillStyle = '#20160f';   // the paint under the hair, so no wood shows at its edge
  for (let i = 0; i < 256; i++) { const u = (i + 0.5) / 256, p = (u - 0.5) * 2 * PI, pp = hs.pa === -PI ? p : (p < 0 ? p + 2 * PI : p); if (pp < hs.pa || pp > hs.pb) continue;
    const lo = hs.lo(pp), hi = hs.hi(pp), vl = (lo + PI / 2) / PI - 0.008, vh = (hi + PI / 2) / PI; g.fillRect(i * S / 256, Y(vh), S / 256 + 1, Y(vl) - Y(vh)); }
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.32; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) g.drawImage(TX.crackle, a * S / 3, b * S / 3, S / 3 + 1, S / 3 + 1);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return c;
}
const clothCache = new Map();
function clothMats(kind, col, seed) {
  const key = kind + col.join(',');
  if (!clothCache.has(key)) {
    const base = texSet(clothCanvases(seed, col, kind)), sc = srgb(col[0] * 1.7, col[1] * 1.7, col[2] * 1.7);
    const mk = (rx, ry) => phys({ ...rep(base, rx, ry), roughness: 1, bumpScale: 0.9, sheen: 0.5, sheenRoughness: 0.75, sheenColor: sc, side: THREE.DoubleSide });
    clothCache.set(key, { torso: mk(8, 5), sleeve: mk(2.5, 3), leg: mk(2.5, 4) });
  }
  return clothCache.get(key);
}
function suitRings(D) {
  const t = D.torso, H = D.H, bf = D.belly, nr = D.neckR;
  return [{ y: -0.075 * H, rx: D.hipHW * 1.1, rz: D.hipHW * 0.84 }, { y: -0.02 * H, rx: D.hipHW * 1.06, rz: D.hipHW * 0.8 }, { y: 0.1 * t, rx: D.hipHW, rz: D.hipHW * 0.78 * bf, cz: 0.012 * H * (bf - 1) },
    { y: 0.32 * t, rx: D.waistHW, rz: D.waistHW * 0.8 * bf, cz: 0.03 * H * (bf - 1) }, { y: 0.55 * t, rx: lerp(D.waistHW, D.chestHW, 0.6), rz: lerp(D.waistHW * 0.8 * bf, D.chestHW * 0.62, 0.6), cz: 0.02 * H * (bf - 1) },
    { y: 0.76 * t, rx: D.chestHW, rz: D.chestHW * 0.62 }, { y: 0.93 * t, rx: D.shoulderHW, rz: D.chestHW * 0.56 }, { y: t, rx: D.shoulderHW * 0.9, rz: D.chestHW * 0.5 },
    { y: t + 0.05 * D.neck, rx: D.shoulderHW * 0.55, rz: D.chestHW * 0.42 }, { y: t + 0.16 * D.neck, rx: nr * 1.5, rz: nr * 1.45 }, { y: t + 0.2 * D.neck, rx: nr * 1.12, rz: nr * 1.1 }];
}
function blouseRings(D) {
  const t = D.torso, H = D.H, nr = D.neckR;
  return [{ y: 0.24 * t, rx: D.waistHW * 1.04, rz: D.waistHW * 0.84 }, { y: 0.32 * t, rx: D.waistHW, rz: D.waistHW * 0.8 }, { y: 0.5 * t, rx: lerp(D.waistHW, D.chestHW, 0.55), rz: D.chestHW * 0.66 },
    { y: 0.7 * t, rx: D.chestHW * 1.02, rz: D.chestHW * 0.78, cz: 0.012 * H }, { y: 0.86 * t, rx: D.shoulderHW * 0.98, rz: D.chestHW * 0.6 }, { y: t, rx: D.shoulderHW * 0.86, rz: D.chestHW * 0.5 },
    { y: t + 0.06 * D.neck, rx: D.shoulderHW * 0.5, rz: D.chestHW * 0.4 }, { y: t + 0.16 * D.neck, rx: nr * 1.4, rz: nr * 1.35 }, { y: t + 0.2 * D.neck, rx: nr * 1.08, rz: nr * 1.06 }];
}
function skirtRings(D, floorY) {
  const t = D.torso, th = D.thigh;
  return [{ y: floorY + 0.005, rx: D.hipHW * 1.55, rz: th * 0.78, cz: th * 0.5 }, { y: floorY * 0.55, rx: D.hipHW * 1.4, rz: th * 0.7, cz: th * 0.5 }, { y: -0.05 * D.H, rx: D.hipHW * 1.32, rz: th * 0.68, cz: th * 0.46 },
    { y: 0.02 * D.H, rx: D.hipHW * 1.25, rz: th * 0.62, cz: th * 0.36 }, { y: 0.1 * t, rx: D.hipHW * 1.1, rz: D.hipHW * 0.95, cz: 0.02 * D.H }, { y: 0.3 * t, rx: D.waistHW * 1.04, rz: D.waistHW * 0.86 }];
}
function ik2(S, T, a, b, pole, out) {   // two bones from S to reach T: the elbow found toward the pole
  const d = T.clone().sub(S), L = clamp(d.length(), Math.abs(a - b) + 1e-4, (a + b) * 0.999); d.normalize();
  const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x)), p = pole.clone().sub(S); p.addScaledVector(d, -p.dot(d)); if (p.lengthSq() < 1e-9) p.set(0, -1, 0); p.normalize();
  return out.copy(S).addScaledVector(d, x).addScaledVector(p, h);
}

function buildDoll(id, kuk, eyeK) {
  const C = CAST[id], D = dims(id, kuk, eyeK), H = D.H;
  const d = { id, C, D, kuk, hand3: {}, root: new THREE.Group(), geos: [], mats: [], texs: [], eyes: [], lids: [], arm: {}, fingers: {}, hy: 0, hp: 0, hyv: 0, hpv: 0, ey: 0, ep: 0,
    ph: Math.random() * 10, bw: 1.5 + Math.random() * 0.3, nextBlink: 1 + Math.random() * 3, blinkAt: -9, nextLook: 0, lookAt: null };
  const own = (m) => (d.mats.push(m), m);
  const add = (geo, mat, parent, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); d.geos.push(geo); return m; };
  const pelvis = new THREE.Group(), spine = new THREE.Group(); pelvis.position.y = D.yHip; d.root.add(pelvis); pelvis.add(spine); d.pelvis = pelvis; d.spine = spine;
  // the seat: Nell sits as high as her arms need, the elbows a little over the keys; Otto as his legs need
  if (id === 'nell') d.seatTop = clamp(0.76 + 0.85 * D.upper - D.torso - 0.85 * D.rThigh, 0.4, 0.8);
  else if (C.seated) d.seatTop = D.yKnee - 0.85 * D.rThigh;
  // the head: turned, its face painted, the eyes of glass behind lids that blink
  const prof = headProfile(D), hs = HAIR[C.hair](D), hz = 0.05 * D.headW;
  const thE = Math.asin(2 * 0.47 - 1), pe = prof(thE); let er = D.eyeR, ex = Math.max(0.2 * D.headW, er * 1.22);
  if (ex > 0.62 * pe.r) { ex = 0.62 * pe.r; er = Math.min(er, ex / 1.15); }
  const phE = Math.asin(ex / pe.r), Ry = D.headH / 2, vOf = (th) => (th + PI / 2) / PI, thOfY = (y) => Math.asin(clamp(y / Ry - 1, -1, 1));
  const yM = pe.y - 0.22 * D.headH, thM = thOfY(yM), pm = prof(thM);
  const F = { hair: hs, eyes: [-1, 1].map((s) => ({ u: 0.5 + s * phE / (2 * PI), v: vOf(thE), du: er / (2 * PI * pe.r), dv: er / (PI * Ry * Math.cos(thE)) })),
    cheeks: [-1, 1].map((s) => ({ u: 0.5 + s * (phE + 0.16) / (2 * PI), v: vOf(thE - 0.36), du: 0.05, dv: 0.06 })), mouth: { u: 0.5, v: vOf(thM), du: 0.11 * D.headW / (2 * PI * pm.r), dv: 0.035 * D.headH / (PI * Ry) } };
  const faceT = tex(faceCanvas(C, F, kuk), true); faceT.wrapS = THREE.ClampToEdgeWrapping; d.texs.push(faceT);
  const eyeT = tex(eyeCanvas(C.iris), true); d.texs.push(eyeT);
  const mFace = own(phys({ map: faceT, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  const mPaint = own(phys({ color: new THREE.Color(C.paint), bumpMap: TX.crackleB, bumpScale: 0.35, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  const mLid = own(phys({ color: new THREE.Color(C.paint), roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide }));
  const mEye = own(phys({ map: eyeT, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const neckG = new THREE.Group(); neckG.position.set(0, D.torso + 0.14 * D.neck, 0.005 * H); spine.add(neckG); d.neckG = neckG;
  add(new THREE.CylinderGeometry(D.neckR, D.neckR * 1.08, 0.86 * D.neck, 16), mPaint, neckG, 0, 0.43 * D.neck);
  const headG = new THREE.Group(); headG.position.y = 0.86 * D.neck; neckG.add(headG); d.headG = headG;
  add(new THREE.SphereGeometry(D.neckR * 1.12, 16, 12), M.linden, headG);   // the ball of the head joint, bare wood
  const pts = []; for (let i = 0; i <= 40; i++) pts.push(V2(Math.max(0.0001, prof(-PI / 2 + PI * i / 40).r), prof(-PI / 2 + PI * i / 40).y));
  add(new THREE.LatheGeometry(pts, 64, -PI, 2 * PI), mFace, headG, 0, 0, hz);
  add(headPatchGeo(prof, 24, 72, hs), M.hair, headG, 0, 0, hz);
  if (C.hair === 'nell') { const pb = prof(0.05), b = add(new THREE.SphereGeometry(0.17 * D.headH, 24, 18), M.hair, headG, 0, pb.y, hz - pb.r - 0.07 * D.headH); b.scale.set(1, 0.85, 0.78);
    const rb = add(new THREE.TorusGeometry(0.15 * D.headH, 0.018 * D.headH, 8, 32), own(M.silk('#d49a3a')), headG, 0, pb.y, hz - pb.r - 0.04 * D.headH); rb.rotation.y = 0; }
  [-1, 1].forEach((s) => {
    const n = V3(Math.sin(phE) * s, 0, Math.cos(phE)), c = V3(ex * s, pe.y, pe.r * Math.cos(phE) + hz).addScaledVector(n, -0.52 * er);
    const eg = new THREE.Group(); eg.position.copy(c); eg.rotation.y = s * phE * 0.5; headG.add(eg);
    const ball = add(new THREE.SphereGeometry(er, 32, 24), mEye, eg, 0, 0, 0, false);
    const lid = add(new THREE.SphereGeometry(er * 1.07, 32, 12, 0, 2 * PI, 0, PI / 2), mLid, eg);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(er * 1.07, er * 0.065, 6, 40), M.lash); lash.rotation.x = PI / 2; lid.add(lash); d.geos.push(lash.geometry);
    add(new THREE.SphereGeometry(er * 1.05, 32, 8, 0, 2 * PI, PI * 0.7, PI * 0.3), mLid, eg);
    d.eyes.push({ eg, ball, s }); d.lids.push(lid);
  });
  const yN = pe.y - 0.15 * D.headH, pn = prof(thOfY(yN));
  if (C.nose === 'long') { const nz = add(lathe([[0, 0], [0.05, 0.004], [0.052, 0.05], [0.04, 0.13], [0.026, 0.19], [0, 0.205]].map(([r, y]) => [r * D.headH, y * D.headH * lerp(0.85, 1.2, kuk)]), 20), mPaint, headG, 0, yN + 0.04 * D.headH, pn.r * 0.88 + hz); nz.rotation.x = PI / 2 - 0.42; }
  else if (C.nose === 'round') add(new THREE.SphereGeometry(0.075 * D.headH, 20, 16), mPaint, headG, 0, yN, pn.r * 0.93 + hz).scale.set(1, 0.9, 0.85);
  else add(new THREE.SphereGeometry(0.045 * D.headH, 16, 12), mPaint, headG, 0, yN + 0.01 * D.headH, pn.r * 0.97 + hz);
  if (C.hair !== 'nell') [-1, 1].forEach((s) => { const pz = prof(thE - 0.12); add(new THREE.SphereGeometry(0.1 * D.headH, 16, 12), mPaint, headG, s * pz.r * 0.98, pz.y, hz - 0.02 * D.headH).scale.set(0.35, 0.72, 0.5); });
  if (C.moustache) [-1, 1].forEach((s) => { const h = D.headH, y = yN - 0.075 * h, zf = (x, yy) => { const r = prof(thOfY(yy)).r; return Math.sqrt(Math.max(0, r * r - x * x)) + hz + 0.012 * h; };
    const pp = [[0.006, y], [0.06, y - 0.012 * h], [0.12, y - 0.02 * h], [0.165, y + 0.008 * h]].map(([x, yy]) => V3(s * x * h, yy, 0)); pp.forEach((p) => (p.z = zf(p.x, p.y)));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pp), 20, 0.036 * h, 12), M.hair, headG);
    add(new THREE.SphereGeometry(0.034 * h, 12, 10), M.hair, headG, pp[3].x, pp[3].y + 0.012 * h, pp[3].z - 0.004 * h); });
  // the body and its clothes
  const yTop = D.torso + 0.12 * D.neck;
  if (C.dress === 'suit') {
    const R = ringsFn(suitRings(D)), cl = clothMats(C.cloth, C.clothCol, id === 'otto' ? 71 : 73), vest = clothMats('twill', C.vestCol, id === 'otto' ? 75 : 77), shirt = M.shirt(6, 4), tieM = own(M.silk(C.tie));
    own(shirt); d.cl = cl;
    const r0 = suitRings(D);
    add(loftGeo(R, r0[0].y, r0[r0.length - 1].y, 48, 56), cl.torso, spine);
    const yB = 0.42 * D.torso, yV0 = C.open ? r0[1].y + 0.01 * H : yB;
    const vW = (y) => (C.open ? lerp(0.6, 0.48, smooth(0.3 * D.torso, D.torso, y)) : 0.5 * smooth(yB, D.torso, y)) + 0.001;
    add(loftGeo(R, yV0, yTop, 30, 18, (y) => -vW(y), (y) => vW(y), 0.0016 * H), vest.torso, spine);
    const sW = (y) => 0.3 * smooth(0.8 * D.torso, yTop, y) + 0.001;
    add(loftGeo(R, 0.8 * D.torso, yTop, 14, 10, (y) => -sW(y), (y) => sW(y), 0.0026 * H), shirt, spine);
    const yT0 = lerp(0.8 * D.torso, yTop, 0.34), tW = (y) => lerp(0.07, 0.035, smooth(yT0, yTop, y));
    if (!C.open) add(loftGeo(R, yT0, yTop - 0.004 * H, 12, 6, (y) => -tW(y), (y) => tW(y), 0.0034 * H), tieM, spine);
    [-1, 1].forEach((s) => { const lw = (y) => (C.open ? 0.16 : 0.2) * (0.4 + 0.6 * smooth(yV0, 0.8 * D.torso, y)) * (1 - 0.55 * smooth(0.9 * D.torso, yTop, y));
      add(loftGeo(R, C.open ? 0.5 * D.torso : yB, yTop - 0.01 * H, 22, 6, (y) => (s > 0 ? vW(y) : -vW(y) - lw(y)), (y) => (s > 0 ? vW(y) + lw(y) : -vW(y)), 0.0042 * H), cl.torso, spine); });
    const btnG = new THREE.SphereGeometry(0.0065 * H, 10, 8); d.geos.push(btnG);
    if (!C.open) [0, 1, 2].forEach((k) => { const y = yB - k * 0.055 * H, p = surfacePoint(R, y, 0, 0.004 * H); add(btnG, M.horn, spine, p.x, p.y, p.z, false); });
    for (let k = 0; k < 5; k++) { const y = lerp(C.open ? 0.12 : yB + 0.01 * H, 0.72, k / 4) * (C.open ? D.torso : 1), yy = C.open ? y : lerp(yB + 0.012 * H, 0.75 * D.torso, k / 4), p = surfacePoint(R, yy, 0, 0.003 * H); const b = add(btnG, M.horn, spine, p.x, p.y, p.z, false); b.scale.setScalar(0.7); }
    if (C.open) {   // Bo: the watch chain over the belly, a bow tie, a pocket square of his colour
      const ch = [[-0.55, 0.4], [-0.25, 0.33], [0.05, 0.31], [0.3, 0.36], [0.5, 0.43]].map(([p, y]) => surfacePoint(R, y * D.torso, p, 0.003 * H));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ch), 30, 0.0022 * H, 6), M.gold, spine, 0, 0, 0, false);
      const bc = surfacePoint(R, yTop - 0.012 * H, 0, 0.012 * H);
      const bw = new THREE.Shape(); bw.moveTo(0, 0.22); bw.quadraticCurveTo(-0.45, 0.62, -1, 0.55); bw.quadraticCurveTo(-1.08, 0, -1, -0.55); bw.quadraticCurveTo(-0.45, -0.62, 0, -0.22);
      bw.quadraticCurveTo(0.45, -0.62, 1, -0.55); bw.quadraticCurveTo(1.08, 0, 1, 0.55); bw.quadraticCurveTo(0.45, 0.62, 0, 0.22);
      const bwg = new THREE.ExtrudeGeometry(bw, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 10 }); bwg.scale(0.034 * H, 0.034 * H, 0.034 * H);
      add(bwg, tieM, spine, bc.x, bc.y, bc.z - 0.004 * H);
      add(rbox(0.016 * H, 0.02 * H, 0.012 * H, 0.004 * H), tieM, spine, bc.x, bc.y, bc.z + 0.006 * H);
      const pq = surfacePoint(R, 0.8 * D.torso, 0.75, 0.003 * H), sq = add(new THREE.ConeGeometry(0.018 * H, 0.03 * H, 3), tieM, spine, pq.x, pq.y + 0.008 * H, pq.z); sq.rotation.set(0.2, 0, 0.6);
    } else { const kc = surfacePoint(R, yTop - 0.008 * H, 0, 0.005 * H); add(rbox(0.015 * H, 0.017 * H, 0.011 * H, 0.004 * H), tieM, spine, kc.x, kc.y, kc.z).rotation.x = 0.25; }
    const col = add(lathe([[D.neckR * 1.2, 0], [D.neckR * 1.22, 0.035 * H], [D.neckR * 1.18, 0.038 * H]], 28, 0.2, 2 * PI - 0.4), shirt, neckG, 0, 0.02 * D.neck, 0.004 * H); col.material.side = THREE.DoubleSide;
  } else {   // Nell: a white blouse with a high collar, an amber brooch, a long dark skirt over the stool
    const R = ringsFn(blouseRings(D)), r0 = blouseRings(D), blouse = M.shirt(7, 4), skirtCl = clothMats('twill', [30, 34, 50], 79); own(blouse); d.cl = { torso: blouse, sleeve: blouse };
    add(loftGeo(R, r0[0].y, r0[r0.length - 1].y, 40, 56), blouse, spine);
    const floorY = -(d.seatTop + 0.85 * D.rThigh), SR = ringsFn(skirtRings(D, floorY)), s0 = skirtRings(D, floorY);
    add(loftGeo(SR, s0[0].y, s0[s0.length - 1].y, 40, 60), skirtCl.torso, pelvis);
    add(loftGeo(R, 0.27 * D.torso, 0.34 * D.torso, 3, 56, -PI, PI, 0.004 * H), own(phys({ color: 0x15121a, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x40384a) })), spine);
    const col = add(lathe([[D.neckR * 1.16, 0], [D.neckR * 1.18, 0.05 * H], [D.neckR * 1.24, 0.056 * H]], 28), blouse, neckG, 0, 0.02 * D.neck, 0.003 * H); col.material.side = THREE.DoubleSide;
    add(new THREE.TorusGeometry(D.neckR * 1.24, 0.004 * H, 6, 40), blouse, neckG, 0, 0.02 * D.neck + 0.056 * H, 0.003 * H).rotation.x = PI / 2;
    const bro = add(new THREE.SphereGeometry(0.014 * H, 16, 12), M.amber, neckG, 0, 0.02 * D.neck + 0.018 * H, D.neckR * 1.2 + 0.006 * H); bro.scale.set(1, 1.25, 0.55);
    add(new THREE.TorusGeometry(0.0145 * H, 0.002 * H, 6, 24), M.gold, neckG, 0, 0.02 * D.neck + 0.018 * H, D.neckR * 1.2 + 0.007 * H).scale.set(1, 1.25, 1);
  }
  // arms: sleeves, a cuff, the wrist ball of bare wood, a hand with fingers — set each frame by two-bone IK
  const sleeveM = d.cl.sleeve, cuffM = C.dress === 'suit' ? M.shirt(2, 1) : d.cl.torso; if (C.dress === 'suit') own(cuffM);
  ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1, A = { s, shoulder: V3(s * D.shoulderHW * 0.92, D.torso - 0.012 * H, 0) };
    add(new THREE.SphereGeometry(D.rUpper * 0.96, 16, 12), d.cl.torso, spine, A.shoulder.x * 0.97, A.shoulder.y, A.shoulder.z);
    A.up = add(lathe([[D.rUpper * 1.04, 0], [D.rUpper, 0.3 * D.upper], [D.rUpper * 0.86, 0.75 * D.upper], [D.rUpper * 0.8, D.upper]], 20), sleeveM, d.root);
    A.elbow = add(new THREE.SphereGeometry(D.rUpper * 0.8, 16, 12), sleeveM, d.root);
    A.fo = add(lathe([[D.rFore * 1.02, 0], [D.rFore, 0.4 * D.fore], [D.rWrist * 1.25, 0.92 * D.fore], [D.rWrist * 1.32, D.fore]], 20), sleeveM, d.root);
    A.cuff = add(new THREE.CylinderGeometry(D.rWrist * 1.2, D.rWrist * 1.2, 0.026 * H, 16, 1, true), cuffM, d.root); A.cuff.geometry.translate(0, 0.013 * H, 0);
    A.wrist = add(new THREE.SphereGeometry(D.rWrist * 0.92, 16, 12), M.linden, d.root);
    // the hand: its fingers along +y, its back toward +z, the thumb on the side toward s
    const hg = new THREE.Group(); d.root.add(hg); A.hand = hg;
    const pw = D.palmW, pl = D.palmL, pt = 0.022 * H * lerp(1, 0.85, kuk);
    add(rbox(pw, pl, pt, pt * 0.45, 2), mPaint, hg, 0, pl / 2, 0);
    const fingers = [], fl = [0.94, 1.0, 0.96, 0.8];
    for (let i = 0; i < 4; i++) { let par = new THREE.Group(); par.position.set(s * (0.375 - 0.25 * i) * pw, pl - 0.004 * H, 0); hg.add(par); const js = [];
      [0.45, 0.32, 0.23].forEach((k, q) => { const len = k * D.fingL * fl[i], r = D.fingR * (1 - 0.12 * q) * (i === 3 ? 0.88 : 1), j = q ? new THREE.Group() : par; if (q) { j.position.y = [0.45, 0.32][q - 1] * D.fingL * fl[i]; par.add(j); }
        add(new THREE.CapsuleGeometry(r, Math.max(0.0005, len - 2 * r), 4, 10), mPaint, j, 0, len / 2, 0); js.push(j); par = j; });
      fingers.push(js); }
    const tb = new THREE.Group(); tb.position.set(s * pw * 0.45, pl * 0.22, -pt * 0.25); tb.rotation.set(-0.5, 0, -s * 0.75); hg.add(tb);
    add(new THREE.CapsuleGeometry(D.fingR * 1.15, D.fingL * 0.4, 4, 10), mPaint, tb, 0, D.fingL * 0.25, 0);
    const tb2 = new THREE.Group(); tb2.position.y = D.fingL * 0.48; tb2.rotation.x = -0.3; tb.add(tb2); add(new THREE.CapsuleGeometry(D.fingR * 1.05, D.fingL * 0.26, 4, 10), mPaint, tb2, 0, D.fingL * 0.17, 0);
    A.fingers = fingers; A.thumb = [tb, tb2]; d.arm[side] = A;
  });
  // legs: trousers and shoes for the men; under Nell's skirt nothing needs to be there
  if (C.dress === 'suit') ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1, hip = new THREE.Group(); hip.position.set(s * D.hipJW, 0, 0); pelvis.add(hip);
    add(lathe([[D.rKnee, -D.thigh], [D.rThigh * 0.9, -0.55 * D.thigh], [D.rThigh, -0.1 * D.thigh], [D.rThigh * 0.96, 0]], 20), d.cl.leg, hip);
    const knee = new THREE.Group(); knee.position.y = -D.thigh; hip.add(knee); add(new THREE.SphereGeometry(D.rKnee * 1.02, 16, 12), d.cl.leg, knee);
    add(lathe([[D.rShin * 1.12, -D.shin], [D.rShin, -0.5 * D.shin], [D.rKnee * 0.98, -0.05 * D.shin], [D.rKnee, 0]], 20), d.cl.leg, knee);
    const ankle = new THREE.Group(); ankle.position.y = -D.shin; knee.add(ankle);
    const sh = 1.15 * D.ankle; add(rbox(0.068 * H * lerp(1, 0.85, kuk), sh, D.footL, sh * 0.48, 3), M.leather, ankle, 0, -D.ankle + sh / 2, 0.25 * D.footL);
    d['hip' + side] = hip; d['knee' + side] = knee; d['ankle' + side] = ankle;
  });
  d.root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return d;
}
function disposeDoll(d) { d.root.removeFromParent(); d.geos.forEach((g) => g.dispose()); d.mats.forEach((m) => m.dispose()); d.texs.forEach((t) => t.dispose()); if (d.props) d.props.forEach((p) => { p.removeFromParent(); p.traverse((o) => o.geometry && o.geometry.dispose()); }); }
function setCurl(A, curls, thumb) { A.fingers.forEach((js, i) => js.forEach((j, q) => (j.rotation.x = -curls[i] * [1, 1.1, 0.8][q]))); A.thumb[0].rotation.x = -0.5 - thumb; A.thumb[1].rotation.x = -0.3 - thumb; }
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function poseArm(d, side, Tw, poleW, Fw, Dw) {   // targets in the world; IK in the doll's own frame
  const A = d.arm[side], D = d.D, root = d.root;
  const S = root.worldToLocal(d.spine.localToWorld(A.shoulder.clone())), T = root.worldToLocal(Tw.clone()), P = root.worldToLocal(poleW.clone());
  root.getWorldQuaternion(_q).invert();
  const F = Fw.clone().applyQuaternion(_q).normalize(), Dh = Dw.clone().applyQuaternion(_q);
  const E = ik2(S, T, D.upper, D.fore, P, new THREE.Vector3()), W = E.clone().add(T.clone().sub(E).setLength(D.fore)), dir = W.clone().sub(E).normalize();
  setSeg(A.up, S, E); A.elbow.position.copy(E); setSeg(A.fo, E, W);
  A.cuff.position.copy(W).addScaledVector(dir, -0.024 * D.H); A.cuff.quaternion.setFromUnitVectors(UP, dir);
  A.wrist.position.copy(W);
  const Y = F, Z = Dh.addScaledVector(Y, -Dh.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  A.hand.position.copy(W).addScaledVector(Y, D.rWrist * 0.55); A.hand.quaternion.setFromRotationMatrix(_m.makeBasis(X, Y, Z));
}

// ── the cast in its places: Nell at the upright (her back to us, half turned), Otto with the bandoneón on his knees, Bo at the bass
let cast = {}, BAND = null, BASS = null;
const tmp = V3(0, 0, 0);
function placeCast() {
  for (const id in cast) disposeDoll(cast[id]);
  cast = { nell: buildDoll('nell', K.kuk, K.eyes), otto: buildDoll('otto', K.kuk, K.eyes), bo: buildDoll('bo', K.kuk, K.eyes) };
  const n = cast.nell, o = cast.otto, b = cast.bo;
  // Nell
  const stool = pianoStool(n.seatTop), sp = V3(0, 0, 0.62).applyMatrix4(PIANO.matrixWorld); stool.position.copy(sp); stool.rotation.y = PIANO.rotation.y; scene.add(stool); n.props = [stool];
  n.root.position.set(sp.x, STAGE + n.seatTop + 0.85 * n.D.rThigh - n.D.yHip, sp.z); n.root.rotation.y = PIANO.rotation.y + PI; n.spine.rotation.x = 0.1; scene.add(n.root);
  // Otto
  const ch = thonet(o.seatTop); ch.position.set(-0.95, STAGE, -0.8); ch.rotation.y = -0.78; scene.add(ch); o.props = [ch];
  o.root.position.set(-0.95, STAGE + o.seatTop + 0.85 * o.D.rThigh - o.D.yHip, -0.8 + 0.02); o.root.rotation.y = -0.78; o.spine.rotation.x = 0.14; scene.add(o.root);
  ['L', 'R'].forEach((sd) => { const s = sd === 'L' ? 1 : -1; o['hip' + sd].rotation.set(-PI / 2 + 0.06, 0, s * 0.16); o['knee' + sd].rotation.set(PI / 2 - 0.02, 0, -s * 0.12); o['ankle' + sd].rotation.x = -0.04; });
  o.root.add(BAND); BAND.position.set(0, o.D.yHip + o.D.rThigh * 1.05 + BAND.userData.S / 2, 0.55 * o.D.thigh); BAND.rotation.set(0.12, 0, 0);
  o.home = { x: o.root.position.x, y: o.root.position.y, z: o.root.position.z, rotY: o.root.rotation.y, band: BAND.position.clone() };   // v34: where he walks to
  // Bo
  b.root.position.set(0.45, STAGE, -1.35); b.root.rotation.y = -0.64; scene.add(b.root);
  ['L', 'R'].forEach((sd) => { const s = sd === 'L' ? 1 : -1; b['hip' + sd].rotation.set(0.02, 0, s * 0.05); b['knee' + sd].rotation.set(0.03, 0, -s * 0.03); b['ankle' + sd].rotation.x = -0.05; });
  b.spine.rotation.set(0.05, 0, -0.04);
  b.root.add(BASS); BASS.position.set(0.06, 0, 0.46 + 0.04 * b.D.belly); BASS.rotation.set(-0.16, -0.42, 0.1);
  b.home = { x: b.root.position.x, y: b.root.position.y, z: b.root.position.z, rotY: b.root.rotation.y }; BASS.userData.home = { p: BASS.position.clone(), q: BASS.quaternion.clone() };   // v34
  scene.updateMatrixWorld(true);
  for (const id in cast) lifeStep(cast[id], 0, 0.016, true);
}

// ── life: breath, blinks, the gaze going between them, the hands on the instruments
const LOOK = {
  nell: [() => V3(0, 1.04, 0.06).applyMatrix4(PIANO.matrixWorld), () => headOf('otto'), () => headOf('bo'), () => cast.nell.arm.R.hand.getWorldPosition(V3(0, 0, 0))],
  otto: [() => BAND.getWorldPosition(V3(0, 0, 0)), () => headOf('nell'), () => headOf('nell'), () => headOf('bo')],
  bo: [() => headOf('nell'), () => headOf('otto'), () => BASS.localToWorld(V3(0, 1.1, 0.15)), () => headOf('nell')],
};
function headOf(id) { return cast[id].headG.getWorldPosition(V3(0, 0, 0)).add(V3(0, cast[id].D.headH * 0.5, 0)); }
const keyW = (m, dz = 0, dy = 0) => V3(PIANO.userData.keyX[m], PIANO.userData.keyTop + dy, 0.24 + dz).applyMatrix4(PIANO.matrixWorld);
function lifeStep(d, t, dt, snap) {
  const D = d.D, b = Math.sin(t * d.bw + d.ph), V = K.vmeste ? HS.withMusic(d.id, HS.now()) : null; d.V = V;
  const Hc = V && K.har && HS.harakter ? HS.harakter(HS.now()) : null;   // v35: the character the band plays in — stormy, a bigger beat in the body; calm, a deeper breath; dark, the head down
  const A = K.mir && d.id !== 'nell' ? HS.arrival(d.id, HS.now()) : null; d.A = A;   // v34: not here yet — or walking in through the door
  if (d.id === 'bo') parkBass(!!(A && A.settle < 1));
  if (A && !A.here) { d.root.visible = false; return; }
  d.root.visible = true; const moving = !!(A && A.settle < 1);
  const sp = (key, target, k = 34, c = 9) => { const S = d.sp || (d.sp = {}), o = S[key] || (S[key] = { x: target, v: 0 }); if (snap) { o.x = target; o.v = 0; } else { o.v += (k * (target - o.x) - c * o.v) * dt; o.x += o.v * dt; } return o.x; };   // a toy's spring for each part: it overshoots a little, then settles
  d.spring = sp;
  if (!d.base) d.base = { x: d.spine.rotation.x, y: d.spine.rotation.y, z: d.spine.rotation.z, ry: d.root.position.y };
  // the body takes part: breath before a phrase, the lean of the one who leads, the beat, its own notes, rest between pieces
  const br = V ? sp('br', V.breath, 40, 11) * (Hc ? 1 + 0.6 * Math.max(0, -Hc.y) : 1) : 0, pu = V ? V.pulse * (Hc ? clamp(1 + 0.8 * Hc.y, 0.3, 1.8) : 1) : 0, hit = V ? V.hit : 0, rest = V ? sp('rest', V.rest, 12, 7) : 0; d.restS = rest;
  d.spine.scale.set(1 + 0.007 * b + 0.007 * br, 1 + 0.004 * b + 0.014 * br - (V ? 0.012 * V.tired : 0), 1 + 0.012 * b + 0.012 * br);
  let lean = V ? (V.lead ? 0.07 : V.leader ? -0.025 : 0) - 0.05 * rest + 0.035 * hit + (Hc ? 0.05 * Math.max(0, Hc.y) * Math.max(0, -Hc.x) + 0.035 * Math.max(0, -Hc.y) * Math.max(0, -Hc.x) : 0) : 0, twist = 0;   // v35: drama leans in; longing sinks
  if (moving) lean = 0.05;   // v34: walking, a little forward
  if (d.id === 'otto' && V && d.bel && d.bel.on) lean += d.bel.dir > 0 ? -0.03 : 0.045;   // he opens leaning back a little, closes leaning in, over the instrument
  if (d.id === 'nell' && V && d.hand3.L && d.hand3.R) twist = (d.hand3.R.on ? -0.07 : 0) + (d.hand3.L.on ? 0.07 : 0);   // she turns a little to the hand that plays
  d.spine.rotation.set(d.base.x + sp('lean', lean, 26, 8) + 0.015 * pu, d.base.y + sp('tw', twist, 18, 7), d.base.z);
  if (moving) walkPose(d, A, t);   // v34
  else if (d.id === 'bo') { const bo = V ? sp('bounce', pu, 60, 10) : 0;   // Bo stands and gives with his knees on the beat
    ['L', 'R'].forEach((sd) => { const s = sd === 'L' ? 1 : -1; d['hip' + sd].rotation.set(0.02 - 0.06 * bo, 0, s * 0.05); d['knee' + sd].rotation.set(0.03 + 0.12 * bo, 0, -s * 0.03); d['ankle' + sd].rotation.x = -0.05 - 0.06 * bo; });
    d.root.position.y = d.base.ry - 0.012 * bo; }
  if (t > d.nextBlink) { d.blinkAt = t; d.nextBlink = t + (Math.random() < 0.15 ? 0.32 : 2.2 + Math.random() * 4.2); }
  const bt = t - d.blinkAt, close = bt < 0 ? 0 : bt < 0.07 ? bt / 0.07 : bt < 0.1 ? 1 : bt < 0.2 ? 1 - (bt - 0.1) / 0.1 : 0;
  // the gaze: where the lab's figure looks; at the end of a tango, at Nell — or, with «vmeste» 0, here and there as in v32
  let tg, gk = 'own';
  if (moving) tg = d.root.localToWorld(V3(0, D.yHip + D.torso + D.neck, 2.2));   // v34: walking, it looks where it goes
  else if (V) { const g = V.end.look && d.id !== 'nell' ? { kind: 'mus', id: 'nell' } : V.gaze; gk = g.kind; tg = lookPoint(d, g);
    if (t > (d.sacc || 0)) { d.sacc = t + 0.5 + Math.random(); d.saccX = (Math.random() - 0.5) * 0.06; d.saccY = (Math.random() - 0.5) * 0.04; } }   // the small leaps the eyes make
  else { if (t > d.nextLook || !d.lookAt) { const L = LOOK[d.id]; d.lookAt = L[Math.floor(Math.random() * L.length)]; d.nextLook = t + 1.4 + Math.random() * 3.2; } tg = d.lookAt(); }
  const hw = d.headG.getWorldPosition(tmp.set(0, 0, 0)), hl = d.root.worldToLocal(hw.clone()), tl = d.root.worldToLocal(tg.clone()).sub(hl);
  const wy = Math.atan2(tl.x, tl.z), wp = Math.atan2(tl.y, Math.hypot(tl.x, tl.z)), hy = clamp(wy * 0.78, -1.1, 1.1), hp = clamp(wp * 0.6, -0.5, 0.35);
  if (snap) { d.hy = hy; d.hp = hp; } else { const k = 38, c = 7.4; d.hyv += (k * (hy - d.hy) - c * d.hyv) * dt; d.hpv += (k * (hp - d.hp) - c * d.hpv) * dt; d.hy += d.hyv * dt; d.hp += d.hpv * dt; }
  const nodP = V ? 0.16 * V.nod + (d.id === 'nell' ? V.end.nod : 0) + 0.04 * pu + 0.03 * hit - 0.06 * br - 0.14 * V.flinch + 0.07 * V.tired - 0.06 * rest + (Hc ? 0.09 * Math.max(0, -Hc.x) * Math.max(0, -Hc.y) - 0.04 * Math.max(0, Hc.x) : 0) : 0;   // down: pleased, the last chord, the beat, its own note; up: a breath, a start, rest
  d.headG.rotation.set(-d.hp + sp('nod', nodP, 90, 13) + 0.03 * Math.sin(t * 0.7 + d.ph), d.hy, 0.04 * Math.sin(t * 0.43 + d.ph * 2), 'YXZ');
  const ey = clamp(wy - d.hy + (V ? d.saccX || 0 : 0), -0.42, 0.42), ep = clamp(wp - d.hp + (V ? d.saccY || 0 : 0), -0.35, 0.3);
  d.ey += (ey - d.ey) * Math.min(1, dt * 25); d.ep += (ep - d.ep) * Math.min(1, dt * 25);
  d.eyes.forEach((e) => e.ball.rotation.set(-d.ep, d.ey - e.eg.rotation.y, 0, 'YXZ'));
  const looks = V ? gk === 'mus' || gk === 'sofa' || gk === 'stand' : d.id === 'otto' && d.lookAt === LOOK.otto[1];   // Otto plays with his eyes half shut and opens them to look at someone
  const lid = d.C.lid + (looks ? (d.id === 'otto' ? -0.36 : -0.07) : 0) + Math.max(0, -d.ep) * 0.6 - (V ? 0.12 * V.flinch : 0);
  d.lids.forEach((l) => (l.rotation.x = lerp(lid, 0.52, close)));
  d.root.updateMatrixWorld(true);
  rigHands(d, t);
}
function parkBass(park) {   // v34: before Bo is in his place the bass waits on its own where he will play it; then it is his again
  const b = cast.bo; if (!b || !BASS.userData.home) return;
  if (park && BASS.parent !== room) room.attach(BASS);
  else if (!park && BASS.parent !== b.root) { b.root.attach(BASS); BASS.position.copy(BASS.userData.home.p); BASS.quaternion.copy(BASS.userData.home.q); }
}
function routeOf(d) {   // v34: the way in from the door — Bo straight to his place; Otto behind Bo's place and the bass, past the right of his chair, round to its front
  const H = d.home, door = V3(0.55, 0, RB + 0.1);
  if (d.id !== 'otto') return new THREE.QuadraticBezierCurve3(door, V3(0.55, 0, RB + 0.95), V3(H.x, 0, H.z));
  const f = V3(Math.sin(H.rotY), 0, Math.cos(H.rotY)), side = V3(f.z, 0, -f.x), stand = V3(H.x, 0, H.z).addScaledVector(f, 0.28 * 0.766).addScaledVector(side, 0.28 * 0.643);   // where one stands to sit: before the seat, a little to the side he comes from
  return new THREE.CatmullRomCurve3([door, V3(0.22, 0, -1.95), V3(-0.24, 0, -1.4), V3(-0.42, 0, -0.78), V3(-0.68, 0, -0.33), stand]);   // the straight way went through the parked bass, Bo's place and the back of the chair; this one keeps 5 cm and more from each (measured on their shapes)
}
function walkPose(d, A, t) {   // v34: in through the door, a toy's walk across the stage, then down into the chair (Otto) or behind the bass (Bo)
  const H = d.home, D = d.D, R = d.route || (d.route = routeOf(d)), L = d.routeL || (d.routeL = R.getLength());
  const u = smooth(0, 1, A.walk), p = R.getPointAt(u), tg = R.getTangentAt(u), head = Math.atan2(tg.x, tg.z);
  const st = smooth(0, 1, A.settle), dy = Math.atan2(Math.sin(H.rotY - head), Math.cos(H.rotY - head));
  p.lerp(V3(H.x, 0, H.z), st);   // settling: from where it stopped onto its place — Otto steps back onto the seat as he turns to the room
  const stride = clamp(L / (3 * (A.W || 1.5)), 0.42, 0.6), ph = u * L / stride * PI, sw = 1 - st, sit = d.id === 'otto';   // about three steps a second: a longer way takes longer strides, not more time; the steps die away as it settles
  d.walkPh = ph; d.walkSw = sw;
  d.root.position.set(p.x, lerp(STAGE, H.y, st) + 0.018 * Math.abs(Math.sin(ph)) * sw, p.z); d.root.rotation.y = head + dy * st;
  ['L', 'R'].forEach((sd, k) => { const s = sd === 'L' ? 1 : -1, q = ph + (k ? PI : 0), fw = -0.4 * Math.sin(q) * sw, kn = 0.55 * Math.max(0, Math.sin(q + 1.1)) * sw;
    d['hip' + sd].rotation.set(sit ? lerp(fw, -PI / 2 + 0.06, st) : lerp(fw, 0.02, st), 0, s * (sit ? lerp(0.04, 0.16, st) : 0.05));
    d['knee' + sd].rotation.set(sit ? lerp(kn, PI / 2 - 0.02, st) : lerp(kn, 0.03, st), 0, sit ? -s * 0.12 * st : -s * 0.03);
    d['ankle' + sd].rotation.x = -0.1 * Math.max(0, Math.sin(q)) * sw + (sit ? -0.04 : -0.05) * st; });
  if (sit) { BAND.position.copy(V3(0, D.yHip + 0.16, 0.3).lerp(H.band, st)); BAND.rotation.set(0.12 * st, 0, 0); }   // he carries the bandoneón before him, then it goes on his knees
}
function lookPoint(d, g) {   // v33: the thing it looks at, as a point in the room
  if (g.kind === 'mus' && cast[g.id]) return headOf(g.id);
  if (g.kind === 'sofa') return camera.position.clone();   // the guest — that is us
  if (g.kind === 'stand') return V3(0, 1.04, 0.06).applyMatrix4(PIANO.matrixWorld);
  if (g.kind === 'window') return V3(2.4, 1.9, RB - 0.1);
  if (d.id === 'nell') { const h = d.hand3; return h.L && h.R ? V3((h.L.x + h.R.x) / 2, PIANO.userData.keyTop, 0.2).applyMatrix4(PIANO.matrixWorld) : V3(0, 1.04, 0.06).applyMatrix4(PIANO.matrixWorld); }
  if (d.id === 'otto') return BAND.getWorldPosition(V3(0, 0, 0));
  return BASS.localToWorld(V3(0, 1.25, 0.1));
}
function rigHands(d, t) {
  const D = d.D;
  if (d.id === 'nell') {   // her hands read the notes the engine has scheduled: along the keys where the pitch is, lifted before a stroke, down with its sound
    const inward = V3(0, 0, -1).applyQuaternion(PIANO.quaternion), up = UP.clone(), Tn = HS.now();
    ['L', 'R'].forEach((sd) => {
      const s = sd === 'L' ? 1 : -1, h = HS.hand(sd, Tn), k = HS.keyAt(h.p);
      const T = V3(k.x, PIANO.userData.keyTop + (k.black ? 0.018 : 0) + 0.028 + h.lift, (k.black ? 0.17 : 0.24) + D.palmL + 0.5 * D.fingL).applyMatrix4(PIANO.matrixWorld);
      const rs = d.restS || 0, rq = d.root.quaternion, F = inward.clone().addScaledVector(up, -0.42), Dh = up.clone().addScaledVector(inward, -0.15);
      if (rs > 0.001) { T.lerp(d.root.localToWorld(V3(s * 0.11, D.yHip + 0.07, D.thigh * 0.42)), rs); F.lerp(V3(0, -0.45, 1).applyQuaternion(rq).normalize(), rs); }   // v33: between pieces, her hands in her lap
      poseArm(d, sd, T, d.spine.localToWorld(V3(s * 0.45, -0.2, -0.35)), F, Dh);
      const press = h.on ? 0.2 : 0, spread = clamp(h.w / 12, 0, 1);   // down on a key the fingers close a little more; a chord keeps them open
      setCurl(d.arm[sd], [0.42 + press - 0.1 * spread, 0.4 + press, 0.42 + press, 0.46 + press - 0.12 * spread].map((c) => lerp(c, 0.55, rs)), 0.25 + 0.2 * spread);
      d.hand3[sd] = { p: +h.p.toFixed(3), x: +k.x.toFixed(4), on: h.on };   // checks only
    });
  } else if (d.id === 'otto') {   // he holds the ends of the bandoneón; v32: the bellows open and close with his line, a finger presses for each note
    const bl = K.igra ? HS.bellows(HS.now()) : null; d.bel = bl;
    if (d.bandY0 === undefined) d.bandY0 = d.home ? d.home.band.y : BAND.position.y;   // v34: his knees' height, not where he carried it in
    const walking = !!(d.A && d.A.settle < 1), rs = walking ? 1 : d.restS || 0, len = lerp(bl ? bl.len : 0.26 + 0.014 * Math.sin(t * d.bw + d.ph), 0.12, rs), push = d.V && !walking ? 0.006 * d.V.hit : 0;
    BAND.userData.setOpen(len - push);   // v33: at rest they close; each struck note a small push
    if (K.vmeste && !walking) { const op = clamp((len - 0.12) / 0.28, 0, 1);   // v33: his knees go with the bellows — apart as they open, together as they close (as the teachers say: the legs move with the instrument)
      ['L', 'R'].forEach((sd) => { const s = sd === 'L' ? 1 : -1; d['hip' + sd].rotation.z = s * (0.08 + 0.26 * op); d['knee' + sd].rotation.z = -s * (0.05 + 0.22 * op); });
      BAND.position.y = d.bandY0 - 0.03 * rs; }
    const elb = K.vmeste && d.spring ? d.spring('elb', bl && bl.on && bl.dir < 0 ? 1 : 0, 20, 7) : 0;   // closing, the elbows rise, as if hugging the instrument
    BAND.updateMatrixWorld(true);
    BAND.userData.ends.forEach((e, k) => { const sd = k ? 'L' : 'R', s = k ? 1 : -1, ew = e.getWorldPosition(V3(0, 0, 0)), out = V3(s, 0, 0).applyQuaternion(BAND.getWorldQuaternion(new THREE.Quaternion()));
      const T = ew.clone().addScaledVector(out, BAND.userData.E * 0.5 + D.rWrist * 1.2).add(V3(0, 0.02, 0)), pole = d.spine.localToWorld(V3(s * 0.55, -0.35 + 0.32 * elb, -0.25 + 0.1 * elb));
      poseArm(d, sd, T, pole, V3(0, 0.75, 0).add(V3(0, 0, 0.66).applyQuaternion(d.root.quaternion)), out);
      const c = [0.9, 0.95, 1.0, 1.05]; if (bl && bl.on && bl.hand === sd) c[bl.p % 4] += 0.35;   // the finger on the button of the note now sounding
      setCurl(d.arm[sd], c, 0.4); });
  } else {   // Bo: the left hand on the neck, the right by the end of the fingerboard, ready to pluck
    if (d.A && d.A.settle < 1) {   // v34: walking in, his arms swing
      const rq = d.root.quaternion; ['L', 'R'].forEach((sd, k) => { const s = sd === 'L' ? 1 : -1, q = (d.walkPh || 0) + (k ? 0 : PI);
        poseArm(d, sd, d.root.localToWorld(V3(s * (D.shoulderHW + 0.03), D.yHip + 0.02, 0.16 * Math.sin(q) * (d.walkSw || 0))), d.spine.localToWorld(V3(s * 0.35, -0.3, -0.3)), V3(0, -1, 0.15).applyQuaternion(rq), V3(s, 0, 0).applyQuaternion(rq)); setCurl(d.arm[sd], [0.5, 0.55, 0.6, 0.65], 0.3); });
      return;
    }
    const U = BASS.userData, bq = BASS.getWorldQuaternion(new THREE.Quaternion()), W = (v) => U.inner.localToWorld(v.clone()), Dq = (v) => v.clone().normalize().applyQuaternion(bq);
    const bh = K.igra ? HS.bass(HS.now()) : null; d.bassH = bh;
    if (!bh) {
      poseArm(d, 'L', W(U.neckL), d.spine.localToWorld(V3(0.6, -0.3, 0.1)), Dq(U.neckF), Dq(U.neckD));
      poseArm(d, 'R', W(U.pluck), W(U.elbowR), Dq(U.pluckF), Dq(U.pluckD));   // v39: the elbow out by the bass's side, not inside it
      setCurl(d.arm.L, [1.05, 1.1, 1.12, 1.15], 0.55); setCurl(d.arm.R, [0.35 + 0.1 * Math.sin(t * 1.7), 0.5, 0.9, 1.0], 0.2);
    } else {   // v32: the left hand beside the neck where the note is stopped, its fingers on the string; the right finger hooks, pulls, comes back
      const stop = U.strAt(bh.L.string, 1.845 - bh.L.d), wl = stop.clone().add(V3(0.075, 0.03, -0.06));
      poseArm(d, 'L', W(wl), d.spine.localToWorld(V3(0.6, -0.3, 0.1)), Dq(V3(-0.55, -0.25, 0.8)), Dq(V3(0.9, 0.2, -0.3)));
      setCurl(d.arm.L, bh.L.press ? [1.2, 1.25, 1.2, 1.15] : [0.8, 0.85, 0.85, 0.9], 0.55);
      const P = U.strAt(bh.R.string, U.pluckY), rest = U.pluck, e = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
      const near = P.clone().add(V3(-0.06, 0.02, 0.035)), past = P.clone().add(V3(-0.01, 0.01, 0.035)), ph = bh.R.phase, u = bh.R.u;
      const wr = (ph === 'hook' ? rest.clone().lerp(near, e(u)) : ph === 'pull' ? near.clone().lerp(past, e(u)) : ph === 'back' ? past.clone().lerp(rest, e(u)) : rest.clone()).lerp(V3(-0.24, 1.2, 0.17), d.restS || 0);   // v33: at rest, on the bass's shoulder; v39 — on its edge, in front, not in the wood
      poseArm(d, 'R', W(wr), W(U.elbowR), Dq(U.pluckF), Dq(U.pluckD));   // v39
      const cl = ph === 'pull' ? 0.45 + 0.5 * e(u) : ph === 'back' ? 0.95 - 0.5 * e(u) : 0.45;   // the two fingers close as they pull through the string
      setCurl(d.arm.R, [cl, cl + 0.05, 0.95, 1.05], 0.2);
    }
  }
}

// ── the lamps' warmth (the knob), their small unrest; the dust in their light
function kelvin(K0) {
  const t = K0 / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; } else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  return srgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
}
function applyWarm() {
  const c = kelvin(K.warm);
  LAMPS.forEach((L) => { L.spot.color.copy(c); L.glow.color.copy(c); L.shadeM.emissive.copy(c); L.bulbM.color.copy(c).multiplyScalar(1.6); });
  SCONCES.forEach((S) => { S.pl.color.copy(c); S.shadeM.emissive.copy(c); });
}
let dust = null;
function buildDust() {
  const N = 360, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seeds = [], R = rng(91);
  for (let i = 0; i < N; i++) seeds.push({ L: LAMPS[i % 2], a: R() * PI * 2, r: Math.sqrt(R()), h: R(), sp: 0.01 + R() * 0.025, w: R() * 10 });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.012, map: tex(dotCanvas(), false), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts); dust = { pts, seeds, pos, col };
}
function stepDust(t, dt) {
  const { seeds, pos, col, pts } = dust, c = kelvin(K.warm);
  seeds.forEach((s, i) => { s.h = (s.h + s.sp * dt) % 1; s.a += 0.05 * dt;
    const L = s.L.spot.position, y = L.y - 0.15 - s.h * 2.0, rad = (L.y - y) * Math.tan(0.75) * s.r, wob = 0.03 * Math.sin(t * 0.6 + s.w);
    pos[i * 3] = L.x + Math.cos(s.a) * rad + wob; pos[i * 3 + 1] = y; pos[i * 3 + 2] = L.z + Math.sin(s.a) * rad + wob * 0.7;
    const k = 0.5 * (1 - s.r * s.r) * (1 - s.h * 0.7) * (0.6 + 0.4 * Math.sin(t * 2 + s.w)); col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; });
  pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
}

// ── the camera: looking in at the front, a little from above, like a child at a doll's house; drag to walk round, the wheel to come near
const CAM = { yaw: 0.16, pitch: 0.1, dist: 6.4, target: V3(-0.85, 1.28, -1.1) }, CAM0 = { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist }, camS = { ...CAM0 };
function stepCamera(dt) {
  const k = 1 - Math.exp(-dt * 7); camS.yaw += (CAM.yaw - camS.yaw) * k; camS.pitch += (CAM.pitch - camS.pitch) * k; camS.dist += (CAM.dist - camS.dist) * k;
  const T = CAM.target, cp = Math.cos(camS.pitch);
  camera.position.set(T.x + camS.dist * Math.sin(camS.yaw) * cp, T.y + camS.dist * Math.sin(camS.pitch), T.z + camS.dist * Math.cos(camS.yaw) * cp); camera.lookAt(T);
  const dir = camera.getWorldDirection(V3(0, 0, 0)); bokeh.uniforms.focus.value = Math.max(1, V3(-1.0, 1.35, -1.05).sub(camera.position).dot(dir));
}
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: CAM.yaw, pitch: CAM.pitch }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
cv.addEventListener('pointermove', (e) => { if (!drag) return; CAM.yaw = clamp(drag.yaw - (e.clientX - drag.x) * 0.005, -0.8, 0.8); CAM.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, 0.0, 0.6); });
const dragEnd = (e) => { const moved = !drag || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5; drag = null; cv.classList.remove('drag'); if (e.type === 'pointerup' && !moved && windowHit(e)) HS.openScenes(); };
function windowHit(e) {   // the café's window as it stands on the screen: a click on it opens the postcards, as in v30
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = 1 - (e.clientY - r.top) / r.height * 2;
  const c = [[1.55, 0.95], [3.25, 0.95], [1.55, 3.0], [3.25, 3.0]].map(([a, b]) => V3(a, b, RB - 0.1).project(camera)), xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  return x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys);
}
cv.addEventListener('pointerup', dragEnd); cv.addEventListener('pointercancel', dragEnd);
cv.addEventListener('wheel', (e) => { e.preventDefault(); CAM.dist = clamp(CAM.dist * Math.exp(e.deltaY * 0.0012), 3.0, 13); }, { passive: false });
cv.addEventListener('dblclick', () => Object.assign(CAM, CAM0));   // a double click: the camera back where it stood

// ── the knobs of the look, read each frame from the page; the dolls are made again a moment after a change
let rebuildT = null;
function syncKnobs() {
  const k = HS.knobs();
  if (k.teplo !== K.warm) { K.warm = k.teplo; applyWarm(); }
  K.igra = k.igra; K.vmeste = k.vmeste; K.mir = k.mir; K.har = k.harakter;
  if (k.kukla !== K.kuk || k.glaza !== K.eyes) { K.kuk = k.kukla; K.eyes = k.glaza; clearTimeout(rebuildT); rebuildT = setTimeout(placeCast, 150); }
}

// ── the café's own light as its environment: what the varnish, the mirror and the glass eyes reflect
async function uploadTextures() {   // v34: every texture to the card one at a time, the page breathing between them
  const all = new Set();
  scene.traverse((o) => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => { for (const k in mt) { const v = mt[k]; if (v && v.isTexture && !v.isRenderTargetTexture) all.add(v); } }); });
  for (const tx of all) { renderer.initTexture(tx); await tick(); }
}
function compileFor(rt, cam) {   // v34: the shaders as they will draw into rt, compiled on the card's own threads — the page goes on meanwhile
  renderer.setRenderTarget(rt); const done = renderer.compileAsync(scene, cam); renderer.setRenderTarget(null); return done.then(tick);
}
async function warmDraw(rt, cam) {   // v34: on the first draw of each material into each kind of frame the card prepares a pipeline for it — all at once that was
  const groups = new Map(), lights = [];   // up to 3 s on a loaded machine; here four materials a breath, by all the lamps, into a frame nobody sees
  scene.traverseVisible((o) => { if (o.isLight) lights.push(o); else if (o.material && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) { const g = groups.get(o.material); if (g) g.push(o); else groups.set(o.material, [o]); } });
  const G = [...groups.values()], mask = cam.layers.mask;
  renderer.shadowMap.autoUpdate = false; lights.forEach((l) => l.layers.enable(7)); cam.layers.set(7);
  for (let i = 0; i < G.length; i += 4) {
    const part = G.slice(i, i + 4).flat(); part.forEach((o) => o.layers.enable(7));
    renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);   // their shadows too
    part.forEach((o) => o.layers.disable(7)); await tick();
  }
  lights.forEach((l) => l.layers.disable(7)); cam.layers.mask = mask; renderer.shadowMap.autoUpdate = true;
}
async function warmPasses() {   // v34: and the passes after the picture — light between the dolls, depth, film — one more each breath, still into frames nobody sees
  const P = composer.passes, on = P.map((p) => p.enabled); composer.renderToScreen = false;
  for (let i = 0; i < P.length; i++) { P.forEach((p, j) => (p.enabled = on[j] && j <= i)); composer.render(0); await tick(); }
  P.forEach((p, j) => (p.enabled = on[j])); composer.renderToScreen = true;
}
async function bakeEnvironment() {
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 30, crt);
  cc.position.set(0.2, 1.6, -0.6); scene.add(cc);
  const vis = []; for (const id in cast) { vis.push(cast[id].root); cast[id].root.visible = false; }
  const ph = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 24), new THREE.MeshBasicMaterial({ map: tex(phantomCanvas(), true), side: THREE.BackSide })); ph.position.set(0, 1.7, -0.6); scene.add(ph);
  await tick(); renderer.initTexture(ph.material.map); await tick();
  scene.environment = null; await compileFor(crt, cc.children[0]); await warmDraw(crt, cc.children[0]);   // v34
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; cc.update(renderer, scene); renderer.shadowMap.autoUpdate = true;   // v34: the shadows once for the six faces — the light does not move between them
  vis.forEach((r) => (r.visible = true)); scene.remove(cc); scene.remove(ph);
  const pm = new THREE.PMREMGenerator(renderer); pm.compileCubemapShader(); await tick();
  const env = pm.fromCubemap(crt.texture).texture; crt.dispose(); await tick();
  scene.environment = env; scene.environmentIntensity = 0.9;
}

// ── build, then live
async function build() {
  await buildMaterials(); await tick();
  buildRoom(); await tick();
  PIANO = buildPiano(); PIANO.position.set(-2.45, STAGE, -1.6); PIANO.rotation.y = 0.26; scene.add(PIANO);
  BAND = buildBandoneon(); BASS = buildBass();
  scene.updateMatrixWorld(true);
  placeCast(); await tick(); applyWarm(); buildDust();
  resize(); stepCamera(1);
  await uploadTextures();
  await bakeEnvironment();
  await compileFor(composer.renderTarget1, camera); await warmDraw(composer.renderTarget1, camera); await warmPasses();   // v34: the shaders as the house is drawn — through the passes, not straight to the screen
}
const timer = new THREE.Timer();
let fps = 0, fpsN = 0, fpsT = 0, frames = 0;
function loop(ts) {   // one frame, when the page draws: 30 a second while the house is on
  timer.update(ts); frames++; syncKnobs();
  const dt = Math.min(0.05, timer.getDelta()), t = timer.getElapsed();
  stepCamera(dt);
  for (const id in cast) lifeStep(cast[id], t, dt, false);
  LAMPS.forEach((L) => { const f = 1 + 0.025 * Math.sin(t * 7.3 + L.ph) * Math.sin(t * 2.1 + L.ph * 0.7); L.spot.intensity = L.base * f; L.glow.intensity = L.base * 0.16 * f; });
  stepDust(t, dt); stepWorld(t);
  film.uniforms.time.value = t;
  composer.render(dt); if (warm < 3) warm++;
  fpsN++; fpsT += dt; if (fpsT > 1) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
}
function stepWorld(t) {   // v34: the evening's clock in the room and across the street; the candles by the air at the piano
  const on = !!K.mir, Wd = on ? HS.world(HS.now()) : null;
  WORLD3.clock.g.visible = on;
  if (Wd) { WORLD3.clock.m.rotation.z = -Wd.m / 60 * PI * 2; WORLD3.clock.h.rotation.z = -((Wd.h + Wd.m / 60) / 12) * PI * 2; }
  PIANO.userData.candles.forEach((c, i) => { c.f.visible = on; if (!on) { c.l.intensity = 0; c.m.scale.y = 1; return; }
    const top = 1.08 + 0.12 * Wd.candle, fl = 1 + (0.5 * Math.sin(t * 23 + i * 2) + 0.5 * Math.sin(t * 37 + i)) * 0.18 * Wd.flame;
    c.m.scale.y = Wd.candle; c.f.position.set(c.x + 0.0015 * Math.sin(t * 9 + i) * Wd.flame, top + 0.012, 0.12); c.f.scale.set(1, 2.3 * fl, 1); c.l.position.y = top + 0.02; c.l.intensity = 0.1 * fl; });
  WORLD3.doors.forEach((o, i) => (o.material.opacity = on ? 0.9 * (1 - Wd.doors[i]) : 0)); WORLD3.glows.forEach((o, i) => (o.material.opacity = on ? 0.75 * (1 - Wd.doors[i]) : 0));
  WORLD3.wins.forEach((o, i) => (o.material.opacity = on ? 0.85 * (1 - Wd.wins[i]) : 0));
  WORLD3.tram.visible = !!(Wd && Wd.tram !== null); if (WORLD3.tram.visible) WORLD3.tram.position.x = Wd.tram;
  WORLD3.people.forEach((p, k) => { const q = Wd ? Wd.people.find((x) => x.k === k) : null; p.visible = !!q; if (q) p.position.x = q.x; });
  WORLD3.door.rotation.y = on ? -1.35 * Wd.door : 0;
}
let built = false, building = false, want = false, warm = 0;   // v34: warm — frames drawn; the first ones still compile the passes' and shadows' shaders
window.DOM3D = { ok: false, failed: false, K, CAM, scene, camera, renderer, LAMPS, gtao, bokeh, film, placeCast, applyWarm,
  get cast() { return cast; }, get fps() { return fps; }, get frames() { return frames; },
  show(on) {   // the page asks for the house, or not: the first time it is built (a second or so), meanwhile the flat one stands
    want = !!on;
    if (want && !built && !building) { building = true; setTimeout(() => build().then(() => { built = true; this.ok = true; resize(); }).catch((e) => { this.failed = true; console.error(e); }), 80); }   // v34: after a breath — the page has planned its notes further ahead by then
    this.busy = !this.failed && (building && !built || want && warm < 3);   // v34: while the house is built and its first frames drawn, the page plans notes further ahead
    cv.style.display = want && built ? 'block' : 'none';
  },
  frame() { if (built && want) loop(performance.now()); },
  ears() { if (!built) return null; camera.updateMatrixWorld(); const c = camera.getWorldPosition(V3(0, 0, 0)), e = camera.matrixWorld.elements, at = {};   // v41: where the listener is (the camera, its right hand) and where each one sounds from, for the café's sound
    Object.keys(cast).forEach((id) => { const d = cast[id]; if (d && d.root && d.root.visible && d.headG) { const h = headOf(id); at[id] = [h.x, h.y - 0.4, h.z]; } });
    return { cam: [c.x, c.y, c.z], right: [e[0], e[1], e[2]], at }; },
  resize() { if (built) resize(); },
  view(yaw, pitch, dist, tx, ty, tz) { Object.assign(CAM, { yaw, pitch, dist }); Object.assign(camS, { yaw, pitch, dist }); if (tx !== undefined) CAM.target.set(tx, ty, tz); },   // checks: a camera at once, no easing
  closeup(id, yaw, pitch = 0.05, dist = 1.3) { const h = headOf(id); this.view(yaw, pitch, dist, h.x, h.y, h.z); return [h.x, h.y, h.z].map((v) => +v.toFixed(2)); },
  world() { const Wd = HS.world(HS.now()); return { clock: Wd.h + ':' + String(Math.floor(Wd.m)).padStart(2, '0'), candle: +Wd.candle.toFixed(3), door: +Wd.door.toFixed(2), tram: Wd.tram, doors: Wd.doors.map((x) => +x.toFixed(2)), wins: Wd.wins.map((x) => +x.toFixed(2)), otto: cast.otto.A, bo: cast.bo.A, ottoHere: cast.otto.root.visible, boHere: cast.bo.root.visible, bassHis: BASS.parent === cast.bo.root }; },   // checks only: v34
  route(id) { const d = cast[id]; if (!d || !d.home) return null; const R = d.route || (d.route = routeOf(d)); return { pts: R.getSpacedPoints(120).map((v) => [+v.x.toFixed(3), +v.z.toFixed(3)]), seat: [+d.home.x.toFixed(3), +d.home.z.toFixed(3)], L: +R.getLength().toFixed(3) }; },   // checks only: v34
  together() { const o = {}; for (const id in cast) { const d = cast[id], V = d.V; o[id] = V ? { gaze: V.gaze.kind + (V.gaze.id ? ':' + V.gaze.id : ''), lead: V.lead, leader: V.leader, breath: +V.breath.toFixed(2), rest: +V.rest.toFixed(2), pulse: +V.pulse.toFixed(2), end: V.end.tf !== null, lean: +d.spine.rotation.x.toFixed(3) } : null; } return o; },   // checks only: v33
  play() { const o = cast.otto, b = cast.bo; return { bel: o && o.bel ? { len: +o.bel.len.toFixed(4), dir: o.bel.dir, on: o.bel.on, why: o.bel.why } : null, open: +BAND.userData.ends[1].position.x.toFixed(4), bass: b && b.bassH ? { R: b.bassH.R.phase + ' ' + b.bassH.R.string, L: [+b.bassH.L.string.toFixed(2), +b.bassH.L.d.toFixed(3), b.bassH.L.press] } : null }; },   // checks only: v32
  hands() { const n = cast.nell; return n ? { L: n.hand3.L, R: n.hand3.R, keysSame: Object.keys(HS.keys.x).every((k) => PIANO.userData.keyX[k] === HS.keys.x[k]) } : null; },   // checks only
  info() { const r = renderer.info; return { fps, frames, calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, texs: r.memory.textures }; } };
