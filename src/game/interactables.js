import { BOUNCE_PAD, SCORE } from '../config.js';
import { rectsOverlap } from '../core/math.js';

/** Spring pad that launches the runner high and far. Triggers on any contact from above. */
export class BouncePad {
  constructor(x, y) {
    this.x = x - BOUNCE_PAD.width / 2;
    this.y = y;
    this.width = BOUNCE_PAD.width;
    this.height = 6;
    this.compression = 0;
  }

  update(dt, world) {
    this.compression = Math.max(0, this.compression - dt * 4);
    const player = world.player;
    if (!player.isAlive) return;
    // The pad's lift field reaches a little above it, so a slightly early jump
    // (still rising just off the roof) is caught instead of sailing over the pad.
    const heightAbovePad = this.y - player.bottom;
    const inLiftField = heightAbovePad >= -8 && heightAbovePad <= 22;
    const overHorizontally = player.x + player.width > this.x && player.x < this.x + this.width;
    const isAlreadyLaunched = player.vy < -BOUNCE_PAD.launchVelocity * 0.9;
    if (inLiftField && overHorizontally && !isAlreadyLaunched) {
      this.compression = 1;
      player.launchFromPad(world, this);
    }
  }
}

export class Checkpoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.isReached = false;
  }

  update(dt, world) {
    if (this.isReached || world.player.x < this.x) return;
    this.isReached = true;
    world.setRespawnPoint(this.x, this.y);
    world.emit('checkpoint', { x: this.x, y: this.y });
  }
}

/** End-of-level extraction gate. */
export class FinishGate {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.isReached = false;
  }

  update(dt, world) {
    if (this.isReached || world.player.x < this.x) return;
    this.isReached = true;
    world.completeLevel();
  }
}

class Pickup {
  constructor(x, y, width, height) {
    this.x = x - width / 2;
    this.y = y - height / 2;
    this.width = width;
    this.height = height;
    this.isCollected = false;
    this.bobPhase = x * 0.05;
  }

  update(dt, world) {
    if (this.isCollected || !world.player.isAlive) return;
    // Generous pickup box: collectibles should never feel like near misses.
    const reach = { x: this.x - 6, y: this.y - 6, width: this.width + 12, height: this.height + 12 };
    if (rectsOverlap(reach, world.player)) {
      this.isCollected = true;
      this.collect(world);
    }
  }
}

export class BlasterPickup extends Pickup {
  constructor(x, y) {
    super(x, y, 16, 10);
    this.kind = 'blaster';
  }

  collect(world) {
    world.player.hasBlaster = true;
    world.emit('blasterAcquired', { x: this.x, y: this.y });
  }
}

export class BatteryPickup extends Pickup {
  constructor(x, y) {
    super(x, y, 9, 12);
    this.kind = 'battery';
  }

  collect(world) {
    world.player.heal(1);
    world.emit('healthRestored', { x: this.x, y: this.y });
  }
}

export class DataShard extends Pickup {
  constructor(x, y) {
    super(x, y, 13, 13);
    this.kind = 'shard';
  }

  collect(world) {
    world.stats.shards += 1;
    world.addScore(SCORE.shard, this.x, this.y);
    world.emit('shardCollected', { x: this.x, y: this.y });
  }
}

/** Fires once when the runner passes `x`: radio messages, background collapses, etc. */
export class ScriptTrigger {
  constructor(x, action) {
    this.x = x;
    this.action = action;
    this.hasFired = false;
  }

  update(dt, world) {
    if (this.hasFired || world.player.x < this.x) return;
    this.hasFired = true;
    this.action(world);
  }
}
