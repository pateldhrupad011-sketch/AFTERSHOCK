import { createSeededRandom } from '../core/math.js';

/*
 * Level authoring vocabulary.
 *
 * A level is a left-to-right list of segments: `roof(length)` places a
 * building whose top is the running surface, `gap(width)` leaves empty
 * space. Each roof can change height with `dy` (negative = higher).
 *
 * Items are positioned with `at`, measured in pixels from the start of the
 * segment they belong to. Flying items take a `height` above the roof.
 *
 *   roof(600, { checkpoint: true, items: [crawler(300), shard(200, 40)] }),
 *   gap(110),
 *   roof(400, { dy: -30, items: [pad(340)] }),
 */

export const roof = (length, options = {}) => ({ segment: 'roof', length, ...options });
export const gap = (width, options = {}) => ({ segment: 'gap', width, ...options });

export const pad = (at) => ({ type: 'bouncePad', at });
export const crawler = (at, patrolDistance = 70) => ({ type: 'crawler', at, patrolDistance });
export const sentry = (at) => ({ type: 'sentry', at });
export const drone = (at, height = 95) => ({ type: 'drone', at, height });
export const diver = (at, height = 130) => ({ type: 'diver', at, height });
export const shard = (at, height = 28) => ({ type: 'shard', at, height });
export const battery = (at, height = 26) => ({ type: 'battery', at, height });
export const blaster = (at) => ({ type: 'blaster', at, height: 22 });
export const crate = (at, width = 22, height = 18) => ({ type: 'crate', at, width, height });
export const shockStrip = (at, width = 30) => ({ type: 'shockStrip', at, width });
export const steamVent = (at, options = {}) => ({ type: 'steamVent', at, ...options });
export const laser = (at, options = {}) => ({ type: 'laser', at, ...options });
export const debris = (at, size = 18) => ({ type: 'debris', at, size });
export const finish = (at) => ({ type: 'finish', at });

/** A girder hovering in a gap. `dy` is relative to the previous roof height. */
export const ledge = (at, width, dy = 0) => ({ type: 'ledge', at, width, dy });

/** A girder that oscillates by (moveX, moveY) over `period` seconds. */
export const mover = (at, { width = 60, dy = 0, moveX = 0, moveY = 0, period = 3, phase = 0 } = {}) =>
  ({ type: 'mover', at, width, dy, moveX, moveY, period, phase });

/** Slow-motion drone swarm encounter, triggered when the runner passes `at`. */
export const swarm = (at, count = 4, slotOffset = 0) => ({ type: 'swarm', at, count, slotOffset });

/** The Hunter gunship chases the runner from `at` for `distance` pixels. */
export const gunship = (at, distance) => ({ type: 'gunship', at, distance });

/** Radio message shown in the HUD when the runner passes `at`. */
export const message = (at, speaker, text) => ({ type: 'message', at, speaker, text });

/** Collapses a background building (pure spectacle + screen shake). */
export const collapseEvent = (at, layer = 'near') => ({ type: 'collapse', at, layer });

/** Shards laid out along a jump-shaped arc, rewarding a well-timed jump. */
export function shardArc(at, count = 3, spacing = 26, peak = 60) {
  const shards = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    shards.push(shard(at + i * spacing, 22 + Math.sin(t * Math.PI) * peak));
  }
  return shards;
}

const ROOF_PROP_TYPES = ['acUnit', 'antenna', 'waterTank', 'vent', 'satellite'];

/**
 * Converts a level definition into plain placement data (no game objects),
 * so it can be validated or rendered as a preview without running the game.
 */
export function buildLevelLayout(definition) {
  const random = createSeededRandom(definition.number * 7919 + 13);
  const platforms = [];
  const items = [];
  const decorations = [];
  let cursorX = 0;
  let roofY = 0;
  let lowestRoofY = 0;
  let highestRoofY = 0;
  let start = null;

  const placeItems = (list = [], baseX, baseY) => {
    for (const item of list.flat()) {
      const x = baseX + item.at;
      if (item.type === 'mover' || item.type === 'ledge') {
        platforms.push({ ...item, kind: item.type, x, y: baseY + item.dy });
      } else if (item.type === 'crate') {
        platforms.push({ kind: 'crate', x, y: baseY - item.height, width: item.width, height: item.height });
      } else {
        items.push({ ...item, x, y: baseY + (item.dy ?? 0) - (item.height ?? 0), roofY: baseY });
      }
    }
  };

  for (const segment of definition.layout) {
    if (segment.segment === 'roof') {
      roofY += segment.dy ?? 0;
      lowestRoofY = Math.max(lowestRoofY, roofY);
      highestRoofY = Math.min(highestRoofY, roofY);
      platforms.push({
        kind: segment.collapse ? 'collapsing' : 'building',
        x: cursorX,
        y: roofY,
        width: segment.length,
        style: segment.style ?? random.int(0, 2),
        warningDuration: segment.collapseDelay,
      });
      if (!start) start = { x: cursorX + 48, y: roofY };
      if (segment.checkpoint) items.push({ type: 'checkpoint', x: cursorX + 24, y: roofY });
      placeItems(segment.items, cursorX, roofY);
      if (!segment.collapse) decorations.push(...generateRoofProps(random, cursorX, roofY, segment.length));
      cursorX += segment.length;
    } else {
      placeItems(segment.items, cursorX, roofY);
      cursorX += segment.width;
    }
  }

  return {
    platforms,
    items,
    decorations,
    start,
    length: cursorX,
    lowestRoofY,
    highestRoofY,
    totalShards: items.filter((item) => item.type === 'shard').length,
  };
}

function generateRoofProps(random, roofX, roofY, roofLength) {
  const props = [];
  let x = roofX + random.range(30, 90);
  while (x < roofX + roofLength - 40) {
    props.push({ type: random.pick(ROOF_PROP_TYPES), x, y: roofY, variant: random.int(0, 3) });
    x += random.range(90, 220);
  }
  return props;
}
