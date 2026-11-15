import { BLASTER, CAMERA, DRONE_ENCOUNTER, ENEMIES, PLAYER, PROJECTILE_CAPS, SCORE, VIEW } from '../config.js';
import { approach, rectsOverlap } from '../core/math.js';
import { Architect } from './boss.js';
import { Camera } from './camera.js';
import { Drone, DroneEncounter, Gunship } from './drones.js';
import { EffectsSystem } from './effects.js';
import { spawnEventEffects } from './eventEffects.js';
import { Crawler, Sentry } from './enemies.js';
import { FallingDebris, LaserBarrier, ShockStrip, SteamVent, TriangleRubble } from './hazards.js';
import { BatteryPickup, BlasterPickup, BouncePad, Checkpoint, DataShard, FinishGate, ScriptTrigger } from './interactables.js';
import { buildLevelLayout } from './levelBuilder.js';
import { CollapsingPlatform, MovingPlatform, Platform } from './platforms.js';
import { Player } from './player.js';
import { PlayerShot } from './projectiles.js';

const PLATFORM_FACTORIES = {
  building: (spec) => new Platform(spec),
  collapsing: (spec) => new CollapsingPlatform(spec),
  crate: (spec) => new Platform({ ...spec, kind: 'crate' }),
  ledge: (spec) => new Platform({ ...spec, height: 8, kind: 'ledge', oneWay: true }),
  mover: (spec) => new MovingPlatform(spec),
};

/**
 * The simulation for one level (or the boss arena). Owns every entity and
 * advances them in a fixed order. Contains no rendering or DOM code: it
 * communicates outward through `events`, which the gameplay screen drains
 * each frame to drive sound, HUD and camera effects.
 */
export class World {
  constructor(level, { startWithBlaster = false, invincible = false } = {}) {
    this.level = level;
    this.layout = buildLevelLayout(level);
    this.events = [];
    this.effects = new EffectsSystem();
    this.camera = new Camera();
    this.isPlayerInvincible = invincible;

    this.time = 0;
    this.timeScale = 1;
    this.isSlowMotion = false;
    this.hitStopTimer = 0;
    this.state = 'playing';
    this.stateTimer = 0;
    this.activeEncounter = null;
    this.droneFireTurn = 0;
    this.obstacleSpawnTimer = 1.4;
    this.lockedTarget = null;
    this.aimWorldX = 0;
    this.aimWorldY = 0;
    this.boss = null;

    this.stats = {
      time: 0,
      kills: 0,
      shards: 0,
      totalShards: this.layout.totalShards,
      damageTaken: 0,
      score: 0,
      shotsFired: 0,
    };

    this.populate();

    const start = this.layout.start;
    this.player = new Player(start.x, start.y, level.runSpeed);
    this.player.autoRun = Boolean(level.autoRun);
    this.player.hasBlaster = startWithBlaster;
    this.respawnPoint = { x: start.x, y: start.y };
    this.killY = this.layout.lowestRoofY + 260;
    // Keep the player from walking off the left edge of the authored start roof.
    this.minPlayerX = start.x - 24;
    this.camera.minX = start.x - PLAYER.screenAnchorX - 8;
    this.camera.lowestAllowedY = this.layout.lowestRoofY - VIEW.height * CAMERA.groundScreenFraction + 50;
    this.camera.snapTo(this.player);

    if (level.isBossArena) {
      this.boss = new Architect(start.y);
      this.boss.startReveal(this);
    }
  }

  populate() {
    this.platforms = this.layout.platforms.map((spec) => PLATFORM_FACTORIES[spec.kind](spec));
    this.pads = [];
    this.hazards = [];
    this.enemies = [];
    this.drones = [];
    this.pickups = [];
    this.checkpoints = [];
    this.triggers = [];
    this.playerShots = [];
    this.enemyBolts = [];
    this.droneLasers = [];
    this.pursuers = [];
    this.finishGate = null;

    for (const item of this.layout.items) this.createEntity(item);
  }

  createEntity(item) {
    switch (item.type) {
      case 'bouncePad': this.pads.push(new BouncePad(item.x, item.roofY)); break;
      case 'checkpoint': this.checkpoints.push(new Checkpoint(item.x, item.y)); break;
      case 'finish': this.finishGate = new FinishGate(item.x, item.roofY); break;
      case 'crawler': this.enemies.push(new Crawler(item.x, item.roofY, item)); break;
      case 'sentry': this.enemies.push(new Sentry(item.x, item.roofY)); break;
      case 'drone': this.drones.push(new Drone(item.x, item.y, 'hover')); break;
      case 'diver': this.drones.push(new Drone(item.x, item.y, 'diver')); break;
      case 'shard': this.pickups.push(new DataShard(item.x, item.y)); break;
      case 'battery': this.pickups.push(new BatteryPickup(item.x, item.y)); break;
      case 'blaster': this.pickups.push(new BlasterPickup(item.x, item.y)); break;
      case 'shockStrip': this.hazards.push(new ShockStrip(item.x, item.roofY, item.width)); break;
      case 'steamVent': this.hazards.push(new SteamVent(item.x, item.roofY, item)); break;
      case 'laser': this.hazards.push(new LaserBarrier(item.x, item.roofY, item)); break;
      case 'debris': this.hazards.push(new FallingDebris(item.x, item.roofY, item)); break;
      case 'message':
        this.triggers.push(new ScriptTrigger(item.x, (world) => world.emit('radioMessage', { speaker: item.speaker, text: item.text })));
        break;
      case 'collapse':
        this.triggers.push(new ScriptTrigger(item.x, (world) => world.triggerBackgroundCollapse(item.layer)));
        break;
      case 'gunship':
        this.triggers.push(new ScriptTrigger(item.x, (world) => {
          world.pursuers.push(new Gunship(item.x + item.distance));
          world.emit('gunshipArrives', {});
        }));
        break;
      case 'swarm': {
        const trigger = new ScriptTrigger(item.x, (world) => world.startDroneEncounter(new DroneEncounter(item)));
        trigger.rearmOnRespawn = true;
        this.triggers.push(trigger);
        break;
      }
      default:
        throw new Error(`Unknown level item type "${item.type}" in level ${this.level.number}`);
    }
  }

  emit(type, data = {}) {
    const event = { type, ...data };
    this.events.push(event);
    spawnEventEffects(this, event);
  }

  drainEvents() {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  /**
   * Advances the simulation. `realDt` is wall-clock time; most of the world
   * runs on `dt` (scaled by slow motion), while aiming, player shots and
   * swarm drones use real time so the player keeps full control.
   */
  update(realDt, controls) {
    this.updateTimeScale(realDt);
    const dt = realDt * this.timeScale;
    this.time += dt;
    this.stateTimer += realDt;

    if (this.state === 'playing') this.stats.time += dt;
    if (this.state === 'respawning' && this.stateTimer >= PLAYER.respawnDelay) this.respawnPlayer();
    if (this.state === 'dying' && this.stateTimer >= 1.4) {
      this.state = 'failed';
      this.emit('levelFailed', {});
    }

    for (const platform of this.platforms) platform.update(dt, this);
    // Remove rubble/fallen structures that no longer exist.
    if (this.platforms.some((platform) => !platform.isActive && platform.kind === 'rubble')) {
      this.platforms = this.platforms.filter((platform) => platform.isActive || platform.kind !== 'rubble');
    }

    const canAct = this.state === 'playing' || this.state === 'complete';
    if (canAct) {
      this.player.update(dt, this, {
        jumpPressed: controls.jumpPressed,
        // autoRun levels ignore steering; every campaign sector currently uses manual move.
        moveAxis: this.player.autoRun ? 0 : (controls.moveAxis ?? 0),
      });
      if (this.player.x < this.minPlayerX) this.player.x = this.minPlayerX;
      this.updateAiming(realDt, controls);
      if (this.player.y > this.killY && this.state === 'playing') this.handlePlayerFell();
    }

    for (const pad of this.pads) pad.update(dt, this);
    if (this.state === 'playing') {
      for (const checkpoint of this.checkpoints) checkpoint.update(dt, this);
      for (const pickup of this.pickups) {
        if (!pickup.isCollected) pickup.update(dt, this);
      }
      for (const trigger of this.triggers) trigger.update(dt, this);
      this.finishGate?.update(dt, this);
    }

    for (const hazard of this.hazards) hazard.update(dt, this);
    this.hazards = this.hazards.filter((hazard) => hazard.isActive !== false);
    for (const enemy of this.enemies) enemy.update(dt, this);
    // Drop wrecked robots after they have sat as debris for a few seconds.
    this.enemies = this.enemies.filter((enemy) => !(enemy.isDisabled && enemy.wreckTimer > 7));
    for (const drone of this.drones) drone.update(dt, realDt, this);
    this.drones = this.drones.filter((drone) => drone.isActive);
    for (const pursuer of this.pursuers) pursuer.update(dt, this);
    this.pursuers = this.pursuers.filter((pursuer) => pursuer.isActive);

    if (this.activeEncounter) {
      this.activeEncounter.update(realDt, this);
      if (this.activeEncounter.isFinished) this.activeEncounter = null;
    }
    this.boss?.update(dt, realDt, this);
    if (this.level.isBossArena && this.state === 'playing') {
      this.updateBossArenaHazards(dt);
    }

    this.updateProjectiles(dt, realDt);
    this.effects.update(dt);
    this.camera.update(realDt, this.player);

    if (this.player.isAlive === false && this.state === 'playing') {
      this.state = 'dying';
      this.stateTimer = 0;
      this.endDroneEncounter();
    }
  }

  updateTimeScale(realDt) {
    this.hitStopTimer = Math.max(0, this.hitStopTimer - realDt);
    const target = this.isSlowMotion ? DRONE_ENCOUNTER.timeScale : 1;
    this.timeScale = approach(this.timeScale, target, 9, realDt);
    if (this.hitStopTimer > 0) this.timeScale = Math.min(this.timeScale, 0.08);
  }

  updateAiming(realDt, controls) {
    const player = this.player;
    player.updateBlaster(realDt);
    this.aimWorldX = this.camera.x + controls.aimX;
    this.aimWorldY = this.camera.y + controls.aimY;
    this.lockedTarget = player.hasBlaster ? this.findTargetNear(this.aimWorldX, this.aimWorldY) : null;

    const aimX = this.lockedTarget ? this.lockedTarget.x : this.aimWorldX;
    const aimY = this.lockedTarget ? this.lockedTarget.y : this.aimWorldY;
    player.aimAngle = Math.atan2(aimY - (player.y + 22), aimX - player.centerX);

    // One shot per click — holding the button does not auto-fire.
    if (!controls.firePressed) return;
    if (!player.hasBlaster) {
      this.emit('noWeapon', {});
      return;
    }
    if (!player.canFire()) {
      if (player.blasterCharge === 0) this.emit('blasterEmpty', {});
      return;
    }
    const muzzle = player.muzzle;
    // Manual fire aims purely at the cursor; auto-run inherits forward velocity
    // so shots stay lined up with the aim point while the camera scrolls.
    const inheritX = player.autoRun ? player.vx * this.timeScale : 0;
    if (this.playerShots.length >= PROJECTILE_CAPS.playerShots) this.playerShots.shift();
    this.playerShots.push(new PlayerShot(muzzle.x, muzzle.y, player.aimAngle, inheritX));
    player.consumeShot();
    this.stats.shotsFired += 1;
    this.emit('playerShoot', { x: muzzle.x, y: muzzle.y, angle: player.aimAngle });
  }

  /** Aim assist: the closest shootable thing near the cursor, as a point to aim at. */
  findTargetNear(worldX, worldY) {
    let best = null;
    let bestDistance = BLASTER.aimAssistRadius;
    const consider = (entity, x, y, padding) => {
      const d = Math.hypot(x - worldX, y - worldY) - padding;
      if (d < bestDistance) {
        bestDistance = d;
        best = { entity, x, y };
      }
    };
    // Drones get a bigger assist radius so swarm / hover targets lock easily.
    for (const drone of this.drones) if (drone.isTargetable) consider(drone, drone.centerX, drone.centerY, 18);
    for (const enemy of this.enemies) if (enemy.isTargetable) consider(enemy, enemy.centerX, enemy.centerY, 8);
    for (const bolt of this.enemyBolts) consider(bolt, bolt.x, bolt.y, bolt.radius);
    if (this.boss?.isCoreExposed && this.boss.state === 'fighting') consider(this.boss, this.boss.core.x, this.boss.core.y, 14);
    return best;
  }

  updateProjectiles(dt, realDt) {
    for (const shot of this.playerShots) {
      shot.update(realDt);
      if (shot.isActive) this.resolvePlayerShot(shot);
    }
    this.playerShots = this.playerShots.filter((shot) => shot.isActive);

    const player = this.player;
    for (const bolt of this.enemyBolts) {
      bolt.update(dt);
      if (!bolt.isActive) continue;
      const boltBox = { x: bolt.x - bolt.radius, y: bolt.y - bolt.radius, width: bolt.radius * 2, height: bolt.radius * 2 };
      if (player.isAlive && rectsOverlap(boltBox, player)) {
        bolt.isActive = false;
        player.takeDamage(this, bolt.damage ?? 1);
      } else if (this.isInsideSolid(bolt.x, bolt.y)) {
        bolt.isActive = false;
        this.effects.sparks(bolt.x, bolt.y, ['#ff6b8b', '#ffffff'], 5);
      }
    }
    this.enemyBolts = this.enemyBolts.filter((bolt) => bolt.isActive);

    for (const laser of this.droneLasers) laser.update(realDt, this);
    this.droneLasers = this.droneLasers.filter((laser) => laser.isActive);
  }

  resolvePlayerShot(shot) {
    const hitsBox = (entity, pad = 0) =>
      shot.x > entity.x - shot.radius - pad && shot.x < entity.x + entity.width + shot.radius + pad &&
      shot.y > entity.y - shot.radius - pad && shot.y < entity.y + entity.height + shot.radius + pad;

    // Generous drone hitbox so hover + swarm targets are easy to clip.
    for (const drone of this.drones) {
      if (drone.isTargetable && hitsBox(drone, 8)) {
        drone.hit(this, BLASTER.damage);
        return this.endShot(shot, '#8ff8ff');
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.isTargetable && hitsBox(enemy)) {
        enemy.hit(this, BLASTER.damage, shot.x);
        return this.endShot(shot, '#8ff8ff');
      }
    }
    for (const bolt of this.enemyBolts) {
      if (Math.hypot(bolt.x - shot.x, bolt.y - shot.y) < bolt.radius + shot.radius + 2) {
        bolt.hit(this);
        this.addScore(10, bolt.x, bolt.y);
        return this.endShot(shot, '#ff9ec9');
      }
    }
    if (this.boss && this.boss.receiveShot(this, shot) > 0) {
      return this.endShot(shot, this.boss.isCoreExposed ? '#ff5a7a' : '#ffe08a');
    }
    // Energy shots pass through rooftops so drones above/below remain hittable.
    if (this.activeEncounter || this.drones.some((drone) => drone.isTargetable)) return;
    if (this.isInsideSolid(shot.x, shot.y)) this.endShot(shot, '#5ef7ff');
  }

  endShot(shot, color) {
    shot.isActive = false;
    this.effects.burst(shot.x, shot.y, { count: 6, colors: [color, '#ffffff'], speed: [30, 120], life: [0.1, 0.25], gravity: 0, glow: false });
  }

  isInsideSolid(x, y) {
    return this.platforms.some((p) => p.isActive && !p.oneWay && x > p.x && x < p.x + p.width && y > p.y && y < p.y + p.height);
  }

  spawnEnemyBolt(bolt) {
    if (this.enemyBolts.length >= PROJECTILE_CAPS.enemyBolts) this.enemyBolts.shift();
    this.enemyBolts.push(bolt);
  }

  spawnDroneLaser(laser) {
    if (this.droneLasers.length >= PROJECTILE_CAPS.droneLasers) this.droneLasers.shift();
    this.droneLasers.push(laser);
  }

  /**
   * Boss arena: triangle rubble near the player so the floor stays dangerous
   * while they strafe and fight the Architect.
   */
  updateBossArenaHazards(dt) {
    const player = this.player;
    if (!this.level.isBossArena || !player.isAlive) return;
    if (this.boss && (this.boss.state === 'reveal' || this.boss.state === 'dying' || this.boss.state === 'destroyed')) {
      return;
    }

    this.obstacleSpawnTimer -= dt;
    if (this.obstacleSpawnTimer <= 0) {
      const floorY = player.groundPlatform?.y ?? this.layout.start.y;
      const side = Math.random() < 0.5 ? -1 : 1;
      const spot = player.x + side * (90 + Math.random() * 160);
      const sizeRoll = Math.random();
      const width = sizeRoll < 0.25 ? 20 : sizeRoll < 0.65 ? 28 : 36;
      const height = Math.round(width * 0.78);
      this.hazards.push(new TriangleRubble(spot, floorY, { width, height }));
      if (Math.random() < 0.45) {
        this.hazards.push(new TriangleRubble(spot + side * (50 + Math.random() * 40), floorY, {
          width: 18 + Math.floor(Math.random() * 10),
          height: 14 + Math.floor(Math.random() * 8),
        }));
      }
      this.obstacleSpawnTimer = 0.9 + Math.random() * 1.7;
    }
  }

  /**
   * Only one drone may charge or fire at a time. Ready drones take turns in
   * spawn order so lasers arrive one-by-one and stay dodgeable.
   */
  canDroneFireLaser(drone) {
    if (!drone.isTargetable || drone.isFleeing || drone.behavior === 'diver') return false;
    const charging = this.drones.find((other) => other !== drone && other.isTargetable && other.chargeTimer > 0);
    if (charging) return false;
    if (drone.chargeTimer > 0) return true;
    if (drone.cooldownTimer > 0) return false;

    const ready = this.drones.filter((other) => {
      if (!other.isTargetable || other.isFleeing || other.behavior === 'diver') return false;
      if (other.cooldownTimer > 0 || other.chargeTimer > 0) return false;
      if (other.behavior === 'hover') {
        return Math.abs(this.player.centerX - other.centerX) <= ENEMIES.drone.range;
      }
      return true;
    });
    if (ready.length === 0) return false;
    return ready[this.droneFireTurn % ready.length] === drone;
  }

  advanceDroneFireTurn() {
    this.droneFireTurn += 1;
  }

  registerKill(entity, points) {
    this.stats.kills += 1;
    this.addScore(points, entity.centerX, entity.y - 6);
    this.hitStopTimer = 0.045;
    this.effects.sparks(entity.centerX, entity.centerY, ['#ffffff', '#5ef7ff', '#ffe08a'], 16);
    this.camera.shake(2.5);
    this.emit('enemyDestroyed', { x: entity.centerX, y: entity.centerY, kind: entity.kind });
  }

  addScore(points, x, y) {
    this.stats.score += points;
    this.effects.popup(x, y, `+${points}`, '#ffe08a');
  }

  crushEnemiesInArea(area) {
    for (const enemy of this.enemies) {
      if (!enemy.isDisabled && rectsOverlap(area, enemy)) enemy.disable(this, 'crushed');
    }
  }

  setSlowMotion(isEnabled) {
    this.isSlowMotion = isEnabled;
  }

  startDroneEncounter(encounter) {
    if (this.activeEncounter) return;
    this.activeEncounter = encounter;
    encounter.start(this);
  }

  /** Cancels any swarm without consequences (used on respawn and boss death). */
  endDroneEncounter() {
    if (!this.activeEncounter) return;
    for (const drone of this.activeEncounter.drones) drone.isActive = false;
    this.activeEncounter.isFinished = true;
    this.activeEncounter = null;
    this.setSlowMotion(false);
    this.emit('swarmEnd', { outcome: 'cancelled' });
  }

  triggerBackgroundCollapse(layer) {
    this.camera.shake(layer === 'near' ? 4 : 2);
    this.emit('backgroundCollapse', { layer });
  }

  setRespawnPoint(x, y) {
    this.respawnPoint = { x, y };
  }

  handlePlayerFell() {
    const player = this.player;
    player.isAlive = false;
    player.health = Math.max(0, player.health - 1);
    this.stats.damageTaken += 1;
    this.endDroneEncounter();
    if (player.health <= 0) {
      this.state = 'dying';
      this.emit('playerDestroyed', { x: player.centerX, y: player.y });
    } else {
      this.state = 'respawning';
      this.emit('playerFell', { health: player.health });
    }
    this.stateTimer = 0;
  }

  respawnPlayer() {
    const { x, y } = this.respawnPoint;
    const health = this.player.health;
    this.player.placeAt(x, y);
    this.player.health = health;
    this.player.invulnerableTimer = PLAYER.invulnerableTime;
    this.enemyBolts = [];
    this.droneLasers = [];
    for (const platform of this.platforms) if (platform.x > x - 40) platform.reset();
    for (const hazard of this.hazards) if (hazard.kind === 'debris' && hazard.landX > x) hazard.reset();
    for (const trigger of this.triggers) if (trigger.rearmOnRespawn && trigger.x > x) trigger.hasFired = false;
    this.camera.snapTo(this.player);
    this.state = 'playing';
    this.emit('playerRespawn', { x, y });
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.stateTimer = 0;
    this.endDroneEncounter();
    if (this.stats.damageTaken === 0) this.stats.score += SCORE.noDamageBonus;
    this.emit('levelComplete', {});
  }

  /** 0..1 progress through the level, for the HUD progress bar. */
  get progress() {
    const startX = this.layout.start.x;
    const endX = this.finishGate ? this.finishGate.x : this.layout.length;
    return Math.min(1, Math.max(0, (this.player.x - startX) / (endX - startX)));
  }
}
