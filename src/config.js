// Central tuning values. Everything a designer is likely to tweak lives here so
// gameplay feel can be adjusted without hunting through system code.
// Units: pixels (at the 640x360 internal resolution) and seconds.

export const VIEW = {
  width: 640,
  height: 360,
};

export const SIMULATION = {
  // Physics runs at a fixed rate so jumps behave identically on 60Hz and 144Hz screens.
  fixedStep: 1 / 120,
  maxFrameTime: 0.25,
};

export const PHYSICS = {
  gravity: 1000,
  // Falling faster than rising makes jumps feel snappy instead of floaty.
  fallGravityMultiplier: 1.45,
  maxFallSpeed: 760,
  // Roofs count as slightly wider when landing, so "just made it" jumps succeed.
  landingGrace: 3,
  // If the player clips a roof corner by this many pixels they are lifted onto it.
  cornerCorrection: 9,
};

export const PLAYER = {
  hitboxWidth: 12,
  hitboxHeight: 44,
  jumpVelocity: 400,
  coyoteTime: 0.1,
  jumpBufferTime: 0.13,
  // Extra jump available after leaving the ground (reset on landing).
  maxAirJumps: 1,
  doubleJumpVelocity: 370,
  maxHealth: 5,
  invulnerableTime: 1.3,
  respawnDelay: 0.9,
  stompBounceVelocity: 300,
  // Screen x the camera keeps the runner at; leaves most of the view for what is ahead.
  screenAnchorX: 168,
};

export const BOUNCE_PAD = {
  width: 28,
  launchVelocity: 720,
  // Extra horizontal speed while airborne after a pad launch, for long arcs to distant roofs.
  airSpeedMultiplier: 1.4,
};

export const BLASTER = {
  fireCooldown: 0.14,
  projectileSpeed: 640,
  projectileLifetime: 0.9,
  maxCharge: 6,
  rechargeInterval: 0.38,
  damage: 1,
  // Aim assist: clicking within this many pixels of a target snaps the shot to it.
  aimAssistRadius: 40,
};

export const ENEMIES = {
  crawler: { width: 18, height: 14, speed: 42, health: 2 },
  sentry: { width: 16, height: 26, health: 3, range: 360, chargeTime: 0.75, cooldown: 2.4, boltSpeed: 175 },
  drone: {
    width: 20,
    height: 14,
    health: 1,
    range: 300,
    chargeTime: 0.85,
    cooldown: 2.4,
    // Slow particle bolt from the under-cannon — easy to jump over.
    boltSpeed: 160,
    laserDamage: 0.25,
    swarmCooldown: 2.0,
    swarmChargeTime: 0.75,
    laserLife: 2.2,
    laserRadius: 3,
  },
  diver: { width: 20, height: 14, health: 1, triggerRange: 300, diveSpeed: 230 },
};

export const DRONE_ENCOUNTER = {
  timeScale: 0.28,
  // Real-time seconds the player has to clear the swarm before it locks on.
  timeLimit: 7,
  lockOnWarningTime: 1.6,
  entrySpeed: 420,
};

export const CAMERA = {
  // Where the player's feet normally sit on screen (fraction of view height).
  groundScreenFraction: 0.7,
  verticalFollowRate: 4,
  // Bias the camera toward the facing direction so the player sees more of where they are going.
  lookAhead: 42,
  lookAheadRate: 3.2,
  // While rising off a bounce pad, keep the runner below this screen y.
  topMargin: 70,
};

/** Soft caps so projectile / laser arrays cannot grow without bound during long fights. */
export const PROJECTILE_CAPS = {
  playerShots: 28,
  enemyBolts: 48,
  droneLasers: 24,
};

export const SCORE = {
  enemy: 100,
  drone: 150,
  shard: 50,
  swarmCleared: 300,
  noDamageBonus: 1000,
};

export const STORAGE_KEY = 'aftershock.save.v1';
