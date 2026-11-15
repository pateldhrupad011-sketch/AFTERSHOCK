export const lerp = (from, to, t) => from + (to - from) * t;

// Frame-rate independent smoothing: moves `current` toward `target` at `rate` per second.
export const approach = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

export const easeInCubic = (t) => t * t * t;

export const randomRange = (min, max) => min + Math.random() * (max - min);
export const pick = (items) => items[Math.floor(Math.random() * items.length)];

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** True if the segment from (x0,y0) to (x1,y1) clips the axis-aligned rect. */
export function segmentHitsRect(x0, y0, x1, y1, rect) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const inside = (x, y) => x >= left && x <= right && y >= top && y <= bottom;
  if (inside(x0, y0) || inside(x1, y1)) return true;

  const crosses = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (den === 0) return false;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  return (
    crosses(x0, y0, x1, y1, left, top, right, top) ||
    crosses(x0, y0, x1, y1, right, top, right, bottom) ||
    crosses(x0, y0, x1, y1, right, bottom, left, bottom) ||
    crosses(x0, y0, x1, y1, left, bottom, left, top)
  );
}

/**
 * Small deterministic PRNG (mulberry32). Used wherever generated content must
 * look the same every run, e.g. skyline layouts and building facades.
 */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  };
}
