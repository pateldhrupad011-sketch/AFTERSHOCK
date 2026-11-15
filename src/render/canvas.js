/** Creates an offscreen canvas configured for crisp pixel art. */
export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Hard pixel accent — a few opaque squares, never soft bloom.
 * Kept as `drawGlow` so existing call sites stay valid without flooding the scene.
 */
export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  if (alpha < 0.08) return;
  const cx = Math.round(x);
  const cy = Math.round(y);
  const r = Math.max(1, Math.min(4, Math.round(radius * 0.22)));
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(cx - r, cy - r, r * 2 + 1, r * 2 + 1);
  if (r > 1 && alpha > 0.45) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cy, 1, 1);
  }
  ctx.restore();
}

/** '#rrggbb' + alpha -> 'rgba(...)'. */
export function withAlpha(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Linear blend of two '#rrggbb' colours. */
export function mixColors(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}
