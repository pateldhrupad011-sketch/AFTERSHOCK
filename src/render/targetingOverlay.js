import { VIEW } from '../config.js';
import { drawGlow, withAlpha } from './canvas.js';

/**
 * Screen-space aiming UI: the system cursor stays visible; we draw a crosshair
 * under it, a laser guide from the blaster muzzle (stronger in drone slow-mo),
 * lock-on brackets, and swarm indicators.
 */
export function drawTargetingOverlay(ctx, world, mouse, time) {
  const camX = world.camera.x;
  const camY = world.camera.y;
  const inSwarm = Boolean(world.activeEncounter);

  if (inSwarm) drawSwarmIndicators(ctx, world, camX, camY, time);

  if (!world.player.hasBlaster || !mouse.isOverStage || !world.player.isAlive) return;

  const target = world.lockedTarget;
  const aimX = target ? target.x - camX : mouse.x;
  const aimY = target ? target.y - camY : mouse.y;

  drawAimGuide(ctx, world, camX, camY, aimX, aimY, inSwarm, time);

  if (target) {
    const tx = Math.round(target.x - camX);
    const ty = Math.round(target.y - camY);
    const size = 9 + Math.round(Math.sin(time * 12));
    ctx.fillStyle = '#ff3d6b';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cornerX = tx + sx * size;
      const cornerY = ty + sy * size;
      ctx.fillRect(cornerX - (sx > 0 ? 3 : 0), cornerY, 4, 1);
      ctx.fillRect(cornerX, cornerY - (sy > 0 ? 3 : 0), 1, 4);
    }
    ctx.font = '8px Silkscreen';
    ctx.fillText('LOCK', tx + size + 3, ty - size);
  }

  const mx = Math.round(mouse.x);
  const my = Math.round(mouse.y);
  const color = target ? '#ff3d6b' : '#5ef7ff';
  ctx.fillStyle = '#000000';
  ctx.fillRect(mx - 7, my, 4, 1);
  ctx.fillStyle = color;
  ctx.fillRect(mx - 7, my - 1, 4, 1);
  ctx.fillRect(mx + 4, my - 1, 4, 1);
  ctx.fillRect(mx - 1, my - 8, 1, 4);
  ctx.fillRect(mx - 1, my + 3, 1, 4);
  ctx.fillRect(mx - 1, my - 1, 1, 1);
  const charge = world.player.blasterCharge;
  for (let i = 0; i < charge; i++) ctx.fillRect(mx - 6 + i * 2, my + 9, 1, 1);
}

/** Dashed laser from the blaster muzzle to the aim point so shots are readable. */
function drawAimGuide(ctx, world, camX, camY, aimX, aimY, inSwarm, time) {
  const muzzle = world.player.muzzle;
  const mx = muzzle.x - camX;
  const my = muzzle.y - camY;
  const color = world.lockedTarget ? '#ff3d6b' : '#5ef7ff';
  const alpha = inSwarm ? 0.95 : 0.45;

  ctx.save();
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = inSwarm ? 1.5 : 1;
  ctx.setLineDash(inSwarm ? [5, 4] : [3, 5]);
  ctx.lineDashOffset = -time * (inSwarm ? 40 : 18);
  ctx.beginPath();
  ctx.moveTo(Math.round(mx), Math.round(my));
  ctx.lineTo(Math.round(aimX), Math.round(aimY));
  ctx.stroke();
  ctx.setLineDash([]);

  if (inSwarm) {
    // Bright tip at the muzzle so the guide clearly "comes from the gun".
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);
    drawGlow(ctx, mx, my, 10, color, 0.55);
    drawGlow(ctx, aimX, aimY, 8, color, 0.35);
  }
  ctx.restore();
}

function drawSwarmIndicators(ctx, world, camX, camY, time) {
  for (const drone of world.activeEncounter.drones) {
    if (!drone.isTargetable) continue;
    const dx = drone.centerX - camX;
    const dy = drone.centerY - camY;

    if (drone.lockOnProgress > 0) {
      const player = world.player;
      const px = player.centerX - camX;
      const py = player.centerY - camY;
      const alpha = 0.3 + drone.lockOnProgress * 0.7;
      ctx.strokeStyle = withAlpha('#ff2a4a', alpha);
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.moveTo(Math.round(dx), Math.round(dy));
      ctx.lineTo(Math.round(px), Math.round(py));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const isOffScreen = dx < 4 || dx > VIEW.width - 4 || dy < 4 || dy > VIEW.height - 4;
    if (isOffScreen) {
      const ax = Math.max(10, Math.min(VIEW.width - 10, dx));
      const ay = Math.max(10, Math.min(VIEW.height - 10, dy));
      const angle = Math.atan2(dy - ay, dx - ax);
      ctx.save();
      ctx.translate(Math.round(ax), Math.round(ay));
      ctx.rotate(angle);
      ctx.fillStyle = Math.floor(time * 8) % 2 ? '#ff2a4a' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const radius = 11 + Math.sin(time * 8 + drone.slotX) * 2;
      ctx.strokeStyle = withAlpha('#ff2a6a', 0.7);
      ctx.beginPath();
      ctx.arc(Math.round(dx), Math.round(dy), radius, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, dx, dy, 18, '#ff2a6a', 0.2);
    }
  }
}
