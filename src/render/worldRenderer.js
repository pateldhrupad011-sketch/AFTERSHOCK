import { approach } from '../core/math.js';
import { THEMES } from '../data/themes.js';
import { ActorRenderer } from './actorRenderer.js';
import { BossRenderer } from './bossRenderer.js';
import { EnvironmentRenderer } from './environmentRenderer.js';
import { SkylineBackground } from './skylineBackground.js';
import { drawTargetingOverlay } from './targetingOverlay.js';

/**
 * Renders one World: background, environment, actors, player, effects and
 * screen-space overlays, in a fixed back-to-front order. Also reacts to
 * visual world events (flashes, background collapses).
 */
export class WorldRenderer {
  constructor(level, { sprites, playerRenderer, postEffects, skylines, jumpPadFrames, bossSprite }) {
    this.theme = THEMES[level.theme];
    this.background = new SkylineBackground(skylines);
    this.environment = new EnvironmentRenderer(this.theme, level.number * 53, jumpPadFrames);
    this.actors = new ActorRenderer(sprites, this.theme);
    this.boss = new BossRenderer(bossSprite);
    this.playerRenderer = playerRenderer;
    this.postEffects = postEffects;
    this.time = 0;
    this.slowMotionAmount = 0;
    this.damageFlash = 0;
    this.whiteFlash = 0;
  }

  handleEvent(event, world) {
    switch (event.type) {
      case 'backgroundCollapse':
        this.background.triggerCollapse(event.layer, world.camera.x);
        break;
      case 'playerHurt':
      case 'playerFell':
      case 'swarmStrike':
        this.damageFlash = 1;
        break;
      case 'bossCriticalHit':
        this.whiteFlash = Math.max(this.whiteFlash, 0.15);
        break;
      case 'bossDestroyed':
        this.whiteFlash = 1;
        break;
      default:
        break;
    }
  }

  render(ctx, world, mouse, frameDt) {
    this.time += frameDt;
    this.background.update(frameDt * world.timeScale, world.camera.x);
    this.slowMotionAmount = approach(this.slowMotionAmount, world.isSlowMotion ? 1 : 0, 6, frameDt);
    this.damageFlash = Math.max(0, this.damageFlash - frameDt * 2.5);
    this.whiteFlash = Math.max(0, this.whiteFlash - frameDt * 1.2);

    const camX = world.camera.renderX;
    const camY = world.camera.renderY;
    const time = this.time;

    this.background.drawBackLayers(ctx, camX, camY);

    this.boss.draw(ctx, world.boss, camX, camY, time);
    this.environment.drawPlatforms(ctx, world, camX, camY, time);
    this.environment.drawRoofProps(ctx, world.layout.decorations, camX, camY, time);
    this.environment.drawCheckpoints(ctx, world, camX, camY, time);
    this.environment.drawFinishGate(ctx, world, camX, camY, time);
    this.environment.drawBouncePads(ctx, world, camX, camY, time);
    this.actors.drawHazards(ctx, world, camX, camY, time);
    this.boss.drawAttacks(ctx, world, camX, camY, time);
    this.actors.drawPickups(ctx, world, camX, camY, time);
    this.actors.drawEnemies(ctx, world, camX, camY, time);
    this.playerRenderer.draw(ctx, world, camX, camY, { rimColor: this.theme.accent, time });
    this.actors.drawDrones(ctx, world, camX, camY, time);
    this.actors.drawPursuers(ctx, world, camX, camY, time);
    this.actors.drawProjectiles(ctx, world, camX, camY, time);
    this.actors.drawEffects(ctx, world.effects, camX, camY);

    this.background.drawFrontLayers(ctx, frameDt, world.timeScale);
    this.postEffects.drawVignette(ctx, 0.85);
    this.postEffects.drawSlowMotion(ctx, this.slowMotionAmount);
    this.postEffects.drawDamageFlash(ctx, this.damageFlash);

    drawTargetingOverlay(ctx, world, mouse, time);
    this.postEffects.drawColorFlash(ctx, '#ffffff', this.whiteFlash);
  }

  /** Low-health warning pulse, drawn by the gameplay screen when health is 1. */
  drawLowHealthPulse(ctx) {
    const pulse = (Math.sin(this.time * 5) + 1) / 2;
    this.postEffects.drawDamageFlash(ctx, 0.15 + pulse * 0.2);
  }
}
