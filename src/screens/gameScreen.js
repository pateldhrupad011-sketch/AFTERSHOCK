import { BOSS_ARENA, LEVELS } from '../data/levels.js';
import { World } from '../game/world.js';
import { WorldRenderer } from '../render/worldRenderer.js';
import { Hud } from '../ui/hud.js';
import { MenuNavigation } from '../ui/menuNavigation.js';

const INTRO_DURATION = 3.4;
const RESULTS_DELAY = 1.4;
const BOSS_TRANSITION = { freeze: 0.8, glitchIn: 1.6, glitchOut: 0.9 };
const VICTORY_DELAY = 3.2;

// World event -> sound effect. Events needing more than a sound are handled in handleWorldEvent().
const EVENT_SOUNDS = {
  playerJump: 'jump',
  playerLand: 'land',
  bouncePad: 'bounce',
  playerShoot: 'shoot',
  enemyHit: 'enemyHit',
  enemyDestroyed: 'explosion',
  droneExploded: 'explosion',
  boltDestroyed: 'enemyHit',
  shardCollected: 'shard',
  healthRestored: 'powerUp',
  playerHurt: 'hurt',
  playerFell: 'hurt',
  checkpoint: 'checkpoint',
  enemyCharge: 'enemyCharge',
  enemyFire: 'enemyFire',
  droneDive: 'alarm',
  swarmLockOn: 'lockOn',
  swarmStrike: 'hurt',
  structureCracking: 'alarm',
  structureCollapse: 'rumble',
  debrisWarning: 'alarm',
  debrisImpact: 'explosion',
  backgroundCollapse: 'rumble',
  bossWarning: 'alarm',
  bossSlam: 'bossSlam',
  bossArmorHit: 'armorHit',
  bossCriticalHit: 'criticalHit',
  bossExplosion: 'explosion',
  blasterEmpty: 'click',
};

/**
 * Runs a level: intro card, gameplay, pause, results / failure, the glitch
 * transition from Level 5 into the boss arena, and the victory sequence.
 */
export class GameScreen {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('game-screen');
    this.hud = new Hud(this.element, app.sprites);
    this.pauseMenu = this.element.querySelector('.pause-menu');
    this.resultsPanel = this.element.querySelector('.results-panel');
    this.failurePanel = this.element.querySelector('.failure-panel');
    this.modalNavigation = new MenuNavigation(app.audio);
    this.bindButtons();
  }

  bindButtons() {
    const on = (root, action, handler) => root.querySelector(`[data-action="${action}"]`).addEventListener('click', handler);

    this.element.querySelector('.pause-button').addEventListener('click', () => this.togglePause());

    on(this.pauseMenu, 'resume', () => this.togglePause());
    on(this.pauseMenu, 'restart', () => this.restartLevel());
    on(this.pauseMenu, 'settings', () => this.app.settingsPanel.open(() => this.applySettings()));
    on(this.pauseMenu, 'quit', () => this.app.screens.switchTo('levelSelect'));
    on(this.resultsPanel, 'retry', () => this.restartLevel());
    on(this.resultsPanel, 'levels', () => this.app.screens.switchTo('levelSelect'));
    on(this.failurePanel, 'retry', () => this.restartLevel());
    on(this.failurePanel, 'levels', () => this.app.screens.switchTo('levelSelect'));
  }

  enter({ levelNumber, isBoss = false }) {
    this.startLevel(isBoss ? BOSS_ARENA : LEVELS[levelNumber - 1]);
  }

  exit() {
    this.closeModals();
    this.hud.hideIntro();
    this.app.audio.setSlowMotion(false);
  }

  startLevel(level) {
    const app = this.app;
    this.level = level;
    this.world = new World(level, { startWithBlaster: level.startsWithBlaster, invincible: app.debug.invincible });
    this.renderer = new WorldRenderer(level, app);
    this.hud.reset(level);
    this.hud.update(this.world, 0);
    this.closeModals();
    this.applySettings();
    app.input.reset();
    app.audio.playMusic(level.music);
    app.audio.setSlowMotion(false);
    this.phaseTimer = 0;
    this.glitchIntensity = 0;

    if (level.isBossArena) {
      this.phase = 'playing';
    } else {
      this.phase = 'intro';
      this.hud.showIntro(level);
    }
  }

  applySettings() {
    if (this.world) this.world.camera.shakeEnabled = this.app.save.settings.screenShake;
  }

  restartLevel() {
    this.startLevel(this.level);
  }

  update(dt) {
    const { input } = this.app;
    this.phaseTimer += dt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer >= INTRO_DURATION || input.consumeJump() || input.consumeFire()) this.beginPlaying();
        break;
      case 'playing':
      case 'finishing':
      case 'victory':
        this.world.update(dt, {
          jumpPressed: input.consumeJump(),
          moveAxis: input.moveAxis,
          firePressed: input.consumeFire(),
          fireHeld: input.mouse.isDown,
          aimX: input.mouse.x,
          aimY: input.mouse.y,
        });
        for (const event of this.world.drainEvents()) this.handleWorldEvent(event);
        this.hud.update(this.world, dt);
        if (this.phase === 'finishing' && this.phaseTimer >= RESULTS_DELAY) this.showResults();
        if (this.phase === 'victory' && this.phaseTimer >= VICTORY_DELAY) this.finishGame();
        break;
      case 'bossTransition':
        this.updateBossTransition();
        break;
      default:
        break; // paused, results and failure screens wait for button input.
    }
  }

  beginPlaying() {
    this.hud.hideIntro();
    this.phase = 'playing';
    this.phaseTimer = 0;
    this.app.input.reset();
    this.hud.showBanner(
      'GO!',
      this.level.isBossArena ? 'MOVE · JUMP · SHOOT' : 'MOVE · JUMP',
    );
  }

  handleWorldEvent(event) {
    const { audio, save } = this.app;
    const sound = EVENT_SOUNDS[event.type];
    if (sound) audio.play(sound, { impact: event.impact, volume: event.layer === 'far' ? 0.15 : 0.3 });
    this.renderer.handleEvent(event, this.world);

    switch (event.type) {
      case 'radioMessage':
        this.hud.showRadio(event.speaker, event.text);
        break;
      case 'blasterAcquired':
        audio.play('powerUp');
        this.hud.showBanner('BLASTER', 'CLICK TO SHOOT');
        break;
      case 'checkpoint':
        this.hud.showBanner('CHECKPOINT', '', '#40a878');
        break;
      case 'playerFell':
        delete this.hud.cache.health;
        this.hud.update(this.world, 0);
        this.hud.showBanner('DOWN', `${event.health} LEFT`, '#c02840');
        break;
      case 'playerHurt':
        delete this.hud.cache.health;
        this.hud.update(this.world, 0);
        break;
      case 'playerDestroyed':
        audio.play('explosion', { size: 1.4 });
        break;
      case 'swarmStart':
        audio.play('swarmStart');
        audio.setSlowMotion(true);
        this.hud.showBanner('SWARM', 'SHOOT', '#c02840');
        break;
      case 'swarmEnd':
        audio.play('swarmEnd');
        audio.setSlowMotion(false);
        if (event.outcome === 'cleared') this.hud.showBanner('CLEAR', '+300', '#40a878');
        break;
      case 'gunshipArrives':
        audio.play('alarm');
        this.hud.showBanner('GUNSHIP', 'SHOOT THE BOLTS', '#c02840');
        break;
      case 'noWeapon':
        if (!this.noWeaponHintShown) this.hud.showRadio('NOVA', 'Grab the blaster first.');
        this.noWeaponHintShown = true;
        break;
      case 'bossReveal':
        audio.play('bossRoar');
        this.hud.showBanner('THE ARCHITECT', '', '#c02840');
        break;
      case 'bossCoreExposed':
        this.hud.showBanner('CORE OPEN', 'SHOOT', '#c87840');
        break;
      case 'bossPhaseTwo':
        audio.play('glitch');
        this.hud.showBanner('PHASE 2', '', '#c02840');
        break;
      case 'bossDefeated':
        audio.play('bossRoar');
        break;
      case 'bossDestroyed':
        audio.play('explosion', { size: 2.5 });
        break;
      case 'levelComplete':
        this.handleLevelComplete();
        break;
      case 'levelFailed':
        this.showFailure();
        break;
      default:
        break;
    }
    if (event.type === 'playerHurt' && event.health <= 1 && event.health > 0.74) {
      this.hud.showRadio('NOVA', 'Shell integrity critical! Find a battery!');
    }
    if (event.type === 'healthRestored') {
      delete this.hud.cache.health;
      this.hud.update(this.world, 0);
    }
    if (event.type === 'checkpoint' || event.type === 'levelComplete') save.persist();
  }

  handleLevelComplete() {
    if (this.level.isBossArena) {
      this.phase = 'victory';
      this.phaseTimer = 0;
      this.hud.showKo();
      this.app.audio.play('levelComplete');
      this.app.save.recordBossDefeated();
      return;
    }
    this.app.audio.play('levelComplete');
    this.lastResult = this.buildResult();
    this.app.save.recordLevelResult(this.level.number, this.lastResult, LEVELS.length);

    if (this.level.leadsToBoss) {
      this.phase = 'bossTransition';
      this.phaseTimer = 0;
      this.hud.showBanner('CORE BREACH', '', '#c02840');
    } else {
      this.phase = 'finishing';
      this.phaseTimer = 0;
      this.hud.showBanner('LEVEL CLEAR', '', '#40a878');
    }
  }

  buildResult() {
    const stats = this.world.stats;
    const shardRatio = stats.totalShards ? stats.shards / stats.totalShards : 1;
    let rank = 'C';
    if (stats.damageTaken === 0 && shardRatio >= 0.8) rank = 'S';
    else if (stats.damageTaken <= 1) rank = 'A';
    else if (stats.damageTaken <= 2) rank = 'B';
    return { time: stats.time, score: stats.score, shards: stats.shards, totalShards: stats.totalShards, kills: stats.kills, damage: stats.damageTaken, rank };
  }

  showResults() {
    const result = this.lastResult;
    this.phase = 'results';
    this.resultsPanel.querySelector('.results-outro').textContent = this.level.outro;
    this.resultsPanel.querySelector('.results-stats').innerHTML = `
      <dt>TIME</dt><dd>${result.time.toFixed(1)}s</dd>
      <dt>ROBOTS DISABLED</dt><dd>${result.kills}</dd>
      <dt>DATA SHARDS</dt><dd>${result.shards}/${result.totalShards}</dd>
      <dt>DAMAGE TAKEN</dt><dd>${result.damage}</dd>
      <dt>SCORE</dt><dd>${result.score}</dd>`;
    this.resultsPanel.querySelector('.rank-letter').textContent = result.rank;
    this.openModal(this.resultsPanel);
  }

  showFailure() {
    this.phase = 'failed';
    this.app.audio.play('failure');
    this.failurePanel.querySelector('.failure-text').textContent = this.level.isBossArena
      ? 'Boss fight failed. Retry.'
      : 'Your shell was destroyed. The city is still falling.';
    this.openModal(this.failurePanel);
  }

  /**
   * Level 5 -> boss: freeze, corrupt the screen with a growing glitch and
   * pixelation, swap to the arena at peak corruption, then resolve.
   */
  updateBossTransition() {
    const t = this.phaseTimer;
    const { freeze, glitchIn, glitchOut } = BOSS_TRANSITION;
    if (t < freeze) {
      this.glitchIntensity = 0.05;
    } else if (t < freeze + glitchIn) {
      if (!this.glitchSoundPlayed) {
        this.app.audio.play('glitch');
        this.glitchSoundPlayed = true;
      }
      this.glitchIntensity = (t - freeze) / glitchIn;
    } else if (!this.hasSwappedToArena) {
      // Peak corruption hides the cut to the arena.
      this.hasSwappedToArena = true;
      this.startLevel(BOSS_ARENA);
      this.phase = 'bossTransition';
      this.phaseTimer = freeze + glitchIn;
      this.glitchIntensity = 1;
      this.app.audio.play('glitch');
    } else {
      this.glitchIntensity = Math.max(0, 1 - (t - freeze - glitchIn) / glitchOut);
      if (this.glitchIntensity === 0) {
        this.phase = 'playing';
        this.hasSwappedToArena = false;
        this.glitchSoundPlayed = false;
      }
    }
  }

  finishGame() {
    this.phase = 'done';
    this.hud.hideKo();
    const save = this.app.save;
    const totals = LEVELS.reduce((sum, level) => {
      const record = save.getLevelRecord(level.number);
      return { score: sum.score + (record?.bestScore ?? 0), shards: sum.shards + (record?.shards ?? 0), total: sum.total + (record?.totalShards ?? 0) };
    }, { score: 0, shards: 0, total: 0 });
    this.app.screens.switchTo('ending', {
      bossTime: this.world.stats.time,
      bossDamage: this.world.stats.damageTaken,
      totalScore: totals.score + this.world.stats.score,
      shards: `${totals.shards}/${totals.total}`,
    });
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.openModal(this.pauseMenu);
      this.app.audio.engine.setMusicMuffled(true);
    } else if (this.phase === 'paused') {
      this.closeModals();
      this.phase = 'playing';
      this.app.input.reset();
      this.app.audio.setSlowMotion(this.world.isSlowMotion);
    }
  }

  openModal(modal) {
    this.closeModals();
    modal.classList.add('is-open');
    this.activeModal = modal;
    this.modalNavigation.setButtons([...modal.querySelectorAll('button')].filter((button) => button.style.display !== 'none'));
    this.modalNavigation.focus(0, { silent: true });
  }

  closeModals() {
    for (const modal of [this.pauseMenu, this.resultsPanel, this.failurePanel]) modal.classList.remove('is-open');
    this.activeModal = null;
  }

  handleKey(event) {
    const settings = this.app.settingsPanel;
    if (settings.isOpen) {
      settings.handleKey(event);
      return;
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      this.togglePause();
      return;
    }
    if (this.activeModal) this.modalNavigation.handleKey(event);
  }

  render(ctx, frameDt) {
    const isFrozen = this.phase === 'paused' || this.phase === 'intro' || (this.phase === 'bossTransition' && this.phaseTimer < BOSS_TRANSITION.freeze + BOSS_TRANSITION.glitchIn);
    this.renderer.render(ctx, this.world, this.app.input.mouse, isFrozen ? 0 : frameDt);
    if (this.phase === 'playing' && this.world.player.health <= 1 && this.world.player.isAlive) this.renderer.drawLowHealthPulse(ctx);
    if (this.phase === 'bossTransition') this.app.postEffects.applyGlitch(ctx, this.glitchIntensity);
  }
}
