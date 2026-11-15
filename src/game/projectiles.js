import { BLASTER, ENEMIES } from '../config.js';

/**
 * Player energy shot. Moves on real (unscaled) time so it stays fast and
 * satisfying during slow motion.
 *
 * `shooterVelocityX` is optional inherited horizontal velocity (used in
 * auto-run so shots stay on the cursor while the camera scrolls).
 */
export class PlayerShot {
  constructor(x, y, angle, shooterVelocityX = 0) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BLASTER.projectileSpeed + shooterVelocityX;
    this.vy = Math.sin(angle) * BLASTER.projectileSpeed;
    this.angle = angle;
    this.life = BLASTER.projectileLife;
    this.isActive = true;
    this.radius = 3;
  }

  update(realDt) {
    this.x += this.vx * realDt;
    this.y += this.vy * realDt;
    this.life -= realDt;
    if (this.life <= 0) this.isActive = false;
  }
}

/** Hostile plasma bolt. Slow enough to read and can be shot out of the air. */
export class EnemyBolt {
  constructor(x, y, angle, speed, { radius = 4, color = 'red', damage = 1, style = 'orb' } = {}) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.radius = radius;
    this.color = color;
    this.damage = damage;
    this.style = style;
    this.life = 4;
    this.isActive = true;
    this.isTargetable = true;
    this.age = 0;
  }

  get centerX() {
    return this.x;
  }

  get centerY() {
    return this.y;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) this.isActive = false;
  }

  hit(world) {
    this.isActive = false;
    world.effects.burst(this.x, this.y, { count: 8, colors: ['#ff6b8b', '#ffffff'], speed: [40, 120], life: [0.15, 0.3], gravity: 0, glow: false });
    world.emit('boltDestroyed', { x: this.x, y: this.y });
  }
}

/**
 * Small neon-red laser particle fired from a drone's under-cannon.
 * Travels as a dodgeable bolt (not a hitscan beam) with a short glow trail.
 */
export class DroneLaser {
  constructor(x, y, angle, {
    damage = ENEMIES.drone.laserDamage,
    speed = ENEMIES.drone.boltSpeed,
    life = ENEMIES.drone.laserLife,
    radius = ENEMIES.drone.laserRadius,
  } = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.age = 0;
    this.hasHit = false;
    this.isActive = true;
    this.trail = [];
  }

  update(realDt, world) {
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.length = 6;

    this.x += this.vx * realDt;
    this.y += this.vy * realDt;
    this.age += realDt;
    this.life -= realDt;
    if (this.life <= 0) {
      this.isActive = false;
      return;
    }

    const player = world.player;
    if (this.hasHit || !player.isAlive) return;
    const dx = player.centerX - this.x;
    const dy = player.centerY - this.y;
    const hitR = this.radius + Math.max(player.width, player.height) * 0.28;
    if (dx * dx + dy * dy < hitR * hitR) {
      this.hasHit = player.takeDamage(world, this.damage);
      if (this.hasHit) {
        this.isActive = false;
        world.effects.sparks(this.x, this.y, ['#ff1a2e', '#ffffff'], 8);
      }
    }
  }
}
