import { VIEW } from '../config.js';
import { createSeededRandom } from '../core/math.js';
import { createCanvas, mixColors } from './canvas.js';

/*
 * 2.5D buildings: the front face is a flat rectangle, while the roof and the
 * side wall facing the screen centre are projected toward a vanishing point.
 * As the camera scrolls, side walls swing from one side to the other, which
 * sells depth without any 3D engine.
 */

export const VANISHING_POINT = { x: VIEW.width / 2, y: VIEW.height * 0.4 };

/**
 * Pre-renders window facade tiles for a theme. `dim` darkens them for
 * background buildings (atmospheric perspective).
 */
export function createFacadeTiles(theme, seed, dim = 0) {
  const random = createSeededRandom(seed);
  const base = mixColors(theme.facade.base, theme.sky[1], dim);
  const shade = mixColors(theme.facade.shade, theme.sky[1], dim);
  const windowColor = mixColors(theme.facade.window, theme.sky[1], dim);
  // Lit windows are muted toward the wall colour so facades never compete with gameplay.
  const litColors = theme.facade.lit.map((color) => mixColors(mixColors(color, base, 0.45), theme.sky[2], dim * 0.8));

  const styles = [
    // Grid of small windows.
    (ctx, w, h) => {
      for (let y = 4; y < h; y += 8) {
        for (let x = 3; x < w; x += 7) {
          const lit = random.chance(0.16);
          ctx.fillStyle = lit ? random.pick(litColors) : windowColor;
          ctx.fillRect(x, y, 4, 4);
          if (lit) {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(x, y, 4, 1);
          }
        }
      }
    },
    // Horizontal ribbon windows.
    (ctx, w, h) => {
      for (let y = 5; y < h; y += 10) {
        ctx.fillStyle = windowColor;
        ctx.fillRect(0, y, w, 4);
        for (let x = 0; x < w; x += random.int(8, 18)) {
          if (random.chance(0.18)) {
            ctx.fillStyle = random.pick(litColors);
            ctx.fillRect(x, y, random.int(3, 8), 4);
          }
        }
        ctx.fillStyle = shade;
        ctx.fillRect(0, y + 4, w, 1);
      }
    },
    // Vertical panels with sparse windows.
    (ctx, w, h) => {
      for (let x = 0; x < w; x += 12) {
        ctx.fillStyle = shade;
        ctx.fillRect(x, 0, 1, h);
        for (let y = 3; y < h; y += 6) {
          if (random.chance(0.3)) {
            ctx.fillStyle = random.chance(0.4) ? random.pick(litColors) : windowColor;
            ctx.fillRect(x + 3, y, 6, 3);
          }
        }
      }
    },
  ];

  return styles.map((drawWindows) => {
    const { canvas, ctx } = createCanvas(96, 64);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 96, 64);
    drawWindows(ctx, 96, 64);
    return canvas;
  });
}

const projectToVanishingPoint = (x, y, depth) => ({
  x: x + (VANISHING_POINT.x - x) * depth,
  y: y + (VANISHING_POINT.y - y) * depth,
});

function fillQuad(ctx, a, b, c, d, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.lineTo(Math.round(c.x), Math.round(c.y));
  ctx.lineTo(Math.round(d.x), Math.round(d.y));
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws one building in screen space.
 * @param box     { x, y, width } — front-top-left corner and width on screen
 * @param style   { facadeTile, roofColor, sideColor, trimColor, depth, tilt }
 */
export function drawBuilding25D(ctx, box, style) {
  const left = Math.round(box.x);
  const right = Math.round(box.x + box.width);
  const top = Math.round(box.y);
  const bottom = VIEW.height + 40;
  const depth = style.depth;

  const backTopLeft = projectToVanishingPoint(left, top, depth);
  const backTopRight = projectToVanishingPoint(right, top, depth);

  if (left > VANISHING_POINT.x) {
    const backBottomLeft = projectToVanishingPoint(left, bottom, depth);
    fillQuad(ctx, { x: left, y: top }, backTopLeft, backBottomLeft, { x: left, y: bottom }, style.sideColor);
  }
  if (right < VANISHING_POINT.x) {
    const backBottomRight = projectToVanishingPoint(right, bottom, depth);
    fillQuad(ctx, { x: right, y: top }, backTopRight, backBottomRight, { x: right, y: bottom }, style.sideColor);
  }
  if (top > VANISHING_POINT.y) {
    fillQuad(ctx, { x: left, y: top }, { x: right, y: top }, backTopRight, backTopLeft, style.roofColor);
    // Back edge of the roof catches a little light.
    ctx.fillStyle = style.roofEdgeColor ?? 'rgba(255,255,255,0.08)';
    ctx.fillRect(Math.round(backTopLeft.x), Math.round(backTopLeft.y), Math.round(backTopRight.x - backTopLeft.x), 1);
  }

  const pattern = ctx.createPattern(style.facadeTile, 'repeat');
  pattern.setTransform(new DOMMatrix().translate(left + (style.patternOffsetX ?? 0), top + 3));
  ctx.fillStyle = pattern;
  ctx.fillRect(left, top, right - left, bottom - top);

  // Flat shade bands toward the street (no soft gradient wash).
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(left, top + 40, right - left, bottom - top - 40);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(left, top + 90, right - left, Math.max(0, bottom - top - 90));

  // Parapet + neon trim along the roof edge.
  ctx.fillStyle = style.parapetColor ?? 'rgba(0,0,0,0.5)';
  ctx.fillRect(left, top, right - left, 3);
  ctx.fillStyle = style.trimColor;
  ctx.fillRect(left, top, right - left, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(left, top, 1, bottom - top);
  ctx.fillRect(right - 1, top, 1, bottom - top);
}
