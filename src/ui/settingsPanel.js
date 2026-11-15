import { MenuNavigation } from './menuNavigation.js';

/**
 * The settings dialog, shared by the main menu and the pause menu. Inputs are
 * bound by their `data-setting` attribute to keys in SaveData.settings.
 */
export class SettingsPanel {
  constructor(element, { save, audio, onSettingsChanged }) {
    this.element = element;
    this.save = save;
    this.audio = audio;
    this.onSettingsChanged = onSettingsChanged;
    this.onClose = null;
    this.inputs = [...element.querySelectorAll('[data-setting]')];
    this.resetButton = element.querySelector('[data-action="reset"]');
    this.navigation = new MenuNavigation(audio, [...element.querySelectorAll('button')]);

    for (const input of this.inputs) {
      input.addEventListener('input', () => this.applyInput(input));
    }
    element.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    this.resetButton.addEventListener('click', () => this.handleReset());
  }

  get isOpen() {
    return this.element.classList.contains('is-open');
  }

  open(onClose = null) {
    this.onClose = onClose;
    this.resetButton.textContent = 'RESET PROGRESS';
    for (const input of this.inputs) {
      const value = this.save.settings[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value;
    }
    this.element.classList.add('is-open');
    this.navigation.focus(this.navigation.buttons.length - 1, { silent: true });
  }

  close() {
    this.element.classList.remove('is-open');
    this.onClose?.();
  }

  applyInput(input) {
    const value = input.type === 'checkbox' ? input.checked : Number(input.value);
    this.save.updateSettings({ [input.dataset.setting]: value });
    this.audio.applySettings();
    if (input.type === 'checkbox') this.audio.play('click');
    this.onSettingsChanged?.();
  }

  /** Two-step reset so progress is never wiped by a stray click. */
  handleReset() {
    if (this.resetButton.textContent !== 'CONFIRM RESET?') {
      this.resetButton.textContent = 'CONFIRM RESET?';
      return;
    }
    this.save.resetProgress();
    this.resetButton.textContent = 'PROGRESS RESET';
    this.onSettingsChanged?.();
  }

  handleKey(event) {
    if (event.code === 'Escape') {
      this.close();
      return true;
    }
    return this.navigation.handleKey(event);
  }
}
