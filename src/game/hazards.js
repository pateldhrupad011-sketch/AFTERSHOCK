import { PHYSICS } from '../config.js';
import { rectsOverlap } from '../core/math.js';
import { Platform } from './platforms.js';

/** Live electrical strip on a rooftop. Always on — jump over it. */
export class ShockStrip {
  constructor(x, roofY, width) {
    this.kind = 'shockStrip';
    this.x = x;
    this.y = roofY - 5;
    this.width = width;
    this.height = 5;
  }

  update(dt, world) {
    if (rectsOverlap(this, world.player)) world.player.takeDamage(world);
  }
}

/**
 * Steam vent with a fixed rhythm: hiss (warning) -> erupt -> idle.
 * The column is shorter than a full jump, so it can always be cleared.
 */
export class SteamVent {
  constructor(x, roofY, { period = 2.4, eruptDuration = 0.9, offset = 0 } = {}) {
    this.kind = 'steamVent';
    this.x = x - 7;
    this.roofY = roofY;
    this.width = 14;
    this.columnHeight = 58;
    this.period = period;
    this.eruptDuration = eruptDuration;
    this.warningDuration = 0.55;
    this.clock = offset * period;
  }

  get cycleTime() {
    return this.clock % this.period;
  }

  get isErupting() {
    return this.cycleTime < this.eruptDuration;
  }

  get isWarning() {
    return this.cycleTime > this.period - this.warningDuration;
  }

  update(dt, world) {
    this.clock += dt;
    if (!this.isErupting) return;
    const column = { x: this.x, y: this.roofY - this.columnHeight, width: this.width, height: this.columnHeight };
    if (rectsOverlap(column, world.player)) world.player.takeDamage(world);
  }
}

/**
 * Horizontal laser between two pylons. `height` is measured from the roof:
 * low beams must be jumped, high beams (head height mid-jump) mean "don't jump".
 */
export class LaserBarrier {
  constructor(x, roofY, { height = 10, width = 40, period = 2.6, onDuration = 1.4, offset = 0 } = {}) {
    this.kind = 'laser';
    this.x = x;
    this.roofY = roofY;
    this.beamY = roofY - height;
    this.width = width;
    this.period = period;
    this.onDuration = onDuration;
    this.clock = offset * period;
  }

  get cycleTime() {
    return this.clock % this.period;
  }

  get isOn() {
    return this.cycleTime < this.onDuration;
  }

  /** Flickers during the last 0.5s before switching on. */
  get isWarning() {
    return !this.isOn && this.cycleTime > this.period - 0.5;
  }

  update(dt, world) {
    this.clock += dt;
    if (!this.isOn) return;
    const beam = { x: this.x, y: this.beamY - 2, width: this.width, height: 4 };
    if (rectsOverlap(beam, world.player)) world.player.takeDamage(world);
  }
}

/**
 * A chunk of building that drops onto the route ahead of the runner. A warning
 * marker appears on the roof first; once landed it becomes rubble you hop over.
 */
export class FallingDebris {
  constructor(x, roofY, { size = 18 } = {}) {
    this.kind = 'debris';
    this.landX = x;
    this.roofY = roofY;
    this.size = size;
    this.reset();
  }

  reset() {
    this.state = 'waiting';
    this.x = this.landX - this.size / 2;
    this.y = this.roofY - 420;
    this.width = this.size;
    this.height = this.size;
    this.vy = 0;
    this.spin = 0;
    this.warningTimer = 0;
    this.rubble?.markRemoved();
    this.rubble = null;
  }

  update(dt, world) {
    const player = world.player;
    if (this.state === 'waiting') {
      // Time the drop so the chunk lands roughly 0.35s before the runner arrives.
      const secondsUntilPlayerArrives = (this.landX - player.x) / player.runSpeed;
      if (secondsUntilPlayerArrives < 1.6) {
        this.state = 'warning';
        world.emit('debrisWarning', { x: this.landX, y: this.roofY });
      }
    } else if (this.state === 'warning') {
      this.warningTimer += dt;
      if (this.warningTimer > 0.35) this.state = 'falling';
    } else if (this.state === 'falling') {
      this.vy = Math.min(this.vy + PHYSICS.gravity * 1.2 * dt, 900);
      this.y += this.vy * dt;
      this.spin += dt * 6;
      if (rectsOverlap(this, player)) player.takeDamage(world);
      if (this.y + this.height >= this.roofY) this.land(world);
    }
  }

  land(world) {
    this.state = 'landed';
    this.y = this.roofY - this.height;
    // Rubble is lower than the chunk so it is an easy hop, never a wall.
    this.rubble = new RubblePlatform(this.x - 1, this.roofY - 12, this.width + 2);
    world.platforms.push(this.rubble);
    world.emit('debrisImpact', { x: this.landX, y: this.roofY });
    world.crushEnemiesInArea({ x: this.x, y: this.roofY - 30, width: this.width, height: 30 });
  }
}

class RubblePlatform extends Platform {
  constructor(x, y, width) {
    super({ x, y, width, height: 12, kind: 'rubble' });
  }

  markRemoved() {
    this.isActive = false;
  }
}

/**
 * Destroyed triangular rubble on the boss arena floor. Jump it or take a hit.
 * Spawned ahead of the runner during the fight.
 */
export class TriangleRubble {
  constructor(x, roofY, { width = 22, height = 16 } = {}) {
    this.kind = 'triangleRubble';
    this.width = width;
    this.height = height;
    this.x = x - width / 2;
    this.y = roofY - height;
    this.roofY = roofY;
    this.isActive = true;
    this.age = 0;
  }

  update(dt, world) {
    this.age += dt;
    if (this.x + this.width < world.camera.x - 60) {
      this.isActive = false;
      return;
    }
    if (world.player.isAlive && rectsOverlap(this, world.player)) {
      world.player.takeDamage(world);
    }
  }
}
