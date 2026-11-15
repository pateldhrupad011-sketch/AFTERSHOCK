import { ENEMIES, SCORE } from '../config.js';
import { rectsOverlap } from '../core/math.js';
import { moveBody } from './physics.js';
import { EnemyBolt } from './projectiles.js';

/**
 * Base class for ground robots. Handles health, hit flashes, stomping,
 * contact damage and the "disabled" wreck state shared by all of them.
 */
class GroundRobot {
  constructor(x, roofY, stats) {
    this.width = stats.width;
    this.height = stats.height;
    this.x = x - this.width / 2;
    this.y = roofY - this.height;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.groundPlatform = null;
    this.health = stats.health;
    this.isDisabled = false;
    this.hitFlash = 0;
    this.wreckTimer = 0;
    this.animationTime = Math.random() * 10;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  get isTargetable() {
    return !this.isDisabled;
  }

  update(dt, world) {
    this.animationTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);

    if (this.isDisabled) {
      this.wreckTimer += dt;
      this.vx *= 0.9;
      moveBody(this, dt, world.platforms);
      return;
    }

    this.think(dt, world);
    moveBody(this, dt, world.platforms);
    this.checkPlayerContact(world);
    if (this.y > world.killY) this.isDisabled = true;
  }

  checkPlayerContact(world) {
    const player = world.player;
    if (!player.isAlive || !rectsOverlap(this, player)) return;

    // Landing on a robot from above disables it (classic stomp) and bounces the runner.
    const isStomp = player.vy > 0 && player.bottom - this.y < 12;
    if (isStomp) {
      player.bounceOffEnemy();
      this.disable(world, 'stomp');
    } else {
      player.takeDamage(world);
    }
  }

  hit(world, damage, impactX) {
    if (this.isDisabled) return;
    this.health -= damage;
    this.hitFlash = 1;
    world.effects.sparks(impactX, this.centerY, ['#ffffff', '#8ff8ff', '#ffe08a'], 6);
    if (this.health <= 0) this.disable(world, 'shot');
    else world.emit('enemyHit', { x: this.centerX, y: this.centerY });
  }

  disable(world, cause) {
    if (this.isDisabled) return;
    this.isDisabled = true;
    this.vx = cause === 'stomp' ? 0 : 60;
    this.vy = -140;
    world.registerKill(this, SCORE.enemy);
  }
}

/** Patrols back and forth on its rooftop, turning at walls and roof edges. */
export class Crawler extends GroundRobot {
  constructor(x, roofY, { patrolDistance = 70 } = {}) {
    super(x, roofY, ENEMIES.crawler);
    this.kind = 'crawler';
    this.direction = -1;
    this.patrolMinX = this.x - patrolDistance / 2;
    this.patrolMaxX = this.x + patrolDistance / 2;
  }

  think(dt, world) {
    if (!this.grounded) return;
    const nextX = this.x + this.direction * 6;
    const groundAhead = this.hasGroundAt(nextX + (this.direction > 0 ? this.width : 0), world);
    if (!groundAhead || nextX < this.patrolMinX || nextX > this.patrolMaxX) this.direction *= -1;
    this.vx = this.direction * ENEMIES.crawler.speed;
  }

  hasGroundAt(x, world) {
    const footY = this.y + this.height + 2;
    return world.platforms.some((p) => p.isActive && x >= p.x && x <= p.x + p.width && footY >= p.y && footY <= p.y + 8);
  }
}

/**
 * Stationary gunner. Locks on when the runner approaches, glows while
 * charging (the warning), then fires a slow bolt that can be dodged or shot.
 */
export class Sentry extends GroundRobot {
  constructor(x, roofY) {
    super(x, roofY, ENEMIES.sentry);
    this.kind = 'sentry';
    this.chargeTimer = 0;
    this.cooldownTimer = 0.6;
    this.aimAngle = Math.PI;
  }

  get chargeProgress() {
    return this.chargeTimer / ENEMIES.sentry.chargeTime;
  }

  think(dt, world) {
    this.vx = 0;
    const player = world.player;
    const dx = player.centerX - this.centerX;
    const isInRange = Math.abs(dx) < ENEMIES.sentry.range && player.isAlive;
    if (!isInRange) {
      this.chargeTimer = 0;
      return;
    }

    this.aimAngle = Math.atan2(player.centerY - (this.y + 6), dx);
    this.cooldownTimer -= dt;
    if (this.cooldownTimer > 0) return;

    if (this.chargeTimer === 0) world.emit('enemyCharge', { x: this.centerX, y: this.y });
    this.chargeTimer += dt;
    if (this.chargeTimer >= ENEMIES.sentry.chargeTime) {
      this.fire(world);
      this.chargeTimer = 0;
      this.cooldownTimer = ENEMIES.sentry.cooldown;
    }
  }

  fire(world) {
    const muzzleX = this.centerX + Math.cos(this.aimAngle) * 10;
    const muzzleY = this.y + 6 + Math.sin(this.aimAngle) * 10;
    // Lead shots by current velocity so strafing left/right stays readable.
    const leadX = world.player.centerX + world.player.vx * 0.35;
    const angle = Math.atan2(world.player.centerY - muzzleY, leadX - muzzleX);
    world.spawnEnemyBolt(new EnemyBolt(muzzleX, muzzleY, angle, ENEMIES.sentry.boltSpeed));
    world.emit('enemyFire', { x: muzzleX, y: muzzleY });
  }
}
