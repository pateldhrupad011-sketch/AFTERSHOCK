import { PHYSICS } from '../config.js';

/**
 * Shared movement + collision for every body that walks on platforms
 * (player, crawlers, sentries). Bodies are axis-aligned boxes with:
 *   x, y, width, height, vx, vy, grounded, groundPlatform
 *
 * Horizontal and vertical movement are resolved separately, which keeps
 * corner cases (literally) predictable.
 *
 * Returns { hitWall } so callers can react, e.g. crawlers turning around.
 */
export function moveBody(body, dt, platforms, { gravityScale = 1, cornerCorrection = 0 } = {}) {
  carryWithGroundPlatform(body);

  const gravity = PHYSICS.gravity * gravityScale * (body.vy > 0 ? PHYSICS.fallGravityMultiplier : 1);
  body.vy = Math.min(body.vy + gravity * dt, PHYSICS.maxFallSpeed);

  const hitWall = moveHorizontally(body, body.vx * dt, platforms, cornerCorrection);
  moveVertically(body, body.vy * dt, platforms);
  return { hitWall };
}

function carryWithGroundPlatform(body) {
  const platform = body.groundPlatform;
  if (!body.grounded || !platform) return;
  body.x += platform.deltaX;
  body.y += platform.deltaY;
}

function isNearby(body, platform) {
  return platform.isActive && platform.x < body.x + 400 && platform.x + platform.width > body.x - 400;
}

function moveHorizontally(body, distance, platforms, cornerCorrection) {
  body.x += distance;
  let hitWall = false;

  for (const platform of platforms) {
    if (platform.oneWay || !isNearby(body, platform)) continue;
    if (!overlaps(body, platform)) continue;

    const bottom = body.y + body.height;
    const clippedCorner = bottom - platform.y <= cornerCorrection && body.vy >= 0;
    if (clippedCorner) {
      // Forgiveness: catching a roof corner with your feet lifts you onto it.
      body.y = platform.y - body.height;
      body.vy = 0;
      continue;
    }

    if (distance > 0) body.x = platform.x - body.width;
    else if (distance < 0) body.x = platform.x + platform.width;
    hitWall = true;
  }
  return hitWall;
}

function moveVertically(body, distance, platforms) {
  const previousBottom = body.y + body.height;
  const previousTop = body.y;
  body.y += distance;
  body.grounded = false;
  body.groundPlatform = null;

  for (const platform of platforms) {
    if (!isNearby(body, platform)) continue;
    const grace = PHYSICS.landingGrace;
    const overlapsHorizontally = body.x + body.width > platform.x - grace && body.x < platform.x + platform.width + grace;
    if (!overlapsHorizontally) continue;

    const bottom = body.y + body.height;
    // Compare against where the platform was last step so rising platforms can't tunnel through feet.
    const platformTopBefore = Math.min(platform.previousY, platform.y);
    const wasAbove = previousBottom <= platformTopBefore + 1;
    if (body.vy >= 0 && wasAbove && bottom >= platform.y) {
      body.y = platform.y - body.height;
      body.vy = 0;
      body.grounded = true;
      body.groundPlatform = platform;
      continue;
    }

    if (!platform.oneWay && body.vy < 0) {
      const platformBottom = platform.y + platform.height;
      if (previousTop >= platformBottom && body.y < platformBottom) {
        body.y = platformBottom;
        body.vy = 0;
      }
    }
  }
}

function overlaps(body, platform) {
  return (
    body.x < platform.x + platform.width &&
    body.x + body.width > platform.x &&
    body.y < platform.y + platform.height &&
    body.y + body.height > platform.y
  );
}

/** Height reached and air time for a launch velocity — used by trajectory previews and the level validator. */
export function computeJumpArc(launchVelocity, horizontalSpeed, dropHeight = 0) {
  const riseTime = launchVelocity / PHYSICS.gravity;
  const apexHeight = (launchVelocity * launchVelocity) / (2 * PHYSICS.gravity);
  const fallGravity = PHYSICS.gravity * PHYSICS.fallGravityMultiplier;
  const fallTime = Math.sqrt((2 * Math.max(0, apexHeight + dropHeight)) / fallGravity);
  return {
    apexHeight,
    airTime: riseTime + fallTime,
    distance: (riseTime + fallTime) * horizontalSpeed,
  };
}
