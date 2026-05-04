// KV Activations in Transformers — Interactive Diagrams
// 4 sections: autoregressive, unrolled, KV cache, backprop

// ── Per-section token sequences ──
// Each section can have its own sequence. Shorter sequences for simpler demos.
const SEQUENCES = {
  sec1: ['<BOS>', 'LLMs', "don't", 'actually', 'work', 'like', 'this'],
  sec2: ['<BOS>', 'LLMs', 'still', "don't", 'work', 'like', 'this'],
  sec3: ['<BOS>', 'KV', 'activations', 'deserve', 'more', 'attention'],
  sec4: ['<BOS>', 'LLMs', 'are', 'trained', 'to', 'think', 'ahead'],
};

function deriveSeq(seq) {
  const FULL_CHAIN = seq;
  const TOKENS = seq.slice(0, -1);
  const PREDS = seq.slice(1);
  const N = TOKENS.length;
  return { FULL_CHAIN, TOKENS, PREDS, N };
}

const L = 4;

const DARK_PAL = {
  cyan: '#00d4ff', amber: '#ffb020', green: '#40ff90',
  magenta: '#ff3080', red: '#ff4060', white: '#e2e8f0',
  dim: '#4a5568', bg: '#000000', nodeFill: '#050a18',
  gridDot: 'rgba(0,200,255,0.03)', residual: '#ffd060',
};

const LIGHT_PAL = {
  cyan: '#0077aa', amber: '#b87800', green: '#1a8a4a',
  magenta: '#cc2060', red: '#cc3040', white: '#1a2030',
  dim: '#94a3b8', bg: '#f5f5f0', nodeFill: '#fafaf5',
  gridDot: 'rgba(0,100,140,0.06)', residual: '#b89030',
};

const COL = { ...DARK_PAL };
let isLight = false;

function syncTheme() {
  isLight = document.documentElement.dataset.theme === 'light';
  Object.assign(COL, isLight ? LIGHT_PAL : DARK_PAL);
}

// ── Utilities ──

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t) { return 1 - (1 - t) ** 3; }
function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2; }

function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function pop(t, activation, riseMs, fallMs) {
  if (activation < 0) return 0;
  const e = t - activation;
  if (e < 0) return 0;
  const rise = riseMs || 0.1;
  const fall = fallMs || 0.45;
  if (e < rise) return e / rise;
  return Math.max(0, 1 - (e - rise) / fall);
}

// ── Dynamic token sizing ──

function computePillFontSize(ctx, tokens, availPerToken, s) {
  const maxFs = Math.round(22 * s);
  const minFs = Math.round(10 * s);
  ctx.font = `500 ${maxFs}px 'IBM Plex Mono', monospace`;
  let widest = 0;
  for (const tok of tokens)
    widest = Math.max(widest, ctx.measureText(tok).width + maxFs * 0.9);
  if (widest <= availPerToken) return maxFs;
  return Math.max(minFs, Math.round(maxFs * availPerToken / widest));
}

// ── Drawing primitives ──

function drawBg(ctx, W, H) {
  syncTheme();
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  const sp = 28;
  ctx.fillStyle = COL.gridDot;
  for (let x = sp; x < W; x += sp)
    for (let y = sp; y < H; y += sp)
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
}

function glowRect(ctx, x, y, w, h, color, intensity) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = isLight ? 'source-over' : 'lighter';
  const m = isLight ? 3 : 1;
  ctx.fillStyle = rgba(color, intensity * 0.05 * m);
  ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
  ctx.fillStyle = rgba(color, intensity * 0.12 * m);
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = rgba(color, intensity * 0.2 * m);
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.restore();
}

function glowLine(ctx, x1, y1, x2, y2, color, intensity, w) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = isLight ? 'source-over' : 'lighter';
  const m = isLight ? 2.5 : 1;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = rgba(color, intensity * 0.06 * m);
  ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = rgba(color, intensity * 0.14 * m);
  ctx.lineWidth = w + 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(color, intensity * (isLight ? 1.4 : 1));
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// Directional glow: draws from (x1,y1) toward (x2,y2), clipped at `progress` (0..1)
function glowLineDir(ctx, x1, y1, x2, y2, color, intensity, w, progress) {
  if (intensity <= 0 || progress <= 0) return;
  const p = Math.min(progress, 1);
  glowLine(ctx, x1, y1, lerp(x1, x2, p), lerp(y1, y2, p), color, intensity, w);
}

function rRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r); ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
}

function drawLayerNode(ctx, cx, cy, sz, label, a, glow, color) {
  color = color || COL.cyan;
  const x = cx - sz/2, y = cy - sz/2;
  if (glow > 0) glowRect(ctx, x, y, sz, sz, color, a * (0.6 + glow * 0.6));
  ctx.fillStyle = rgba(COL.nodeFill, a * 0.95);
  rRect(ctx, x, y, sz, sz, 3); ctx.fill();
  ctx.strokeStyle = rgba(color, a * (0.5 + glow * 0.5));
  ctx.lineWidth = 1.5 + glow;
  rRect(ctx, x, y, sz, sz, 3); ctx.stroke();
  ctx.fillStyle = rgba(color, a * (0.4 + glow * 0.3));
  ctx.font = `500 ${Math.round(sz * 0.36)}px 'IBM Plex Mono', monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
}

function drawActNode(ctx, cx, cy, sz, color, a, glow) {
  const x = cx - sz/2, y = cy - sz/2;
  if (glow > 0) glowRect(ctx, x, y, sz, sz, color, a * glow * 0.8);
  ctx.fillStyle = rgba(COL.nodeFill, a * 0.9);
  rRect(ctx, x, y, sz, sz, 2); ctx.fill();
  ctx.strokeStyle = rgba(color, a * (0.4 + glow * 0.5));
  ctx.lineWidth = 1 + glow * 0.5;
  rRect(ctx, x, y, sz, sz, 2); ctx.stroke();
}

function drawResidualNode(ctx, cx, cy, w, h, color, a, glow) {
  const x = cx - w/2, y = cy - h/2;
  if (glow > 0) glowRect(ctx, x, y, w, h, color, a * glow * 0.8);
  ctx.fillStyle = rgba(COL.nodeFill, a * 0.9);
  rRect(ctx, x, y, w, h, 2); ctx.fill();
  ctx.strokeStyle = rgba(color, a * (0.4 + glow * 0.5));
  ctx.lineWidth = 1 + glow * 0.5;
  rRect(ctx, x, y, w, h, 2); ctx.stroke();
}

function drawTokenPill(ctx, cx, cy, text, fontSize, a, glow, color) {
  color = color || COL.white;
  ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`;
  const tw = ctx.measureText(text).width + fontSize * 0.9;
  const th = fontSize * 1.6;
  const x = cx - tw/2, y = cy - th/2;
  if (glow > 0) glowRect(ctx, x, y, tw, th, color, a * glow * 0.5);
  ctx.fillStyle = rgba(COL.nodeFill, a * 0.8);
  rRect(ctx, x, y, tw, th, th/2); ctx.fill();
  ctx.strokeStyle = rgba(color, a * (0.3 + glow * 0.4));
  ctx.lineWidth = 1;
  rRect(ctx, x, y, tw, th, th/2); ctx.stroke();
  ctx.fillStyle = rgba(color, a * (0.7 + glow * 0.3));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  return tw;
}

function drawPredBar(ctx, cx, cy, text, a, glow, fontSize) {
  fontSize = fontSize || 12;
  const color = COL.cyan;
  ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`;
  const tw = ctx.measureText(text).width + fontSize * 0.9;
  const th = fontSize * 1.6;
  const x = cx - tw/2, y = cy - th/2;
  if (glow > 0) glowRect(ctx, x, y, tw, th, color, a * glow * 0.4);
  ctx.fillStyle = rgba(COL.nodeFill, a * 0.8);
  rRect(ctx, x, y, tw, th, th/2); ctx.fill();
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = rgba(color, a * (0.3 + glow * 0.4));
  ctx.lineWidth = 1;
  rRect(ctx, x, y, tw, th, th/2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = rgba(color, a * (0.7 + glow * 0.3));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  return tw;
}

// Measures token pill positions for a centered row
function measurePills(ctx, tokens, fontSize, gap) {
  ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`;
  const widths = tokens.map(tok => ctx.measureText(tok).width + fontSize * 0.9);
  const totalW = widths.reduce((s, w) => s + w, 0) + (tokens.length - 1) * gap;
  return { widths, totalW };
}

// ── Section Manager ──

function createSection(sectionEl, drawFn, duration) {
  const canvas = sectionEl.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const playOverlay = sectionEl.querySelector('.btn-play-overlay');
  const resetOverlay = sectionEl.querySelector('.btn-reset-overlay');
  let W = 0, H = 0, t = 0, playing = false, playStartWall = 0, tAtPlay = 0;

  // Tooltip
  const canvasWrap = canvas.parentElement;
  canvasWrap.style.position = 'relative';
  const tooltipEl = document.createElement('div');
  Object.assign(tooltipEl.style, {
    position: 'absolute', pointerEvents: 'none',
    padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
    fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap',
    display: 'none', zIndex: '10',
  });
  canvasWrap.appendChild(tooltipEl);
  let mouseX = -1, mouseY = -1;
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseX = mouseY = -1;
    tooltipEl.style.display = 'none';
    canvas.style.cursor = '';
  });

  function resize() {
    const wrap = canvas.parentElement;
    W = Math.floor(wrap.getBoundingClientRect().width);
    H = Math.round(W * 0.48);
    canvas.width = W; canvas.height = H;
  }

  function frame(now) {
    if (sectionEl.dataset.seek) {
      t = parseFloat(sectionEl.dataset.seek);
      playing = false;
      playOverlay.textContent = 'play';
      delete sectionEl.dataset.seek;
    } else if (playing) {
      t = Math.min(tAtPlay + (now - playStartWall) / 1000, duration);
      if (t >= duration) {
        playing = false;
        playOverlay.textContent = 'play';
      }
    }
    sectionEl.dataset.t = t.toFixed(3);
    ctx._hitTargets = [];
    drawFn(ctx, W, H, t);

    // Hit-test tooltip
    let hoveredLabel = null;
    if (mouseX >= 0 && mouseY >= 0) {
      for (const ht of ctx._hitTargets) {
        if (mouseX >= ht.x && mouseX <= ht.x + ht.w &&
            mouseY >= ht.y && mouseY <= ht.y + ht.h) {
          hoveredLabel = ht.label;
          break;
        }
      }
    }
    if (hoveredLabel) {
      tooltipEl.textContent = hoveredLabel;
      tooltipEl.style.display = 'block';
      tooltipEl.style.background = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
      tooltipEl.style.color = isLight ? '#1a2030' : '#e2e8f0';
      tooltipEl.style.border = isLight ? '1px solid #d0d0d0' : '1px solid #333';
      let tx = mouseX + 12;
      let ty = mouseY - 28;
      if (tx + 180 > W) tx = mouseX - 160;
      if (ty < 0) ty = mouseY + 12;
      tooltipEl.style.left = tx + 'px';
      tooltipEl.style.top = ty + 'px';
      canvas.style.cursor = 'pointer';
    } else {
      tooltipEl.style.display = 'none';
      canvas.style.cursor = '';
    }

    requestAnimationFrame(frame);
  }

  function startPlayback() {
    canvas.classList.remove('pre-play-blur');
    if (t >= duration) t = 0;
    playing = true;
    playStartWall = performance.now();
    tAtPlay = t;
    playOverlay.textContent = 'pause';
    playOverlay.classList.add('playing');
  }

  playOverlay.onclick = () => {
    if (playOverlay.classList.contains('playing')) {
      if (playing) {
        playing = false;
        playOverlay.textContent = 'play';
      } else {
        startPlayback();
      }
    } else {
      startPlayback();
    }
  };
  resetOverlay.onclick = () => {
    t = 0; playing = false;
    playOverlay.textContent = '\u25B6 Play';
    playOverlay.classList.remove('playing');
  };

  resize();
  canvas.classList.add('pre-play-blur');
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
}

// ════════════════════════════════════════════════════════════
//  SECTION 1 — Autoregressive Generation
//  Single model, growing token chain with per-token embeddings
// ════════════════════════════════════════════════════════════

function drawSec1(ctx, W, H, t) {
  const { FULL_CHAIN, TOKENS, PREDS, N } = deriveSeq(SEQUENCES.sec1);
  const density = Math.min(1, 5 / N);
  drawBg(ctx, W, H);
  const s = W / 1100;
  const cx = W / 2;
  const lSz = Math.round(36 * s * density);
  const lY = [0.30, 0.43, 0.56, 0.69].map(f => Math.round(f * H));
  const tokY = Math.round(0.10 * H);
  const embY = Math.round(0.19 * H);
  const predY = Math.round(0.84 * H);
  const embSz = Math.round(8 * s * density);
  const resW = Math.round(28 * s * density);
  const resH = Math.round(7 * s * density);

  const CYCLE = 2.0;
  const cycle = Math.min(Math.floor(t / CYCLE), N);
  const ct = clamp((t - cycle * CYCLE) / CYCLE, 0, 1);

  const chainTokens = cycle <= N - 1
    ? FULL_CHAIN.slice(0, cycle + 1)
    : FULL_CHAIN;

  const availPerToken = (W * 0.85) / chainTokens.length;
  const pillFs = computePillFontSize(ctx, chainTokens, availPerToken, s);
  const predFs = Math.round(pillFs * 0.88);
  const pillGap = 4 * s;
  const { widths: pillWidths, totalW: chainW } = measurePills(ctx, chainTokens, pillFs, pillGap);

  const pillXs = [];
  let drawX = cx - chainW / 2;
  for (let i = 0; i < chainTokens.length; i++) {
    pillXs.push(drawX + pillWidths[i] / 2);
    drawX += pillWidths[i] + pillGap;
  }

  // Vertical model connections
  const fwdStart = 0.20;
  const connA = 0.12;
  glowLine(ctx, cx, embY + embSz, cx, lY[0] - lSz/2, COL.cyan, connA, 1.5);
  for (let l = 0; l < L-1; l++)
    glowLine(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan, connA, 1.5);
  glowLine(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan, connA, 1.5);

  if (cycle < N) {
    const segDur = 0.06;
    const segS0 = fwdStart;
    glowLineDir(ctx, cx, embY + embSz, cx, lY[0] - lSz/2, COL.cyan,
      pop(ct, segS0, 0.03, 0.12) * 0.5, 2.5, clamp((ct - segS0) / segDur, 0, 1));
    for (let l = 0; l < L - 1; l++) {
      const segS = fwdStart + (l + 1) * 0.08;
      glowLineDir(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan,
        pop(ct, segS, 0.03, 0.12) * 0.5, 2.5, clamp((ct - segS) / segDur, 0, 1));
    }
    const segSL = fwdStart + L * 0.08;
    glowLineDir(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan,
      pop(ct, segSL, 0.03, 0.12) * 0.5, 2.5, clamp((ct - segSL) / segDur, 0, 1));
  }

  // Residual nodes between layers
  const resPositions = [
    ...Array.from({length: L-1}, (_, l) => (lY[l] + lSz/2 + lY[l+1] - lSz/2) / 2),
    (lY[L-1] + lSz/2 + predY - 10*s) / 2,
  ];
  for (let r = 0; r < resPositions.length; r++) {
    const rAct = (cycle < N) ? fwdStart + (r + 2) * 0.07 : -1;
    const rGlow = pop(ct, rAct);
    drawResidualNode(ctx, cx, resPositions[r], resW, resH, COL.residual, 0.6 + rGlow * 0.4, rGlow);
    const resLabel = r < L - 1
      ? `Layer ${r+1} Activations`
      : `Layer ${L} Activations`;
    ctx._hitTargets.push({ x: cx - resW/2, y: resPositions[r] - resH/2, w: resW, h: resH, label: resLabel });
  }

  // Draw token pills
  for (let i = 0; i < chainTokens.length; i++) {
    const isNew = (i === cycle && cycle > 0 && cycle <= N);
    if (isNew && ct < 0.12) {
      const slideT = easeOut(ct / 0.12);
      const animCx = lerp(cx, pillXs[i], slideT);
      const animCy = lerp(predY, tokY, slideT);
      drawTokenPill(ctx, animCx, animCy, chainTokens[i], pillFs, 1, pop(ct, 0), COL.cyan);
    } else {
      const pg = (i === 0 && cycle === 0 && t > 0 && ct < 0.08) ? 1 - ct/0.08 : 0;
      drawTokenPill(ctx, pillXs[i], tokY, chainTokens[i], pillFs, 1, pg);
      ctx._hitTargets.push({
        x: pillXs[i] - pillWidths[i]/2, y: tokY - pillFs * 0.8,
        w: pillWidths[i], h: pillFs * 1.6,
        label: `Token Embedding: '${chainTokens[i]}'`
      });
    }
  }

  // Embedding nodes
  if (cycle < N || ct < 0.5) {
    const numEmb = Math.min(chainTokens.length, cycle < N ? cycle + 1 : chainTokens.length);
    for (let i = 0; i < numEmb; i++) {
      const ex = pillXs[i];
      const isNew = (i === cycle && cycle > 0 && ct < 0.12);
      if (isNew) continue;
      glowLine(ctx, ex, tokY + 10*s, ex, embY - embSz/2, COL.cyan, 0.15, 1);
      const embAct = (cycle < N) ? fwdStart + 0.01 : -1;
      const eGlow = pop(ct, embAct);
      drawActNode(ctx, ex, embY, embSz, COL.cyan, 0.5 + eGlow * 0.5, eGlow);
      if (Math.abs(ex - cx) > 3) {
        glowLine(ctx, ex, embY + embSz/2, cx, lY[0] - lSz/2, COL.cyan, 0.10, 1);
      }
    }
  }

  // Layer nodes
  for (let l = 0; l < L; l++) {
    const lAct = (cycle < N) ? fwdStart + (l + 1) * 0.08 + 0.04 : -1;
    drawLayerNode(ctx, cx, lY[l], lSz, 'L'+(l+1), 1, pop(ct, lAct), COL.cyan);
    ctx._hitTargets.push({ x: cx - lSz/2, y: lY[l] - lSz/2, w: lSz, h: lSz, label: `Layer ${l+1} Transformer` });
  }

  // Prediction
  if (cycle < N) {
    const predAct = fwdStart + L * 0.10 + 0.12;
    if (ct > predAct) {
      const pa = clamp((ct - predAct) / 0.04, 0, 1);
      drawPredBar(ctx, cx, predY, PREDS[cycle], pa, pop(ct, predAct), predFs);
      ctx._hitTargets.push({
        x: cx - 40, y: predY - predFs, w: 80, h: predFs * 2,
        label: 'Predicted Next Token Distribution'
      });
    }
  }
}

// ════════════════════════════════════════════════════════════
//  SECTION 2 — Model Cloning → Unrolled View
//  Each forward pass creates a new model copy.
//  Only latest token shown per column, but pulse shows all embeddings.
//  Output copies to next column's input.
// ════════════════════════════════════════════════════════════

function drawSec2(ctx, W, H, t) {
  const { FULL_CHAIN, TOKENS, PREDS, N } = deriveSeq(SEQUENCES.sec2);
  const density = Math.min(1, 5 / N);
  drawBg(ctx, W, H);
  const s = W / 1100;
  const lSz = Math.round(36 * s * density);
  const baseColSp = Math.round(Math.min(170, 850 / Math.max(N - 1, 1)) * s);

  const tokY = Math.round(0.10 * H);
  const embY = Math.round(0.18 * H);
  const lY = [0.28, 0.41, 0.54, 0.67].map(f => Math.round(f * H));
  const predY = Math.round(0.83 * H);
  const resW = Math.round(28 * s * density);
  const resH = Math.round(7 * s * density);
  const embSz = Math.round(8 * s * density);

  const CYCLE = 2.0;
  const cycle = Math.min(Math.floor(t / CYCLE), N);
  const drawCycle = Math.min(cycle, N - 1);
  const ct = cycle < N ? clamp((t - cycle * CYCLE) / CYCLE, 0, 1) : 1;
  const inEpilogue = cycle >= N;
  const ect = inEpilogue ? clamp((t - N * CYCLE) / CYCLE, 0, 1) : 0;

  // Dynamic centering: positions based on visible columns, with smooth transitions
  const targetCols = inEpilogue ? N + 1 : drawCycle + 1;
  const maxW = 0.85 * W;
  let curColSp = baseColSp;
  if (targetCols > 1 && (targetCols - 1) * curColSp > maxW)
    curColSp = Math.round(maxW / (targetCols - 1));
  const curTotalW = Math.max(0, (targetCols - 1) * curColSp);
  const curLeftPad = (W - curTotalW) / 2;

  const prevTargetCols = inEpilogue ? N : Math.max(1, drawCycle);
  let prevColSp = baseColSp;
  if (prevTargetCols > 1 && (prevTargetCols - 1) * prevColSp > maxW)
    prevColSp = Math.round(maxW / (prevTargetCols - 1));
  const prevTotalW = Math.max(0, (prevTargetCols - 1) * prevColSp);
  const prevLeftPad = (W - prevTotalW) / 2;

  const lerpT = inEpilogue ? ect : ct;
  const isShifting = (inEpilogue || (cycle < N && targetCols > 1)) && lerpT < 0.15;
  const shiftT = isShifting ? easeOut(lerpT / 0.15) : 1;
  const colCount = inEpilogue ? N + 1 : N;
  const colX = Array.from({length: colCount}, (_, i) => lerp(prevLeftPad + i * prevColSp, curLeftPad + i * curColSp, shiftT));
  const colSp = curColSp;

  const availPerToken = curColSp * 0.80;
  const fs = computePillFontSize(ctx, TOKENS, availPerToken, s);
  const predFs = Math.round(fs * 0.88);

  for (let pos = 0; pos <= drawCycle; pos++) {
    const cx = colX[pos];
    const isCur = pos === drawCycle && cycle < N;
    const matAlpha = isCur ? clamp(ct / 0.08, 0, 1) : 1;
    const fwdS = 0.12;

    // Vertical connections
    glowLine(ctx, cx, embY + embSz, cx, lY[0] - lSz/2, COL.cyan, matAlpha * 0.12, 1.5);
    for (let l = 0; l < L-1; l++)
      glowLine(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan, matAlpha * 0.12, 1.5);
    glowLine(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan, matAlpha * 0.12, 1.5);

    if (isCur) {
      const segDur = 0.05;
      glowLineDir(ctx, cx, embY + embSz, cx, lY[0] - lSz/2, COL.cyan,
        pop(ct, fwdS, 0.03, 0.10) * 0.5, 2.5, clamp((ct - fwdS) / segDur, 0, 1));
      for (let l = 0; l < L - 1; l++) {
        const segS = fwdS + (l + 1) * 0.07;
        glowLineDir(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan,
          pop(ct, segS, 0.03, 0.10) * 0.5, 2.5, clamp((ct - segS) / segDur, 0, 1));
      }
      const segSL = fwdS + L * 0.07;
      glowLineDir(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan,
        pop(ct, segSL, 0.03, 0.10) * 0.5, 2.5, clamp((ct - segSL) / segDur, 0, 1));
    }

    // Residual nodes between layers
    const resPs = [
      ...Array.from({length: L-1}, (_, l) => (lY[l] + lSz/2 + lY[l+1] - lSz/2) / 2),
      (lY[L-1] + lSz/2 + predY - 10*s) / 2,
    ];
    for (let r = 0; r < resPs.length; r++) {
      const rAct = isCur ? fwdS + (r + 1) * 0.06 : -1;
      const rG = isCur ? pop(ct, rAct) : 0;
      drawResidualNode(ctx, cx, resPs[r], resW, resH, COL.residual, matAlpha * (0.5 + rG * 0.5), rG);
      const resLabel = r < L - 1 ? `Layer ${r+1} Activations` : `Layer ${L} Activations`;
      ctx._hitTargets.push({ x: cx - resW/2, y: resPs[r] - resH/2, w: resW, h: resH, label: resLabel });
    }

    // Main token pill
    if (isCur && pos > 0 && ct < 0.10) {
      const slideT = easeOut(ct / 0.10);
      const fromX = colX[pos - 1];
      const animCx = lerp(fromX, cx, slideT);
      const animCy = lerp(predY, tokY, slideT);
      drawTokenPill(ctx, animCx, animCy, TOKENS[pos], fs, 1, pop(ct, 0), COL.cyan);
    } else {
      const allGlow = cycle < N ? pop(ct, 0.01, 0.05, 0.20) : 0;
      const tokGlow = isCur ? pop(ct, 0.02) : allGlow;
      drawTokenPill(ctx, cx, tokY, TOKENS[pos], fs, matAlpha, tokGlow);
      ctx._hitTargets.push({
        x: cx - 30, y: tokY - fs * 0.8, w: 60, h: fs * 1.6,
        label: `Token Embedding: '${TOKENS[pos]}'`
      });
    }

    // Embedding nodes
    const numEmb = pos + 1;
    const embSpread = Math.round(12 * s);
    const embTotalW = (numEmb - 1) * embSpread;
    const embStartX = cx - embTotalW / 2;
    for (let ei = 0; ei < numEmb; ei++) {
      const ex = embStartX + ei * embSpread;
      const embAct = isCur ? fwdS : -1;
      const eGlow = isCur ? pop(ct, embAct, 0.06, 0.3) : 0;
      const eAlpha = isCur ? matAlpha * (0.3 + eGlow * 0.7) : 0.2;
      drawActNode(ctx, ex, embY, embSz, COL.cyan, eAlpha, eGlow);
      if (Math.abs(ex - cx) > 2)
        glowLine(ctx, ex, embY + embSz/2, cx, lY[0] - lSz/2, COL.cyan, eAlpha * 0.4, 0.8);
    }
    glowLine(ctx, cx, embY + embSz/2, cx, lY[0] - lSz/2, COL.cyan, matAlpha * 0.15, 1);

    // Layer nodes
    for (let l = 0; l < L; l++) {
      const lAct = isCur ? fwdS + (l+1) * 0.07 + 0.02 : -1;
      drawLayerNode(ctx, cx, lY[l], lSz, 'L'+(l+1), matAlpha, isCur ? pop(ct, lAct) : 0, COL.cyan);
      ctx._hitTargets.push({ x: cx - lSz/2, y: lY[l] - lSz/2, w: lSz, h: lSz, label: `Layer ${l+1} Transformer` });
    }

    // Prediction
    const predAct = fwdS + L * 0.09 + 0.08;
    const showPred = isCur ? ct > predAct : true;
    if (showPred) {
      const pa = isCur ? clamp((ct - predAct) / 0.04, 0, 1) : 1;
      drawPredBar(ctx, cx, predY, PREDS[pos], pa * matAlpha, isCur ? pop(ct, predAct) : 0, predFs);
      ctx._hitTargets.push({
        x: cx - 40, y: predY - predFs, w: 80, h: predFs * 2,
        label: 'Predicted Next Token Distribution'
      });
    }
  }

  // Epilogue: final predicted token flies up to the dynamically centered N+1 position
  if (inEpilogue) {
    const lastCx = colX[N - 1];
    const newCx = colX[N];
    if (ect < 0.15) {
      const slideT = easeOut(ect / 0.15);
      drawTokenPill(ctx, lerp(lastCx, newCx, slideT), lerp(predY, tokY, slideT),
        PREDS[N - 1], fs, 1, pop(ect, 0), COL.cyan);
    } else {
      drawTokenPill(ctx, newCx, tokY, PREDS[N - 1], fs, 1, pop(ect, 0.15, 0.05, 0.3));
    }
  }
}

// ════════════════════════════════════════════════════════════
//  SECTION 3 — KV Cache
//  Only latest token enters; KV from previous positions
//  feeds into each layer. KV glows BEFORE the layer it feeds.
//  Order: residual → KV read → layer → KV output
// ════════════════════════════════════════════════════════════

function drawSec3(ctx, W, H, t) {
  const { FULL_CHAIN, TOKENS, PREDS, N } = deriveSeq(SEQUENCES.sec3);
  const density = Math.min(1, 5 / N);
  drawBg(ctx, W, H);
  const s = W / 1100;
  const lSz = Math.round(36 * s * density);
  const kvSz = Math.round(22 * s * density);
  const resW = Math.round(28 * s * density);
  const resH = Math.round(7 * s * density);
  const kvOff = Math.round(48 * s);
  const baseColSp = Math.round(Math.min(175, 900 / Math.max(N - 1, 1)) * s);

  const tokY = Math.round(0.10 * H);
  const lY = [0.28, 0.41, 0.54, 0.67].map(f => Math.round(f * H));
  const predY = Math.round(0.83 * H);

  const CYCLE = 2.4;
  const cycle = Math.min(Math.floor(t / CYCLE), N);
  const drawCycle = Math.min(cycle, N - 1);
  const ct = cycle < N ? clamp((t - cycle * CYCLE) / CYCLE, 0, 1) : 1;
  const inEpilogue = cycle >= N;
  const ect = inEpilogue ? clamp((t - N * CYCLE) / CYCLE, 0, 1) : 0;

  // Dynamic centering: smoothly recenter as each new column appears.
  // During the epilogue, reserve an extra column position to the right so
  // the final-prediction fly-up doesn't clip the canvas edge.
  const maxW = 0.85 * W;
  const targetCols = inEpilogue ? N + 1 : drawCycle + 1;
  let curColSp = baseColSp;
  if (targetCols > 1 && (targetCols - 1) * curColSp > maxW)
    curColSp = Math.round(maxW / (targetCols - 1));
  const curTotalW = Math.max(0, (targetCols - 1) * curColSp);
  const curLeftPad = (W - curTotalW) / 2;

  const prevTargetCols = inEpilogue ? N : Math.max(1, drawCycle);
  let prevColSp = baseColSp;
  if (prevTargetCols > 1 && (prevTargetCols - 1) * prevColSp > maxW)
    prevColSp = Math.round(maxW / (prevTargetCols - 1));
  const prevTotalW = Math.max(0, (prevTargetCols - 1) * prevColSp);
  const prevLeftPad = (W - prevTotalW) / 2;

  const lerpT = inEpilogue ? ect : ct;
  const isShifting = (inEpilogue || (cycle < N && targetCols > 1)) && lerpT < 0.15;
  const shiftT = isShifting ? easeOut(lerpT / 0.15) : 1;
  const colCount = inEpilogue ? N + 1 : N;
  const colX = Array.from({length: colCount}, (_, i) => lerp(prevLeftPad + i * prevColSp, curLeftPad + i * curColSp, shiftT));
  const colSp = curColSp;

  const availPerToken = curColSp * 0.80;
  const fs = computePillFontSize(ctx, TOKENS, availPerToken, s);
  const predFs = Math.round(fs * 0.88);

  // KV bus lines
  const busOff = Math.round(18 * s);
  const busVisible = drawCycle > 0 || ct > 0.2;
  if (busVisible) {
    const busAlpha = cycle === 0 ? clamp((ct - 0.2) / 0.15, 0, 0.08) : 0.08;
    for (let l = 0; l < L; l++) {
      const busY = lY[l] + busOff;
      const x1 = colX[0] - 15 * s;
      const lastVisPos = Math.min(drawCycle, N - 1);
      const x2 = colX[lastVisPos] + kvOff + kvSz/2 + 10 * s;
      glowLine(ctx, x1, busY, x2, busY, COL.amber, busAlpha, 1);
    }
  }

  const fwdS = 0.10;
  const stepTime = 0.10;

  for (let pos = 0; pos <= drawCycle; pos++) {
    const cx = colX[pos];
    const isCur = pos === drawCycle && cycle < N;
    const matA = isCur ? clamp(ct / 0.08, 0, 1) : 1;

    // Vertical connections
    glowLine(ctx, cx, tokY + 10*s, cx, lY[0] - lSz/2, COL.cyan, matA * 0.12, 1.5);
    for (let l = 0; l < L-1; l++)
      glowLine(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan, matA * 0.12, 1.5);
    glowLine(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan, matA * 0.12, 1.5);

    if (isCur) {
      const segDur = 0.05;
      glowLineDir(ctx, cx, tokY + 10*s, cx, lY[0] - lSz/2, COL.cyan,
        pop(ct, fwdS, 0.03, 0.10) * 0.5, 2.5, clamp((ct - fwdS) / segDur, 0, 1));
      for (let l = 0; l < L - 1; l++) {
        const segS = fwdS + (l + 1) * stepTime;
        glowLineDir(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan,
          pop(ct, segS, 0.03, 0.10) * 0.5, 2.5, clamp((ct - segS) / segDur, 0, 1));
      }
      const segSL = fwdS + L * stepTime;
      glowLineDir(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan,
        pop(ct, segSL, 0.03, 0.10) * 0.5, 2.5, clamp((ct - segSL) / segDur, 0, 1));
    }

    // Residual nodes between layers
    const resPs = [
      (tokY + 10*s + lY[0] - lSz/2) / 2,
      ...Array.from({length: L-1}, (_, l) => (lY[l] + lSz/2 + lY[l+1] - lSz/2) / 2),
      (lY[L-1] + lSz/2 + predY - 10*s) / 2,
    ];
    for (let r = 0; r < resPs.length; r++) {
      const rAct = isCur ? fwdS + r * stepTime - 0.01 : -1;
      const rG = isCur ? pop(ct, rAct) : 0;
      drawResidualNode(ctx, cx, resPs[r], resW, resH, COL.residual, matA * (0.5 + rG * 0.5), rG);
      let resLabel;
      if (r === 0) resLabel = 'Embedding Activations';
      else if (r <= L - 1) resLabel = `Layer ${r} Activations`;
      else resLabel = `Layer ${L} Activations`;
      ctx._hitTargets.push({ x: cx - resW/2, y: resPs[r] - resH/2, w: resW, h: resH, label: resLabel });
    }

    // Latest token
    if (isCur && pos > 0 && ct < 0.10) {
      const slideT = easeOut(ct / 0.10);
      const fromX = colX[pos - 1];
      const animCx = lerp(fromX, cx, slideT);
      const animCy = lerp(predY, tokY, slideT);
      drawTokenPill(ctx, animCx, animCy, TOKENS[pos], fs, 1, pop(ct, 0), COL.cyan);
    } else {
      const tokGlow = isCur ? pop(ct, 0.02) : 0;
      drawTokenPill(ctx, cx, tokY, TOKENS[pos], fs, matA, tokGlow);
      ctx._hitTargets.push({
        x: cx - 30, y: tokY - fs * 0.8, w: 60, h: fs * 1.6,
        label: `Token Embedding: '${TOKENS[pos]}'`
      });
    }

    // KV supply rails from previous positions
    if (pos > 0) {
      for (let l = 0; l < L; l++) {
        const busY = lY[l] + busOff;
        const kvReadT = fwdS + l * stepTime;
        for (let src = 0; src < pos; src++) {
          const srcKvX = colX[src] + kvOff;
          const railGlow = isCur ? pop(ct, kvReadT, 0.06, 0.2) : 0;

          if (isCur && railGlow > 0) {
            const kx = srcKvX - kvSz/2, ky = lY[l] - kvSz/2;
            glowRect(ctx, kx, ky, kvSz, kvSz, COL.green, railGlow * 0.7);
          }

          const railProgress = isCur ? clamp((ct - kvReadT) / 0.10, 0, 1) : 1;
          const railA = isCur ? clamp((ct - kvReadT) / 0.08, 0, 1) * 0.3 : 0.15;
          glowLineDir(ctx, srcKvX, busY, cx, busY, COL.green,
            matA * (railA + railGlow * 0.15), 1.2, railProgress);
        }
        const tickProgress = isCur ? clamp((ct - kvReadT - 0.06) / 0.04, 0, 1) : 1;
        const tickA = isCur ? clamp((ct - kvReadT) / 0.08, 0, 1) * 0.30 : 0.15;
        const notchX = cx - lSz/2 - 8*s;
        const notchEndY = lY[l] + lSz/2 - 4;
        glowLineDir(ctx, notchX, busY, notchX, notchEndY, COL.green, matA * tickA, 1.2, tickProgress);
        glowLineDir(ctx, notchX, notchEndY, cx - lSz/2, notchEndY, COL.green, matA * tickA, 1.2, tickProgress);
      }
    }

    // Layer nodes
    for (let l = 0; l < L; l++) {
      const lAct = isCur ? fwdS + l * stepTime + 0.04 : -1;
      drawLayerNode(ctx, cx, lY[l], lSz, 'L'+(l+1), matA, isCur ? pop(ct, lAct) : 0, COL.cyan);
      ctx._hitTargets.push({ x: cx - lSz/2, y: lY[l] - lSz/2, w: lSz, h: lSz, label: `Layer ${l+1} Transformer` });
    }

    // KV output nodes
    for (let l = 0; l < L; l++) {
      const kvAct = isCur ? fwdS + l * stepTime + 0.07 : -1;
      const kvG = isCur ? pop(ct, kvAct) : 0;
      const kvCx = cx + kvOff;
      const busY = lY[l] + busOff;

      const kvWriteP = isCur ? clamp((ct - (fwdS + l * stepTime + 0.05)) / 0.04, 0, 1) : 1;
      glowLineDir(ctx, cx + lSz/2 + 1, lY[l], kvCx - kvSz/2 - 1, lY[l],
        COL.amber, matA * (0.2 + kvG * 0.15), 1, kvWriteP);
      const kvBusP = isCur ? clamp((ct - (fwdS + l * stepTime + 0.08)) / 0.03, 0, 1) : 1;
      glowLineDir(ctx, kvCx, lY[l] + kvSz/2, kvCx, busY,
        COL.amber, matA * (0.15 + kvG * 0.1), 1, kvBusP);
      drawActNode(ctx, kvCx, lY[l], kvSz, COL.amber, matA, kvG);
      ctx.fillStyle = rgba(COL.amber, matA * (0.35 + kvG * 0.3));
      ctx.font = `600 ${Math.round(kvSz * 0.5)}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('KV', kvCx, lY[l] + 0.5);
      ctx._hitTargets.push({ x: kvCx - kvSz/2, y: lY[l] - kvSz/2, w: kvSz, h: kvSz, label: `Layer ${l+1} KV Activations` });
    }

    // Prediction
    const predAct = fwdS + (L - 1) * stepTime + 0.12;
    const showPred = isCur ? ct > predAct : true;
    if (showPred) {
      const pa = isCur ? clamp((ct - predAct) / 0.04, 0, 1) : 1;
      drawPredBar(ctx, cx, predY, PREDS[pos], pa * matA, isCur ? pop(ct, predAct) : 0, predFs);
      ctx._hitTargets.push({
        x: cx - 40, y: predY - predFs, w: 80, h: predFs * 2,
        label: 'Predicted Next Token Distribution'
      });
    }
  }

  // Epilogue: final predicted token flies up to the dynamically centered N+1 position
  if (inEpilogue) {
    const lastCx = colX[N - 1];
    const newCx = colX[N];
    if (ect < 0.15) {
      const slideT = easeOut(ect / 0.15);
      drawTokenPill(ctx, lerp(lastCx, newCx, slideT), lerp(predY, tokY, slideT),
        PREDS[N - 1], fs, 1, pop(ect, 0), COL.cyan);
    } else {
      drawTokenPill(ctx, newCx, tokY, PREDS[N - 1], fs, 1, pop(ect, 0.15, 0.05, 0.3));
    }
  }
}

// ════════════════════════════════════════════════════════════
//  SECTION 4 — Backpropagation
//  Gradient flows from loss backward through layers and KV.
//  Diagonal wavefront from bottom-right to top-left.
//  Prominent loss indicator with visible tokens/predictions.
// ════════════════════════════════════════════════════════════

function drawSec4(ctx, W, H, t) {
  const { FULL_CHAIN, TOKENS, PREDS, N } = deriveSeq(SEQUENCES.sec4);
  const density = Math.min(1, 5 / N);
  drawBg(ctx, W, H);
  const s = W / 1100;
  const lSz = Math.round(36 * s * density);
  const kvSz = Math.round(22 * s * density);
  const resW = Math.round(28 * s * density);
  const resH = Math.round(7 * s * density);
  const kvOff = Math.round(48 * s);
  const maxW = 0.85 * W;
  let colSp = Math.round(Math.min(175, 900 / Math.max(N - 1, 1)) * s);
  // Reserve N+1 slots so the trailing prediction (shown at the top as the next
  // input token) fits without clipping the right edge.
  if (N > 0 && N * colSp > maxW)
    colSp = Math.round(maxW / N);
  const totalW = N * colSp;
  const leftPad = (W - totalW) / 2;
  const colX = Array.from({length: N + 1}, (_, i) => leftPad + i * colSp);

  const tokY = Math.round(0.10 * H);
  const lY = [0.28, 0.41, 0.54, 0.67].map(f => Math.round(f * H));
  const predY = Math.round(0.83 * H);
  const busOff = Math.round(18 * s);

  const availPerToken = colSp * 0.80;
  const tokFs = computePillFontSize(ctx, TOKENS, availPerToken, s);
  const predFs = Math.round(tokFs * 0.88);

  // ── Zoom parameters ──
  const zoomOutStart = 3.5;
  const zoomOutEnd = 5.0;
  let zoom = 1.0;
  let zoomP = 1.0;
  if (t < zoomOutStart) {
    zoom = 1.6;
    zoomP = 0;
  } else if (t < zoomOutEnd) {
    zoomP = easeInOut((t - zoomOutStart) / (zoomOutEnd - zoomOutStart));
    zoom = lerp(1.6, 1.0, zoomP);
  }

  const focalX = lerp(colX[N-1], W/2, zoomP);
  const focalY = lerp(predY - 20, H/2, zoomP);

  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(zoom, zoom);
  ctx.translate(-focalX, -focalY);

  // ── Static base: full KV-cached unrolled view (dimmed) ──
  for (let l = 0; l < L; l++) {
    const busY = lY[l] + busOff;
    const x1 = colX[0] - 15 * s;
    const x2 = colX[N-1] + kvOff + kvSz/2 + 10 * s;
    glowLine(ctx, x1, busY, x2, busY, COL.amber, 0.06, 1);
  }

  for (let pos = 0; pos < N; pos++) {
    const cx = colX[pos];

    glowLine(ctx, cx, tokY + 10*s, cx, lY[0] - lSz/2, COL.cyan, 0.07, 1);
    for (let l = 0; l < L-1; l++)
      glowLine(ctx, cx, lY[l] + lSz/2, cx, lY[l+1] - lSz/2, COL.cyan, 0.07, 1);
    glowLine(ctx, cx, lY[L-1] + lSz/2, cx, predY - 10*s, COL.cyan, 0.07, 1);

    const resPs = [
      (tokY + 10*s + lY[0] - lSz/2) / 2,
      ...Array.from({length: L-1}, (_, l) => (lY[l] + lSz/2 + lY[l+1] - lSz/2) / 2),
      (lY[L-1] + lSz/2 + predY - 10*s) / 2,
    ];
    for (let r = 0; r < resPs.length; r++) {
      drawResidualNode(ctx, cx, resPs[r], resW, resH, COL.residual, 0.25, 0);
      let resLabel;
      if (r === 0) resLabel = 'Embedding Activations';
      else if (r <= L - 1) resLabel = `Layer ${r} Activations`;
      else resLabel = `Layer ${L} Activations`;
      ctx._hitTargets.push({ x: cx - resW/2, y: resPs[r] - resH/2, w: resW, h: resH, label: resLabel });
    }

    drawTokenPill(ctx, cx, tokY, TOKENS[pos], tokFs, 0.65, 0);
    ctx._hitTargets.push({
      x: cx - 30, y: tokY - tokFs * 0.8, w: 60, h: tokFs * 1.6,
      label: `Token Embedding: '${TOKENS[pos]}'`
    });

    for (let l = 0; l < L; l++) {
      drawLayerNode(ctx, cx, lY[l], lSz, 'L'+(l+1), 0.3, 0, COL.cyan);
      ctx._hitTargets.push({ x: cx - lSz/2, y: lY[l] - lSz/2, w: lSz, h: lSz, label: `Layer ${l+1} Transformer` });
    }

    for (let l = 0; l < L; l++) {
      const kvCx = cx + kvOff;
      const busY = lY[l] + busOff;
      glowLine(ctx, cx + lSz/2 + 1, lY[l], kvCx - kvSz/2 - 1, lY[l], COL.amber, 0.08, 1);
      glowLine(ctx, kvCx, lY[l] + kvSz/2, kvCx, busY, COL.amber, 0.06, 1);
      drawActNode(ctx, kvCx, lY[l], kvSz, COL.amber, 0.3, 0);
      ctx._hitTargets.push({ x: kvCx - kvSz/2, y: lY[l] - kvSz/2, w: kvSz, h: kvSz, label: `Layer ${l+1} KV Activations` });
    }

    if (pos > 0) {
      for (let l = 0; l < L; l++) {
        const busY = lY[l] + busOff;
        for (let src = 0; src < pos; src++)
          glowLine(ctx, colX[src] + kvOff, busY, cx, busY, COL.green, 0.04, 1);
        const notchX = cx - lSz/2 - 8*s;
        const notchEndY = lY[l] + lSz/2 - 4;
        glowLine(ctx, notchX, busY, notchX, notchEndY, COL.green, 0.05, 1.2);
        glowLine(ctx, notchX, notchEndY, cx - lSz/2, notchEndY, COL.green, 0.05, 1.2);
      }
    }

    drawPredBar(ctx, cx, predY, PREDS[pos], 0.55, 0, predFs);
    ctx._hitTargets.push({
      x: cx - 40, y: predY - predFs, w: 80, h: predFs * 2,
      label: 'Predicted Next Token Distribution'
    });
  }

  // Trailing input token: the final prediction shown at the top of column N
  // (the would-be next input). Top row only — no layers, no prediction below.
  drawTokenPill(ctx, colX[N], tokY, PREDS[N - 1], tokFs, 0.55, 0);
  ctx._hitTargets.push({
    x: colX[N] - 30, y: tokY - tokFs * 0.8, w: 60, h: tokFs * 1.6,
    label: `Next-token prediction shown as input: '${PREDS[N - 1]}'`
  });

  // ── Phase 1: Zoomed-in loss introduction ──
  const lcx = colX[N-1];

  if (t < zoomOutEnd) {
    // Forward pass pulse through last column (t=0.5..1.5)
    if (t > 0.5) {
      const fwdProgress = clamp((t - 0.5) / 1.0, 0, 1);
      const segCount = L + 1;
      for (let seg = 0; seg <= L; seg++) {
        const segStart = seg / segCount;
        const segEnd = (seg + 1) / segCount;
        const segP = clamp((fwdProgress - segStart) / (segEnd - segStart), 0, 1);
        const segGlow = pop(fwdProgress, segStart, 0.05, 0.15);

        if (seg === 0) {
          glowLineDir(ctx, lcx, tokY + 10*s, lcx, lY[0] - lSz/2, COL.cyan,
            segGlow * 0.6, 2.5, segP);
        } else if (seg < L) {
          glowLineDir(ctx, lcx, lY[seg-1] + lSz/2, lcx, lY[seg] - lSz/2, COL.cyan,
            segGlow * 0.6, 2.5, segP);
        } else {
          glowLineDir(ctx, lcx, lY[L-1] + lSz/2, lcx, predY - 10*s, COL.cyan,
            segGlow * 0.6, 2.5, segP);
        }

        if (seg < L) {
          const layerGlow = pop(fwdProgress, segStart + 0.03, 0.06, 0.2);
          drawLayerNode(ctx, lcx, lY[seg], lSz, 'L'+(seg+1), 0.5 + layerGlow * 0.5, layerGlow, COL.cyan);
        }
      }

      // Prediction materializes at end of forward pass
      if (fwdProgress > 0.85) {
        const predA = clamp((fwdProgress - 0.85) / 0.15, 0, 1);
        drawPredBar(ctx, lcx, predY, PREDS[N-1], predA, pop(fwdProgress, 0.85, 0.08, 0.3), predFs);
      }
    }

    // Loss computation (t=1.5..2.3)
    if (t > 1.5) {
      const la = clamp((t - 1.5) / 0.3, 0, 1);
      const lossGlow = pop(t, 1.5, 0.2, 0.6);

      ctx.save();
      ctx.globalCompositeOperation = isLight ? 'source-over' : 'lighter';
      const lm = isLight ? 3 : 1;
      ctx.fillStyle = rgba(COL.red, la * (0.04 + lossGlow * 0.08) * lm);
      ctx.fillRect(lcx - 40*s, predY - 22, 80*s, 36);
      ctx.restore();

      ctx.fillStyle = rgba(COL.white, la * 0.8);
      ctx.font = `500 ${Math.round(10*s)}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('actual:', lcx - 28*s, predY - 14);

      ctx.fillStyle = rgba(COL.green, la * 0.9);
      ctx.textAlign = 'left';
      ctx.fillText('"' + FULL_CHAIN[FULL_CHAIN.length - 1] + '"', lcx - 24*s, predY - 14);

      // "loss" label (transitions to "gradient" at t=2.3)
      const gradTransition = t > 2.3 ? clamp((t - 2.3) / 0.3, 0, 1) : 0;
      const lossLabelA = la * (1 - gradTransition);
      const gradLabelA = la * gradTransition;

      if (lossLabelA > 0) {
        ctx.fillStyle = rgba(COL.red, lossLabelA * (0.7 + lossGlow * 0.3));
        ctx.font = `600 ${Math.round(11*s)}px 'IBM Plex Mono', monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('\u2190 loss', lcx + 30*s, predY - 4);
      }
      if (gradLabelA > 0) {
        ctx.fillStyle = rgba(COL.magenta, gradLabelA * 0.9);
        ctx.font = `600 ${Math.round(11*s)}px 'IBM Plex Mono', monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('\u2190 gradient', lcx + 30*s, predY - 4);
      }
    }

    // Gradient signal born (t=2.3..3.5)
    if (t > 2.3) {
      const gradBirthP = clamp((t - 2.3) / 1.2, 0, 1);
      const gradA = easeOut(gradBirthP);

      // Magenta arrow pulses upward from prediction through layers
      const arrowEnd = lerp(predY - 10*s, lY[0] - lSz/2, gradBirthP);
      glowLine(ctx, lcx, predY - 10*s, lcx, arrowEnd, COL.magenta, gradA * 0.5, 2.5);

      // Light up layers the arrow has reached
      for (let l = L - 1; l >= 0; l--) {
        const layerReachP = clamp((arrowEnd - (lY[l] + lSz/2)) / (lSz * -0.5), 0, 1);
        if (layerReachP > 0) {
          const layerGlow = pop(gradBirthP, (L - 1 - l) / L * 0.8, 0.1, 0.4);
          drawLayerNode(ctx, lcx, lY[l], lSz, 'L'+(l+1), 0.5 + layerGlow * 0.5, layerGlow, COL.magenta);
        }
      }
    }
  }

  // ── Phase 3: Backprop wavefront (t >= 5.0) ──
  const gradStart = 5.0;
  const waveSpeed = 0.55;

  // Keep loss indicator and gradient arrow visible after zoom out
  if (t >= zoomOutEnd) {
    const la = 1;
    const lossGlow = 0;

    ctx.save();
    ctx.globalCompositeOperation = isLight ? 'source-over' : 'lighter';
    const lm = isLight ? 3 : 1;
    ctx.fillStyle = rgba(COL.red, la * 0.04 * lm);
    ctx.fillRect(lcx - 40*s, predY - 22, 80*s, 36);
    ctx.restore();

    ctx.fillStyle = rgba(COL.white, la * 0.8);
    ctx.font = `500 ${Math.round(10*s)}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('actual:', lcx - 28*s, predY - 14);

    ctx.fillStyle = rgba(COL.green, la * 0.9);
    ctx.textAlign = 'left';
    ctx.fillText('"' + FULL_CHAIN[FULL_CHAIN.length - 1] + '"', lcx - 24*s, predY - 14);

    ctx.fillStyle = rgba(COL.magenta, 0.9);
    ctx.font = `600 ${Math.round(11*s)}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('\u2190 gradient', lcx + 30*s, predY - 4);

    glowLine(ctx, lcx, predY - 10*s, lcx, lY[0] - lSz/2, COL.magenta, 0.5, 2.5);
  }

  for (let pos = N - 1; pos >= 0; pos--) {
    const cx = colX[pos];
    const posFromRight = N - 1 - pos;

    for (let l = L - 1; l >= 0; l--) {
      const layerFromBottom = L - 1 - l;
      const diag = posFromRight + layerFromBottom;
      const activationT = gradStart + diag * waveSpeed;
      const glow = pop(t, activationT, 0.12, 0.6);

      if (t < activationT) continue;

      const ga = clamp((t - activationT) / 0.15, 0, 1);
      const steadyGlow = ga * 0.5;
      const totalGlow = Math.max(glow, steadyGlow);
      drawLayerNode(ctx, cx, lY[l], lSz, 'L'+(l+1), 0.5 + ga * 0.5, totalGlow, COL.magenta);

      if (l > 0) {
        const upA = ga * 0.35;
        const upProgress = clamp((t - activationT) / 0.25, 0, 1);
        glowLineDir(ctx, cx, lY[l] - lSz/2, cx, lY[l-1] + lSz/2, COL.magenta, upA, 2, upProgress);
      } else {
        const upA = ga * 0.35;
        const upProgress = clamp((t - activationT) / 0.25, 0, 1);
        glowLineDir(ctx, cx, lY[0] - lSz/2, cx, tokY + 10*s, COL.magenta, upA, 2, upProgress);
      }

      if (pos > 0) {
        const kvCx = cx + kvOff;
        const busY = lY[l] + busOff;
        const busA = ga * 0.15;
        const elapsed = t - activationT;
        for (let src = pos - 1; src >= 0; src--) {
          const dist = pos - src;
          const travelProgress = clamp(elapsed / (0.4 * dist), 0, 1);
          if (travelProgress <= 0) continue;
          const srcKvX = colX[src] + kvOff;
          const endX = lerp(cx, srcKvX, travelProgress);
          glowLine(ctx, cx, busY, endX, busY, COL.magenta, busA, 1.5);
        }
        glowLine(ctx, cx + lSz/2, lY[l], kvCx - kvSz/2, lY[l], COL.magenta, busA, 1);
        glowLine(ctx, kvCx, lY[l] + kvSz/2, kvCx, busY, COL.magenta, busA, 1);
      }

      const kvCx = cx + kvOff;
      drawActNode(ctx, kvCx, lY[l], kvSz, COL.magenta, 0.5 + ga * 0.5, Math.max(glow * 0.8, steadyGlow * 0.6));
    }

    // Residual glow
    const resPs = [
      (tokY + 10*s + lY[0] - lSz/2) / 2,
      ...Array.from({length: L-1}, (_, l) => (lY[l] + lSz/2 + lY[l+1] - lSz/2) / 2),
      (lY[L-1] + lSz/2 + predY - 10*s) / 2,
    ];
    for (let r = 0; r < resPs.length; r++) {
      if (r === L && pos !== N - 1) continue;
      const layerFromBottom = L - 1 - Math.min(r, L - 1);
      const diag = posFromRight + layerFromBottom;
      const activationT = gradStart + diag * waveSpeed;
      const rGlow = pop(t, activationT);
      if (t >= activationT) {
        const rA = clamp((t - activationT) / 0.1, 0, 1);
        drawResidualNode(ctx, cx, resPs[r], resW, resH, COL.magenta, 0.4 + rA * 0.6, rGlow);
      }
    }
  }

  ctx.restore();
}

// ── Init ──

function initTheme() {
  const saved = localStorage.getItem('llm-backprop-theme');
  const theme = saved || 'dark';
  document.documentElement.dataset.theme = theme;

  const btn = document.getElementById('theme-toggle');
  btn.textContent = theme === 'light' ? 'dark' : 'light';
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    btn.textContent = next === 'light' ? 'dark' : 'light';
    localStorage.setItem('llm-backprop-theme', next);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const SEC1_CYCLE = 2.0, SEC2_CYCLE = 2.0, SEC3_CYCLE = 2.4;
  const sec4ZoomOutEnd = 5.0, sec4WaveSpeed = 0.55;
  const n1 = deriveSeq(SEQUENCES.sec1).N;
  const n2 = deriveSeq(SEQUENCES.sec2).N;
  const n3 = deriveSeq(SEQUENCES.sec3).N;
  const n4 = deriveSeq(SEQUENCES.sec4).N;
  createSection(document.getElementById('sec1'), drawSec1, (n1 + 1) * SEC1_CYCLE);
  createSection(document.getElementById('sec2'), drawSec2, (n2 + 1) * SEC2_CYCLE);
  createSection(document.getElementById('sec3'), drawSec3, (n3 + 1) * SEC3_CYCLE);
  createSection(document.getElementById('sec4'), drawSec4,
    sec4ZoomOutEnd + (n4 + L - 2) * sec4WaveSpeed + 2.0);
});
