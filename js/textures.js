// Proceduralne tekstury rysowane na <canvas> – bez zewnętrznych plików graficznych.
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function toTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function veins(ctx, x, y, w, h, color, count, rand, maxAlpha = 0.35) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < count; i++) {
    let px = x + rand() * w;
    let py = y + rand() * h;
    let ang = rand() * Math.PI * 2;
    const steps = 30 + rand() * 80;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.05 + rand() * maxAlpha;
    ctx.lineWidth = 0.5 + rand() * 2.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let s = 0; s < steps; s++) {
      ang += (rand() - 0.5) * 0.7;
      px += Math.cos(ang) * 5;
      py += Math.sin(ang) * 5;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function blotches(ctx, x, y, w, h, color, count, rand, alpha = 0.08) {
  for (let i = 0; i < count; i++) {
    const cx = x + rand() * w, cy = y + rand() * h, r = 10 + rand() * w * 0.4;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
}

export function marbleTexture(base, vein, seed = 7, size = 512) {
  const [c, ctx] = makeCanvas(size, size);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, 0, 0, size, size, vein, 12, rand, 0.07);
  veins(ctx, 0, 0, size, size, vein, 40, rand, 0.35);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function boardTexture() {
  const S = 128;
  const [c, ctx] = makeCanvas(S * 8, S * 8);
  const rand = rng(42);
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const x = f * S, y = (7 - r) * S;
      const dark = (f + r) % 2 === 0;
      ctx.fillStyle = dark ? '#24262e' : '#e6dcc6';
      ctx.fillRect(x, y, S, S);
      blotches(ctx, x, y, S, S, dark ? '#4a4f5e' : '#b9a98a', 4, rand, 0.12);
      veins(ctx, x, y, S, S, dark ? '#8a90a3' : '#8f7f63', 7, rand, dark ? 0.25 : 0.3);
      // Delikatna fuga między polami
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, S - 2, S - 2);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, S - 6, S - 6);
    }
  }
  return toTexture(c);
}

export function frameTexture() {
  const S = 128;
  const W = S * 9;
  const [c, ctx] = makeCanvas(W, W);
  const rand = rng(9);
  const g = ctx.createLinearGradient(0, 0, W, W);
  g.addColorStop(0, '#2b1c12');
  g.addColorStop(0.5, '#3d2818');
  g.addColorStop(1, '#24170e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  veins(ctx, 0, 0, W, W, '#6b4a2c', 120, rand, 0.25);
  // Złote obramowania
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 6;
  ctx.strokeRect(S / 2 - 6, S / 2 - 6, S * 8 + 12, S * 8 + 12);
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, W - 28);
  // Ozdobne narożniki
  ctx.fillStyle = '#d8b45a';
  for (const [cx, cy] of [[32, 32], [W - 32, 32], [32, W - 32], [W - 32, W - 32]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
  ctx.fillStyle = '#e2c069';
  ctx.font = 'bold 42px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const files = 'abcdefgh';
  for (let i = 0; i < 8; i++) {
    const x = S / 2 + i * S + S / 2;
    ctx.fillText(files[i], x, W - S / 4);
    ctx.save();
    ctx.translate(x, S / 4);
    ctx.rotate(Math.PI);
    ctx.fillText(files[i], 0, 0);
    ctx.restore();
    const y = S / 2 + (7 - i) * S + S / 2;
    ctx.fillText(String(i + 1), S / 4, y);
    ctx.save();
    ctx.translate(W - S / 4, y);
    ctx.rotate(Math.PI);
    ctx.fillText(String(i + 1), 0, 0);
    ctx.restore();
  }
  return toTexture(c);
}

export function stoneTexture(seed = 3, tint = [70, 66, 72], tiles = 4) {
  const size = 512;
  const [c, ctx] = makeCanvas(size, size);
  const rand = rng(seed);
  const T = size / tiles;
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const v = (rand() - 0.5) * 24;
      ctx.fillStyle = `rgb(${tint[0] + v},${tint[1] + v},${tint[2] + v})`;
      ctx.fillRect(i * T, j * T, T, T);
      blotches(ctx, i * T, j * T, T, T, 'rgba(20,18,24,1)', 3, rand, 0.25);
    }
  }
  // Szum
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(10,8,12,0.85)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * T, 0);
    ctx.lineTo(i * T, size);
    ctx.moveTo(0, i * T);
    ctx.lineTo(size, i * T);
    ctx.stroke();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function brickTexture(seed = 5) {
  const W = 512, H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(seed);
  ctx.fillStyle = '#141218';
  ctx.fillRect(0, 0, W, H);
  const bh = 48, bw = 128;
  for (let row = 0; row < H / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < W / bw + 1; col++) {
      const v = 46 + (rand() - 0.5) * 18;
      ctx.fillStyle = `rgb(${v},${v - 3},${v + 4})`;
      ctx.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 6);
    }
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function glowTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, false);
}

export function flameTexture() {
  const [c, ctx] = makeCanvas(64, 128);
  const g = ctx.createRadialGradient(32, 84, 2, 32, 76, 40);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.3, 'rgba(255,210,120,0.9)');
  g.addColorStop(0.7, 'rgba(255,120,30,0.3)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(52, 50, 60, 90, 32, 124);
  ctx.bezierCurveTo(4, 90, 12, 50, 32, 4);
  ctx.fill();
  return toTexture(c, false);
}

export function runeCircleTexture(seed = 11) {
  const S = 512, C = S / 2;
  const [c, ctx] = makeCanvas(S, S);
  const rand = rng(seed);
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 8;
  const ring = (r, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(C, C, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(244, 4);
  ring(230, 2);
  ring(172, 3);
  ring(160, 1.5);
  ring(60, 2);
  // Gwiazda siedmioramienna
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2;
    const x = C + Math.cos(a) * 160, y = C + Math.sin(a) * 160;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Runy wokół pierścienia
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.save();
    ctx.translate(C + Math.cos(a) * 201, C + Math.sin(a) * 201);
    ctx.rotate(a + Math.PI / 2);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const strokes = 2 + Math.floor(rand() * 3);
    for (let s = 0; s < strokes; s++) {
      const x1 = (rand() - 0.5) * 22, y1 = (rand() - 0.5) * 26;
      const x2 = (rand() - 0.5) * 22, y2 = (rand() - 0.5) * 26;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 13);
    ctx.stroke();
    ctx.restore();
  }
  // Małe kropki
  for (let i = 0; i < 7; i++) {
    const a = ((i + 0.5) / 7) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(C + Math.cos(a) * 110, C + Math.sin(a) * 110, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, false);
}

export function windowTexture() {
  const W = 128, H = 384;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(8, H - 4);
  ctx.lineTo(8, 80);
  ctx.quadraticCurveTo(8, 8, 64, 4);
  ctx.quadraticCurveTo(120, 8, 120, 80);
  ctx.lineTo(120, H - 4);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9fb8ff');
  g.addColorStop(0.5, '#4c6bc4');
  g.addColorStop(1, '#22306a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 5;
  for (let y = 60; y < H; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, H);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let y = 60; y < H; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(64, y + 46);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  return toTexture(c);
}
