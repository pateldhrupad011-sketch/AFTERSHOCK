import { VIEW } from '../config.js';

/**
 * Letterboxes the 16:9 stage into the window, filling as much space as
 * possible. --u is the CSS size of one game pixel (may be fractional).
 */
export function fitStageToWindow(stage) {
  const resize = () => {
    const scale = Math.max(
      1,
      Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height),
    );
    stage.style.width = `${VIEW.width * scale}px`;
    stage.style.height = `${VIEW.height * scale}px`;
    stage.style.setProperty('--u', `${scale}px`);
  };
  window.addEventListener('resize', resize);
  resize();
}
