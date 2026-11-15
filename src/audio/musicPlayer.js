/** Maps every in-game music cue to one of the two handmade soundtrack files. */
const TRACK_URLS = {
  main: 'assets/music/main.mp3',
  boss: 'assets/music/boss.mp3',
};

function resolveTrackKey(trackName) {
  return trackName === 'boss' ? 'boss' : 'main';
}

/**
 * Loops the campaign MP3 for menus/levels, and the boss MP3 for the final fight.
 * HTMLAudio keeps this simple and respects the browser's user-gesture unlock.
 */
export class MusicPlayer {
  constructor(engine) {
    this.engine = engine;
    this.players = {
      main: createLooper(TRACK_URLS.main),
      boss: createLooper(TRACK_URLS.boss),
    };
    this.trackKey = null;
    this.trackName = null;
    this.volumeScale = 1;
  }

  play(trackName) {
    const nextKey = resolveTrackKey(trackName);
    this.trackName = trackName;
    if (this.trackKey === nextKey && !this.players[nextKey].paused) return;
    this.stopAll();
    this.trackKey = nextKey;
    this.applyVolume();
    const audio = this.players[nextKey];
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }

  /** After the first click unlocks audio, restart whatever track was requested. */
  resume() {
    if (!this.trackKey) return;
    const audio = this.players[this.trackKey];
    this.applyVolume();
    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }

  stop() {
    this.stopAll();
    this.trackKey = null;
    this.trackName = null;
  }

  stopAll() {
    for (const audio of Object.values(this.players)) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  setTempoScale() {}

  applyVolume() {
    const settings = this.engine.settings;
    const enabled = settings.soundEnabled !== false;
    const musicVolume = settings.musicVolume ?? 0.6;
    const volume = enabled ? musicVolume * this.volumeScale : 0;
    for (const audio of Object.values(this.players)) audio.volume = Math.max(0, Math.min(1, volume));
  }

  setMuffled(isMuffled) {
    this.volumeScale = isMuffled ? 0.45 : 1;
    this.applyVolume();
  }
}

function createLooper(url) {
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  return audio;
}
