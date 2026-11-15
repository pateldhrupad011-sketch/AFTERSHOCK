import { MenuNavigation } from '../ui/menuNavigation.js';

export class MenuScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('menu-screen');
    const buttons = [...this.element.querySelectorAll('.menu-item')];
    this.navigation = new MenuNavigation(app.audio, buttons);

    this.element.querySelector('[data-action="start"]').addEventListener('click', () => {
      app.screens.switchTo('levelSelect');
    });
    this.element.querySelector('[data-action="credits"]').addEventListener('click', () => {
      app.screens.switchTo('credits');
    });
  }

  enter() {
    this.app.audio.playMusic('menu');
    this.navigation.focus(0, { silent: true });
  }

  exit() {}

  handleKey(event) {
    this.navigation.handleKey(event);
  }

  update(dt) {
    this.app.menuScene.update(dt);
  }

  render(ctx) {
    this.app.menuScene.render(ctx);
  }
}
