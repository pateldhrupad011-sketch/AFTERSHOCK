import { VIEW } from './config.js';
import { GameAudio } from './audio/gameAudio.js';
import { loadAssets } from './core/assets.js';
import { startGameLoop } from './core/gameLoop.js';
import { Input } from './core/input.js';
import { SaveData } from './core/storage.js';
import { MenuScene } from './render/menuScene.js';
import { buildSpriteLibrary } from './render/pixelArt.js';
import { PlayerRenderer } from './render/playerRenderer.js';
import { PostEffects } from './render/postEffects.js';
import { BootScreen } from './screens/bootScreen.js';
import { CreditsScreen } from './screens/creditsScreen.js';
import { EndingScreen } from './screens/endingScreen.js';
import { GameScreen } from './screens/gameScreen.js';
import { LevelSelectScreen } from './screens/levelSelectScreen.js';
import { MenuScreen } from './screens/menuScreen.js';
import { ScreenManager } from './ui/screenManager.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { fitStageToWindow } from './ui/stage.js';

/**
 * Debug flags via URL, e.g. index.html?invincible&level=5
 *   invincible  — hazards cannot hurt you (handy for demos and testing)
 *   level=N     — skip the menus and start sector N (6 = boss)
 *   debug       — exposes the app as `window.aftershock` for console inspection
 */
function readDebugOptions() {
  const params = new URLSearchParams(window.location.search);
  return {
    invincible: params.has('invincible'),
    startLevel: params.has('level') ? Number(params.get('level')) : null,
    exposeApp: params.has('debug'),
  };
}

async function main() {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  fitStageToWindow(stage);

  const assets = await loadAssets();
  const save = new SaveData();
  const sprites = buildSpriteLibrary();

  // `app` is the shared context handed to every screen.
  const app = {
    stage,
    save,
    sprites,
    skylines: assets.skylines,
    jumpPadFrames: assets.jumpPadFrames,
    bossSprite: assets.boss,
    debug: readDebugOptions(),
    input: new Input(canvas, stage),
    audio: new GameAudio(save.settings),
    postEffects: new PostEffects(),
    playerRenderer: new PlayerRenderer(
      assets.playerRunFrames,
      sprites.blaster,
      assets.playerHurtFrames,
    ),
    screens: new ScreenManager(document.getElementById('transition-overlay')),
  };
  app.menuScene = new MenuScene(app.playerRenderer, app.skylines);
  if (app.debug.exposeApp) window.aftershock = app;

  const applyVisualSettings = () => {
    document.getElementById('crt-overlay').classList.toggle('is-hidden', !save.settings.crtEffect);
  };
  app.settingsPanel = new SettingsPanel(document.querySelector('.settings-modal'), {
    save,
    audio: app.audio,
    onSettingsChanged: () => {
      applyVisualSettings();
      app.screens.current?.applySettings?.();
      if (app.screens.current instanceof LevelSelectScreen) app.screens.current.buildCards();
    },
  });
  applyVisualSettings();

  app.screens.register('boot', new BootScreen(app));
  app.screens.register('menu', new MenuScreen(app));
  app.screens.register('credits', new CreditsScreen(app));
  app.screens.register('levelSelect', new LevelSelectScreen(app));
  app.screens.register('game', new GameScreen(app));
  app.screens.register('ending', new EndingScreen(app));

  window.addEventListener('keydown', (event) => {
    app.audio.unlock();
    app.screens.handleKey(event);
  });
  stage.addEventListener('pointerdown', () => app.audio.unlock());

  // Always open on the start page when the game is loaded or reloaded.
  // Dev shortcut: ?debug&level=N still jumps into a sector after the boot click.
  await app.screens.switchTo('boot', {}, { instant: true });
  if (app.debug.startLevel) {
    app._pendingDebugLevel = app.debug.startLevel;
  }

  startGameLoop({
    update: (dt) => app.screens.update(dt),
    render: (frameDt) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      app.screens.render(ctx, frameDt);
    },
  });
}

main().catch((error) => {
  console.error(error);
  const message = document.getElementById('loading-error');
  message.hidden = false;
  message.textContent = window.location.protocol === 'file:'
    ? 'AFTERSHOCK needs to be served over http. Run "npm start" (or "python3 -m http.server") in the project folder and open http://localhost:8080.'
    : `AFTERSHOCK failed to start: ${error.message}`;
});
