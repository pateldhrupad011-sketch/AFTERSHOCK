import { MenuNavigation } from '../ui/menuNavigation.js';

/** Victory screen after THE ARCHITECT falls. */
export class EndingScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('ending-screen');
    this.stats = this.element.querySelector('.ending-stats');
    this.navigation = new MenuNavigation(app.audio, [...this.element.querySelectorAll('.menu-item')]);
    this.element.querySelector('[data-action="play-again"]').addEventListener('click', () => app.screens.switchTo('levelSelect'));
    this.element.querySelector('[data-action="menu"]').addEventListener('click', () => app.screens.switchTo('menu'));
  }

  enter({ bossTime = 0, bossDamage = 0, totalScore = 0, shards = '0/0' }) {
    this.app.audio.playMusic('victory');
    this.stats.innerHTML = `
      <dt>BOSS FIGHT</dt><dd>${bossTime.toFixed(1)}s</dd>
      <dt>HITS TAKEN</dt><dd>${bossDamage}</dd>
      <dt>DATA SHARDS</dt><dd>${shards}</dd>
      <dt>TOTAL SCORE</dt><dd>${totalScore}</dd>`;
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
    this.app.menuScene.render(ctx, { showCharacter: true, dim: 0.6 });
  }
}
