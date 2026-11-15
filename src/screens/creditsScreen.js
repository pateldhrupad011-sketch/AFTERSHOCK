/**
 * Simple credits page: music attributions, then back to the main menu.
 */
export class CreditsScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('credits-screen');
    this.element.querySelector('[data-action="back"]').addEventListener('click', () => {
      app.audio.play('uiBack');
      app.screens.switchTo('menu');
    });
  }

  enter() {
    this.app.audio.playMusic('menu');
  }

  exit() {}

  handleKey(event) {
    if (event.code === 'Escape' || event.code === 'Backspace' || event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      this.app.audio.play('uiBack');
      this.app.screens.switchTo('menu');
    }
  }

  update(dt) {
    this.app.menuScene.update(dt);
  }

  render(ctx) {
    this.app.menuScene.render(ctx, { showCharacter: false, dim: 0.45 });
  }
}
