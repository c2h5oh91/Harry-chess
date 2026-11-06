// Minimalny silnik tweenów oparty na obietnicach (Promise).
const tweens = new Set();

export const anim = { timeScale: 1 };

export const ease = {
  linear: (k) => k,
  inQuad: (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inCubic: (k) => k * k * k,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};

export function tween(duration, fn, easing = ease.inOutCubic) {
  return new Promise((resolve) => {
    if (duration <= 0) {
      fn(1, 1);
      resolve();
      return;
    }
    const t = { duration, fn, easing, elapsed: 0, resolve };
    tweens.add(t);
    fn(easing(0), 0);
  });
}

export const wait = (d) => tween(d, () => {}, ease.linear);

export function updateTweens(dt) {
  const step = dt * anim.timeScale;
  for (const t of [...tweens]) {
    t.elapsed += step;
    const k = Math.min(1, t.elapsed / t.duration);
    t.fn(t.easing(k), k);
    if (k >= 1) {
      tweens.delete(t);
      t.resolve();
    }
  }
}
