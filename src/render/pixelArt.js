import { createCanvas } from './canvas.js';

/*
 * Hand-authored pixel art for enemies, pickups and icons.
 * Each sprite is a list of equal-length rows; every character maps to a
 * colour in the palette ('.' is transparent). Edit the rows to redraw a
 * sprite — no image editor required.
 */

const METAL = {
  o: '#07060c', // outline
  d: '#262838', // dark plate
  m: '#464b62', // mid plate
  l: '#8a92ae', // highlight
  w: '#ffe1e8', // eye glint
  y: '#ffb03b', // hazard paint
};

const CRAWLER_BODY = [
  '.....oooooooo.....',
  '...oommmmmmmmoo...',
  '..omllllllllllmo..',
  '.omlmmmmmmmmmmlmo.',
  '.omddddddrrrrddmo.',
  '.omddddddrwwrddmo.',
  '.ommmmmmmmmmmmmmo.',
  '.oyyooyyooyyooyyo.',
  '..ommmmmmmmmmmmo..',
  '..oddoo....ooddo..',
];
const CRAWLER_LEGS_A = [
  '.odo.od....do.odo.',
  '.oo..od....do..oo.',
  'od...od....do...do',
  'o....oo....oo....o',
];
const CRAWLER_LEGS_B = [
  '..odo.od..do.odo..',
  '..od..od..do..do..',
  '.od...od..do...do.',
  '.o....oo..oo....o.',
];

const SENTRY = [
  '....oooooooo....',
  '...ommmmmmmmo...',
  '..omllllllllmo..',
  '..omlrrrrrrlmo..',
  '..omlrwwrrrlmo..',
  '..ommmmmmmmmmo..',
  '...oooddddooo...',
  '.oommmmmmmmmmoo.',
  'omllmmmmmmmmllmo',
  'omlmddddddddmlmo',
  'omlmdyyyyyydmlmo',
  'omlmddddddddmlmo',
  'omlmdyyyyyydmlmo',
  'ommmddddddddmmmo',
  '.oommmmmmmmmmoo.',
  '..oommmmmmmmoo..',
  '...oddoooodddo..',
  '...odo....odo...',
  '...odo....odo...',
  '..omdo....omdo..',
  '..omdo....omdo..',
  '..odmo....odmo..',
  '..odmo....odmo..',
  '.oommo...oommo..',
  'ommmmo..ommmmo..',
  'oooooo..oooooo..',
];

// Eye-shaped drone with X-struts and a bottom cannon (matches the concept art).
const DRONE_BODY_A = [
  'l..................l',
  '.l....oooooooo....l.',
  '..l.ooddddddddoo.l..',
  '...ooddddrrddddoo...',
  'l.ooddddrwwrddddoo.l',
  '..oodddddrrddddoo...',
  '...oodddddddddoo....',
  '....oodddddddoo.....',
  '.....oooooddoo......',
  '.........oddo.......',
  '..........oo........',
];
const DRONE_BODY_B = [
  '.l................l.',
  'l.....oooooooo.....l',
  '..l.ooddddddddoo.l..',
  '...ooddddrrddddoo...',
  '.looddddrwwrddddool.',
  '..oodddddrrddddoo...',
  '...oodddddddddoo....',
  '....oodddddddoo.....',
  '.....oooooddoo......',
  '.........oddo.......',
  '..........oo........',
];

const BLASTER = [
  '...ooooooo....',
  '..ollllllloooo',
  'ooommcccmmmmmo',
  'ommmmcccmmmmmo',
  'ommooooooooooo',
  'omdo..........',
  'oddo..........',
];

const BATTERY = [
  '..oooo..',
  '.oommoo.',
  'oooooooo',
  'ogggwggo',
  'oggwwggo',
  'ogwwwwgo',
  'oggwwggo',
  'ogggwggo',
  'oggggggo',
  'oddddddo',
  'oooooooo',
];

// Cut diamond: pointed crown, wide girdle, pointed pavilion. Facet letters:
// o outline, d deep shade, m mid body, h bright facet, w specular chip.
const SHARD = [
  '......o......',
  '.....owo.....',
  '....ohhho....',
  '...ohhmmdo...',
  '..ohhmmmmdo..',
  '.ohhhmmmmddo.',
  'ohhhhmmmmdddo',
  '.ohhmmmmmddo.',
  '..ohmmmmddo..',
  '...ohmmddo...',
  '....ohddo....',
  '.....odo.....',
  '......o......',
];

const HEART = [
  '.oo.oo.',
  'orrorro',
  'orwrrro',
  'orrrrro',
  '.orrro.',
  '..oro..',
  '...o...',
];

function buildSprite(rows, palette) {
  const width = rows[0].length;
  const { canvas, ctx } = createCanvas(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Pixel art row ${y} is ${row.length} wide, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

/**
 * Recolours a sprite's opaque pixels. 'source-in' replaces colours (white hit
 * flash); 'source-atop' layers over them (darkened wreck).
 */
function tintSprite(source, color, mode) {
  const { canvas, ctx } = createCanvas(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, source.width, source.height);
  return canvas;
}

function withVariants(sprite) {
  return {
    image: sprite,
    flash: tintSprite(sprite, '#ffffff', 'source-in'),
    dark: tintSprite(sprite, 'rgba(10, 6, 14, 0.6)', 'source-atop'),
  };
}

/** Builds every procedural sprite once at startup. */
export function buildSpriteLibrary() {
  const crawlerPalette = { ...METAL, r: '#ff3355' };
  const dronePalette = { ...METAL, r: '#ff3355' };
  const diverPalette = { ...METAL, r: '#ff9a1a', y: '#ff3355', m: '#5a4a40' };
  const swarmPalette = { ...METAL, r: '#ff2a6a', y: '#b44bff', m: '#3e3a5c' };

  const droneFrames = (palette) => [
    withVariants(buildSprite(DRONE_BODY_A, palette)),
    withVariants(buildSprite(DRONE_BODY_B, palette)),
  ];

  return {
    crawler: [
      withVariants(buildSprite([...CRAWLER_BODY, ...CRAWLER_LEGS_A], crawlerPalette)),
      withVariants(buildSprite([...CRAWLER_BODY, ...CRAWLER_LEGS_B], crawlerPalette)),
    ],
    sentry: withVariants(buildSprite(SENTRY, { ...METAL, r: '#ff3355' })),
    drone: droneFrames(dronePalette),
    diver: droneFrames(diverPalette),
    swarm: droneFrames(swarmPalette),
    blaster: buildSprite(BLASTER, { ...METAL, c: '#5ef7ff' }),
    battery: buildSprite(BATTERY, { o: '#07060c', g: '#3fe08a', w: '#eafff2', m: '#8a92ae', d: '#1f6a44' }),
    shard: buildSprite(SHARD, {
      o: '#0c1520',
      d: '#1a6a7a',
      m: '#2ec4d6',
      h: '#9af0ff',
      w: '#f4ffff',
    }),
    heart: buildSprite(HEART, { o: '#07060c', r: '#ff3d6b', w: '#ffd0da' }),
    heartEmpty: buildSprite(HEART, { o: '#07060c', r: '#2a2438', w: '#3a3248' }),
  };
}

/** Converts a sprite to a scaled PNG data URL for crisp use in HTML (HUD icons). */
export function spriteToDataUrl(sprite, scale = 4) {
  const { canvas, ctx } = createCanvas(sprite.width * scale, sprite.height * scale);
  ctx.drawImage(sprite, 0, 0, sprite.width * scale, sprite.height * scale);
  return canvas.toDataURL();
}
