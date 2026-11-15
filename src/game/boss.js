import { rectsOverlap } from '../core/math.js';
import { DroneEncounter } from './drones.js';
import { EnemyBolt } from './projectiles.js';

export const ARCHITECT = {
  maxHealth: 72,
  armorDamage: 2,
  coreDamage: 6,
  // Where the boss hovers, in screen space (it keeps pace with the runner).
  screenX: 500,
  screenY: 150,
  revealDuration: 2.6,
  deathDuration: 2.8,
};

// Attack sequences. Each step names an attack; phase two (below half health)
// is a bit faster. Expose windows are frequent so the core stays hittable.
const PHASE_ONE_SEQUENCE = ['shockwave', 'expose', 'orbs', 'expose', 'beam', 'expose', 'shockwave', 'expose'];
const PHASE_TWO_SEQUENCE = ['combo', 'expose', 'orbs', 'expose', 'swarm', 'expose', 'beam', 'expose', 'shockwave', 'expose'];

const ATTACK_TIMINGS = {
  shockwave: { windup: 0.9, recover: 0.75 },
  beam: { windup: 1.05, recover: 0.7 },
  orbs: { windup: 0.55, recover: 0.85 },
  combo: { windup: 1.0, recover: 0.9 },
  expose: { windup: 0.2, recover: 0.35 },
  swarm: { windup: 0.55, recover: 0.55 },
};

/**
 * THE ARCHITECT — the corrupted city-control machine. It hovers ahead of the
 * runner, telegraphs every attack (warning lines, glowing arms, floor
 * chevrons) and periodically opens its core, which takes 4x damage.
 */
export class Architect {
  constructor(floorY) {
    this.kind = 'architect';
    this.floorY = floorY;
    this.health = ARCHITECT.maxHealth;
    this.state = 'dormant';
    this.stateTimer = 0;
    this.attackIndex = 0;
    this.currentAttack = null;
    this.attackPhase = 'idle';
    this.coreOpenAmount = 0;
    this.hitFlash = 0;
    this.time = 0;
    this.width = 140;
    this.height = 150;
    this.x = 0;
    this.y = 0;
    this.armRaise = 0;
    this.eyeTargetX = 0;
    this.eyeTargetY = 0;
    this.swarm = null;
  }

  get isPhaseTwo() {
    return this.health <= ARCHITECT.maxHealth / 2;
  }

  get isCoreExposed() {
    return this.coreOpenAmount > 0.6;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  get core() {
    // Eye of the orb sprite — centered on the body, slightly below midline.
    return { x: this.centerX, y: this.y + this.height * 0.58, radius: 18 };
  }

  get isAlive() {
    return this.state !== 'dying' && this.state !== 'destroyed';
  }

  startReveal(world) {
    this.state = 'reveal';
    this.stateTimer = 0;
    world.emit('bossReveal', {});
  }

  update(dt, realDt, world) {
    this.time += dt;
    this.stateTimer += dt;
    this.hitFlash = Math.max(0, this.hitFlash - realDt * 5);

    // Keep pace with the runner, bobbing slowly like something enormous and heavy.
    const bob = Math.sin(this.time * 1.4) * 8;
    this.x = world.camera.x + ARCHITECT.screenX - this.width / 2;
    this.y = world.camera.y + ARCHITECT.screenY - this.height / 2 + bob;
    this.eyeTargetX = world.player.centerX;
    this.eyeTargetY = world.player.centerY;

    if (this.state === 'reveal' && this.stateTimer >= ARCHITECT.revealDuration) {
      this.state = 'fighting';
      this.beginNextAttack(world);
    } else if (this.state === 'fighting') {
      this.updateAttack(dt, world);
    } else if (this.state === 'dying') {
      this.updateDeath(dt, world);
    }

    const wantsCoreOpen = this.currentAttack === 'expose' && this.attackPhase === 'active';
    const coreRate = wantsCoreOpen ? 6 : -2.2;
    this.coreOpenAmount = Math.min(1, Math.max(0, this.coreOpenAmount + coreRate * dt));
    const wantsArmsUp = this.attackPhase === 'windup' && ['shockwave', 'combo'].includes(this.currentAttack);
    this.armRaise = Math.min(1, Math.max(0, this.armRaise + (wantsArmsUp ? 2.5 : -4) * dt));
  }

  beginNextAttack(world) {
    const sequence = this.isPhaseTwo ? PHASE_TWO_SEQUENCE : PHASE_ONE_SEQUENCE;
    this.currentAttack = sequence[this.attackIndex % sequence.length];
    this.attackIndex += 1;
    this.attackPhase = 'windup';
    this.stateTimer = 0;
    // Phase two is only a little faster — keep telegraphs readable.
    this.speedMultiplier = this.isPhaseTwo ? 1.12 : 0.95;
    this.announceAttack(world);
  }

  announceAttack(world) {
    const floorY = this.floorY;
    const screenLeft = world.camera.x;
    if (this.currentAttack === 'shockwave') {
      world.emit('bossWarning', { attack: 'shockwave' });
      world.hazards.push(new FloorWarning(screenLeft, floorY, this.windupTime()));
    } else if (this.currentAttack === 'beam') {
      world.emit('bossWarning', { attack: 'beam' });
      world.hazards.push(new ScanBeam(floorY - 64, this.windupTime()));
    } else if (this.currentAttack === 'combo') {
      world.emit('bossWarning', { attack: 'combo' });
      world.hazards.push(new FloorWarning(screenLeft, floorY, this.windupTime()));
      // The beam fires once the runner has landed from jumping the shockwave: jump, then stay low.
      world.hazards.push(new ScanBeam(floorY - 64, this.windupTime() + 1.75));
    } else if (this.currentAttack === 'orbs') {
      world.emit('bossWarning', { attack: 'orbs' });
    } else if (this.currentAttack === 'expose') {
      world.emit('bossCoreExposed', {});
    } else if (this.currentAttack === 'swarm') {
      world.emit('bossWarning', { attack: 'swarm' });
    }
  }

  windupTime() {
    return ATTACK_TIMINGS[this.currentAttack].windup / this.speedMultiplier;
  }

  updateAttack(dt, world) {
    const timing = ATTACK_TIMINGS[this.currentAttack];
    if (this.attackPhase === 'windup' && this.stateTimer >= this.windupTime()) {
      this.attackPhase = 'active';
      this.stateTimer = 0;
      this.executeAttack(world);
    } else if (this.attackPhase === 'active' && this.isAttackFinished(dt, world)) {
      this.attackPhase = 'recover';
      this.stateTimer = 0;
    } else if (this.attackPhase === 'recover' && this.stateTimer >= timing.recover / this.speedMultiplier) {
      this.beginNextAttack(world);
    }
  }

  executeAttack(world) {
    if (this.currentAttack === 'shockwave' || this.currentAttack === 'combo') {
      world.hazards.push(new Shockwave(world.camera.x + ARCHITECT.screenX - 60, this.floorY));
      world.emit('bossSlam', { x: this.centerX, y: this.floorY });
    } else if (this.currentAttack === 'orbs') {
      this.orbsFired = 0;
      this.orbTimer = 0;
    } else if (this.currentAttack === 'swarm') {
      this.swarm = new DroneEncounter({ count: 2, slotOffset: 4, timeLimit: 6.5 });
      world.startDroneEncounter(this.swarm);
    }
  }

  isAttackFinished(dt, world) {
    switch (this.currentAttack) {
      case 'shockwave':
        return this.stateTimer > 0.3;
      case 'combo':
        return this.stateTimer > 2.7;
      case 'beam':
        return this.stateTimer > 1.0;
      case 'expose':
        return this.stateTimer > (this.isPhaseTwo ? 2.8 : 3.4);
      case 'swarm':
        return !this.swarm || this.swarm.isFinished;
      case 'orbs':
        return this.updateOrbVolley(dt, world);
      default:
        return true;
    }
  }

  /** Fires a fan of slow, shootable orbs. Returns true when the volley is done. */
  updateOrbVolley(dt, world) {
    const orbCount = this.isPhaseTwo ? 5 : 4;
    this.orbTimer -= dt;
    if (this.orbsFired < orbCount && this.orbTimer <= 0) {
      const originX = this.centerX - 40;
      const originY = this.y + 70;
      const spread = (this.orbsFired - (orbCount - 1) / 2) * 0.16;
      const angle = Math.atan2(world.player.centerY - originY, world.player.centerX - originX) + spread;
      // Match the player's current strafe so orbs still close on screen when standing still.
      const orbSpeed = this.isPhaseTwo ? 145 : 130;
      const orb = new EnemyBolt(originX, originY, angle, orbSpeed, { radius: 6, color: 'violet' });
      orb.vx += world.player.vx;
      world.spawnEnemyBolt(orb);
      world.emit('enemyFire', { x: originX, y: originY });
      this.orbsFired += 1;
      this.orbTimer = 0.28;
    }
    return this.orbsFired >= orbCount && this.stateTimer > 0.55;
  }

  /** Hit test for a player shot. Returns the damage dealt (0 if it missed). */
  receiveShot(world, shot) {
    if (this.state !== 'fighting') return 0;
    const body = { x: this.x + 18, y: this.y + 22, width: this.width - 36, height: this.height - 36 };
    const insideBody = shot.x >= body.x && shot.x <= body.x + body.width && shot.y >= body.y && shot.y <= body.y + body.height;
    if (!insideBody) return 0;

    // The core sits on the face of the machine, so a shot entering the body is
    // a core hit if its path is heading into the open core.
    if (this.isCoreExposed && this.isShotHeadingIntoCore(shot)) {
      const core = this.core;
      this.applyDamage(world, ARCHITECT.coreDamage, core.x, core.y, true);
      return ARCHITECT.coreDamage;
    }
    this.applyDamage(world, ARCHITECT.armorDamage, shot.x, shot.y, false);
    return ARCHITECT.armorDamage;
  }

  isShotHeadingIntoCore(shot) {
    const core = this.core;
    const speed = Math.hypot(shot.vx, shot.vy);
    const dirX = shot.vx / speed;
    const dirY = shot.vy / speed;
    const toCoreX = core.x - shot.x;
    const toCoreY = core.y - shot.y;
    const along = Math.max(0, toCoreX * dirX + toCoreY * dirY);
    const closestX = shot.x + dirX * along;
    const closestY = shot.y + dirY * along;
    return Math.hypot(core.x - closestX, core.y - closestY) <= core.radius + 3;
  }

  applyDamage(world, amount, x, y, isCritical) {
    const wasPhaseOne = !this.isPhaseTwo;
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = 1;
    world.emit(isCritical ? 'bossCriticalHit' : 'bossArmorHit', { x, y });
    if (wasPhaseOne && this.isPhaseTwo) {
      world.emit('bossPhaseTwo', {});
      this.attackIndex = 0;
    }
    if (this.health === 0) {
      this.state = 'dying';
      this.stateTimer = 0;
      this.explosionTimer = 0;
      world.endDroneEncounter();
      world.hazards = world.hazards.filter((hazard) => !hazard.isBossAttack);
      world.enemyBolts = [];
      world.droneLasers = [];
      world.emit('bossDefeated', {});
    }
  }

  updateDeath(dt, world) {
    this.explosionTimer -= dt;
    if (this.explosionTimer <= 0) {
      this.explosionTimer = 0.12;
      const x = this.x + 20 + Math.random() * (this.width - 40);
      const y = this.y + 20 + Math.random() * (this.height - 40);
      world.effects.explosion(x, y, 1.2);
      world.emit('bossExplosion', { x, y });
    }
    if (this.stateTimer >= ARCHITECT.deathDuration) {
      this.state = 'destroyed';
      world.effects.explosion(this.centerX, this.centerY, 4);
      world.emit('bossDestroyed', {});
      world.completeLevel();
    }
  }
}

/** Red chevrons sweeping along the floor: "a shockwave is coming, jump". */
class FloorWarning {
  constructor(x, floorY, duration) {
    this.kind = 'floorWarning';
    this.isBossAttack = true;
    this.x = x;
    this.floorY = floorY;
    this.duration = duration;
    this.timer = 0;
    this.isActive = true;
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) this.isActive = false;
  }
}

/** Ground shockwave from the boss's slam. Travels toward the runner; jump it. */
class Shockwave {
  constructor(x, floorY) {
    this.kind = 'shockwave';
    this.isBossAttack = true;
    this.x = x;
    this.floorY = floorY;
    this.width = 20;
    this.height = 24;
    this.screenSpeed = 250;
    this.isActive = true;
    this.hasHit = false;
    this.age = 0;
  }

  update(dt, world) {
    this.age += dt;
    // Close toward the player on screen whether they're strafing or standing still.
    this.x += (world.player.vx - this.screenSpeed) * dt;
    const hitbox = { x: this.x, y: this.floorY - this.height, width: this.width, height: this.height };
    if (!this.hasHit && rectsOverlap(hitbox, world.player)) {
      this.hasHit = world.player.takeDamage(world);
    }
    if (this.x < world.camera.x - 80 || this.x > world.camera.x + 900) this.isActive = false;
  }
}

/**
 * Horizontal scan beam across the whole arena at jump height. A dashed line
 * warns first; while it fires, staying on the ground keeps you safe.
 */
class ScanBeam {
  constructor(beamY, warningDuration) {
    this.kind = 'scanBeam';
    this.isBossAttack = true;
    this.beamY = beamY;
    this.warningDuration = warningDuration;
    this.fireDuration = 0.75;
    this.timer = 0;
    this.isActive = true;
    this.hasHit = false;
  }

  get isFiring() {
    return this.timer >= this.warningDuration;
  }

  update(dt, world) {
    this.timer += dt;
    if (this.timer >= this.warningDuration + this.fireDuration) {
      this.isActive = false;
      return;
    }
    if (!this.isFiring) return;
    const player = world.player;
    const beam = { x: world.camera.x, y: this.beamY - 4, width: 640, height: 8 };
    if (!this.hasHit && rectsOverlap(beam, player)) this.hasHit = player.takeDamage(world);
  }
}
