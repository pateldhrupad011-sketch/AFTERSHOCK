import { createCanvas, drawGlow } from './canvas.js';

const RUN_FRAME_RATE = 10; // steps per second at normal run speed
const EYE_COLOR = [95, 205, 228]; // the cyan robot-eye pixels in the source art
// Where the right hand sits in the source sprite; the blaster pivots here.
const HAND_ANCHOR = { x: 18, y: 28 };
// Alternating walk: plant → right-leg step → plant → left-leg step.
const WALK_CYCLE = [0, 1, 0, 2];

const HURT_RIM = '#ff3a3a';

/**
 * Draws the player from the uploaded run frames, plus the handmade red hurt
 * sprites while invulnerable after taking damage.
 */
export class PlayerRenderer {
  constructor(runFrames, blasterSprite, hurtFrames = null) {
    this.frames = runFrames;
    this.hurtFrames = hurtFrames?.length ? hurtFrames : runFrames;
    this.blasterSprite = blasterSprite;
    this.frameWidth = runFrames[0].width;
    this.frameHeight = runFrames[0].height;
    this.rimCache = new Map();
    this.eyePosition = findPixel(runFrames[0], EYE_COLOR) ?? { x: 7, y: 7 };
    this.trail = [];
  }

  frameSet(hurt) {
    return hurt ? this.hurtFrames : this.frames;
  }

  /** Solid silhouette of a frame, grown by 1px, in the given colour. */
  getRim(frameIndex, color, hurt = false) {
    const key = `${hurt ? 'h' : 'n'}|${frameIndex}|${color}`;
    if (!this.rimCache.has(key)) {
      const frames = this.frameSet(hurt);
      const frame = frames[frameIndex % frames.length];
      const { canvas, ctx } = createCanvas(frame.width + 2, frame.height + 2);
      for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(frame, dx, dy);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.rimCache.set(key, canvas);
    }
    return this.rimCache.get(key);
  }

  /**
   * Draws a frame with its feet at (feetX, feetY). `pose` controls lean,
   * squash and scale so the same routine serves gameplay and the menu.
   */
  drawFrame(ctx, frameIndex, feetX, feetY, {
    scale = 1,
    lean = 0,
    squash = 0,
    rimColor = '#3ef4ff',
    alpha = 1,
    rimOnly = false,
    facing = 1,
    hurt = false,
  } = {}) {
    const frames = this.frameSet(hurt);
    const frame = frames[frameIndex % frames.length];
    const width = frame.width * scale;
    const height = frame.height * scale;
    const rimColorFinal = hurt ? HURT_RIM : rimColor;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(feetX), Math.round(feetY));
    ctx.rotate(lean);
    ctx.scale(facing * (1 + squash * 0.12), 1 - squash * 0.12);
    const rim = this.getRim(frameIndex % frames.length, rimColorFinal, hurt);
    ctx.drawImage(rim, Math.round(-width / 2 - scale), Math.round(-height - scale), rim.width * scale, rim.height * scale);
    if (!rimOnly) ctx.drawImage(frame, Math.round(-width / 2), Math.round(-height), width, height);
    ctx.restore();
  }

  draw(ctx, world, camX, camY, { rimColor, time }) {
    const player = world.player;
    const feetX = player.centerX - camX;
    const feetY = player.bottom - camY;

    if (world.state === 'dying') {
      this.drawDeathTumble(ctx, feetX, feetY, world.stateTimer);
      return;
    }
    if (!player.isAlive) return;

    this.updateTrail(player, world.time);
    this.drawTrail(ctx, camX, camY);

    const hurt = player.isInvulnerable;
    const isRunning = player.grounded && Math.abs(player.vx) > 8;
    const frameIndex = isRunning
      ? WALK_CYCLE[Math.floor(player.runCycleTime * RUN_FRAME_RATE) % WALK_CYCLE.length]
      : 0;

    const bob = isRunning && frameIndex !== 0 ? -1 : 0;
    const lean = isRunning
      ? 0.07 * player.facing
      : player.vy < 0
        ? 0.12 * player.facing
        : 0.03 * player.facing;
    const facing = player.facing < 0 ? -1 : 1;

    this.drawFrame(ctx, frameIndex, feetX, feetY + bob, {
      lean,
      squash: player.landingSquash,
      rimColor,
      facing,
      hurt,
      alpha: hurt && Math.floor(time * 16) % 2 === 0 ? 0.85 : 1,
    });

    if (!hurt) {
      const eye = this.eyeScreenPosition(feetX, feetY + bob, facing);
      drawGlow(ctx, eye.x, eye.y, 6, '#5ef7ff', 0.55 + Math.sin(time * 6) * 0.15);
    }

    if (player.hasBlaster) this.drawBlaster(ctx, player, feetX, feetY + bob, facing);
  }

  eyeScreenPosition(feetX, feetY, facing = 1) {
    const localX = facing < 0
      ? this.frameWidth / 2 - this.eyePosition.x - 0.5
      : -this.frameWidth / 2 + this.eyePosition.x + 0.5;
    return {
      x: feetX + localX,
      y: feetY - this.frameHeight + this.eyePosition.y + 0.5,
    };
  }

  drawBlaster(ctx, player, feetX, feetY, facing = 1) {
    const handLocalX = facing < 0
      ? this.frameWidth / 2 - HAND_ANCHOR.x
      : -this.frameWidth / 2 + HAND_ANCHOR.x;
    const handX = Math.round(feetX + handLocalX);
    const handY = Math.round(feetY - this.frameHeight + HAND_ANCHOR.y);
    const aimingBackward = Math.cos(player.aimAngle) < 0;
    const recoil = player.shootPoseTimer > 0.12 ? -2 : 0;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(player.aimAngle);
    if (aimingBackward) ctx.scale(1, -1);
    ctx.drawImage(this.blasterSprite, -3 + recoil, -3);
    ctx.restore();

    if (player.shootPoseTimer > 0.1) {
      const muzzleX = handX + Math.cos(player.aimAngle) * 13;
      const muzzleY = handY + Math.sin(player.aimAngle) * 13;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(muzzleX) - 1, Math.round(muzzleY) - 1, 3, 3);
      drawGlow(ctx, muzzleX, muzzleY, 12, '#5ef7ff', 0.9);
    }
  }

  updateTrail(player, time) {
    if (player.isLaunched) {
      if (!this.lastTrailTime || time - this.lastTrailTime > 0.035) {
        this.trail.push({ x: player.centerX, y: player.bottom, age: 0 });
        this.lastTrailTime = time;
      }
    }
    for (const ghost of this.trail) ghost.age += 1 / 60;
    this.trail = this.trail.filter((ghost) => ghost.age < 0.25).slice(-6);
  }

  drawTrail(ctx, camX, camY) {
    for (const ghost of this.trail) {
      const alpha = 0.45 * (1 - ghost.age / 0.25);
      this.drawFrame(ctx, 1, ghost.x - camX, ghost.y - camY, {
        rimColor: '#3ef4ff',
        alpha,
        rimOnly: true,
        lean: 0.12,
      });
    }
  }

  drawDeathTumble(ctx, feetX, feetY, elapsed) {
    const t = Math.min(elapsed, 1.4);
    const x = feetX - t * 40;
    const y = feetY - 120 * t + 260 * t * t;
    ctx.save();
    ctx.translate(x, y - this.frameHeight / 2);
    ctx.rotate(-t * 7);
    this.drawFrame(ctx, 0, 0, this.frameHeight / 2, {
      hurt: true,
      alpha: Math.max(0, 1 - t / 1.4),
    });
    ctx.restore();
  }
}

function findPixel(image, [r, g, b]) {
  const { canvas, ctx } = createCanvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - r) < 12 && Math.abs(data[i + 1] - g) < 12 && Math.abs(data[i + 2] - b) < 12) {
      const index = i / 4;
      sumX += index % canvas.width;
      sumY += Math.floor(index / canvas.width);
      count += 1;
    }
  }
  return count ? { x: sumX / count, y: sumY / count } : null;
}
