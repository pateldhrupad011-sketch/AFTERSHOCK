import { VIEW } from '../config.js';

/**
 * Full-screen handmade skyline from the player's art.
 * Three layers scroll at different rates behind gameplay.
 */
export class SkylineBackground {
  constructor(images) {
    this.far = images.far;
    this.mid = images.mid;
    this.near = images.near;
  }

  update() {}

  /** Kept for WorldRenderer collapse events — art is static, so this is a no-op. */
  triggerCollapse() {}

  drawBackLayers(ctx, cameraX) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.imageSmoothingEnabled = false;
    this.drawLayer(ctx, this.far, cameraX, 0.08);
    this.drawLayer(ctx, this.mid, cameraX, 0.18);
    this.drawLayer(ctx, this.near, cameraX, 0.32);
  }

  drawFrontLayers() {}

  drawLayer(ctx, image, cameraX, parallax) {
    if (!image?.width) return;
    // Cover the full view without squashing the skyline plates.
    const scale = Math.max(VIEW.width / image.width, VIEW.height / image.height);
    const dw = Math.ceil(image.width * scale);
    const dh = Math.ceil(image.height * scale);
    const dy = Math.round((VIEW.height - dh) / 2);
    const shift = -Math.round((((cameraX * parallax) % dw) + dw) % dw);
    for (let x = shift - dw; x < VIEW.width + dw; x += dw) {
      ctx.drawImage(image, Math.round(x), dy, dw, dh);
    }
  }
}
