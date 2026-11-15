import { VIEW } from '../config.js';
import { createSeededRandom, easeInCubic, randomRange } from '../core/math.js';
import { drawBuilding25D, createFacadeTiles } from './buildings.js';
import { createCanvas, mixColors, withAlpha } from './canvas.js';

const TILE_WIDTH = 1024;
// Camera y where roofs at world y=0 sit at their normal screen height.
const REFERENCE_CAMERA_Y = -252;
const NEAR_SPACING = 150;
const NEAR_PARALLAX = 0.4;
const AMBIENT_COLLAPSE_INTERVAL = [9, 16];

/**
 * Layered city backdrop. Static layers are pre-rendered into tiles; weather
 * and a few live details are drawn on top. Flat pixels, limited palettes.
 *
 * Draw order: drawBackLayers() before gameplay, drawFrontLayers() after.
 */
export class CityBackground {
  constructor(theme, seed = 1) {
    this.theme = theme;
    this.seed = seed;
    this.random = createSeededRandom(seed);
    this.sky = this.renderSky();
    this.antennaLights = [];
    this.stackTops = [];
    this.billboards = [];
    this.farTile = this.renderSkylineTile({ color: theme.far, minHeight: 50, maxHeight: 170, windowChance: 0.05, haze: 0.55, layer: 'far' });
    this.midTile = this.renderSkylineTile({ color: theme.mid, minHeight: 80, maxHeight: 250, windowChance: 0.12, haze: 0.3, layer: 'mid' });
    this.nearFacades = createFacadeTiles(theme, seed + 5, 0.45);
    this.collapsingBuildings = new Map();
    this.distantCollapses = [];
    this.dust = [];
    this.weather = this.createWeather(theme.weather);
    this.traffic = this.createTraffic();
    this.ambientCollapseTimer = randomRange(4, 8);
    this.time = 0;
  }

  renderSky() {
    const { canvas, ctx } = createCanvas(VIEW.width, VIEW.height);
    const stops = this.theme.sky;
    // Flat color bands — no smooth gradients, no soft horizon bloom.
    for (let i = 0; i < stops.length; i++) {
      const y0 = Math.floor((VIEW.height * i) / stops.length);
      const y1 = Math.floor((VIEW.height * (i + 1)) / stops.length);
      ctx.fillStyle = stops[i];
      ctx.fillRect(0, y0, VIEW.width, y1 - y0);
    }
    // Sparse 1px stars.
    const random = createSeededRandom(this.seed + 99);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 48; i++) {
      if (random.range(0, 1) > 0.55) continue;
      ctx.fillRect(random.int(0, VIEW.width), random.int(0, Math.floor(VIEW.height * 0.5)), 1, 1);
    }
    // Hard horizon strip (2px), not a radial glow.
    ctx.fillStyle = this.theme.horizonGlow;
    ctx.fillRect(0, VIEW.height - 18, VIEW.width, 2);

    this.drawCelestial(ctx);
    return canvas;
  }

  drawCelestial(ctx) {
    const body = this.theme.celestial;
    if (body.type === 'none') return;
    const cx = Math.round(body.x * VIEW.width);
    const cy = Math.round(body.y * VIEW.height);
    const r = body.radius;
    if (body.type === 'moon') {
      this.fillPixelDisc(ctx, cx, cy, r, body.color);
      ctx.fillStyle = '#0a0814';
      this.fillPixelDisc(ctx, cx + Math.round(r * 0.35), cy - Math.round(r * 0.15), Math.max(2, Math.round(r * 0.55)), '#0a0814');
    } else if (body.type === 'sun') {
      for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        if (y > 2 && (Math.floor(y / 3) % 2 === 1)) continue;
        ctx.fillStyle = body.color;
        ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
    } else if (body.type === 'core') {
      ctx.fillStyle = body.color;
      ctx.fillRect(cx - r, cy - 1, r * 2, 3);
      ctx.fillRect(cx - 1, cy - r, 3, r * 2);
      this.fillPixelDisc(ctx, cx, cy, Math.round(r * 0.45), '#1a0010');
      this.fillPixelDisc(ctx, cx, cy, Math.round(r * 0.25), body.color);
    }
  }

  fillPixelDisc(ctx, cx, cy, radius, color) {
    const r = Math.max(1, Math.round(radius));
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  renderSkylineTile({ color, minHeight, maxHeight, windowChance, haze, layer }) {
    const { canvas, ctx } = createCanvas(TILE_WIDTH, VIEW.height);
    const random = createSeededRandom(this.seed + (layer === 'far' ? 11 : 23));
    const groundY = VIEW.height - 40;
    const windowColors = this.theme.windowColors;
    let x = -10;

    while (x < TILE_WIDTH) {
      const width = random.int(28, layer === 'far' ? 70 : 90);
      const height = random.int(minHeight, maxHeight);
      const top = groundY - height;
      ctx.fillStyle = color;
      ctx.fillRect(x, top, width, VIEW.height - top);

      // Stepped crowns and spires break up the silhouette.
      if (random.chance(0.4)) ctx.fillRect(x + width * 0.2, top - 8, width * 0.6, 8);
      if (random.chance(0.35)) {
        const spireX = Math.round(x + width / 2);
        const spireHeight = random.int(12, 34);
        ctx.fillRect(spireX, top - spireHeight, 1, spireHeight);
        this.antennaLights.push({ layer, x: spireX, y: top - spireHeight, phase: random.range(0, 6) });
      }

      for (let wy = top + 4; wy < groundY + 30; wy += layer === 'far' ? 4 : 6) {
        for (let wx = x + 2; wx < x + width - 2; wx += layer === 'far' ? 3 : 4) {
          if (random.chance(windowChance)) {
            ctx.fillStyle = withAlpha(random.pick(windowColors), layer === 'far' ? 0.45 : 0.75);
            ctx.fillRect(wx, wy, layer === 'far' ? 1 : 2, layer === 'far' ? 1 : 2);
          }
        }
      }

      if (layer === 'mid' && random.chance(0.28)) this.drawNeonSign(ctx, random, x, top, width);
      if (this.theme.features.includes('smokestacks') && random.chance(layer === 'far' ? 0.3 : 0.18)) {
        const stackX = x + random.int(4, Math.max(5, width - 10));
        const stackHeight = random.int(30, 60);
        ctx.fillStyle = color;
        ctx.fillRect(stackX, top - stackHeight, 7, stackHeight);
        ctx.fillStyle = withAlpha(this.theme.accentAlt, 0.7);
        ctx.fillRect(stackX, top - stackHeight + 4, 7, 1);
        this.stackTops.push({ layer, x: stackX + 3, y: top - stackHeight });
      }
      x += width + random.int(-4, 10);
    }

    if (layer === 'mid') this.drawMidLayerFeatures(ctx, random, groundY, color);

    // Flat dusk wash — one solid tint, no soft gradient fog.
    if (haze > 0.2) {
      ctx.fillStyle = withAlpha(this.theme.sky[Math.min(3, this.theme.sky.length - 1)], haze * 0.35);
      ctx.fillRect(0, groundY - 40, TILE_WIDTH, 50);
    }
    return canvas;
  }

  drawNeonSign(ctx, random, x, top, width) {
    const signWidth = Math.min(width - 6, random.int(18, 36));
    const signX = x + random.int(2, Math.max(3, width - signWidth - 2));
    const signY = top + random.int(10, 50);
    const color = random.pick([this.theme.accent, this.theme.accentAlt, ...this.theme.windowColors]);
    ctx.fillStyle = '#05040a';
    ctx.fillRect(signX - 1, signY - 1, signWidth + 2, 9);
    ctx.fillStyle = color;
    ctx.fillRect(signX - 1, signY - 1, signWidth + 2, 1);
    ctx.fillRect(signX - 1, signY + 7, signWidth + 2, 1);
    // Fake glyphs: little pixel strokes that read as text at a distance.
    for (let gx = signX + 1; gx < signX + signWidth - 2; gx += 4) {
      for (let p = 0; p < 4; p++) {
        if (random.chance(0.55)) ctx.fillRect(gx + random.int(0, 2), signY + 1 + random.int(0, 4), 1, random.int(1, 2));
      }
    }
    this.billboards.push({ x: signX + signWidth / 2, y: signY + 3, width: signWidth, color, phase: random.range(0, 10) });
  }

  drawMidLayerFeatures(ctx, random, groundY, color) {
    const features = this.theme.features;
    if (features.includes('cranes')) {
      for (let i = 0; i < 3; i++) {
        const baseX = random.int(60, TILE_WIDTH - 120);
        const height = random.int(150, 210);
        ctx.fillStyle = color;
        ctx.fillRect(baseX, groundY - height, 4, height);
        ctx.fillRect(baseX - 40, groundY - height, 110, 3);
        ctx.fillRect(baseX + 60, groundY - height, 1, random.int(30, 70));
        for (let y = groundY - height; y < groundY; y += 6) ctx.fillRect(baseX - 1, y, 6, 1);
      }
    }
    if (features.includes('bridge')) {
      const deckY = groundY - 50;
      ctx.fillStyle = color;
      ctx.fillRect(0, deckY, TILE_WIDTH, 5);
      for (const towerX of [180, 700]) {
        ctx.fillRect(towerX, deckY - 150, 8, 200);
        ctx.fillRect(towerX - 6, deckY - 150, 20, 4);
        ctx.strokeStyle = color;
        for (const direction of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(towerX + 4, deckY - 148);
          ctx.quadraticCurveTo(towerX + 4 + direction * 160, deckY - 20, towerX + 4 + direction * 300, deckY - 140);
          ctx.stroke();
        }
      }
      ctx.fillStyle = withAlpha(this.theme.accentAlt, 0.8);
      for (let x = 0; x < TILE_WIDTH; x += 24) ctx.fillRect(x, deckY + 2, 2, 1);
    }
  }

  createWeather(type) {
    const particles = [];
    const count = { rain: 140, embers: 50, ash: 70, data: 60 }[type] ?? 0;
    for (let i = 0; i < count; i++) {
      particles.push({ x: Math.random() * VIEW.width, y: Math.random() * VIEW.height, speed: randomRange(0.6, 1.4), phase: Math.random() * 10 });
    }
    return { type, particles };
  }

  createTraffic() {
    if (this.theme.features.includes('dataColumns')) return [];
    const lanes = [];
    for (let i = 0; i < 9; i++) {
      lanes.push({
        x: Math.random() * VIEW.width * 2,
        y: randomRange(60, 190),
        speed: randomRange(30, 90) * (Math.random() < 0.5 ? -1 : 1),
        color: Math.random() < 0.5 ? '#ff4a5a' : '#fff4c8',
        depth: randomRange(0.15, 0.35),
      });
    }
    return lanes;
  }

  /** Starts a building collapse. 'near' topples a visible near building; 'far' drops a distant tower. */
  triggerCollapse(layer, cameraX) {
    if (layer === 'near') {
      const layerX = cameraX * NEAR_PARALLAX;
      const firstIndex = Math.floor((layerX + VIEW.width * 0.5) / NEAR_SPACING);
      for (let index = firstIndex; index < firstIndex + 3; index++) {
        if (!this.collapsingBuildings.has(index)) {
          this.collapsingBuildings.set(index, { elapsed: 0, direction: Math.random() < 0.5 ? -1 : 1 });
          return;
        }
      }
    }
    this.distantCollapses.push({
      x: randomRange(VIEW.width * 0.45, VIEW.width * 0.85),
      width: randomRange(30, 50),
      height: randomRange(150, 210),
      elapsed: 0,
      duration: 3.2,
      direction: Math.random() < 0.5 ? -1 : 1,
    });
  }

  update(dt, cameraX) {
    this.time += dt;
    this.ambientCollapseTimer -= dt;
    if (this.ambientCollapseTimer <= 0) {
      this.triggerCollapse('far', cameraX);
      this.ambientCollapseTimer = randomRange(...AMBIENT_COLLAPSE_INTERVAL);
    }

    for (const [index, collapse] of this.collapsingBuildings) {
      collapse.elapsed += dt;
      if (collapse.elapsed > 0.4 && collapse.elapsed < 2.2 && Math.random() < 0.6) collapse.needsDust = true;
      if (collapse.elapsed > 6) this.collapsingBuildings.delete(index);
    }
    for (const tower of this.distantCollapses) {
      tower.elapsed += dt;
      if (tower.elapsed < tower.duration * 0.8 && Math.random() < 0.7) {
        this.spawnDust(tower.x + randomRange(-tower.width, tower.width), VIEW.height - 70, 0.6);
      }
    }
    this.distantCollapses = this.distantCollapses.filter((tower) => tower.elapsed < tower.duration + 1);

    for (const puff of this.dust) {
      puff.life -= dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.radius += dt * 6 * puff.scale;
    }
    this.dust = this.dust.filter((puff) => puff.life > 0);

    for (const car of this.traffic) car.x += car.speed * dt;
  }

  spawnDust(x, y, scale = 1) {
    this.dust.push({
      x, y,
      vx: randomRange(-20, 20),
      vy: randomRange(-25, -6),
      radius: randomRange(4, 9) * scale,
      life: randomRange(1.2, 2.4),
      maxLife: 2.4,
      scale,
    });
  }

  /** Everything behind the gameplay layer. */
  drawBackLayers(ctx, cameraX, cameraY) {
    const verticalShift = (factor) => Math.round((REFERENCE_CAMERA_Y - cameraY) * factor);
    ctx.drawImage(this.sky, 0, verticalShift(0.02));

    if (this.theme.features.includes('dataColumns')) this.drawDataColumns(ctx);
    this.drawTile(ctx, this.farTile, cameraX * 0.06, verticalShift(0.06));
    this.drawAntennaLights(ctx, 'far', cameraX * 0.06, verticalShift(0.06));
    this.drawStackSmoke(ctx, 'far', cameraX * 0.06, verticalShift(0.06));
    this.drawDistantCollapses(ctx, verticalShift(0.1));
    if (this.theme.features.includes('searchlights')) this.drawSearchlights(ctx);
    this.drawTile(ctx, this.midTile, cameraX * 0.16, verticalShift(0.12));
    this.drawAntennaLights(ctx, 'mid', cameraX * 0.16, verticalShift(0.12));
    this.drawStackSmoke(ctx, 'mid', cameraX * 0.16, verticalShift(0.12));
    this.drawBillboardGlow(ctx, cameraX * 0.16, verticalShift(0.12));
    this.drawTraffic(ctx, cameraX);
    this.drawNearBuildings(ctx, cameraX, verticalShift(0.3));
    this.drawDust(ctx);
  }

  drawTile(ctx, tile, offsetX, offsetY) {
    const x = -Math.round(((offsetX % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH);
    ctx.drawImage(tile, x, offsetY);
    if (x + TILE_WIDTH < VIEW.width) ctx.drawImage(tile, x + TILE_WIDTH, offsetY);
  }

  tileScreenX(tileX, offsetX) {
    const wrapped = (((tileX - offsetX) % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH;
    return wrapped > VIEW.width + 20 ? wrapped - TILE_WIDTH : wrapped;
  }

  drawAntennaLights(ctx, layer, offsetX, offsetY) {
    for (const light of this.antennaLights) {
      if (light.layer !== layer) continue;
      if (Math.sin(this.time * 2 + light.phase) < 0.6) continue;
      const x = this.tileScreenX(light.x, offsetX);
      ctx.fillStyle = '#c02840';
      ctx.fillRect(Math.round(x), light.y + offsetY, 1, 1);
    }
  }

  drawStackSmoke(ctx, layer, offsetX, offsetY) {
    for (const stack of this.stackTops) {
      if (stack.layer !== layer) continue;
      const x = this.tileScreenX(stack.x, offsetX);
      if (x < -40 || x > VIEW.width + 40) continue;
      for (let i = 0; i < 4; i++) {
        const age = (this.time * 0.35 + i / 4 + stack.x * 0.01) % 1;
        const size = 1 + Math.floor(age * 3);
        ctx.fillStyle = withAlpha('#5a4a44', 0.45 * (1 - age));
        ctx.fillRect(
          Math.round(x + age * 20 + Math.sin(age * 6) * 2) - size,
          Math.round(stack.y + offsetY - age * 40) - size,
          size * 2,
          size * 2,
        );
      }
    }
  }

  drawBillboardGlow(ctx, offsetX, offsetY) {
    for (const sign of this.billboards) {
      const flicker = Math.sin(this.time * 13 + sign.phase) > -0.85 ? 1 : 0.25;
      const x = this.tileScreenX(sign.x, offsetX);
      if (x < -30 || x > VIEW.width + 30) continue;
      ctx.globalAlpha = flicker;
      ctx.fillStyle = sign.color;
      ctx.fillRect(Math.round(x - sign.width / 2), Math.round(sign.y + offsetY), Math.round(sign.width), 1);
      ctx.globalAlpha = 1;
    }
  }

  drawTraffic(ctx, cameraX) {
    for (const car of this.traffic) {
      const span = VIEW.width + 80;
      const x = ((((car.x - cameraX * car.depth) % span) + span) % span) - 40;
      ctx.fillStyle = car.color;
      ctx.fillRect(Math.round(x), Math.round(car.y), 3, 1);
    }
  }

  drawSearchlights(ctx) {
    // Thin dashed beams — readable without soft cones.
    ctx.fillStyle = withAlpha(this.theme.accent, 0.35);
    for (let i = 0; i < 3; i++) {
      const baseX = 120 + i * 200;
      const angle = -Math.PI / 2 + Math.sin(this.time * 0.4 + i * 2) * 0.45;
      for (let d = 0; d < 220; d += 4) {
        const x = Math.round(baseX + Math.cos(angle) * d);
        const y = Math.round(VIEW.height + Math.sin(angle) * d);
        if ((d / 4) % 2 === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  drawDataColumns(ctx) {
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 110;
      ctx.fillStyle = withAlpha(i % 2 ? this.theme.accent : this.theme.accentAlt, 0.22);
      ctx.fillRect(Math.round(x), 0, 2, VIEW.height);
      const packetY = ((this.time * 50 + i * 47) % (VIEW.height + 20)) - 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x), Math.round(packetY), 2, 4);
    }
  }

  drawDistantCollapses(ctx, offsetY) {
    const groundY = VIEW.height - 40 + offsetY;
    for (const tower of this.distantCollapses) {
      const progress = Math.min(1, tower.elapsed / tower.duration);
      const sink = easeInCubic(Math.max(0, progress - 0.1) / 0.9) * tower.height * 1.05;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, VIEW.width, groundY);
      ctx.clip();
      ctx.translate(Math.round(tower.x), Math.round(groundY + sink));
      ctx.rotate(tower.direction * easeInCubic(progress) * 0.25);
      ctx.fillStyle = mixColors(this.theme.far, this.theme.mid, 0.5);
      ctx.fillRect(-tower.width / 2, -tower.height, tower.width, tower.height);
      ctx.fillRect(-2, -tower.height - 26, 3, 26);
      ctx.fillStyle = withAlpha(this.theme.windowColors[0], 0.5);
      for (let y = -tower.height + 6; y < 0; y += 8) {
        for (let x = -tower.width / 2 + 3; x < tower.width / 2 - 3; x += 6) {
          if ((x * 7 + y * 3) % 5 === 0) ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      }
      ctx.restore();
    }
  }

  drawNearBuildings(ctx, cameraX, offsetY) {
    const layerX = cameraX * NEAR_PARALLAX;
    const firstIndex = Math.floor(layerX / NEAR_SPACING) - 1;
    const sideColor = mixColors(this.theme.near, '#000000', 0.35);
    const roofColor = mixColors(this.theme.near, this.theme.sky[2], 0.25);

    for (let index = firstIndex; index < firstIndex + Math.ceil(VIEW.width / NEAR_SPACING) + 3; index++) {
      const random = createSeededRandom(this.seed * 31 + index * 977);
      const width = random.int(70, 125);
      const height = random.int(120, 230);
      const screenX = index * NEAR_SPACING + random.int(0, 20) - layerX;
      const top = VIEW.height - 30 - height + offsetY;

      const collapse = this.collapsingBuildings.get(index);
      ctx.save();
      if (collapse) {
        const t = collapse.elapsed;
        const shake = t < 0.5 ? Math.sin(t * 80) * 2 : 0;
        const fall = easeInCubic(Math.min(1, Math.max(0, (t - 0.4) / 2.2)));
        ctx.translate(screenX + width / 2 + shake, VIEW.height + 20);
        ctx.rotate(collapse.direction * fall * 0.35);
        ctx.translate(-(screenX + width / 2), -(VIEW.height + 20) + fall * (height + 60));
        if (collapse.needsDust) {
          this.spawnDust(screenX + random.range(0, width), VIEW.height - 20, 1.4);
          collapse.needsDust = false;
        }
      }
      drawBuilding25D(ctx, { x: screenX, y: top, width }, {
        facadeTile: this.nearFacades[((index % 3) + 3) % 3],
        roofColor,
        sideColor,
        trimColor: withAlpha(this.theme.accent, 0.35),
        depth: 0.05,
      });

      if (random.chance(0.45)) {
        const signColor = random.pick([this.theme.accent, this.theme.accentAlt]);
        const flicker = Math.sin(this.time * 17 + index) > -0.9 ? 1 : 0.15;
        const signX = Math.round(screenX + random.int(4, width - 12));
        const signY = Math.round(top + random.int(12, 40));
        ctx.globalAlpha = flicker;
        ctx.fillStyle = '#05040a';
        ctx.fillRect(signX - 1, signY - 1, 7, 32);
        ctx.fillStyle = signColor;
        for (let y = 0; y < 30; y += 5) ctx.fillRect(signX + 1, signY + y + 1, 3, 3);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  drawDust(ctx) {
    for (const puff of this.dust) {
      const size = Math.max(1, Math.round(puff.radius));
      ctx.fillStyle = withAlpha('#4e4656', 0.45 * (puff.life / puff.maxLife));
      ctx.fillRect(Math.round(puff.x) - size, Math.round(puff.y) - size, size * 2, size * 2);
    }
  }

  /** Weather drawn over the gameplay layer (kept sparse so it never hides hazards). */
  drawFrontLayers(ctx, dt, timeScale = 1) {
    const { type, particles } = this.weather;
    for (const p of particles) {
      if (type === 'rain') {
        p.x -= 70 * p.speed * dt * timeScale;
        p.y += 480 * p.speed * dt * timeScale;
        if (p.y > VIEW.height) { p.y = -10; p.x = Math.random() * (VIEW.width + 60); }
        if (p.x < -10) p.x += VIEW.width + 20;
        ctx.fillStyle = withAlpha('#a8d8ff', 0.25 * p.speed);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, Math.round(5 * p.speed));
      } else if (type === 'embers') {
        p.y -= 30 * p.speed * dt * timeScale;
        p.x += Math.sin(this.time * 2 + p.phase) * 10 * dt;
        if (p.y < -5) { p.y = VIEW.height + 5; p.x = Math.random() * VIEW.width; }
        const color = p.speed > 1 ? '#ffd27a' : '#ff6a2a';
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      } else if (type === 'ash') {
        p.y += 22 * p.speed * dt * timeScale;
        p.x -= 18 * p.speed * dt * timeScale + Math.sin(this.time + p.phase) * 6 * dt;
        if (p.y > VIEW.height) { p.y = -5; p.x = Math.random() * (VIEW.width + 40); }
        if (p.x < -5) p.x += VIEW.width + 10;
        ctx.fillStyle = withAlpha(p.speed > 1.1 ? '#ff8a4a' : '#9a8e8a', 0.6);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.speed > 1.2 ? 2 : 1, 1);
      } else if (type === 'data') {
        p.y += 90 * p.speed * dt * timeScale;
        if (p.y > VIEW.height) { p.y = -8; p.x = Math.random() * VIEW.width; }
        ctx.fillStyle = withAlpha(p.speed > 1 ? this.theme.accent : this.theme.accentAlt, 0.35);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 3);
      }
    }
  }
}
