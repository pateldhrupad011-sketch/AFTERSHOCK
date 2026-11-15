import { BLASTER, PLAYER } from '../config.js';
import { spriteToDataUrl } from '../render/pixelArt.js';
import { ARCHITECT } from '../game/boss.js';

const RADIO_DURATION = 4.2;

/**
 * The in-game heads-up display (HTML over the canvas). Values are only
 * written to the DOM when they change, to keep layout work out of the frame.
 */
export class Hud {
  constructor(root, sprites) {
    this.root = root;
    const find = (selector) => root.querySelector(selector);
    this.hearts = find('.hud-hearts');
    this.levelName = find('.hud-level-name');
    this.progressFill = find('.hud-progress-fill');
    this.progressRunner = find('.hud-progress-runner');
    this.score = find('.hud-score');
    this.shardCount = find('.hud-shard-count');
    this.blaster = find('.hud-blaster');
    this.blasterCells = find('.hud-blaster-cells');
    this.swarmPanel = find('.swarm-panel');
    this.swarmCount = find('.swarm-count');
    this.swarmTimerFill = find('.swarm-timer-fill');
    this.bossBar = find('.boss-bar');
    this.bossHealthFill = find('.boss-health-fill');
    this.progress = find('.hud-progress');
    this.radio = find('.radio-message');
    this.radioSpeaker = find('.radio-speaker');
    this.radioText = find('.radio-text');
    this.banner = find('.center-banner');
    this.bannerTitle = find('.banner-title');
    this.bannerSubtitle = find('.banner-subtitle');
    this.koOverlay = find('.ko-overlay');
    this.intro = find('.level-intro');

    find('.hud-shard-icon').src = spriteToDataUrl(sprites.shard, 4);
    this.heartImages = { full: spriteToDataUrl(sprites.heart, 4), empty: spriteToDataUrl(sprites.heartEmpty, 4) };
    this.hearts.replaceChildren(...Array.from({ length: PLAYER.maxHealth }, () => {
      const wrap = document.createElement('span');
      wrap.className = 'hud-heart';
      const empty = document.createElement('img');
      empty.className = 'heart-empty';
      empty.alt = '';
      empty.src = this.heartImages.empty;
      const fill = document.createElement('img');
      fill.className = 'heart-fill';
      fill.alt = '';
      fill.src = this.heartImages.full;
      wrap.append(empty, fill);
      return wrap;
    }));
    this.blasterCells.replaceChildren(...Array.from({ length: BLASTER.maxCharge }, () => document.createElement('span')));
    this.cache = {};
  }

  reset(level) {
    this.cache = {};
    this.levelName.textContent = level.isBossArena ? 'BOSS' : `LEVEL 0${level.number}  ${level.name.toUpperCase()}`;
    this.progress.style.display = level.isBossArena ? 'none' : '';
    this.radio.classList.remove('is-visible');
    this.banner.classList.remove('is-visible');
    this.hideKo();
    this.radioTimer = 0;
  }

  /** Writes `value` via `apply` only when it differs from last frame. */
  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  update(world, realDt) {
    const player = world.player;
    // Round to quarter-hearts so laser chip damage (0.25) updates the HUD cleanly.
    const health = Math.round(player.health * 4) / 4;
    this.set('health', health, (value) => {
      [...this.hearts.children].forEach((wrap, i) => {
        const fill = wrap.querySelector('.heart-fill');
        const previous = Number(wrap.dataset.fill || 1);
        const amount = Math.max(0, Math.min(1, value - i));
        wrap.dataset.fill = String(amount);
        wrap.classList.toggle('is-empty', amount <= 0);
        wrap.classList.toggle('is-lost', previous > amount);
        if (amount <= 0) {
          fill.style.opacity = '0';
          fill.style.clipPath = 'none';
          fill.style.visibility = 'hidden';
        } else if (amount >= 1) {
          fill.style.opacity = '1';
          fill.style.visibility = 'visible';
          fill.style.clipPath = 'none';
        } else {
          fill.style.opacity = '1';
          fill.style.visibility = 'visible';
          fill.style.clipPath = `inset(0 ${(1 - amount) * 100}% 0 0)`;
        }
      });
    });
    this.set('score', world.stats.score, (score) => { this.score.textContent = String(score).padStart(6, '0'); });
    this.set('shards', world.stats.shards, (shards) => { this.shardCount.textContent = `${shards}/${world.stats.totalShards}`; });
    const progress = Math.round(world.progress * 200) / 2;
    this.set('progress', progress, (value) => {
      this.progressFill.style.width = `${value}%`;
      this.progressRunner.style.left = `${value}%`;
    });
    this.set('hasBlaster', player.hasBlaster, (has) => this.blaster.classList.toggle('is-visible', has));
    this.set('charge', player.blasterCharge, (charge) => {
      [...this.blasterCells.children].forEach((cell, i) => cell.classList.toggle('is-charged', i < charge));
    });

    const encounter = world.activeEncounter;
    this.set('swarm', Boolean(encounter), (visible) => this.swarmPanel.classList.toggle('is-visible', visible));
    if (encounter) {
      this.set('swarmCount', encounter.remainingDrones, (count) => { this.swarmCount.textContent = `${count} LEFT`; });
      this.swarmTimerFill.style.width = `${(encounter.remainingTime / encounter.timeLimit) * 100}%`;
    }

    const boss = world.boss;
    const showBossBar = Boolean(boss) && boss.state !== 'dormant' && boss.state !== 'destroyed';
    this.set('bossBar', showBossBar, (visible) => this.bossBar.classList.toggle('is-visible', visible));
    if (showBossBar) {
      // During the reveal the bar fills up dramatically.
      const fill = boss.state === 'reveal' ? Math.min(1, boss.stateTimer / ARCHITECT.revealDuration) : boss.health / ARCHITECT.maxHealth;
      this.set('bossHealth', Math.round(fill * 200), (value) => { this.bossHealthFill.style.width = `${value / 2}%`; });
    }

    if (this.radioTimer > 0) {
      this.radioTimer -= realDt;
      if (this.radioTimer <= 0) this.radio.classList.remove('is-visible');
    }
  }

  showRadio(speaker, text) {
    this.radioSpeaker.textContent = speaker;
    this.radioText.textContent = text;
    this.radio.classList.toggle('is-hostile', speaker === 'ARCHITECT');
    this.radio.classList.add('is-visible');
    this.radioTimer = RADIO_DURATION;
  }

  showBanner(title, subtitle = '', color = '#3ef4ff') {
    this.bannerTitle.textContent = title;
    this.bannerSubtitle.textContent = subtitle;
    this.banner.style.setProperty('--banner-color', color);
    // Restart the CSS animation even if a banner is already showing.
    this.banner.classList.remove('is-visible');
    void this.banner.offsetWidth;
    this.banner.classList.add('is-visible');
  }

  showKo() {
    this.koOverlay.classList.remove('is-visible');
    void this.koOverlay.offsetWidth;
    this.koOverlay.classList.add('is-visible');
  }

  hideKo() {
    this.koOverlay.classList.remove('is-visible');
  }

  showIntro(level) {
    this.intro.querySelector('.intro-sector').textContent = `LEVEL 0${level.number}`;
    const name = this.intro.querySelector('.intro-name');
    name.textContent = level.name.toUpperCase();
    name.dataset.text = level.name.toUpperCase();
    this.intro.querySelector('.intro-briefing').textContent = level.briefing;
    this.intro.classList.add('is-visible');
  }

  hideIntro() {
    this.intro.classList.remove('is-visible');
  }
}
