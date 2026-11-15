const WIPE_DURATION_MS = 420;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Switches between screens (boot, menu, level select, game, ending) with a
 * slanted-panel wipe. A screen is any object with:
 *   element, enter(params), exit(), update(dt), render(ctx, frameDt), handleKey?(event)
 */
export class ScreenManager {
  constructor(overlay) {
    this.overlay = overlay;
    this.screens = new Map();
    this.current = null;
    this.isTransitioning = false;
    this.wipePanels = [...overlay.querySelectorAll('.wipe-panel')];
  }

  register(name, screen) {
    this.screens.set(name, screen);
  }

  async switchTo(name, params = {}, { instant = false } = {}) {
    const next = this.screens.get(name);
    if (!next) throw new Error(`Unknown screen "${name}"`);
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (!instant) {
      this.overlay.classList.add('is-blocking', 'is-covering');
      await wait(WIPE_DURATION_MS + 100);
    }

    if (this.current) {
      this.current.exit();
      this.current.element.classList.remove('is-active');
    }
    this.current = next;
    next.element.classList.add('is-active');
    next.enter(params);

    if (!instant) {
      this.overlay.classList.add('is-leaving');
      await wait(WIPE_DURATION_MS + 100);
      this.resetWipeWithoutAnimating();
    }
    this.isTransitioning = false;
  }

  /** Snap the wipe panels back off-screen without them sweeping visibly in reverse. */
  resetWipeWithoutAnimating() {
    for (const panel of this.wipePanels) panel.style.transition = 'none';
    this.overlay.classList.remove('is-covering', 'is-leaving', 'is-blocking');
    void this.overlay.offsetWidth;
    for (const panel of this.wipePanels) panel.style.transition = '';
  }

  update(dt) {
    this.current?.update(dt);
  }

  render(ctx, frameDt) {
    this.current?.render(ctx, frameDt);
  }

  handleKey(event) {
    if (!this.isTransitioning) this.current?.handleKey?.(event);
  }
}
