import { LEVELS } from '../data/levels.js';
import { renderLevelPreview } from '../render/levelPreview.js';

/**
 * Simple level picker: picture + "LEVEL N". Click twice (or Enter) to play.
 */
export class LevelSelectScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('level-select-screen');
    this.cardContainer = this.element.querySelector('.level-cards');
    this.selectedIndex = 0;
    this.previews = null;

    this.element.querySelector('[data-action="back"]').addEventListener('click', () => {
      app.audio.play('uiBack');
      app.screens.switchTo('menu');
    });
  }

  enter() {
    // Rebuild previews when skyline art is available (and after hot reloads).
    this.previews = LEVELS.map((level) =>
      renderLevelPreview(level, this.app.playerRenderer, this.app.skylines),
    );
    this.buildCards();
    const firstOpen = LEVELS.findIndex(
      (level) => this.app.save.isLevelUnlocked(level.number) && !this.app.save.getLevelRecord(level.number),
    );
    this.select(firstOpen >= 0 ? firstOpen : 0, { silent: true });
    this.app.audio.playMusic('menu');
  }

  exit() {}

  buildCards() {
    const save = this.app.save;
    this.cardContainer.replaceChildren();
    this.cards = LEVELS.map((level, index) => {
      const isUnlocked = save.isLevelUnlocked(level.number);
      const card = document.createElement('button');
      card.className = `level-card${isUnlocked ? '' : ' is-locked'}`;
      card.type = 'button';

      const art = this.previews[index];
      const artCopy = document.createElement('canvas');
      artCopy.className = 'card-art';
      artCopy.width = art.width;
      artCopy.height = art.height;
      artCopy.getContext('2d').drawImage(art, 0, 0);

      const label = document.createElement('span');
      label.className = 'card-label';
      label.textContent = `LEVEL ${level.number}`;

      card.append(artCopy, label);
      if (!isUnlocked) {
        const lock = document.createElement('span');
        lock.className = 'lock-icon';
        card.append(lock);
      }

      card.addEventListener('pointerdown', (event) => event.preventDefault());
      card.addEventListener('pointerenter', () => this.select(index));
      card.addEventListener('click', () => {
        if (this.selectedIndex === index) this.startSelected();
        else this.select(index);
      });
      this.cardContainer.append(card);
      return card;
    });
  }

  select(index, { silent = false } = {}) {
    if (index !== this.selectedIndex && !silent) this.app.audio.play('uiHover');
    this.selectedIndex = index;
    this.cards.forEach((card, i) => card.classList.toggle('is-selected', i === index));
  }

  startSelected() {
    const level = LEVELS[this.selectedIndex];
    if (!this.app.save.isLevelUnlocked(level.number)) {
      this.app.audio.play('uiBack');
      return;
    }
    this.app.audio.play('uiSelect');
    this.app.screens.switchTo('game', { levelNumber: level.number });
  }

  handleKey(event) {
    if (['ArrowLeft', 'KeyA'].includes(event.code)) {
      this.select((this.selectedIndex + LEVELS.length - 1) % LEVELS.length);
    } else if (['ArrowRight', 'KeyD'].includes(event.code)) {
      this.select((this.selectedIndex + 1) % LEVELS.length);
    } else if (['Enter', 'Space', 'NumpadEnter'].includes(event.code) && !event.repeat) {
      this.startSelected();
    } else if (event.code === 'Escape' || event.code === 'Backspace') {
      this.app.audio.play('uiBack');
      this.app.screens.switchTo('menu');
    } else {
      return;
    }
    event.preventDefault();
  }

  update(dt) {
    this.app.menuScene.update(dt);
  }

  render(ctx) {
    this.app.menuScene.render(ctx, { showCharacter: false, dim: 0.35 });
  }
}
