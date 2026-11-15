/*
 * Headless playtest: proves every level can be completed by a player who
 * only jumps (no shooting), using the real game simulation.
 *
 * A bot searches for jump timings with depth-first backtracking: run the
 * level, and when the runner falls or gets stuck, try adding a jump at
 * progressively earlier moments before the failure.
 *
 * Usage: node tools/playtest-levels.mjs [levelNumber]
 */
import { SIMULATION } from '../src/config.js';
import { BOSS_ARENA, LEVELS } from '../src/data/levels.js';
import { ARCHITECT } from '../src/game/boss.js';
import { buildLevelLayout } from '../src/game/levelBuilder.js';
import { World } from '../src/game/world.js';

const STEP = SIMULATION.fixedStep;
const MAX_SECONDS = 150;
const CANDIDATE_SPACING = 4; // steps between candidate jump moments (~33ms)
const MAX_CANDIDATES_PER_FAILURE = 45;
const MAX_SIMULATIONS = 4000;

function simulate(level, jumpSteps) {
  const world = new World(level, { startWithBlaster: true, invincible: true });
  const jumps = new Set(jumpSteps);
  let lastProgressX = world.player.x;
  let lastProgressStep = 0;
  // Steps at which a jump press would actually do something (on ground or in coyote time).
  const jumpableSteps = [];

  for (let step = 0; step < MAX_SECONDS / STEP; step++) {
    if (world.player.grounded || world.player.coyoteTimer > 0) jumpableSteps.push(step);
    // Always hold right — movement is player-controlled now.
    world.update(STEP, {
      jumpPressed: jumps.has(step),
      moveAxis: 1,
      firePressed: false,
      fireHeld: false,
      aimX: 400,
      aimY: 180,
    });
    world.drainEvents();

    if (world.state === 'complete') return { outcome: 'complete', step, world, jumpableSteps };
    if (world.state === 'respawning' || world.state === 'dying') return { outcome: 'fell', step, world, jumpableSteps };

    if (world.player.x > lastProgressX + 1) {
      lastProgressX = world.player.x;
      lastProgressStep = step;
    } else if (step - lastProgressStep > 90) {
      return { outcome: 'stuck', step, world, jumpableSteps };
    }
  }
  return { outcome: 'timeout', step: MAX_SECONDS / STEP, world, jumpableSteps };
}

function solveLevel(level) {
  let simulations = 0;
  let furthestFailure = null;

  function search(jumps) {
    simulations += 1;
    const result = simulate(level, jumps);
    if (result.outcome === 'complete') return { jumps, result };
    if (!furthestFailure || result.world.player.x > furthestFailure.x) {
      furthestFailure = { x: Math.round(result.world.player.x), outcome: result.outcome };
    }
    if (simulations > MAX_SIMULATIONS || result.outcome === 'timeout') return null;

    const lastJump = jumps.at(-1) ?? -1;
    const candidates = result.jumpableSteps
      .filter((step) => step > lastJump + 10 && step < result.step)
      .reverse()
      .filter((_, index) => index % CANDIDATE_SPACING === 0)
      .slice(0, MAX_CANDIDATES_PER_FAILURE);
    for (const candidate of candidates) {
      const solution = search([...jumps, candidate]);
      if (solution) return solution;
    }
    return null;
  }

  const solution = search([]);
  return { solution, simulations, furthestFailure };
}

// Fairness lint: after jumping a ground obstacle you need room to land before
// the roof ends, otherwise the "correct" jump drops you into a gap.
const GROUND_OBSTACLES = new Set(['crate', 'shockStrip', 'steamVent', 'debris']);
const MIN_RUNWAY_AFTER_OBSTACLE = 170;

function findObstacleTraps(level) {
  const layout = buildLevelLayout(level);
  const roofs = layout.platforms.filter((p) => p.kind === 'building' || p.kind === 'collapsing');
  const obstacles = [
    ...layout.items.filter((item) => GROUND_OBSTACLES.has(item.type) || (item.type === 'laser' && (item.height ?? 10) < 30)),
    ...layout.platforms.filter((p) => p.kind === 'crate').map((p) => ({ type: 'crate', x: p.x })),
  ];
  const traps = [];
  for (const obstacle of obstacles) {
    const roofUnder = roofs.find((r) => obstacle.x >= r.x && obstacle.x < r.x + r.width);
    if (!roofUnder) continue;
    const runway = roofUnder.x + roofUnder.width - obstacle.x;
    if (runway < MIN_RUNWAY_AFTER_OBSTACLE) traps.push(`${obstacle.type} at x=${obstacle.x} has only ${runway}px before the roof edge`);
  }
  return traps;
}

const onlyLevel = Number(process.argv[2]) || null;
let allPassed = true;

for (const level of LEVELS) {
  if (onlyLevel && level.number !== onlyLevel) continue;
  const traps = findObstacleTraps(level);
  for (const trap of traps) console.log(`WARN  Level ${level.number}: ${trap}`);
  if (traps.length) allPassed = false;
  const started = performance.now();
  const { solution, simulations, furthestFailure } = solveLevel(level);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  if (solution) {
    const { world } = solution.result;
    console.log(
      `PASS  Level ${level.number} "${level.name}": ${world.stats.time.toFixed(1)}s of play, ` +
      `${solution.jumps.length} jumps, ${world.stats.shards}/${world.stats.totalShards} shards by accident, ` +
      `${world.stats.ignoredHits ?? 0} hits a non-shooting player would take ` +
      `(${simulations} simulations, ${seconds}s)`,
    );
  } else {
    allPassed = false;
    console.log(
      `FAIL  Level ${level.number} "${level.name}": could not get past x=${furthestFailure.x} ` +
      `(${furthestFailure.outcome}) after ${simulations} simulations`,
    );
  }
}

/**
 * Boss check: a bot that aims at the open core (armor otherwise), jumps
 * shockwaves and stays grounded while a scan beam is charging or firing.
 */
function simulateBoss() {
  const world = new World(BOSS_ARENA, { startWithBlaster: true, invincible: true });
  for (let step = 0; step < 120 / STEP; step++) {
    const { boss, player, camera } = world;
    const target = boss.isCoreExposed ? boss.core : { x: boss.centerX, y: boss.centerY };
    const beamActive = world.hazards.some((h) => h.kind === 'scanBeam' && h.timer > h.warningDuration - 0.8);
    const waveIncoming = world.hazards.some((h) => h.kind === 'shockwave' && h.x - player.x < 90 && h.x > player.x);
    world.update(STEP, {
      jumpPressed: waveIncoming && !beamActive,
      moveAxis: 1,
      // Single-click firing: press every step; the blaster cooldown gates the rate.
      firePressed: boss.state === 'fighting',
      fireHeld: false,
      aimX: target.x - camera.x,
      aimY: target.y - camera.y,
    });
    world.drainEvents();
    if (boss.state === 'dying' || boss.state === 'destroyed') {
      return { defeated: true, seconds: world.stats.time - ARCHITECT.revealDuration, hits: world.stats.ignoredHits ?? 0 };
    }
  }
  return { defeated: false };
}

if (!onlyLevel || onlyLevel === BOSS_ARENA.number) {
  const boss = simulateBoss();
  if (boss.defeated) {
    console.log(`PASS  THE ARCHITECT: defeated in ${boss.seconds.toFixed(1)}s of fighting, ${boss.hits} hits taken by the bot`);
  } else {
    allPassed = false;
    console.log('FAIL  THE ARCHITECT: not defeated within 120s');
  }
}

process.exit(allPassed ? 0 : 1);
