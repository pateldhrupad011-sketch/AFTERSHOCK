/*
 * Song data for the procedural synthwave soundtrack.
 *
 * Each track is a looping chord progression (one chord per bar) plus 16-step
 * patterns. In patterns, '.' is a rest:
 *   drums  'x' = hit, 'o' = accented/open hit
 *   bass   a digit picks a chord tone (0 = root, 1 = third, 2 = fifth, 3 = octave)
 *   arp    same digits, played an octave above the chord
 * Chords are [root MIDI note, 'min' | 'maj'].
 */

const A2 = 45, B2 = 47, C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55;
const GS2 = 44, AS2 = 46, DS3 = 51, FS3 = 54;

export const MUSIC_TRACKS = {
  menu: {
    bpm: 84,
    chords: [[A2, 'min'], [F3 - 12, 'maj'], [C3, 'maj'], [G3 - 12, 'maj']],
    kick: 'x.......x.......',
    snare: '................',
    hat: '....x.......x...',
    bass: '0.......0...2...',
    arp: '0.2.3.2.1.2.3.2.',
    pad: true,
    arpVolume: 0.05,
  },
  outbreak: {
    bpm: 118,
    chords: [[A2, 'min'], [F3 - 12, 'maj'], [C3, 'maj'], [G3 - 12, 'maj']],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...xo',
    bass: '0.00.00.0.00.03.',
    arp: '0231023102310231',
    pad: true,
    arpVolume: 0.045,
  },
  iron: {
    bpm: 112,
    chords: [[D3, 'min'], [AS2, 'maj'], [C3, 'maj'], [A2, 'min']],
    kick: 'x..x..x.x..x..x.',
    snare: '....x.......x..x',
    hat: 'xxoxxxoxxxoxxxox',
    bass: '0..0..0.0..0..20',
    arp: '0...2...3...2...',
    pad: true,
    arpVolume: 0.05,
    metallic: true,
  },
  pursuit: {
    bpm: 124,
    chords: [[E3, 'min'], [C3, 'maj'], [D3, 'maj'], [B2, 'min']],
    kick: 'x...x...x...x...',
    snare: '....x.......x.x.',
    hat: 'x.x.x.x.x.x.x.xo',
    bass: '0000000000000000',
    arp: '0123210301232103',
    pad: true,
    arpVolume: 0.04,
  },
  bridge: {
    bpm: 132,
    chords: [[C3, 'min'], [GS2, 'maj'], [DS3, 'maj'], [AS2, 'maj']],
    kick: 'x..xx...x..xx...',
    snare: '....x.......xxxx',
    hat: 'xoxoxoxoxoxoxoxo',
    bass: '0.0.0.00.0.0.030',
    arp: '3210321032103210',
    pad: true,
    arpVolume: 0.04,
  },
  core: {
    bpm: 128,
    chords: [[FS3 - 12, 'min'], [D3, 'maj'], [A2, 'maj'], [E3, 'maj']],
    kick: 'x...x...x...x.x.',
    snare: '....x..x....x...',
    hat: '.xx..xx..xx..xxo',
    bass: '0.30.30.0.30.320',
    arp: '0.3.1.3.2.3.1.3.',
    pad: true,
    arpVolume: 0.05,
    glitch: true,
  },
  boss: {
    bpm: 140,
    chords: [[D3, 'min'], [D3, 'min'], [AS2, 'maj'], [A2, 'maj']],
    kick: 'x.x.x.x.x.x.x.xx',
    snare: '....x.......x.xx',
    hat: 'xoxoxoxoxoxoxoxo',
    bass: '0303030302020203',
    arp: '3210321032103213',
    pad: true,
    arpVolume: 0.05,
    glitch: true,
  },
  victory: {
    bpm: 96,
    chords: [[C3, 'maj'], [G3 - 12, 'maj'], [A2, 'min'], [F3 - 12, 'maj']],
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: '0...0...0...2...',
    arp: '0123012301230123',
    pad: true,
    arpVolume: 0.05,
  },
};
