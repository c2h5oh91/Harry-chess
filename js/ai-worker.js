// Prosty silnik szachowy (negamax + alfa-beta) działający w Web Workerze.
import { Chess } from '../vendor/chess/chess.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tablice pozycyjne z perspektywy białych; indeks 0 = a8, 63 = h1.
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const MATE = 100000;

function evaluate(ch) {
  const b = ch.board();
  let s = 0;
  for (let r = 0; r < 8; r++) {
    const row = b[r];
    for (let f = 0; f < 8; f++) {
      const p = row[f];
      if (!p) continue;
      const idx = p.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      const v = VAL[p.type] + PST[p.type][idx];
      s += p.color === 'w' ? v : -v;
    }
  }
  return s;
}

function order(moves) {
  for (const m of moves) {
    let s = 0;
    if (m.captured) s += 10 * VAL[m.captured] - VAL[m.piece] + 1000;
    if (m.promotion) s += 800;
    m._s = s;
  }
  return moves.sort((a, b) => b._s - a._s);
}

const toMove = (m) => (m.promotion ? { from: m.from, to: m.to, promotion: m.promotion } : { from: m.from, to: m.to });

let nodes = 0;

function negamax(ch, depth, alpha, beta, ply) {
  nodes++;
  if (depth === 0) return (ch.turn() === 'w' ? 1 : -1) * evaluate(ch);
  const moves = ch.moves({ verbose: true });
  if (moves.length === 0) return ch.inCheck() ? -MATE + ply : 0;
  let best = -Infinity;
  for (const m of order(moves)) {
    ch.move(toMove(m));
    const v = -negamax(ch, depth - 1, -beta, -alpha, ply + 1);
    ch.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

self.onmessage = (e) => {
  const { fen, depth, noise, token } = e.data;
  const ch = new Chess(fen);
  const moves = order(ch.moves({ verbose: true }));
  nodes = 0;
  let best = null, bestScore = -Infinity;
  let alpha = -Infinity;
  for (const m of moves) {
    ch.move(toMove(m));
    let v = -negamax(ch, depth - 1, -Infinity, -alpha + 2 * noise + 1, 1);
    ch.undo();
    v += (Math.random() - 0.5) * 2 * noise;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
    if (v > alpha) alpha = v;
  }
  self.postMessage({ token, move: best ? toMove(best) : null, nodes });
};
