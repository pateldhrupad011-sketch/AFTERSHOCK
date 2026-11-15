import { VIEW } from '../config.js';
import { SkylineBackground } from './skylineBackground.js';
import { withAlpha } from './canvas.js';

const CHARACTER = { x: 118, feetY: 336, scale: 5 };

/**
 * Static title screen: handmade skyline + character on the left. No motion.
 */
export class MenuScene {
  constructor(playerRenderer, skylines) {
    this.playerRenderer = playerRenderer;
    this.background = new SkylineBackground(skylines);
  }

  update() {}

  render(ctx, { showCharacter = true, dim = 0 } = {}) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    this.background.drawBackLayers(ctx, 0);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, CHARACTER.feetY, VIEW.width, VIEW.height - CHARACTER.feetY);
    ctx.fillStyle = '#3aa8b8';
    ctx.fillRect(0, CHARACTER.feetY, VIEW.width, 1);

    if (showCharacter) {
      this.playerRenderer.drawFrame(ctx, 0, CHARACTER.x, CHARACTER.feetY, {
        scale: CHARACTER.scale,
        lean: 0,
        squash: 0,
        rimColor: '#3aa8b8',
        facing: 1,
      });
    }

    if (dim > 0) {
      ctx.fillStyle = withAlpha('#000000', dim);
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }
}
