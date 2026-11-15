const PREVIOUS_KEYS = new Set(['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA']);
const NEXT_KEYS = new Set(['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD']);
const ACTIVATE_KEYS = new Set(['Enter', 'Space', 'NumpadEnter']);

/**
 * Keyboard + mouse navigation for a list of buttons. The highlighted item
 * uses an `is-focused` class instead of DOM focus, so mouse hover and arrow
 * keys share one consistent highlight and Space never double-activates.
 */
export class MenuNavigation {
  constructor(audio, buttons = []) {
    this.audio = audio;
    this.buttons = [];
    this.index = 0;
    this.setButtons(buttons);
  }

  setButtons(buttons) {
    this.buttons = buttons;
    this.index = Math.min(this.index, Math.max(0, buttons.length - 1));
    buttons.forEach((button, index) => {
      if (button.dataset.navigationBound) return;
      button.dataset.navigationBound = 'true';
      button.addEventListener('pointerenter', () => this.focus(this.buttons.indexOf(button)));
      // Prevent DOM focus so keyboard Space/Enter is handled only by handleKey().
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      button.addEventListener('click', () => this.audio.play(button.dataset.action === 'back' ? 'uiBack' : 'uiSelect'));
    });
    this.refresh();
  }

  focus(index, { silent = false } = {}) {
    if (index < 0 || index >= this.buttons.length) return;
    if (index !== this.index && !silent) this.audio.play('uiHover');
    this.index = index;
    this.refresh();
  }

  refresh() {
    this.buttons.forEach((button, i) => button.classList.toggle('is-focused', i === this.index));
  }

  /** Returns true if the key was used. */
  handleKey(event) {
    if (!this.buttons.length) return false;
    if (PREVIOUS_KEYS.has(event.code)) {
      this.focus((this.index - 1 + this.buttons.length) % this.buttons.length);
    } else if (NEXT_KEYS.has(event.code)) {
      this.focus((this.index + 1) % this.buttons.length);
    } else if (ACTIVATE_KEYS.has(event.code)) {
      if (event.repeat) return true;
      this.buttons[this.index]?.click();
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  }
}
