import { BLASTER, BOUNCE_PAD, PHYSICS, PLAYER } from '../config.js';
import { moveBody } from './physics.js';

/**
 * The agent. Horizontal movement defaults to player control (arrow keys / A D);
 * levels may set autoRun for a locked forward pace. Jumping uses coyote time,
 * buffering, and a double jump.
 */
export class Player {
  constructor(x, groundY, runSpeed) {
    this.width = PLAYER.hitboxWidth;
    this.height = PLAYER.hitboxHeight;
    this.runSpeed = runSpeed;
    this.autoRun = false;
    this.speedScale = 1;
    this.health = PLAYER.maxHealth;
    this.hasBlaster = false;
    this.blasterCharge = BLASTER.maxCharge;
    this.placeAt(x, groundY);
  }

  placeAt(x, groundY) {
    this.x = x;
    this.y = groundY - this.height;
    this.speedScale = 1;
    this.vx = this.autoRun ? this.runSpeed : 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = true;
    this.groundPlatform = null;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.airJumpsLeft = PLAYER.maxAirJumps;
    this.airSpeedMultiplier = 1;
    this.isLaunched = false;
    this.invulnerableTimer = 0;
    this.isAlive = true;
    this.runCycleTime = 0;
    this.landingSquash = 0;
    this.fireCooldown = 0;
    this.rechargeTimer = 0;
    this.shootPoseTimer = 0;
    this.aimAngle = 0;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  get bottom() {
    return this.y + this.height;
  }

  get isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  /** Muzzle position in world space (the blaster is held at chest height). */
  get muzzle() {
    return {
      x: this.centerX + Math.cos(this.aimAngle) * 12,
      y: this.y + 22 + Math.sin(this.aimAngle) * 12,
    };
  }

  update(dt, world, { jumpPressed = false, moveAxis = 0 } = {}) {
    if (!this.isAlive) return;

    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.landingSquash = Math.max(0, this.landingSquash - dt * 5);
    this.shootPoseTimer = Math.max(0, this.shootPoseTimer - dt);

    if (jumpPressed) this.jumpBufferTimer = PLAYER.jumpBufferTime;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.grounded) {
      this.coyoteTimer = PLAYER.coyoteTime;
      this.airJumpsLeft = PLAYER.maxAirJumps;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) this.jump(world, false);
      else if (this.airJumpsLeft > 0) this.jump(world, true);
    }

    if (this.autoRun) {
      // Auto-run sectors (1 + boss): constant forward speed. Left/right input is ignored.
      this.facing = 1;
      this.vx = this.runSpeed * this.airSpeedMultiplier * this.speedScale;
    } else {
      // Later sectors: hold left/right to move; release to stop.
      const axis = moveAxis < 0 ? -1 : moveAxis > 0 ? 1 : 0;
      this.vx = 0;
      if (axis !== 0) {
        this.facing = axis;
        this.vx = axis * this.runSpeed * this.airSpeedMultiplier;
      }
    }
    const wasGrounded = this.grounded;
    const fallSpeed = this.vy;
    moveBody(this, dt, world.platforms, { cornerCorrection: PHYSICS.cornerCorrection });
    if (!this.autoRun) {
      const axis = moveAxis < 0 ? -1 : moveAxis > 0 ? 1 : 0;
      if (axis === 0 && !(this.groundPlatform && this.groundPlatform.kind === 'mover')) {
        this.vx = 0;
      }
    }

    if (this.grounded) {
      this.groundPlatform.onStoodOn(world);
      this.airJumpsLeft = PLAYER.maxAirJumps;
      if (!wasGrounded) this.land(world, fallSpeed);
    }

    // Freeze the walk cycle while idle so the sprite does not "shuffle" in place.
    const moving = Math.abs(this.vx) > 8;
    if (this.grounded && moving) this.runCycleTime += dt;
  }

  jump(world, isDouble = false) {
    this.vy = -(isDouble ? PLAYER.doubleJumpVelocity : PLAYER.jumpVelocity);
    this.grounded = false;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    if (isDouble) this.airJumpsLeft = Math.max(0, this.airJumpsLeft - 1);
    world.emit('playerJump', { x: this.centerX, y: this.bottom, isDouble });
  }

  launchFromPad(world, pad) {
    this.vy = -BOUNCE_PAD.launchVelocity;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.airJumpsLeft = PLAYER.maxAirJumps;
    this.airSpeedMultiplier = BOUNCE_PAD.airSpeedMultiplier;
    this.isLaunched = true;
    world.emit('bouncePad', { x: pad.x + pad.width / 2, y: pad.y });
  }

  bounceOffEnemy() {
    this.vy = -PLAYER.stompBounceVelocity;
    this.grounded = false;
  }

  land(world, impactSpeed) {
    this.airSpeedMultiplier = 1;
    this.isLaunched = false;
    this.landingSquash = Math.min(1, impactSpeed / 600);
    world.emit('playerLand', { x: this.centerX, y: this.bottom, impact: impactSpeed });
  }

  /** Returns true if the hit was applied (not blocked by invulnerability). */
  takeDamage(world, amount = 1) {
    if (!this.isAlive || this.isInvulnerable) return false;
    if (world.isPlayerInvincible) {
      // Debug/playtest mode: count the hit for difficulty reports but ignore it.
      world.stats.ignoredHits = (world.stats.ignoredHits ?? 0) + 1;
      this.invulnerableTimer = PLAYER.invulnerableTime;
      return false;
    }
    this.health = Math.max(0, this.health - amount);
    // Chip hits (drone lasers) use a short i-frame so quarter-heart damage can stack.
    this.invulnerableTimer = amount < 1 ? 0.3 : PLAYER.invulnerableTime;
    world.stats.damageTaken += amount;
    world.emit('playerHurt', { x: this.centerX, y: this.centerY, health: this.health });
    if (this.health <= 0) {
      this.isAlive = false;
      world.emit('playerDestroyed', { x: this.centerX, y: this.centerY });
    }
    return true;
  }

  heal(amount = 1) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  /**
   * Blaster logic runs on real (unscaled) time so firing stays snappy during
   * slow-motion drone encounters.
   */
  updateBlaster(realDt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - realDt);
    if (this.blasterCharge < BLASTER.maxCharge) {
      this.rechargeTimer += realDt;
      if (this.rechargeTimer >= BLASTER.rechargeInterval) {
        this.rechargeTimer = 0;
        this.blasterCharge += 1;
      }
    } else {
      this.rechargeTimer = 0;
    }
  }

  canFire() {
    return this.hasBlaster && this.isAlive && this.fireCooldown <= 0 && this.blasterCharge > 0;
  }

  consumeShot() {
    this.blasterCharge -= 1;
    this.fireCooldown = BLASTER.fireCooldown;
    this.shootPoseTimer = 0.18;
  }
}
