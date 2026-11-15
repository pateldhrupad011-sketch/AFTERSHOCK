import { PHYSICS } from '../config.js';

// Buildings extend far below the screen so the player can never see their base.
const BUILDING_DEPTH = 1600;

/**
 * Anything a body can stand on. Buildings are solid on all sides; thin girders
 * and moving platforms are one-way (you can jump up through them).
 */
export class Platform {
  constructor({ x, y, width, height = BUILDING_DEPTH, kind = 'building', oneWay = false, style = 0 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.kind = kind;
    this.oneWay = oneWay;
    this.style = style;
    this.deltaX = 0;
    this.deltaY = 0;
    this.previousY = y;
    this.isActive = true;
  }

  get top() {
    return this.y;
  }

  get right() {
    return this.x + this.width;
  }

  update() {
    this.previousY = this.y;
  }

  /** Called when a body lands on or stands on this platform. */
  onStoodOn() {}

  /** Restores the initial state when the player respawns behind this platform. */
  reset() {}
}

/** A girder that oscillates between two points (sine easing at the ends). */
export class MovingPlatform extends Platform {
  constructor({ x, y, width, moveX = 0, moveY = 0, period = 3, phase = 0 }) {
    super({ x, y, width, height: 10, kind: 'mover', oneWay: true });
    this.originX = x;
    this.originY = y;
    this.moveX = moveX;
    this.moveY = moveY;
    this.period = period;
    this.phase = phase;
    this.elapsed = 0;
  }

  update(dt) {
    this.previousY = this.y;
    this.elapsed += dt;
    const wave = (1 - Math.cos((this.elapsed / this.period) * Math.PI * 2 + this.phase * Math.PI * 2)) / 2;
    const nextX = this.originX + this.moveX * wave;
    const nextY = this.originY + this.moveY * wave;
    this.deltaX = nextX - this.x;
    this.deltaY = nextY - this.y;
    this.x = nextX;
    this.y = nextY;
  }
}

/**
 * A structure that gives way shortly after being stepped on: it shakes, then
 * drops with gravity. Used for scaffolds (Iron District) and failing rooftops.
 */
export class CollapsingPlatform extends Platform {
  constructor(options) {
    super(options);
    this.originY = options.y;
    this.warningDuration = options.warningDuration ?? 0.55;
    this.reset();
  }

  reset() {
    this.y = this.originY;
    this.previousY = this.originY;
    this.state = 'stable';
    this.timer = 0;
    this.fallSpeed = 0;
    this.deltaY = 0;
    this.isActive = true;
  }

  onStoodOn(world) {
    if (this.state !== 'stable') return;
    this.state = 'cracking';
    this.timer = 0;
    world.emit('structureCracking', { x: this.x + this.width / 2, y: this.y });
  }

  update(dt, world) {
    this.previousY = this.y;
    this.deltaY = 0;
    if (this.state === 'cracking') {
      this.timer += dt;
      if (this.timer >= this.warningDuration) {
        this.state = 'falling';
        world.emit('structureCollapse', { x: this.x + this.width / 2, y: this.y, width: this.width });
      }
    } else if (this.state === 'falling') {
      // Sinks slowly at first so a runner already on it can still jump clear.
      this.fallSpeed = Math.min(this.fallSpeed + PHYSICS.gravity * 0.35 * dt, PHYSICS.maxFallSpeed);
      this.deltaY = this.fallSpeed * dt;
      this.y += this.deltaY;
      if (this.y > this.originY + 500) {
        this.state = 'gone';
        this.isActive = false;
      }
    }
  }

  /** 0 when solid, rising toward 1 as the collapse warning plays out (used for shaking). */
  get crackProgress() {
    if (this.state === 'cracking') return this.timer / this.warningDuration;
    return this.state === 'stable' ? 0 : 1;
  }
}
