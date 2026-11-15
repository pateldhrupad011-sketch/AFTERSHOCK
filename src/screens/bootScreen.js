/**
 * Attract screen. Browsers block audio until the player interacts, so this
 * screen waits for any key or click, unlocks audio and opens the main menu.
 */
export class BootScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('boot-screen');
    this.element.addEventListener('pointerdown', () => this.continue());
  }

  enter() {
    this.hasContinued = false;
  }

  exit() {}

  continue() {
    if (this.hasContinued) return;
    this.hasContinued = true;
    this.app.audio.unlock();
    this.app.audio.play('uiSelect');
    // Dev shortcut: ?debug&level=N opens that sector after leaving the start page.
    const pending = this.app._pendingDebugLevel;
    if (pending) {
      this.app._pendingDebugLevel = null;
      this.app.screens.switchTo('game', pending === 6 ? { isBoss: true } : { levelNumber: pending });
      return;
    }
    this.app.screens.switchTo('menu');
  }

  handleKey(event) {
    event.preventDefault();
    this.continue();
  }

  update(dt) {
    this.app.menuScene.update(dt);
  }

  render(ctx) {
    this.app.menuScene.render(ctx, { showCharacter: true, dim: 0.25 });
  }
}
