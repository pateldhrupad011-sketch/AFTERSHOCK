import { MusicPlayer } from './musicPlayer.js';

/**
 * Music-only audio. SFX stay silent; campaign music uses the main MP3
 * everywhere except the boss fight, which uses the boss MP3.
 */
export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.unlocked = false;
    this.music = new MusicPlayer({ settings });
    this.engine = {
      isReady: false,
      settings,
      setMusicMuffled: (isMuffled) => this.music.setMuffled(isMuffled),
      applySettings: () => this.applySettings(),
      unlock: () => this.unlock(),
    };
  }

  /** Must be called from a user gesture (click / key press). */
  unlock() {
    this.unlocked = true;
    this.engine.isReady = true;
    this.music.applyVolume();
    this.music.resume();
  }

  playMusic(trackName) {
    this.music.play(trackName);
    if (this.unlocked) this.music.resume();
  }

  /** Sound effects removed — keep the API so call sites stay unchanged. */
  play() {}

  applySettings() {
    this.music.applyVolume();
  }

  setSlowMotion(isSlow) {
    this.music.setMuffled(isSlow);
  }
}
