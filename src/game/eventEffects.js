/**
 * Visual feedback ("juice") for world events: dust, sparks, rings and camera
 * shake. Kept in one table so effect tuning lives in one place, separate from
 * the gameplay rules that raise the events.
 */
const EFFECTS = {
  playerJump: (world, e) => world.effects.dust(e.x, e.y, { count: 5, spreadX: 6 }),
  playerLand: (world, e) => {
    if (e.impact > 250) world.effects.dust(e.x, e.y, { count: Math.min(12, Math.round(e.impact / 60)), spreadX: 10 });
  },
  bouncePad: (world, e) => {
    world.effects.burst(e.x, e.y, { count: 18, colors: ['#ff3d8b', '#ff9ec9', '#ffffff'], speed: [80, 220], life: [0.3, 0.6], gravity: 200, direction: -Math.PI / 2, spread: Math.PI * 0.8, glow: false });
    world.effects.ring(e.x, e.y, '#ff3d8b', 36);
    world.camera.shake(2);
  },
  playerShoot: (world, e) => world.effects.burst(e.x, e.y, { count: 3, colors: ['#5ef7ff', '#ffffff'], speed: [30, 90], life: [0.08, 0.16], gravity: 0, direction: e.angle, spread: 0.8, glow: false }),
  playerHurt: (world, e) => {
    world.effects.sparks(e.x, e.y, ['#ff3d6b', '#ffffff'], 14);
    world.camera.shake(5);
  },
  playerDestroyed: (world, e) => {
    world.effects.explosion(e.x, e.y, 1.4);
    world.camera.shake(8);
  },
  checkpoint: (world, e) => world.effects.ring(e.x + 5, e.y - 31, '#5cff9d', 28, 0.6),
  shardCollected: (world, e) => world.effects.burst(e.x + 6, e.y + 6, { count: 6, colors: ['#9af0ff', '#2ec4d6', '#f4ffff'], speed: [20, 70], life: [0.15, 0.35], gravity: 40, glow: false }),
  healthRestored: (world, e) => world.effects.burst(e.x + 4, e.y + 6, { count: 12, colors: ['#3fe08a', '#eafff2'], speed: [30, 100], life: [0.3, 0.6], gravity: -60, glow: false }),
  blasterAcquired: (world, e) => {
    world.effects.ring(e.x + 8, e.y + 4, '#5ef7ff', 40, 0.6);
    world.effects.burst(e.x + 8, e.y + 4, { count: 20, colors: ['#5ef7ff', '#ffffff'], speed: [40, 140], life: [0.3, 0.7], gravity: 0, glow: false });
  },
  structureCollapse: (world, e) => {
    world.effects.dust(e.x, e.y, { count: 24, spreadX: e.width / 2, color: '#5a5262' });
    world.camera.shake(3);
  },
  debrisImpact: (world, e) => {
    world.effects.dust(e.x, e.y, { count: 16, spreadX: 14, color: '#5a5262' });
    world.effects.sparks(e.x, e.y - 4, ['#ffb03b', '#ffffff'], 10);
    world.camera.shake(4);
  },
  droneExploded: (world) => world.camera.shake(3),
  bossSlam: (world, e) => {
    world.effects.dust(e.x - 60, e.y, { count: 20, spreadX: 40, color: '#4a1828' });
    world.camera.shake(7);
  },
  bossCriticalHit: (world, e) => {
    world.effects.sparks(e.x, e.y, ['#ff2a5a', '#ffffff', '#ffe08a'], 14);
    world.camera.shake(2);
  },
  bossArmorHit: (world, e) => world.effects.sparks(e.x, e.y, ['#ffe08a', '#ffffff'], 4),
  bossExplosion: (world) => world.camera.shake(5),
  bossDestroyed: (world) => world.camera.shake(12),
  bossPhaseTwo: (world) => world.camera.shake(6),
};

export function spawnEventEffects(world, event) {
  EFFECTS[event.type]?.(world, event);
}
