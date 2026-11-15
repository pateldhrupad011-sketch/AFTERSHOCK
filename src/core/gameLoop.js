import { SIMULATION } from '../config.js';

/**
 * Fixed-timestep loop: `update` always receives the same dt, while `render`
 * runs once per display frame. This keeps physics deterministic regardless of
 * monitor refresh rate.
 */
export function startGameLoop({ update, render }) {
  let previousTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    const frameTime = Math.min((now - previousTime) / 1000, SIMULATION.maxFrameTime);
    previousTime = now;
    accumulator += frameTime;

    while (accumulator >= SIMULATION.fixedStep) {
      update(SIMULATION.fixedStep);
      accumulator -= SIMULATION.fixedStep;
    }

    render(frameTime);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
