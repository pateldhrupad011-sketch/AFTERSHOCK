import { BOUNCE_PAD, PHYSICS, VIEW } from '../config.js';
import { drawBuilding25D, createFacadeTiles } from './buildings.js';
import { drawGlow, mixColors, withAlpha } from './canvas.js';

const isOnScreen = (screenX, width, margin = 60) => screenX + width > -margin && screenX < VIEW.width + margin;

/** Draw the handmade jump-pad sprite frames (purple base + flickering cyan energy). */
function drawJumpPad(ctx, frames, x, y, width, compression, time) {
  const list = frames?.length ? frames : null;
  if (!list) return;
  const frame = list[Math.floor(time * 12) % list.length];
  const squash = Math.round(compression * 3);
  // Art is ~114×100; scale up so the flame reads at gameplay size.
  const drawW = width + 20;
  const boost = 1 + compression * 0.35;
  const drawH = Math.round(drawW * (frame.height / frame.width) * boost);
  const dx = Math.round(x + width / 2 - drawW / 2);
  const dy = Math.round(y - drawH + 2 + squash);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, dx, dy, drawW, drawH);
  // Reinforce the purple slab so it stays readable on dark rooftops.
  const baseH = Math.max(3, Math.round(drawH * 0.1));
  ctx.fillStyle = '#3a0050';
  ctx.fillRect(dx + 1, y - baseH + squash, drawW - 2, baseH);
}

/**
 * Draws the playable environment: rooftops, girders, roof props, bounce
 * pads, checkpoints, the finish gate and rooftop hazards.
 */
export class EnvironmentRenderer {
  constructor(theme, seed, jumpPadFrames = null) {
    this.theme = theme;
    this.jumpPadFrames = jumpPadFrames;
    this.facadeTiles = createFacadeTiles(theme, seed, 0);
    this.sideColor = mixColors(theme.facade.shade, '#000000', 0.3);
    this.crateColor = mixColors(theme.roofTop, '#000000', 0.2);
  }

  drawPlatforms(ctx, world, camX, camY, time) {
    for (const platform of world.platforms) {
      if (!platform.isActive) continue;
      const screenX = platform.x - camX;
      if (!isOnScreen(screenX, platform.width)) continue;
      const screenY = platform.y - camY;
      if (platform.kind === 'building' || platform.kind === 'collapsing') this.drawRooftop(ctx, platform, screenX, screenY, time);
      else if (platform.kind === 'crate') this.drawCrate(ctx, platform, screenX, screenY);
      else if (platform.kind === 'rubble') this.drawRubble(ctx, platform, screenX, screenY);
      else this.drawGirder(ctx, platform, screenX, screenY, time);
    }
  }

  drawRooftop(ctx, platform, screenX, screenY, time) {
    ctx.save();
    if (platform.kind === 'collapsing') {
      const crack = platform.crackProgress;
      if (platform.state === 'cracking') ctx.translate(Math.round(Math.sin(time * 70) * crack * 2), 0);
      if (platform.state === 'falling') {
        const tilt = Math.min(0.12, (platform.y - platform.originY) / 900);
        ctx.translate(screenX + platform.width / 2, screenY);
        ctx.rotate(tilt);
        ctx.translate(-(screenX + platform.width / 2), -screenY);
      }
    }
    drawBuilding25D(ctx, { x: screenX, y: screenY, width: platform.width }, {
      facadeTile: this.facadeTiles[platform.style % this.facadeTiles.length],
      roofColor: this.theme.roofTop,
      sideColor: this.sideColor,
      trimColor: this.theme.accent,
      depth: 0.09,
    });
    // Bright walkable lip so roofs stay readable on the dark handmade skyline.
    const rx = Math.round(screenX);
    const ry = Math.round(screenY);
    ctx.fillStyle = mixColors(this.theme.roofTop, '#ffffff', 0.28);
    ctx.fillRect(rx, ry, Math.round(platform.width), 3);
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(rx, ry, Math.round(platform.width), 1);
    if (platform.kind === 'collapsing') this.drawCollapseMarkings(ctx, platform, screenX, screenY, time);
    ctx.restore();
  }

  /** Hazard stripes and cracks so players learn "this roof will fall". */
  drawCollapseMarkings(ctx, platform, screenX, screenY, time) {
    const warningBlink = platform.state === 'cracking' && Math.floor(time * 12) % 2 === 0;
    for (let x = 0; x < platform.width; x += 10) {
      ctx.fillStyle = (x / 10) % 2 === 0 ? (warningBlink ? '#ffffff' : '#ffb03b') : '#1a1208';
      ctx.fillRect(Math.round(screenX + x), Math.round(screenY + 3), 10, 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const startX = screenX + platform.width * (0.2 + i * 0.3);
      ctx.moveTo(Math.round(startX), Math.round(screenY + 6));
      ctx.lineTo(Math.round(startX + 6), Math.round(screenY + 20));
      ctx.lineTo(Math.round(startX + 2), Math.round(screenY + 34));
    }
    ctx.stroke();
  }

  drawCrate(ctx, platform, screenX, screenY) {
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    // An AC unit / cargo block with a little 2.5D top face.
    ctx.fillStyle = mixColors(this.theme.roofTop, '#ffffff', 0.12);
    ctx.fillRect(x + 2, y - 3, platform.width, 3);
    ctx.fillStyle = this.crateColor;
    ctx.fillRect(x, y, platform.width, platform.height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let gy = y + 4; gy < y + platform.height - 2; gy += 3) ctx.fillRect(x + 3, gy, platform.width - 6, 1);
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(x, y, platform.width, 1);
    ctx.fillStyle = '#ffb03b';
    ctx.fillRect(x + platform.width - 5, y + 3, 2, 2);
  }

  drawRubble(ctx, platform, screenX, screenY) {
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    ctx.fillStyle = '#3a3440';
    ctx.fillRect(x + 2, y + 3, platform.width - 4, platform.height - 3);
    ctx.fillRect(x + 5, y, 8, 4);
    ctx.fillStyle = '#5a5262';
    ctx.fillRect(x + 4, y + 3, 6, 2);
    ctx.fillRect(x + platform.width - 8, y + 5, 5, 2);
    ctx.fillStyle = '#8a6a5a';
    ctx.fillRect(x + platform.width - 4, y - 2, 1, 6);
  }

  drawGirder(ctx, platform, screenX, screenY, time) {
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    const width = Math.round(platform.width);
    // Cables up to the top of the screen show that movers are suspended.
    if (platform.kind === 'mover') {
      ctx.fillStyle = 'rgba(160,170,200,0.35)';
      ctx.fillRect(x + 6, 0, 1, y);
      ctx.fillRect(x + width - 7, 0, 1, y);
    }
    ctx.fillStyle = mixColors(this.theme.roofTop, '#ffffff', 0.15);
    ctx.fillRect(x + 2, y - 2, width, 2);
    ctx.fillStyle = '#2a2a36';
    ctx.fillRect(x, y, width, 8);
    ctx.fillStyle = '#4a4a5c';
    for (let gx = x + 2; gx < x + width - 4; gx += 8) {
      ctx.fillRect(gx, y + 2, 1, 5);
      ctx.fillRect(gx + 1, y + 4, 4, 1);
    }
    for (let gx = 0; gx < width; gx += 8) {
      ctx.fillStyle = (gx / 8) % 2 === 0 ? '#ffb03b' : '#14121c';
      ctx.fillRect(x + gx, y, 8, 2);
    }
    const lightOn = Math.sin(time * 6 + platform.x) > 0;
    ctx.fillStyle = lightOn ? this.theme.accent : '#1a1a24';
    ctx.fillRect(x + 1, y + 8, 2, 1);
    ctx.fillRect(x + width - 3, y + 8, 2, 1);
    if (lightOn) {
      drawGlow(ctx, x + 2, y + 9, 6, this.theme.accent, 0.6);
      drawGlow(ctx, x + width - 2, y + 9, 6, this.theme.accent, 0.6);
    }
  }

  drawRoofProps(ctx, decorations, camX, camY, time) {
    const dark = mixColors(this.theme.facade.shade, '#000000', 0.2);
    const mid = mixColors(this.theme.roofTop, '#000000', 0.15);
    for (const prop of decorations) {
      const x = Math.round(prop.x - camX);
      if (x < -60 || x > VIEW.width + 60) continue;
      // Props stand slightly back on the roof surface, behind the action.
      const y = Math.round(prop.y - camY - 4);
      ctx.fillStyle = dark;
      switch (prop.type) {
        case 'acUnit':
          ctx.fillStyle = mid;
          ctx.fillRect(x, y - 10, 20, 10);
          ctx.fillStyle = dark;
          ctx.fillRect(x + 3, y - 8, 8, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(x + 4 + Math.floor(time * 20) % 6, y - 8, 1, 6);
          break;
        case 'antenna':
          ctx.fillRect(x, y - 30, 1, 30);
          ctx.fillRect(x - 3, y - 22, 7, 1);
          ctx.fillRect(x - 2, y - 15, 5, 1);
          if (Math.sin(time * 3 + x) > 0.3) {
            ctx.fillStyle = '#ff3a4a';
            ctx.fillRect(x, y - 31, 1, 1);
            drawGlow(ctx, x, y - 31, 5, '#ff3a4a', 0.7);
          }
          break;
        case 'waterTank':
          ctx.fillRect(x + 1, y - 6, 1, 6);
          ctx.fillRect(x + 12, y - 6, 1, 6);
          ctx.fillStyle = mid;
          ctx.fillRect(x, y - 22, 14, 16);
          ctx.fillRect(x + 2, y - 25, 10, 3);
          ctx.fillStyle = dark;
          ctx.fillRect(x, y - 16, 14, 1);
          break;
        case 'vent':
          ctx.fillStyle = mid;
          ctx.fillRect(x, y - 10, 6, 10);
          ctx.fillRect(x - 1, y - 12, 8, 2);
          ctx.fillStyle = 'rgba(200,200,220,0.12)';
          ctx.fillRect(x + 1 + Math.round(Math.sin(time * 2 + x) * 2), y - 20, 4, 6);
          break;
        case 'satellite':
          ctx.fillRect(x + 4, y - 8, 1, 8);
          ctx.fillStyle = mid;
          ctx.beginPath();
          ctx.arc(x + 4, y - 12, 6, Math.PI * 0.8, Math.PI * 1.9);
          ctx.fill();
          break;
        default:
          break;
      }
    }
  }

  drawBouncePads(ctx, world, camX, camY, time) {
    for (const pad of world.pads) {
      const x = Math.round(pad.x - camX);
      if (!isOnScreen(x, pad.width)) continue;
      const y = Math.round(pad.y - camY);
      drawJumpPad(ctx, this.jumpPadFrames, x, y, pad.width, pad.compression, time);

      const distanceAhead = pad.x - world.player.x;
      if (distanceAhead > 0 && distanceAhead < 320) {
        this.drawTrajectoryPreview(ctx, pad, x, y, world.player.runSpeed, 1 - distanceAhead / 320, time);
      }
    }
  }

  /** Dotted hologram of the launch arc so players see where a pad will take them. */
  drawTrajectoryPreview(ctx, pad, screenX, screenY, runSpeed, strength, time) {
    const speedX = runSpeed * BOUNCE_PAD.airSpeedMultiplier;
    let vy = -BOUNCE_PAD.launchVelocity;
    let px = screenX + pad.width / 2;
    let py = screenY;
    const step = 1 / 30;
    for (let i = 0; i < 40; i++) {
      const gravity = PHYSICS.gravity * (vy > 0 ? PHYSICS.fallGravityMultiplier : 1);
      vy += gravity * step;
      px += speedX * step;
      py += vy * step;
      if ((i + Math.floor(time * 12)) % 3 !== 0) continue;
      ctx.fillStyle = withAlpha('#5fcde4', 0.55 * strength * (1 - i / 40));
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
  }

  drawCheckpoints(ctx, world, camX, camY, time) {
    for (const checkpoint of world.checkpoints) {
      const x = Math.round(checkpoint.x - camX);
      if (!isOnScreen(x, 10)) continue;
      const y = Math.round(checkpoint.y - camY);
      const color = checkpoint.isReached ? '#5cff9d' : '#3ef4ff';
      ctx.fillStyle = '#2a2a36';
      ctx.fillRect(x - 2, y - 4, 5, 4);
      ctx.fillStyle = '#5a5a6e';
      ctx.fillRect(x, y - 34, 1, 30);
      const wave = Math.round(Math.sin(time * 6) * 1);
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y - 34 + wave, 9, 5);
      ctx.fillRect(x + 1, y - 34, 1, 7);
      drawGlow(ctx, x + 5, y - 31, 14, color, 0.6);
    }
  }

  drawFinishGate(ctx, world, camX, camY, time) {
    const gate = world.finishGate;
    if (!gate) return;
    const x = Math.round(gate.x - camX);
    if (!isOnScreen(x, 60, 100)) return;
    const y = Math.round(gate.y - camY);
    const color = this.theme.accent;
    for (const side of [-24, 24]) {
      ctx.fillStyle = '#1e1c2a';
      ctx.fillRect(x + side - 2, y - 70, 5, 70);
      ctx.fillStyle = color;
      ctx.fillRect(x + side, y - 68, 1, 66);
    }
    ctx.globalAlpha = 0.25 + Math.sin(time * 4) * 0.1;
    ctx.fillStyle = color;
    ctx.fillRect(x - 22, y - 66, 45, 66);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const lineY = y - ((time * 50 + i * 11) % 66);
      ctx.fillStyle = withAlpha('#ffffff', 0.5);
      ctx.fillRect(x - 22, Math.round(lineY), 45, 1);
    }
    ctx.font = '8px Silkscreen';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('EXIT', x - 9, y - 82);
    drawGlow(ctx, x, y - 34, 60, color, 0.5);
  }
}
