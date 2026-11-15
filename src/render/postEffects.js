import { VIEW } from '../config.js';
import { createCanvas, withAlpha } from './canvas.js';

/**
 * Flat post effects — hard fills and blocky glitch, no soft vignettes.
 */
export class PostEffects {
  constructor() {
    this.scratch = createCanvas(VIEW.width, VIEW.height);
    this.small = createCanvas(VIEW.width, VIEW.height);
  }

  drawVignette(ctx, strength = 1) {
    if (strength <= 0.01) return;
    ctx.fillStyle = withAlpha('#000000', 0.35 * strength);
    ctx.fillRect(0, 0, VIEW.width, 12);
    ctx.fillRect(0, VIEW.height - 12, VIEW.width, 12);
    ctx.fillRect(0, 0, 10, VIEW.height);
    ctx.fillRect(VIEW.width - 10, 0, 10, VIEW.height);
  }

  drawSlowMotion(ctx, amount) {
    if (amount <= 0.01) return;
    ctx.fillStyle = withAlpha('#082028', 0.22 * amount);
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const barHeight = Math.round(16 * amount);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW.width, barHeight);
    ctx.fillRect(0, VIEW.height - barHeight, VIEW.width, barHeight);
  }

  drawColorFlash(ctx, color, amount) {
    if (amount <= 0.01) return;
    ctx.fillStyle = withAlpha(color, amount);
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  drawDamageFlash(ctx, amount) {
    if (amount <= 0.01) return;
    ctx.fillStyle = withAlpha('#c02840', amount * 0.35);
    ctx.fillRect(0, 0, VIEW.width, 8);
    ctx.fillRect(0, VIEW.height - 8, VIEW.width, 8);
    ctx.fillRect(0, 0, 8, VIEW.height);
    ctx.fillRect(VIEW.width - 8, 0, 8, VIEW.height);
  }

  applyGlitch(ctx, intensity) {
    if (intensity <= 0) return;
    const source = ctx.canvas;
    const { ctx: scratch } = this.scratch;
    scratch.drawImage(source, 0, 0);

    const block = Math.max(1, Math.round(1 + intensity * 10));
    if (block > 1) {
      const w = Math.ceil(VIEW.width / block);
      const h = Math.ceil(VIEW.height / block);
      this.small.ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      this.small.ctx.imageSmoothingEnabled = false;
      this.small.ctx.drawImage(this.scratch.canvas, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.small.canvas, 0, 0, w, h, 0, 0, VIEW.width, VIEW.height);
      scratch.drawImage(source, 0, 0);
    }

    const slices = Math.round(intensity * 10);
    for (let i = 0; i < slices; i++) {
      const y = Math.floor(Math.random() * VIEW.height);
      const height = 2 + Math.floor(Math.random() * 8);
      const offset = Math.round((Math.random() - 0.5) * 40 * intensity);
      ctx.drawImage(this.scratch.canvas, 0, y, VIEW.width, height, offset, y, VIEW.width, height);
    }

    for (let i = 0; i < intensity * 18; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? withAlpha('#c02840', 0.45) : withAlpha('#3aa8b8', 0.45);
      ctx.fillRect(Math.random() * VIEW.width, Math.random() * VIEW.height, 2 + Math.random() * 24, 1 + Math.random() * 2);
    }
  }
}
