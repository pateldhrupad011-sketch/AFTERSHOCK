import { DRONE_ENCOUNTER, ENEMIES, SCORE } from '../config.js';
import { approach, rectsOverlap } from '../core/math.js';
import { DroneLaser, EnemyBolt } from './projectiles.js';

/**
 * Flying robot with three behaviours:
 *  - 'hover':  holds position near the route and fires telegraphed red lasers.
 *  - 'diver':  waits, then dive-bombs the runner's predicted position.
 *  - 'swarm':  part of a slow-motion drone encounter; positioned in screen
 *              space around the runner and driven by DroneEncounter.
 */
export class Drone {
  constructor(x, y, behavior = 'hover') {
    const stats = behavior === 'diver' ? ENEMIES.diver : ENEMIES.drone;
    this.kind = 'drone';
    this.behavior = behavior;
    this.width = stats.width;
    this.height = stats.height;
    this.x = x - this.width / 2;
    this.y = y - this.height / 2;
    this.homeY = this.y;
    this.health = stats.health;
    this.isActive = true;
    this.isDisabled = false;
    this.animationTime = Math.random() * 10;
    this.chargeTimer = 0;
    this.cooldownTimer = 1 + Math.random();
    this.diveVelocity = null;
    this.hitFlash = 0;
    // Swarm-only state, set by DroneEncounter.
    this.screenX = 0;
    this.screenY = 0;
    this.slotX = 0;
    this.slotY = 0;
    this.lockOnProgress = 0;
    this.isFleeing = false;
    // Aim locked when the laser starts charging so the runner can dodge it.
    this.lockedAimAngle = 0;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  get isTargetable() {
    return this.isActive && !this.isDisabled;
  }

  get chargeProgress() {
    const chargeTime = this.behavior === 'swarm' ? ENEMIES.drone.swarmChargeTime : ENEMIES.drone.chargeTime;
    return chargeTime > 0 ? this.chargeTimer / chargeTime : 0;
  }

  /** Under-cannon tip where the red laser particle spawns. */
  get muzzle() {
    return { x: this.centerX, y: this.y + this.height - 1 };
  }

  update(dt, realDt, world) {
    this.animationTime += realDt;
    this.hitFlash = Math.max(0, this.hitFlash - realDt * 6);

    if (this.isDisabled) {
      // Wreck spirals down trailing smoke, then is removed.
      this.vy = (this.vy ?? 0) + 500 * dt;
      this.y += this.vy * dt;
      this.x += 40 * dt;
      if (Math.random() < 0.5) world.effects.spawn({ x: this.centerX, y: this.centerY, vx: 0, vy: -10, life: 0.5, color: '#3c3446', size: 2, shape: 'puff' });
      if (this.y > world.killY) this.isActive = false;
      return;
    }

    if (this.behavior === 'swarm') this.updateSwarm(realDt, world);
    else if (this.behavior === 'diver') this.updateDiver(dt, world);
    else this.updateHover(dt, world);

    // Swarm drones are dealt with by the lock-on timer, not by ramming the runner.
    if (this.behavior !== 'swarm' && world.player.isAlive && rectsOverlap(this, world.player)) {
      world.player.takeDamage(world);
      this.destroy(world, false);
    }
  }

  updateHover(dt, world) {
    this.y = this.homeY + Math.sin(this.animationTime * 2.2) * 6;
    this.tryFireLaser(dt, world, ENEMIES.drone.chargeTime, ENEMIES.drone.cooldown);
  }

  /** Fires a small red laser particle from the under-cannon toward the runner. */
  fireLaser(world, angle) {
    const muzzle = this.muzzle;
    world.spawnDroneLaser(new DroneLaser(muzzle.x, muzzle.y, angle));
    world.emit('enemyFire', { x: muzzle.x, y: muzzle.y });
  }

  tryFireLaser(dt, world, chargeTime, cooldown) {
    const player = world.player;
    if (!player.isAlive) {
      this.chargeTimer = 0;
      return;
    }
    if (this.behavior === 'hover') {
      const dx = player.centerX - this.centerX;
      if (Math.abs(dx) > ENEMIES.drone.range) {
        this.chargeTimer = 0;
        return;
      }
    }
    this.cooldownTimer -= dt;
    // Only one drone may charge/fire at a time so lasers come one by one.
    if (!world.canDroneFireLaser(this)) {
      if (this.chargeTimer > 0) this.chargeTimer = 0;
      return;
    }
    if (this.cooldownTimer > 0) return;
    if (this.chargeTimer === 0) {
      const muzzle = this.muzzle;
      // Aim at the runner with no lead so a jump / sidestep clears the bolt.
      this.lockedAimAngle = Math.atan2(player.centerY - muzzle.y, player.centerX - muzzle.x);
      world.emit('enemyCharge', { x: muzzle.x, y: muzzle.y });
    }
    this.chargeTimer += dt;
    if (this.chargeTimer >= chargeTime) {
      this.fireLaser(world, this.lockedAimAngle);
      this.chargeTimer = 0;
      this.cooldownTimer = cooldown;
      world.advanceDroneFireTurn();
    }
  }

  updateDiver(dt, world) {
    const player = world.player;
    if (!this.diveVelocity) {
      this.y = this.homeY + Math.sin(this.animationTime * 3) * 4;
      const dx = this.centerX - player.centerX;
      if (dx > 0 && dx < ENEMIES.diver.triggerRange) {
        // Lead the dive using current horizontal velocity (works for strafe and idle).
        const travelTime = Math.hypot(dx, this.centerY - player.centerY) / ENEMIES.diver.diveSpeed;
        const targetX = player.centerX + player.vx * travelTime;
        const angle = Math.atan2(player.centerY - this.centerY, targetX - this.centerX);
        this.diveVelocity = { x: Math.cos(angle) * ENEMIES.diver.diveSpeed, y: Math.sin(angle) * ENEMIES.diver.diveSpeed };
        world.emit('droneDive', { x: this.centerX, y: this.centerY });
      }
      return;
    }
    this.x += this.diveVelocity.x * dt;
    this.y += this.diveVelocity.y * dt;
    if (this.y > world.killY) this.isActive = false;
  }

  updateSwarm(realDt, world) {
    if (!this.isFleeing && this._slotOffset) {
      // Keep formation glued to the runner so lasers stay on target.
      this.slotX = world.player.centerX - world.camera.x + this._slotOffset.x;
      this.slotY = world.player.centerY - world.camera.y + this._slotOffset.y;
    }
    const speed = this.isFleeing ? DRONE_ENCOUNTER.entrySpeed * 1.5 : DRONE_ENCOUNTER.entrySpeed;
    const orbitX = this.isFleeing ? 0 : Math.cos(this.animationTime * 1.3) * 14;
    const orbitY = this.isFleeing ? 0 : Math.sin(this.animationTime * 1.7) * 10;
    const targetX = this.slotX + orbitX;
    const targetY = this.slotY + orbitY;
    const dx = targetX - this.screenX;
    const dy = targetY - this.screenY;
    const dist = Math.hypot(dx, dy);
    if (dist > speed * realDt) {
      this.screenX += (dx / dist) * speed * realDt;
      this.screenY += (dy / dist) * speed * realDt;
    } else {
      this.screenX = approach(this.screenX, targetX, 8, realDt);
      this.screenY = approach(this.screenY, targetY, 8, realDt);
    }
    this.x = world.camera.x + this.screenX - this.width / 2;
    this.y = world.camera.y + this.screenY - this.height / 2;
    if (this.isFleeing && this.screenY < -40) this.isActive = false;
    if (this.isFleeing) {
      this.chargeTimer = 0;
      return;
    }
    this.tryFireLaser(realDt, world, ENEMIES.drone.swarmChargeTime, ENEMIES.drone.swarmCooldown);
  }

  hit(world, damage) {
    if (this.isDisabled) return;
    this.health -= damage;
    this.hitFlash = 1;
    if (this.health <= 0) this.destroy(world, true);
  }

  destroy(world, scoreIt) {
    this.isDisabled = true;
    this.vy = -60;
    world.effects.explosion(this.centerX, this.centerY, 0.8);
    if (scoreIt) world.registerKill(this, SCORE.drone);
    else world.emit('droneExploded', { x: this.centerX, y: this.centerY });
  }
}

/**
 * The Hunter gunship that chases the runner across the Last Bridge. It flies
 * in from behind, hangs over the runner's shoulder and fires telegraphed
 * bolts until `leaveX`. It is too heavily armoured to destroy, but its bolts
 * can be shot down.
 */
export class Gunship {
  constructor(leaveX) {
    this.kind = 'gunship';
    this.leaveX = leaveX;
    this.screenX = -90;
    this.screenY = 70;
    this.width = 56;
    this.height = 26;
    this.x = 0;
    this.y = 0;
    this.time = 0;
    this.chargeTimer = 0;
    this.cooldownTimer = 1.8;
    this.isActive = true;
    this.isLeaving = false;
  }

  get chargeProgress() {
    return this.chargeTimer / 0.9;
  }

  get muzzle() {
    return { x: this.x + this.width - 6, y: this.y + this.height - 4 };
  }

  update(dt, world) {
    this.time += dt;
    const player = world.player;
    if (player.x > this.leaveX) this.isLeaving = true;

    const targetScreenX = this.isLeaving ? 760 : 70;
    this.screenX += (targetScreenX - this.screenX) * Math.min(1, dt * (this.isLeaving ? 0.8 : 1.4));
    const bob = Math.sin(this.time * 2) * 6;
    this.x = world.camera.x + this.screenX - this.width / 2;
    this.y = world.camera.y + this.screenY + bob - this.height / 2;
    if (this.isLeaving && this.screenX > 700) {
      this.isActive = false;
      return;
    }
    if (this.isLeaving || !player.isAlive || this.screenX < 20) return;

    this.cooldownTimer -= dt;
    if (this.cooldownTimer > 0) return;
    if (this.chargeTimer === 0) world.emit('enemyCharge', { x: this.x, y: this.y });
    this.chargeTimer += dt;
    if (this.chargeTimer >= 0.9) {
      const muzzle = this.muzzle;
      const angle = Math.atan2(player.centerY - muzzle.y, player.centerX + 40 - muzzle.x);
      const bolt = new EnemyBolt(muzzle.x, muzzle.y, angle, 150, { radius: 5 });
      bolt.vx += player.vx;
      world.spawnEnemyBolt(bolt);
      world.emit('enemyFire', { x: muzzle.x, y: muzzle.y });
      this.chargeTimer = 0;
      this.cooldownTimer = 2.2;
    }
  }
}

// Hover positions around the runner during a swarm, relative to the runner's
// on-screen centre. Spread above, below, ahead and behind so the player has
// to sweep the cursor around the character.
const SWARM_SLOTS = [
  { x: 150, y: -95 },
  { x: 255, y: -20 },
  { x: -105, y: -75 },
  { x: 205, y: 72 },
  { x: 60, y: -135 },
  { x: 330, y: -115 },
  { x: 110, y: 62 },
  { x: -70, y: 48 },
];

function entryPointFor(slot) {
  if (slot.x < 0) return { x: -30, y: 180 + slot.y };
  if (slot.y > 40) return { x: 200 + slot.x, y: 400 };
  if (slot.y < -100) return { x: 170 + slot.x, y: -30 };
  return { x: 680, y: 220 + slot.y };
}

/**
 * Cinematic drone-swarm moment: the world slows down, a group of drones
 * flies in from several directions, and the player aims with the mouse to
 * clear them before they lock on.
 */
export class DroneEncounter {
  constructor({ count = 4, slotOffset = 0, timeLimit = DRONE_ENCOUNTER.timeLimit } = {}) {
    this.count = Math.min(count, SWARM_SLOTS.length);
    this.slotOffset = slotOffset;
    this.timeLimit = timeLimit;
    this.elapsed = 0;
    this.drones = [];
    this.isFinished = false;
    this.outcome = null;
  }

  get remainingTime() {
    return Math.max(0, this.timeLimit - this.elapsed);
  }

  get remainingDrones() {
    return this.drones.filter((drone) => drone.isTargetable).length;
  }

  start(world) {
    const playerScreenX = world.player.centerX - world.camera.x;
    const playerScreenY = world.player.centerY - world.camera.y;
    for (let i = 0; i < this.count; i++) {
      const slot = SWARM_SLOTS[(i + this.slotOffset) % SWARM_SLOTS.length];
      const entry = entryPointFor(slot);
      const drone = new Drone(0, 0, 'swarm');
      drone.screenX = entry.x;
      drone.screenY = entry.y;
      drone.slotX = playerScreenX + slot.x;
      drone.slotY = playerScreenY + slot.y;
      drone._slotOffset = { x: slot.x, y: slot.y };
      // Stagger arrivals; lasers are gated one-by-one via world.canDroneFireLaser.
      drone.animationTime = i * 0.7;
      drone.cooldownTimer = 0.4;
      this.drones.push(drone);
      world.drones.push(drone);
    }
    world.setSlowMotion(true);
    world.emit('swarmStart', { count: this.count });
  }

  update(realDt, world) {
    if (this.isFinished) return;
    this.elapsed += realDt;

    if (this.remainingDrones === 0) {
      this.finish(world, 'cleared');
      return;
    }

    const lockOnStart = this.timeLimit - DRONE_ENCOUNTER.lockOnWarningTime;
    if (this.elapsed >= lockOnStart) {
      const progress = Math.min(1, (this.elapsed - lockOnStart) / DRONE_ENCOUNTER.lockOnWarningTime);
      if (this.drones.every((drone) => drone.lockOnProgress === 0)) world.emit('swarmLockOn', {});
      for (const drone of this.drones) if (drone.isTargetable) drone.lockOnProgress = progress;
    }

    if (this.elapsed >= this.timeLimit) {
      world.player.takeDamage(world);
      world.emit('swarmStrike', {});
      this.finish(world, 'timeout');
    }
  }

  finish(world, outcome) {
    this.isFinished = true;
    this.outcome = outcome;
    if (outcome === 'cleared') world.addScore(SCORE.swarmCleared, world.player.centerX, world.player.y - 16);
    for (const drone of this.drones) {
      drone.lockOnProgress = 0;
      if (drone.isTargetable) drone.isFleeing = true;
      drone.slotY = -80;
    }
    world.setSlowMotion(false);
    world.emit('swarmEnd', { outcome });
  }
}
