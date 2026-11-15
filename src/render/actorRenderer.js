import { VIEW } from '../config.js';
import { drawGlow, withAlpha } from './canvas.js';

const onScreen = (x, margin = 40) => x > -margin && x < VIEW.width + margin;

/**
 * Draws everything that moves or interacts: hazards, pickups, robots,
 * drones, the Hunter gunship, projectiles, particles and score popups.
 */
export class ActorRenderer {
  constructor(sprites, theme) {
    this.sprites = sprites;
    this.theme = theme;
  }

  drawHazards(ctx, world, camX, camY, time) {
    for (const hazard of world.hazards) {
      switch (hazard.kind) {
        case 'shockStrip': this.drawShockStrip(ctx, hazard, camX, camY); break;
        case 'steamVent': this.drawSteamVent(ctx, hazard, camX, camY, time); break;
        case 'laser': this.drawLaser(ctx, hazard, camX, camY, time); break;
        case 'debris': this.drawDebris(ctx, hazard, camX, camY, time); break;
        case 'triangleRubble': this.drawTriangleRubble(ctx, hazard, camX, camY, time); break;
        default: break; // Boss attacks are drawn by BossRenderer.
      }
    }
  }

  drawShockStrip(ctx, strip, camX, camY) {
    const x = Math.round(strip.x - camX);
    if (!onScreen(x, strip.width + 20)) return;
    const y = Math.round(strip.y - camY);
    ctx.fillStyle = '#20202c';
    ctx.fillRect(x, y + 3, strip.width, 2);
    ctx.fillStyle = '#ffb03b';
    ctx.fillRect(x, y + 4, 2, 1);
    ctx.fillRect(x + strip.width - 2, y + 4, 2, 1);
    // Jagged arcs re-randomised every frame read as live current.
    ctx.fillStyle = '#d8fbff';
    let arcY = y + 2;
    for (let px = x + 1; px < x + strip.width - 1; px++) {
      arcY = Math.max(y - 3, Math.min(y + 3, arcY + Math.round(Math.random() * 2 - 1)));
      ctx.fillRect(px, arcY, 1, 1);
    }
    drawGlow(ctx, x + strip.width / 2, y + 1, strip.width * 0.55, '#5ef7ff', 0.35 + Math.random() * 0.15);
  }

  drawSteamVent(ctx, vent, camX, camY, time) {
    const x = Math.round(vent.x - camX);
    if (!onScreen(x)) return;
    const y = Math.round(vent.roofY - camY);
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(x - 1, y - 4, vent.width + 2, 4);
    ctx.fillStyle = '#0c0a10';
    for (let gx = x + 1; gx < x + vent.width; gx += 3) ctx.fillRect(gx, y - 3, 1, 3);

    if (vent.isWarning) {
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(x - 1, y - 5, vent.width + 2, 1);
      drawGlow(ctx, x + vent.width / 2, y - 3, 12, '#ff8a2a', 0.45);
      if (Math.random() < 0.5) {
        ctx.fillStyle = 'rgba(230,230,240,0.5)';
        ctx.fillRect(x + Math.random() * vent.width, y - 6 - Math.random() * 10, 2, 2);
      }
    }
    if (vent.isErupting) {
      for (let i = 0; i < 10; i++) {
        const t = (time * 2.5 + i / 10) % 1;
        const size = 1 + Math.floor(t * 3);
        ctx.fillStyle = `rgba(220,220,230,${0.7 * (1 - t * 0.7)})`;
        ctx.fillRect(
          Math.round(x + vent.width / 2 + Math.sin(i * 1.7 + time * 6) * 2) - size,
          Math.round(y - t * vent.columnHeight) - size,
          size * 2,
          size * 2,
        );
      }
      drawGlow(ctx, x + vent.width / 2, y - 30, 22, '#ffb877', 0.18);
    }
  }

  drawLaser(ctx, laser, camX, camY, time) {
    const x = Math.round(laser.x - camX);
    if (!onScreen(x, laser.width + 20)) return;
    const roofY = Math.round(laser.roofY - camY);
    const beamY = Math.round(laser.beamY - camY);
    for (const px of [x - 3, x + laser.width]) {
      ctx.fillStyle = '#26202e';
      ctx.fillRect(px, beamY - 4, 4, roofY - beamY + 4);
      ctx.fillStyle = laser.isOn ? '#ff2a4a' : '#5a2030';
      ctx.fillRect(px + 1, beamY - 1, 2, 3);
    }
    if (laser.isOn) {
      ctx.fillStyle = '#ff2a4a';
      ctx.fillRect(x + 1, beamY - 1, laser.width - 1, 3);
      ctx.fillStyle = '#ffd0da';
      ctx.fillRect(x + 1, beamY, laser.width - 1, 1);
      drawGlow(ctx, x + laser.width / 2, beamY, laser.width * 0.55, '#ff2a4a', 0.4);
    } else if (laser.isWarning && Math.floor(time * 16) % 2 === 0) {
      ctx.fillStyle = withAlpha('#ff2a4a', 0.6);
      for (let px = x + 1; px < x + laser.width; px += 4) ctx.fillRect(px, beamY, 2, 1);
    }
  }

  drawTriangleRubble(ctx, spike, camX, camY, time) {
    const x = Math.round(spike.x - camX);
    if (!onScreen(x, spike.width + 20)) return;
    const baseY = Math.round(spike.roofY - camY);
    const tipX = x + Math.round(spike.width / 2);
    const tipY = baseY - spike.height;
    const flicker = 0.75 + Math.sin(time * 14 + spike.x) * 0.25;
    ctx.fillStyle = '#1a1218';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(x + spike.width, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 42, 74, ${0.55 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(x + 2, baseY);
    ctx.lineTo(tipX, tipY + 2);
    ctx.lineTo(x + spike.width - 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a9a';
    ctx.fillRect(tipX - 1, tipY, 2, 2);
    drawGlow(ctx, tipX, tipY + 4, 12, '#ff2a4a', 0.35 * flicker);
  }

  drawDebris(ctx, debris, camX, camY, time) {
    const markerX = Math.round(debris.landX - camX);
    if (!onScreen(markerX, 60)) return;
    const roofY = Math.round(debris.roofY - camY);

    if (debris.state === 'warning' || debris.state === 'falling') {
      const blink = Math.floor(time * 10) % 2 === 0;
      ctx.fillStyle = blink ? '#ff3a3a' : '#ffb03b';
      ctx.fillRect(markerX - 10, roofY - 1, 20, 1);
      ctx.fillRect(markerX - 1, roofY - 14, 2, 8);
      ctx.fillRect(markerX - 1, roofY - 4, 2, 2);
      drawGlow(ctx, markerX, roofY - 6, 18, '#ff3a3a', 0.6);
      // Shadow grows as the chunk gets closer.
      const closeness = debris.state === 'falling' ? Math.min(1, (debris.y - (debris.roofY - 420)) / 420) : 0.1;
      ctx.fillStyle = withAlpha('#000000', 0.25 + closeness * 0.4);
      ctx.fillRect(Math.round(markerX - debris.size * closeness * 0.7), roofY - 1, Math.round(debris.size * closeness * 1.4), 2);
    }
    if (debris.state === 'falling') {
      const x = Math.round(debris.x - camX + debris.width / 2);
      const y = Math.round(debris.y - camY + debris.height / 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(debris.spin);
      ctx.fillStyle = '#4a4252';
      ctx.fillRect(-debris.width / 2, -debris.height / 2, debris.width, debris.height);
      ctx.fillStyle = '#6a6272';
      ctx.fillRect(-debris.width / 2, -debris.height / 2, debris.width, 3);
      ctx.fillStyle = '#9a6a4a';
      ctx.fillRect(-debris.width / 2 - 3, -2, 4, 1);
      ctx.fillRect(debris.width / 2 - 1, 3, 4, 1);
      ctx.restore();
    }
  }

  drawPickups(ctx, world, camX, camY, time) {
    for (const pickup of world.pickups) {
      if (pickup.isCollected) continue;
      const x = Math.round(pickup.x - camX);
      if (!onScreen(x)) continue;
      const bob = Math.round(Math.sin(time * 3 + pickup.bobPhase) * 2);
      const y = Math.round(pickup.y - camY) + bob;
      if (pickup.kind === 'shard') {
        // Flat 1px cast shadow keeps it grounded; no soft neon bloom.
        ctx.fillStyle = 'rgba(8, 18, 28, 0.45)';
        ctx.fillRect(x + 1, y + 12, 11, 2);
        ctx.drawImage(this.sprites.shard, x, y);
        if (Math.sin(time * 6 + pickup.bobPhase) > 0.65) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 4, y + 3, 1, 1);
        }
      } else if (pickup.kind === 'battery') {
        ctx.drawImage(this.sprites.battery, x, y);
        drawGlow(ctx, x + 4, y + 6, 10, '#3fe08a', 0.35);
      } else if (pickup.kind === 'blaster') {
        // Holographic display pedestal with a rotating light ring.
        const baseY = Math.round(pickup.y - camY + 22);
        ctx.fillStyle = '#26202e';
        ctx.fillRect(x - 2, baseY - 4, 20, 4);
        ctx.fillStyle = withAlpha('#5ef7ff', 0.25);
        ctx.fillRect(x, y + 8, 16, baseY - y - 12);
        ctx.drawImage(this.sprites.blaster, x + 1, y);
        const ringX = x + 8 + Math.cos(time * 4) * 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(ringX), y + 10, 1, 1);
        drawGlow(ctx, x + 8, y + 4, 18, '#5ef7ff', 0.4 + Math.sin(time * 5) * 0.1);
      }
    }
  }

  drawEnemies(ctx, world, camX, camY, time) {
    for (const enemy of world.enemies) {
      const x = Math.round(enemy.x - camX);
      if (!onScreen(x)) continue;
      const y = Math.round(enemy.y - camY);
      if (enemy.kind === 'crawler') this.drawCrawler(ctx, enemy, x, y, time);
      else this.drawSentry(ctx, enemy, x, y, time);
    }
  }

  drawCrawler(ctx, crawler, x, y, time) {
    const frames = this.sprites.crawler;
    const frame = frames[Math.floor(crawler.animationTime * 10) % 2];
    if (crawler.isDisabled) {
      this.drawWreck(ctx, frame.dark, x, y, crawler);
      return;
    }
    ctx.save();
    if (crawler.direction > 0) {
      ctx.translate(x + crawler.width, y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, y);
    }
    ctx.drawImage(crawler.hitFlash > 0.5 ? frame.flash : frame.image, 0, 0);
    ctx.restore();
    const eyeX = crawler.direction > 0 ? x + 6 : x + 11;
    drawGlow(ctx, eyeX, y + 5, 5, '#ff3355', 0.4);
  }

  drawSentry(ctx, sentry, x, y, time) {
    const sprite = this.sprites.sentry;
    if (sentry.isDisabled) {
      this.drawWreck(ctx, sprite.dark, x, y, sentry);
      return;
    }
    ctx.drawImage(sentry.hitFlash > 0.5 ? sprite.flash : sprite.image, x, y);
    // Arm cannon tracks the runner.
    ctx.save();
    ctx.translate(x + 8, y + 9);
    ctx.rotate(sentry.aimAngle);
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, -2, 12, 4);
    ctx.fillStyle = '#5a5f78';
    ctx.fillRect(1, -1, 10, 2);
    ctx.fillStyle = sentry.chargeTimer > 0 ? '#ff3355' : '#2a2c3a';
    ctx.fillRect(10, -1, 2, 2);
    ctx.restore();
    drawGlow(ctx, x + 8, y + 4, 6, '#ff3355', 0.3);
    if (sentry.chargeTimer > 0) {
      const muzzleX = x + 8 + Math.cos(sentry.aimAngle) * 12;
      const muzzleY = y + 9 + Math.sin(sentry.aimAngle) * 12;
      drawGlow(ctx, muzzleX, muzzleY, 4 + sentry.chargeProgress * 12, '#ff3355', 0.5 + sentry.chargeProgress * 0.5);
    }
  }

  /** Disabled robots topple, darken and spark: unmistakably out of action. */
  drawWreck(ctx, image, x, y, robot) {
    const tip = Math.min(1, robot.wreckTimer * 4);
    ctx.save();
    ctx.translate(x + robot.width / 2, y + robot.height);
    ctx.rotate(tip * 1.2);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, robot.wreckTimer - 2.5));
    ctx.drawImage(image, -robot.width / 2, -robot.height);
    ctx.restore();
    if (robot.wreckTimer < 2.5 && Math.random() < 0.15) {
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(x + Math.random() * robot.width, y + robot.height * 0.5 + Math.random() * 6, 1, 1);
    }
    if (robot.wreckTimer < 2.5) {
      ctx.fillStyle = 'rgba(60,54,70,0.5)';
      const smokeY = y - ((robot.wreckTimer * 30) % 18);
      ctx.fillRect(x + robot.width / 2, Math.round(smokeY), 3, 3);
    }
  }

  drawDrones(ctx, world, camX, camY, time) {
    for (const drone of world.drones) {
      const x = Math.round(drone.x - camX);
      if (!onScreen(x, 60)) continue;
      const y = Math.round(drone.y - camY);
      const set = drone.behavior === 'swarm' ? this.sprites.swarm : drone.behavior === 'diver' ? this.sprites.diver : this.sprites.drone;
      const frame = set[Math.floor(drone.animationTime * 24) % 2];
      ctx.save();
      if (drone.isDisabled) {
        ctx.translate(x + drone.width / 2, y + drone.height / 2);
        ctx.rotate(drone.animationTime * 8);
        ctx.drawImage(frame.dark, -drone.width / 2, -drone.height / 2);
        ctx.restore();
        continue;
      }
      if (drone.diveVelocity) {
        ctx.translate(x + drone.width / 2, y + drone.height / 2);
        ctx.rotate(Math.atan2(drone.diveVelocity.y, drone.diveVelocity.x) - Math.PI);
        ctx.translate(-drone.width / 2, -drone.height / 2);
        ctx.drawImage(drone.hitFlash > 0.5 ? frame.flash : frame.image, 0, 0);
      } else {
        ctx.drawImage(drone.hitFlash > 0.5 ? frame.flash : frame.image, x, y);
      }
      ctx.restore();
      const eyeColor = drone.behavior === 'diver' ? '#ff9a1a' : '#ff2a6a';
      drawGlow(ctx, x + drone.width / 2, y + 5, 7, eyeColor, 0.4);
      // Charge telegraph: dashed guide line from the under-cannon along the locked aim.
      if (drone.chargeTimer > 0) {
        const muzzleX = x + drone.width / 2;
        const muzzleY = y + drone.height - 1;
        const len = 240;
        const tipX = muzzleX + Math.cos(drone.lockedAimAngle) * len;
        const tipY = muzzleY + Math.sin(drone.lockedAimAngle) * len;
        ctx.save();
        ctx.globalAlpha = 0.3 + drone.chargeProgress * 0.55;
        ctx.strokeStyle = '#ff1a2e';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(muzzleX, muzzleY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawGlow(ctx, muzzleX, muzzleY, 4 + drone.chargeProgress * 10, '#ff1a2e', 0.4 + drone.chargeProgress * 0.6);
        ctx.fillStyle = withAlpha('#ff1a2e', 0.5 + drone.chargeProgress * 0.5);
        ctx.fillRect(muzzleX - 1, muzzleY - 1, 2, 2);
      }
      if (drone.diveVelocity) drawGlow(ctx, x + drone.width / 2, y + drone.height / 2, 16, '#ff9a1a', 0.5);
    }
  }

  drawPursuers(ctx, world, camX, camY, time) {
    for (const ship of world.pursuers) {
      const x = Math.round(ship.x - camX);
      const y = Math.round(ship.y - camY);
      // Searchlight sweeping over the runner.
      const player = world.player;
      const targetX = player.centerX - camX + Math.sin(time * 1.3) * 30;
      const targetY = player.bottom - camY;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(x + 30, y + 20, targetX, targetY);
      beam.addColorStop(0, 'rgba(255,240,200,0.22)');
      beam.addColorStop(1, 'rgba(255,240,200,0.02)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 20);
      ctx.lineTo(targetX - 30, targetY);
      ctx.lineTo(targetX + 30, targetY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#0c0a12';
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x + 14, y);
      ctx.lineTo(x + 46, y + 2);
      ctx.lineTo(x + 56, y + 14);
      ctx.lineTo(x + 44, y + 26);
      ctx.lineTo(x + 10, y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2e2a3c';
      ctx.fillRect(x + 14, y + 4, 28, 3);
      ctx.fillRect(x - 6, y + 8, 14, 2);
      ctx.fillRect(x + 4, y - 3 + Math.round(Math.sin(time * 40)), 22, 1);
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(x + 40, y + 10, 5, 3);
      drawGlow(ctx, x + 42, y + 11, 10, '#ff3355', 0.7);
      if (Math.floor(time * 3) % 2 === 0) {
        ctx.fillStyle = '#ff3355';
        ctx.fillRect(x + 2, y + 9, 1, 1);
      }
      if (ship.chargeTimer > 0) {
        const muzzle = ship.muzzle;
        drawGlow(ctx, muzzle.x - camX, muzzle.y - camY, 6 + ship.chargeProgress * 16, '#ff3355', 0.4 + ship.chargeProgress * 0.6);
      }
    }
  }

  drawProjectiles(ctx, world, camX, camY, time) {
    for (const shot of world.playerShots) {
      const x = shot.x - camX;
      const y = shot.y - camY;
      const tailX = x - Math.cos(shot.angle) * 10;
      const tailY = y - Math.sin(shot.angle) * 10;
      ctx.strokeStyle = '#5ef7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(tailX), Math.round(tailY));
      ctx.lineTo(Math.round(x), Math.round(y));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      drawGlow(ctx, x, y, 10, '#5ef7ff', 0.8);
    }
    ctx.lineWidth = 1;

    for (const bolt of world.enemyBolts) {
      const x = Math.round(bolt.x - camX);
      const y = Math.round(bolt.y - camY);
      const color = bolt.color === 'violet' ? '#c34bff' : '#ff3355';
      const pulse = 1 + Math.sin(bolt.age * 20) * 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, bolt.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      drawGlow(ctx, x, y, bolt.radius * 4, color, 0.8);
    }

    for (const laser of world.droneLasers ?? []) {
      const x = Math.round(laser.x - camX);
      const y = Math.round(laser.y - camY);
      const cos = Math.cos(laser.angle);
      const sin = Math.sin(laser.angle);
      // Neon particle bolt with a dashed energy trail (matches the laser art).
      for (let i = laser.trail.length - 1; i >= 0; i--) {
        const point = laser.trail[i];
        const px = Math.round(point.x - camX);
        const py = Math.round(point.y - camY);
        const fade = 1 - i / Math.max(1, laser.trail.length);
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = '#ff1a2e';
        const len = 2 + Math.round(fade * 3);
        ctx.fillRect(px - Math.round(cos * len), py - Math.round(sin * len), Math.max(1, len), 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff1a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(x - cos * 5), Math.round(y - sin * 5));
      ctx.lineTo(Math.round(x + cos * 4), Math.round(y + sin * 4));
      ctx.stroke();
      ctx.strokeStyle = '#ffb0b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x - cos * 2), Math.round(y - sin * 2));
      ctx.lineTo(Math.round(x + cos * 5), Math.round(y + sin * 5));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      drawGlow(ctx, x, y, 12, '#ff1a2e', 0.95);
      ctx.lineWidth = 1;
    }
  }

  drawEffects(ctx, effects, camX, camY) {
    for (const particle of effects.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      const x = Math.round(particle.x - camX);
      const y = Math.round(particle.y - camY);
      ctx.globalAlpha = particle.shape === 'puff' ? alpha * 0.6 : alpha;
      ctx.fillStyle = particle.color;
      if (particle.shape === 'puff') {
        ctx.beginPath();
        ctx.arc(x, y, particle.size * (1.6 - alpha * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, particle.size, particle.size);
      }
      if (particle.glow) drawGlow(ctx, x, y, 4 + particle.size * 2, particle.color, alpha * 0.5);
    }
    ctx.globalAlpha = 1;

    for (const ring of effects.shockRings) {
      ctx.strokeStyle = withAlpha(ring.color, ring.life / ring.maxLife);
      ctx.beginPath();
      ctx.arc(Math.round(ring.x - camX), Math.round(ring.y - camY), ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '8px Silkscreen';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const popup of effects.popups) {
      const x = Math.round(popup.x - camX);
      const y = Math.round(popup.y - camY);
      ctx.globalAlpha = Math.min(1, popup.life * 2);
      ctx.fillStyle = '#000000';
      ctx.fillText(popup.text, x + 1, y + 1);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
