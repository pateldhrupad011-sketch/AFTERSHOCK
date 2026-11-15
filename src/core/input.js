import { VIEW } from '../config.js';

const JUMP_KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

/**
 * Collects raw keyboard/mouse/touch input and exposes it as simple game intents.
 *
 * Presses are latched until consumed so a quick tap is never lost between
 * fixed simulation steps (at high refresh rates a frame may run zero steps).
 */
export class Input {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.stage = stage;
    this.mouse = { x: VIEW.width / 2, y: VIEW.height / 2, isDown: false, isOverStage: false };
    this.jumpHeld = false;
    this.pendingJump = false;
    this.pendingFire = false;
    this.keysDown = new Set();

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.handleKeyUp(event));
    stage.addEventListener('pointermove', (event) => this.updateMousePosition(event));
    stage.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    window.addEventListener('pointerup', () => { this.mouse.isDown = false; });
    stage.addEventListener('pointerleave', () => { this.mouse.isOverStage = false; });
    stage.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => this.keysDown.clear());
  }

  handleKeyDown(event) {
    this.keysDown.add(event.code);
    if (JUMP_KEYS.has(event.code) || LEFT_KEYS.has(event.code) || RIGHT_KEYS.has(event.code)) {
      // Stop the page from scrolling, but let focused UI buttons handle Space themselves.
      if (!(event.target instanceof HTMLButtonElement)) event.preventDefault();
    }
    if (JUMP_KEYS.has(event.code)) {
      if (!event.repeat) this.pendingJump = true;
      this.jumpHeld = true;
    }
  }

  handleKeyUp(event) {
    this.keysDown.delete(event.code);
    if (JUMP_KEYS.has(event.code)) this.jumpHeld = false;
  }

  handlePointerDown(event) {
    this.updateMousePosition(event);
    // Clicks on HUD / menu buttons must not also fire the blaster.
    if (event.target.closest('button, input, label, .ui-blocks-fire')) return;
    if (event.button !== 0) return;
    this.mouse.isDown = true;
    this.pendingFire = true;
  }

  updateMousePosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    this.mouse.y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
    this.mouse.isOverStage = true;
  }

  /** -1 left, 1 right, 0 idle. Only while ArrowLeft/Right or A/D are held. */
  get moveAxis() {
    let axis = 0;
    for (const code of LEFT_KEYS) if (this.keysDown.has(code)) axis -= 1;
    for (const code of RIGHT_KEYS) if (this.keysDown.has(code)) axis += 1;
    if (axis < 0) return -1;
    if (axis > 0) return 1;
    return 0;
  }

  consumeJump() {
    const pressed = this.pendingJump;
    this.pendingJump = false;
    return pressed;
  }

  consumeFire() {
    const pressed = this.pendingFire;
    this.pendingFire = false;
    return pressed;
  }

  reset() {
    this.pendingJump = false;
    this.pendingFire = false;
    this.mouse.isDown = false;
    this.keysDown.clear();
  }
}
