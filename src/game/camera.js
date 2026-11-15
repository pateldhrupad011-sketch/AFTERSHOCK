import { CAMERA, PLAYER, VIEW } from '../config.js';
import { approach } from '../core/math.js';

/**
 * Side-scrolling camera. Horizontally it tracks the player with a short
 * facing-based look-ahead (important for manual left/right control).
 * Vertically it eases toward the runner, rising quickly during bounce-pad
 * launches and never following them into a pit.
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.lookAhead = 0;
    this.shakeStrength = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeEnabled = true;
    this.lowestAllowedY = Infinity;
    this.minX = -Infinity;
  }

  snapTo(player) {
    this.lookAhead = player.facing * CAMERA.lookAhead;
    this.x = Math.max(this.minX, player.x - PLAYER.screenAnchorX + this.lookAhead);
    this.y = this.targetYFor(player);
  }

  targetYFor(player) {
    const groundScreenY = VIEW.height * CAMERA.groundScreenFraction;
    const groundY = player.groundPlatform?.y ?? player.bottom;
    let target = (player.grounded ? groundY : player.bottom) - groundScreenY;
    // Keep a launched runner comfortably on screen near the top.
    target = Math.min(target, player.y - CAMERA.topMargin);
    return Math.min(target, this.lowestAllowedY);
  }

  update(realDt, player) {
    const desiredLook = player.isAlive ? player.facing * CAMERA.lookAhead : this.lookAhead;
    this.lookAhead = approach(this.lookAhead, desiredLook, CAMERA.lookAheadRate, realDt);
    this.x = Math.max(this.minX, player.x - PLAYER.screenAnchorX + this.lookAhead);

    if (player.isAlive) {
      const target = this.targetYFor(player);
      const rate = target < this.y ? CAMERA.verticalFollowRate * 1.6 : CAMERA.verticalFollowRate;
      this.y = approach(this.y, target, rate, realDt);
    }

    this.shakeStrength = Math.max(0, this.shakeStrength - realDt * 18);
    const strength = this.shakeEnabled ? this.shakeStrength : 0;
    this.shakeOffsetX = (Math.random() * 2 - 1) * strength;
    this.shakeOffsetY = (Math.random() * 2 - 1) * strength;
  }

  shake(strength) {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  /** Integer camera position used for rendering, so pixel art never blurs. */
  get renderX() {
    return Math.round(this.x + this.shakeOffsetX);
  }

  get renderY() {
    return Math.round(this.y + this.shakeOffsetY);
  }
}
