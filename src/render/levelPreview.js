import { VIEW } from '../config.js';
import { THEMES } from '../data/themes.js';
import { createCanvas } from './canvas.js';
import { SkylineBackground } from './skylineBackground.js';

export const PREVIEW_SIZE = { width: 128, height: 280 };

/**
 * Card artwork: full handmade skyline + the runner on a simple roof strip.
 */
export function renderLevelPreview(level, playerRenderer, skylines) {
  const theme = THEMES[level.theme];
  const scene = createCanvas(VIEW.width, VIEW.height);
  const background = new SkylineBackground(skylines);
  background.drawBackLayers(scene.ctx, level.number * 70);

  const roofY = 300;
  scene.ctx.fillStyle = '#0a0a18';
  scene.ctx.fillRect(40, roofY, 200, VIEW.height - roofY);
  scene.ctx.fillStyle = theme.accent;
  scene.ctx.fillRect(40, roofY, 200, 2);
  playerRenderer.drawFrame(scene.ctx, 0, 120, roofY, { rimColor: theme.accent, scale: 2 });

  const preview = createCanvas(PREVIEW_SIZE.width, PREVIEW_SIZE.height);
  preview.ctx.imageSmoothingEnabled = false;
  // Full-height slice so cards show the whole skyline, not a tiny crop.
  const srcX = Math.round((VIEW.width - PREVIEW_SIZE.width) / 2) + (level.number - 1) * 36;
  preview.ctx.drawImage(
    scene.canvas,
    srcX, 0, PREVIEW_SIZE.width, VIEW.height,
    0, 0, PREVIEW_SIZE.width, PREVIEW_SIZE.height,
  );
  return preview.canvas;
}
