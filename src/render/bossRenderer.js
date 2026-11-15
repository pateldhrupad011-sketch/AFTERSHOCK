import { VIEW } from '../config.js';
import { drawGlow, withAlpha } from './canvas.js';

const SEAM = '#ff1a4a';

/** Drawn size of the handmade boss orb (source sprite is 67×73). */
const SPRITE_W = 140;
const SPRITE_H = 152;

/**
 * Draws THE ARCHITECT from the player's boss sprite, plus attack telegraphs.
 */
export class BossRenderer {
  constructor(sprite = null) {
    this.sprite = sprite;
  }

  draw(ctx, boss, camX, camY, time) {
    if (!boss || boss.state === 'destroyed' || boss.state === 'dormant') return;
    if (!this.sprite) return;

    const x = Math.round(boss.x - camX);
    const y = Math.round(boss.y - camY);
    const revealAlpha = boss.state === 'reveal' ? Math.min(1, boss.stateTimer / 2.4) : 1;
    const dyingShake = boss.state === 'dying' ? Math.round(Math.sin(time * 90) * 3) : 0;
    const open = boss.coreOpenAmount;
    const pulse = 1 + Math.sin(time * (boss.isPhaseTwo ? 12 : 6)) * (0.03 + open * 0.04);
    const drawW = Math.round(SPRITE_W * pulse);
    const drawH = Math.round(SPRITE_H * pulse);
    const dx = Math.round((boss.width - drawW) / 2);
    const dy = Math.round((boss.height - drawH) / 2) - 4;

    ctx.save();
    ctx.translate(x + dyingShake, y);
    ctx.globalAlpha = revealAlpha;
    ctx.imageSmoothingEnabled = false;

    // Soft red aura — stronger when the core is open or phase two hits.
    drawGlow(ctx, boss.width / 2, boss.height / 2 + 8, 40 + open * 28, SEAM, 0.2 + open * 0.45 + (boss.isPhaseTwo ? 0.15 : 0));

    ctx.drawImage(this.sprite, dx, dy, drawW, drawH);

    // When the core is exposed, brighten the eye with hard red pixels.
    if (open > 0.15) {
      const eyeX = Math.round(boss.width / 2);
      const eyeY = Math.round(dy + drawH * 0.58);
      ctx.globalAlpha = revealAlpha * (0.35 + open * 0.65);
      ctx.fillStyle = '#ff2a4a';
      ctx.fillRect(eyeX - 2, eyeY - 6, 4, 12);
      ctx.fillStyle = '#ffd0d8';
      ctx.fillRect(eyeX - 1, eyeY - 4, 2, 3);
      drawGlow(ctx, eyeX, eyeY, 10 + open * 16, SEAM, 0.5 + open * 0.5);
    }

    // Charge flicker while winding up an attack.
    if (boss.attackPhase === 'windup' && boss.currentAttack !== 'expose' && Math.floor(time * 16) % 2 === 0) {
      ctx.globalAlpha = revealAlpha * 0.55;
      ctx.fillStyle = SEAM;
      ctx.fillRect(dx + 8, dy + Math.round(drawH * 0.45), 3, 3);
      ctx.fillRect(dx + drawW - 11, dy + Math.round(drawH * 0.45), 3, 3);
    }

    if (boss.hitFlash > 0) {
      ctx.globalAlpha = boss.hitFlash * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, drawW, drawH);
    }

    // Phase-two / dying glitch slices across the orb.
    if (boss.isPhaseTwo || boss.hitFlash > 0.6 || boss.state === 'dying') {
      ctx.globalAlpha = revealAlpha;
      this.glitchSlices(ctx, dx, dy, drawW, drawH, boss);
    }

    ctx.restore();
  }

  glitchSlices(ctx, dx, dy, drawW, drawH, boss) {
    const slices = boss.state === 'dying' ? 5 : 2;
    for (let i = 0; i < slices; i++) {
      if (Math.random() > 0.4) continue;
      const sliceY = dy + 8 + Math.floor(Math.random() * (drawH - 16));
      const sliceHeight = 2 + Math.floor(Math.random() * 4);
      const offset = Math.round((Math.random() - 0.5) * 12);
      try {
        ctx.drawImage(
          ctx.canvas,
          dx, sliceY, drawW, sliceHeight,
          dx + offset, sliceY, drawW, sliceHeight,
        );
      } catch {
        // Ignore if the canvas isn't readable mid-frame.
      }
    }
  }

  /** Telegraphs and active boss attacks. */
  drawAttacks(ctx, world, camX, camY, time) {
    for (const hazard of world.hazards) {
      if (hazard.kind === 'floorWarning') this.drawFloorWarning(ctx, hazard, world, camY, time);
      else if (hazard.kind === 'shockwave') this.drawShockwave(ctx, hazard, camX, camY, time);
      else if (hazard.kind === 'scanBeam') this.drawScanBeam(ctx, hazard, camY, time);
    }
  }

  drawFloorWarning(ctx, warning, world, camY, time) {
    const floorY = Math.round(warning.floorY - camY);
    const progress = warning.timer / warning.duration;
    for (let i = 0; i < 10; i++) {
      const x = Math.round(440 - ((time * 160 + i * 30) % 300));
      ctx.fillStyle = withAlpha(SEAM, 0.4 + progress * 0.6);
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(x + k, floorY - 8 - k, 2, 1);
        ctx.fillRect(x + k, floorY - 8 + k, 2, 1);
      }
    }
    if (Math.floor(time * 8) % 2 === 0) {
      ctx.font = '8px Silkscreen';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('JUMP!', Math.round(world.player.centerX - world.camera.x), floorY - 60);
      ctx.textAlign = 'left';
    }
  }

  drawShockwave(ctx, wave, camX, camY) {
    const x = Math.round(wave.x - camX);
    const floorY = Math.round(wave.floorY - camY);
    for (let i = 0; i < wave.height; i++) {
      const width = Math.round(wave.width * (1 - i / wave.height) * (0.8 + Math.random() * 0.4));
      ctx.fillStyle = i < 4 ? '#ffffff' : i < 10 ? '#ff7a9a' : SEAM;
      ctx.fillRect(x + Math.round((wave.width - width) / 2), floorY - i, width, 1);
    }
    drawGlow(ctx, x + wave.width / 2, floorY - 10, 36, SEAM, 0.9);
  }

  drawScanBeam(ctx, beam, camY, time) {
    const y = Math.round(beam.beamY - camY);
    if (!beam.isFiring) {
      const blink = Math.floor(time * 10) % 2 === 0;
      ctx.fillStyle = withAlpha(SEAM, blink ? 0.9 : 0.4);
      for (let x = 0; x < VIEW.width; x += 8) ctx.fillRect(x, y, 4, 1);
      if (blink) {
        ctx.font = '8px Silkscreen';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('! STAY LOW !', 210, y - 6);
      }
      return;
    }
    const flicker = 0.85 + Math.random() * 0.15;
    ctx.fillStyle = withAlpha(SEAM, flicker);
    ctx.fillRect(0, y - 4, VIEW.width, 8);
    ctx.fillStyle = '#ffd0da';
    ctx.fillRect(0, y - 1, VIEW.width, 2);
    for (let x = 0; x < VIEW.width; x += 80) drawGlow(ctx, x + ((time * 400) % 80), y, 40, SEAM, 0.6);
  }
}
