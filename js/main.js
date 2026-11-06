// Szachy Czarodziejów – główny moduł gry.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Chess } from '../vendor/chess/chess.js';
import { createPiece } from './pieces.js';
import { buildEnvironment } from './environment.js';
import { buildBoard, squareToPos, posToSquare } from './board.js';
import { Effects } from './effects.js';
import { tween, wait, updateTweens, anim, ease } from './tween.js';
import { Sfx } from './audio.js';

// ---------- Ustawienia ----------
const SIDE_COLOR = { w: 0xffc25a, b: 0x46ff8c };
const NAMES = { w: 'Białe', b: 'Czarne' };
const PIECE_NAMES = { p: 'Pionek', n: 'Skoczek', b: 'Goniec', r: 'Wieża', q: 'Hetman', k: 'Król' };
const SPELLS = {
  p: ['Pedes Avanti!', 'Gradus Primus!'],
  n: ['Equus Saltare!', 'Saltus Equinus!'],
  b: ['Obliquo Volare!', 'Diagonalis!'],
  r: ['Turris Movere!', 'Murus Ambulat!'],
  q: ['Regina Imperat!', 'Maiestas Volans!'],
  k: ['Rex Gradior!', 'Passus Regalis!'],
};
const CAPTURE_SPELLS = ['Lapis Frangitur!', 'Confractus Totalis!', 'Ruina Saxorum!', 'Fulmen Petrae!'];
const LEVELS = { 1: { depth: 1, noise: 60 }, 2: { depth: 2, noise: 20 }, 3: { depth: 3, noise: 5 } };

// ---------- Renderer, scena, kamera ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
const HOME = { pos: new THREE.Vector3(0, 9.2, 10.2), target: new THREE.Vector3(0, 0, 0.4) };
camera.position.set(0, 14, 22); // ujęcie startowe (przelot nad salą)

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 24;
controls.maxPolarAngle = 1.38;
controls.target.copy(HOME.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const env = buildEnvironment(scene);
const board = buildBoard(scene);
const fx = new Effects(scene);
const sfx = new Sfx();

const spellLight = new THREE.PointLight(0xffffff, 0, 6, 2);
scene.add(spellLight);

// ---------- Stan gry ----------
const game = new Chess();
const pieces = new Map(); // pole -> THREE.Group
let selected = null;
let legal = [];
let busy = false;
let flipped = false;
let aiToken = 0;
let aiThinking = false;
let cameraLocked = false;
let shakeAmt = 0;
const settings = { mode: 'ai', level: 2, aiColor: 'b', cinematic: true, fast: false };

const worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'),
  turn: $('turnIndicator'),
  moves: $('moves'),
  spell: $('spell'),
  spellText: $('spell').querySelector('.incant'),
  spellSub: $('spell').querySelector('.sub'),
  promo: $('promo'),
  over: $('gameover'),
};

function showSpell(text, sub = '', cls = '') {
  const el = ui.spell;
  el.className = '';
  void el.offsetWidth; // restart animacji CSS
  ui.spellText.textContent = text;
  ui.spellSub.textContent = sub;
  el.className = `show ${cls}`;
}

function setStatus(text) {
  ui.status.textContent = text;
}

function updateTurnUI() {
  const t = game.turn();
  ui.turn.className = `turn ${t === 'w' ? 'white' : 'black'}`;
  ui.turn.textContent = `Ruch: ${NAMES[t]}`;
  const hist = game.history();
  let html = '';
  for (let i = 0; i < hist.length; i += 2) {
    html += `<li><span class="n">${i / 2 + 1}.</span><span>${hist[i]}</span><span>${hist[i + 1] ?? ''}</span></li>`;
  }
  ui.moves.innerHTML = html;
  ui.moves.scrollTop = ui.moves.scrollHeight;
  $('undo').disabled = hist.length === 0;
}

function findKing(color) {
  for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

function refreshCheck() {
  board.setCheck(game.inCheck() ? findKing(game.turn()) : null);
}

// ---------- Figury ----------
function placePiece(type, color, sq) {
  const g = createPiece(type, color);
  g.position.copy(squareToPos(sq));
  g.userData.square = sq;
  scene.add(g);
  pieces.set(sq, g);
  return g;
}

function syncPieces() {
  for (const g of pieces.values()) scene.remove(g);
  pieces.clear();
  for (const row of game.board()) for (const p of row) if (p) placePiece(p.type, p.color, p.square);
}

function setGlow(group, intensity, hex) {
  for (const m of group.userData.materials) {
    m.emissive.setHex(hex);
    m.emissiveIntensity = intensity;
  }
}

// ---------- Kamera ----------
function moveCamera(pos, target, dur) {
  const p0 = camera.position.clone();
  const t0 = controls.target.clone();
  return tween(dur, (k) => {
    camera.position.lerpVectors(p0, pos, k);
    controls.target.lerpVectors(t0, target, k);
    camera.lookAt(controls.target);
  }, ease.inOutCubic);
}

let savedView = null;
async function cinematicIn(from, to) {
  if (!settings.cinematic) return;
  cameraLocked = true;
  savedView = { pos: camera.position.clone(), target: controls.target.clone() };
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  if (side.dot(camera.position.clone().sub(mid)) < 0) side.negate();
  const d = from.distanceTo(to);
  const dist = 4.6 + d * 0.5;
  const target = mid.clone().setY(0.9);
  const pos = mid.clone().addScaledVector(side, dist).addScaledVector(dir, -1.4).setY(2.6 + d * 0.3);
  // Nie wylatuj poza salę
  if (pos.length() > 13) pos.setLength(13);
  await moveCamera(pos, target, 0.75);
}

async function cinematicOut() {
  if (!settings.cinematic || !savedView) return;
  await moveCamera(savedView.pos, savedView.target, 0.9);
  savedView = null;
  cameraLocked = false;
}

function shake(a) {
  shakeAmt = Math.max(shakeAmt, a);
}

// ---------- Animacje ruchu ----------
function topOf(group) {
  const box = new THREE.Box3().setFromObject(group);
  return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
}

async function levitate(group, hex, height = 0.55, dur = 0.5) {
  const y0 = group.position.y;
  spellLight.color.setHex(hex);
  sfx.chime();
  await tween(dur, (k) => {
    group.position.y = y0 + height * k;
    setGlow(group, 0.4 * k, hex);
    spellLight.intensity = 7 * k;
    spellLight.position.copy(group.position).add(new THREE.Vector3(0, 0.9, 0));
    fx.trail(group.position, hex, 2);
  }, ease.outCubic);
}

async function fly(group, toSq, hex, { arc = 0.6, dur = 0.85, spin = 0 } = {}) {
  const p0 = group.position.clone();
  const p1 = squareToPos(toSq, p0.y);
  const d = p0.distanceTo(p1);
  const h = arc + d * 0.12;
  const r0 = group.rotation.y;
  sfx.whoosh(dur);
  await tween(dur, (k) => {
    group.position.lerpVectors(p0, p1, k);
    group.position.y = p0.y + Math.sin(Math.PI * k) * h;
    group.rotation.z = Math.sin(k * Math.PI * 2) * 0.1;
    group.rotation.y = r0 + spin * k;
    spellLight.position.copy(group.position).add(new THREE.Vector3(0, 0.9, 0));
    fx.trail(group.position, hex, 4);
  }, ease.inOutSine);
  group.rotation.z = 0;
  group.rotation.y = r0;
}

async function land(group, hex, heavy = false) {
  const y0 = group.position.y;
  await tween(0.2, (k) => {
    group.position.y = y0 * (1 - k);
  }, ease.inQuad);
  group.position.y = 0;
  const p = group.position.clone();
  fx.shockwave(p, hex, heavy ? 6 : 3.5);
  fx.dust(p, heavy ? 50 : 25, heavy ? 1.3 : 0.8);
  fx.burst(p.clone().setY(0.1), hex, heavy ? 70 : 30, heavy ? 3 : 1.8, 0.09);
  sfx.thud();
  shake(heavy ? 0.18 : 0.07);
  // zgnieć i odbij
  tween(0.3, (k) => {
    const s = 1 - Math.sin(k * Math.PI) * 0.08;
    group.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
  }, ease.linear).then(() => group.scale.set(1, 1, 1));
  tween(0.6, (k) => {
    setGlow(group, 0.4 * (1 - k), hex);
    spellLight.intensity = 7 * (1 - k);
  }, ease.outQuad);
}

async function destroyPiece(attacker, victim, hex) {
  const from = topOf(attacker).add(new THREE.Vector3(0, 0.1, 0));
  const to = topOf(victim).sub(new THREE.Vector3(0, 0.25, 0));
  sfx.zap();
  await fx.bolt(from, to, hex, 0.5);
  fx.lightning(from, to, hex);
  fx.flash(to, hex, 20, 0.6);
  fx.burst(to, hex, 90, 4, 0.11);
  // drżenie trafionej figury
  const base = victim.position.clone();
  setGlow(victim, 0.9, 0xff5533);
  await tween(0.35, (k) => {
    victim.position.set(base.x + (Math.random() - 0.5) * 0.08 * (1 - k * 0.3), base.y, base.z + (Math.random() - 0.5) * 0.08);
    victim.rotation.z = (Math.random() - 0.5) * 0.1;
  }, ease.linear);
  scene.remove(victim);
  fx.shatter(victim);
  sfx.crash();
  shake(0.35);
  await wait(0.25);
}

async function promote(group, sq, newType, color, hex) {
  const pos = squareToPos(sq);
  fx.pillar(pos, hex, 6, 1.6);
  fx.spiral(pos, hex, 2, 120);
  sfx.fanfare();
  showSpell('Coronatio Maxima!', `${PIECE_NAMES.p} staje się: ${PIECE_NAMES[newType]}`, 'gold');
  await tween(0.5, (k) => {
    group.scale.setScalar(1 - k);
    group.rotation.y = k * Math.PI * 3;
  }, ease.inCubic);
  scene.remove(group);
  const g = placePiece(newType, color, sq);
  g.scale.setScalar(0.01);
  setGlow(g, 0.8, hex);
  fx.burst(pos.clone().setY(0.5), hex, 150, 3.5, 0.13);
  await tween(0.7, (k) => {
    g.scale.setScalar(Math.max(0.01, k));
    g.rotation.y = (1 - k) * Math.PI * 2;
    setGlow(g, 0.8 * (1 - k), hex);
  }, ease.outBack);
  g.scale.setScalar(1);
}

async function toppleKing(color) {
  const sq = findKing(color);
  const king = pieces.get(sq);
  if (!king) return;
  const hex = 0xff4433;
  fx.magicCircle(king.position, hex, 2.2);
  setGlow(king, 0.6, hex);
  await wait(0.4);
  const dir = color === 'w' ? 1 : -1;
  await tween(1.0, (k) => {
    king.rotation.x = dir * k * (Math.PI / 2 - 0.1);
    king.position.y = Math.sin(k * Math.PI) * 0.15;
  }, ease.inCubic);
  sfx.thud();
  shake(0.25);
  fx.dust(king.position, 70, 1.5);
  await wait(0.5);
  scene.remove(king);
  pieces.delete(sq);
  fx.shatter(king);
  sfx.crash();
  shake(0.5);
}

async function playMove(move) {
  const hex = SIDE_COLOR[move.color];
  const piece = pieces.get(move.from);
  const fromPos = squareToPos(move.from);
  const toPos = squareToPos(move.to);

  let capSq = null;
  if (move.flags.includes('e')) capSq = move.to[0] + move.from[1];
  else if (move.captured) capSq = move.to;
  const victim = capSq ? pieces.get(capSq) : null;

  pieces.delete(move.from);
  if (capSq) pieces.delete(capSq);
  pieces.set(move.to, piece);
  piece.userData.square = move.to;

  let rook = null, rookTo = null;
  if (move.flags.includes('k') || move.flags.includes('q')) {
    const rank = move.color === 'w' ? '1' : '8';
    const rFrom = (move.flags.includes('k') ? 'h' : 'a') + rank;
    rookTo = (move.flags.includes('k') ? 'f' : 'd') + rank;
    rook = pieces.get(rFrom);
    pieces.delete(rFrom);
    pieces.set(rookTo, rook);
    rook.userData.square = rookTo;
  }

  // Inkantacja
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (rook) showSpell('Turris Commuto!', `${NAMES[move.color]}: roszada`, move.color);
  else if (victim) showSpell(pick(CAPTURE_SPELLS), `${PIECE_NAMES[move.piece]} niszczy: ${PIECE_NAMES[move.captured]}`, move.color);
  else showSpell(pick(SPELLS[move.piece]), `${PIECE_NAMES[move.piece]} ${move.from} → ${move.to}`, move.color);

  const circle = fx.magicCircle(fromPos, hex, 1.5);
  const cam = cinematicIn(fromPos, toPos);
  fx.spiral(fromPos, hex, 1.2, 50);

  const lev = [levitate(piece, hex)];
  if (rook) lev.push(levitate(rook, hex));
  await Promise.all(lev);

  if (victim) {
    await cam;
    await destroyPiece(piece, victim, hex);
  }

  const targetCircle = fx.magicCircle(toPos, hex, 1.2);
  circle.close();
  const flights = [fly(piece, move.to, hex, { arc: move.piece === 'n' ? 1.6 : 0.6, dur: move.piece === 'n' ? 0.95 : 0.85 })];
  if (rook) flights.push(fly(rook, rookTo, hex, { arc: 1.2, dur: 0.95 }));
  await Promise.all(flights);

  const lands = [land(piece, hex, !!victim || move.piece === 'q' || move.piece === 'k')];
  if (rook) lands.push(land(rook, hex));
  await Promise.all(lands);
  targetCircle.close(0.8);

  if (move.promotion) await promote(piece, move.to, move.promotion, move.color, hex);

  await cam;
  await wait(0.25);
  await cinematicOut();
}

// ---------- Logika rozgrywki ----------
function clearSelection() {
  selected = null;
  legal = [];
  board.clearTargets();
  board.setSelected(null);
}

function select(sq) {
  clearSelection();
  selected = sq;
  legal = game.moves({ square: sq, verbose: true });
  board.setSelected(sq);
  board.showTargets(legal);
  sfx.select();
  const g = pieces.get(sq);
  if (g) {
    fx.burst(g.position.clone().setY(0.1), SIDE_COLOR[game.turn()], 25, 1.2, 0.07);
  }
}

function askPromotion(color) {
  return new Promise((resolve) => {
    ui.promo.classList.remove('hidden');
    ui.promo.dataset.color = color;
    const onClick = (e) => {
      const btn = e.target.closest('button[data-p]');
      if (!btn) return;
      ui.promo.removeEventListener('click', onClick);
      ui.promo.classList.add('hidden');
      resolve(btn.dataset.p);
    };
    ui.promo.addEventListener('click', onClick);
  });
}

async function makeMove(from, to, promotion) {
  if (busy) return;
  busy = true;
  clearSelection();
  let move;
  try {
    move = game.move(promotion ? { from, to, promotion } : { from, to });
  } catch {
    busy = false;
    return;
  }
  board.setCheck(null);
  board.setLastMove(null);
  anim.timeScale = settings.fast ? 2.4 : 1;
  setStatus('Trwa zaklęcie…');
  await playMove(move);
  board.setLastMove(move.from, move.to);
  updateTurnUI();
  refreshCheck();
  busy = false;
  await afterMove(move);
}

async function afterMove() {
  if (game.isCheckmate()) {
    busy = true;
    const loser = game.turn();
    const winner = loser === 'w' ? 'b' : 'w';
    showSpell('Rex Cadit!', `Szach-mat! Wygrywają ${NAMES[winner]}`, 'red');
    sfx.check();
    await toppleKing(loser);
    sfx.fanfare();
    gameOver(`Szach-mat!`, `Wygrywają ${NAMES[winner]}`);
    busy = false;
    return;
  }
  if (game.isDraw() || game.isStalemate()) {
    let why = 'Remis';
    if (game.isStalemate()) why = 'Pat – remis';
    else if (game.isThreefoldRepetition()) why = 'Trzykrotne powtórzenie – remis';
    else if (game.isInsufficientMaterial()) why = 'Niewystarczający materiał – remis';
    showSpell('Pax Magica!', why, 'gold');
    gameOver('Koniec gry', why);
    return;
  }
  if (game.inCheck()) {
    const sq = findKing(game.turn());
    showSpell('Rex Periclitatur!', `Szach! ${NAMES[game.turn()]} muszą bronić króla`, 'red');
    sfx.check();
    const k = pieces.get(sq);
    if (k) {
      fx.burst(k.position.clone().setY(1.2), 0xff4433, 60, 1.5, 0.1);
      fx.shockwave(k.position, 0xff4433, 3, 0.9);
    }
  }
  if (settings.mode === 'ai' && game.turn() === settings.aiColor) requestAiMove();
  else setStatus(game.inCheck() ? 'Szach!' : 'Wybierz figurę');
}

function gameOver(title, sub) {
  setStatus(`${title} ${sub}`);
  ui.over.querySelector('h2').textContent = title;
  ui.over.querySelector('p').textContent = sub;
  setTimeout(() => ui.over.classList.remove('hidden'), 900);
}

function requestAiMove() {
  aiThinking = true;
  setStatus('Komputer obmyśla zaklęcie…');
  const token = ++aiToken;
  const lvl = LEVELS[settings.level];
  const started = performance.now();
  worker.onmessage = (e) => {
    if (e.data.token !== aiToken) return;
    const delay = Math.max(0, 500 - (performance.now() - started));
    setTimeout(() => {
      if (token !== aiToken) return;
      aiThinking = false;
      if (e.data.move) makeMove(e.data.move.from, e.data.move.to, e.data.move.promotion);
    }, delay);
  };
  worker.postMessage({ fen: game.fen(), depth: lvl.depth, noise: lvl.noise, token });
}

function newGame() {
  aiToken++;
  aiThinking = false;
  game.reset();
  clearSelection();
  syncPieces();
  board.setLastMove(null);
  board.setCheck(null);
  ui.over.classList.add('hidden');
  updateTurnUI();
  setStatus('Wybierz figurę');
  showSpell('Ludus Incipit!', 'Niech rozpocznie się czarodziejska partia', 'gold');
  if (settings.mode === 'ai' && game.turn() === settings.aiColor) requestAiMove();
}

function undo() {
  if (busy) return;
  aiToken++;
  aiThinking = false;
  if (game.history().length === 0) return;
  game.undo();
  if (settings.mode === 'ai' && game.turn() === settings.aiColor && game.history().length > 0) game.undo();
  clearSelection();
  syncPieces();
  const h = game.history({ verbose: true });
  const last = h[h.length - 1];
  board.setLastMove(last ? last.from : null, last ? last.to : null);
  refreshCheck();
  ui.over.classList.add('hidden');
  updateTurnUI();
  showSpell('Tempus Reverto!', 'Cofnięto ruch', 'gold');
  setStatus('Wybierz figurę');
  if (settings.mode === 'ai' && game.turn() === settings.aiColor) requestAiMove();
}

// ---------- Wskazywanie myszą / dotykiem ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pickSquare(ev) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = [...pieces.values(), board.mesh];
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.square && o.parent) o = o.parent;
    if (o && o.userData.square) return o.userData.square;
    if (h.object === board.mesh) return posToSquare(h.point);
  }
  return null;
}

function canInteract() {
  if (busy || aiThinking || game.isGameOver()) return false;
  if (settings.mode === 'ai' && game.turn() === settings.aiColor) return false;
  return true;
}

let downAt = null;
canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  sfx.ensure();
});
canvas.addEventListener('pointerup', async (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8 || !canInteract()) return;
  const sq = pickSquare(e);
  if (!sq) {
    clearSelection();
    return;
  }
  if (selected) {
    const candidates = legal.filter((m) => m.to === sq);
    if (candidates.length) {
      let promo;
      if (candidates.some((m) => m.promotion)) promo = await askPromotion(game.turn());
      makeMove(selected, sq, promo);
      return;
    }
  }
  const p = game.get(sq);
  if (p && p.color === game.turn()) select(sq);
  else clearSelection();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !canInteract()) {
    board.setHover(null);
    return;
  }
  const sq = pickSquare(e);
  board.setHover(sq);
  const p = sq && game.get(sq);
  const clickable = (p && p.color === game.turn()) || (selected && legal.some((m) => m.to === sq));
  canvas.style.cursor = clickable ? 'pointer' : 'default';
});

// ---------- Panel sterowania ----------
$('newGame').addEventListener('click', newGame);
$('again').addEventListener('click', newGame);
ui.over.addEventListener('click', (e) => {
  if (e.target === ui.over) ui.over.classList.add('hidden'); // kliknięcie w tło – podgląd planszy
});
$('undo').addEventListener('click', undo);
$('flip').addEventListener('click', async () => {
  if (cameraLocked) return;
  flipped = !flipped;
  const p = camera.position.clone();
  const target = HOME.target.clone();
  if (flipped) target.z = -target.z;
  const to = new THREE.Vector3(-p.x, p.y, -p.z);
  cameraLocked = true;
  await moveCamera(to, target, 1.2);
  cameraLocked = false;
});
$('mode').addEventListener('change', (e) => {
  settings.mode = e.target.value;
  $('levelRow').style.display = settings.mode === 'ai' ? '' : 'none';
  newGame();
});
$('level').addEventListener('change', (e) => (settings.level = +e.target.value));
$('cine').addEventListener('change', (e) => (settings.cinematic = e.target.checked));
$('fast').addEventListener('change', (e) => (settings.fast = e.target.checked));
$('sound').addEventListener('change', (e) => (sfx.enabled = e.target.checked));
$('menuToggle').addEventListener('click', () => document.body.classList.toggle('panel-open'));

// ---------- Pętla renderowania ----------
const clock = new THREE.Clock();
let time = 0;
const camOffset = new THREE.Vector3();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}
window.addEventListener('resize', resize);

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  updateTweens(dt);
  fx.update(dt * anim.timeScale);
  env.update(time);
  board.pulse(time);

  // delikatne unoszenie wybranej figury
  if (selected && !busy) {
    const g = pieces.get(selected);
    if (g) {
      g.position.y = 0.12 + Math.sin(time * 3) * 0.05;
      setGlow(g, 0.25 + Math.sin(time * 3) * 0.1, SIDE_COLOR[game.turn()]);
    }
  }
  for (const [sq, g] of pieces) {
    if (sq !== selected && !busy && g.position.y !== 0) {
      g.position.y = 0;
      setGlow(g, 0, 0x000000);
    }
  }

  if (!cameraLocked) controls.update();
  else camera.lookAt(controls.target);

  if (shakeAmt > 0.001) {
    camOffset.set((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    camera.position.add(camOffset);
    composer.render();
    camera.position.sub(camOffset);
    shakeAmt *= Math.pow(0.02, dt);
  } else {
    composer.render();
  }
}

// ---------- Start ----------
syncPieces();
updateTurnUI();
loop();
$('loading').classList.add('hidden');
cameraLocked = true;
moveCamera(HOME.pos, HOME.target, 2.6).then(() => {
  cameraLocked = false;
  showSpell('Ludus Incipit!', 'Kliknij figurę, aby rzucić zaklęcie ruchu', 'gold');
  setStatus('Wybierz figurę');
});

// Dostęp dla testów / konsoli
window.__chess = { game, pieces, makeMove, settings, newGame };
