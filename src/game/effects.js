import { randomRange, pick } from '../core/math.js';

const MAX_PARTICLES = 900;

/**
 * Pure-data particle system. The world spawns particles; the renderer draws them.
 * Keeping this free of canvas code lets the simulation also run headless.
 */
export class EffectsSystem {
  constructor() {
    this.particles = [];
    this.popups = [];
    this.shockRings = [];
  }

  spawn(particle) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      gravity: 0,
      drag: 0,
      size: 1,
      glow: false,
      shape: 'square',
      ...particle,
      maxLife: particle.life,
    });
  }

  burst(x, y, { count = 10, colors = ['#ffffff'], speed = [40, 160], life = [0.3, 0.7], gravity = 300, size = [1, 2], spread = Math.PI * 2, direction = 0, glow = false, drag = 1 }) {
    for (let i = 0; i < count; i++) {
      const angle = direction + randomRange(-spread / 2, spread / 2);
      const velocity = randomRange(speed[0], speed[1]);
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: randomRange(life[0], life[1]),
        color: pick(colors),
        size: Math.round(randomRange(size[0], size[1])),
        gravity,
        drag,
        glow,
      });
    }
  }

  sparks(x, y, colors = ['#fff6a8', '#c87840', '#ffffff'], count = 10) {
    this.burst(x, y, { count, colors, speed: [60, 180], life: [0.12, 0.35], gravity: 500, size: [1, 1], glow: false, drag: 2 });
  }

  dust(x, y, { count = 10, color = '#6c6478', spreadX = 20 } = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + randomRange(-spreadX, spreadX),
        y: y - randomRange(0, 4),
        vx: randomRange(-40, 40),
        vy: randomRange(-50, -10),
        life: randomRange(0.4, 0.9),
        color,
        size: Math.round(randomRange(2, 4)),
        gravity: -10,
        drag: 2.5,
        shape: 'puff',
      });
    }
  }

  explosion(x, y, scale = 1) {
    this.burst(x, y, { count: Math.round(12 * scale), colors: ['#ffffff', '#c87840', '#c02840'], speed: [40, 160 * scale], life: [0.2, 0.45], gravity: 140, size: [1, 2], glow: false, drag: 2 });
    this.burst(x, y, { count: Math.round(5 * scale), colors: ['#2a2430', '#3a3440'], speed: [16, 60], life: [0.4, 0.9], gravity: -10, size: [2, 3], drag: 2 });
    this.shockRings.push({ x, y, radius: 2, maxRadius: 22 * scale, life: 0.25, maxLife: 0.25, color: '#c87840' });
  }

  ring(x, y, color, maxRadius = 30, life = 0.4) {
    this.shockRings.push({ x, y, radius: 2, maxRadius, life, maxLife: life, color });
  }

  popup(x, y, text, color = '#ffffff') {
    this.popups.push({ x, y, text, color, life: 1, maxLife: 1 });
  }

  update(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      const dragFactor = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= dragFactor;
      particle.vy *= dragFactor;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const popup of this.popups) {
      popup.life -= dt;
      popup.y -= 22 * dt;
    }
    this.popups = this.popups.filter((popup) => popup.life > 0);

    for (const ring of this.shockRings) {
      ring.life -= dt;
      const progress = 1 - ring.life / ring.maxLife;
      ring.radius = ring.maxRadius * Math.sqrt(progress);
    }
    this.shockRings = this.shockRings.filter((ring) => ring.life > 0);
  }

  clear() {
    this.particles.length = 0;
    this.popups.length = 0;
    this.shockRings.length = 0;
  }
}
