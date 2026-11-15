# AFTERSHOCK

A handmade cyberpunk pixel-art action game. Move across a collapsing city, ride
bounce pads over impossible gaps, blast rogue robots, survive slow-motion
drone swarms, and take down THE ARCHITECT.

Internal resolution is 640×360 with integer nearest-neighbour scaling, flat
palettes, and hard pixel UI — no soft bloom or smooth website chrome.

Plain JavaScript (ES modules) + Canvas 2D + Web Audio. No dependencies, no build step.

## Run it

```bash
npm start            # serves the game at http://localhost:8080
# or: python3 -m http.server 8080
```

ES modules do not load from `file://`, so the game must be served over http.
Everything (fonts, music, sounds) is local, so it works offline at a booth.

## Controls

| Action | Input |
| --- | --- |
| Move | `←` `→` / `A` `D` |
| Jump (double jump in air) | `SPACE` / `W` / `↑` |
| Aim + fire (after picking up the blaster) | Mouse aim, left-click once to shoot |
| Pause | `ESC` / `P` |
| Menus | Mouse, or arrow keys + `ENTER` |

Movement is fully manual on every sector and the boss arena. Hold a direction
to run; release to stop. Drones still fire dodgeable red lasers.

## Test

```bash
npm test
```

`tools/playtest-levels.mjs` runs the real simulation headless and checks:

- every level can be finished by a bot that holds right and searches for jump timings,
- no ground obstacle sits so close to a roof edge that jumping it drops you into a gap,
- THE ARCHITECT can be beaten and its attacks can be dodged.

## Debug URL flags

- `?level=3` starts sector 3 directly (`?level=6` is the boss).
- `?invincible` ignores damage, which is handy for showing the game off.
- `?debug` exposes the app as `window.aftershock` in the console.

Settings also has an **Unlock all sectors** toggle for booth demos.

## Project layout

```
index.html            Screen markup (menus, HUD, modals)
styles/main.css       All UI styling; sizes use --u (one game pixel)
src/
  main.js             Boots assets, screens and the game loop
  config.js           Tuning values: physics, jump, weapons, camera, scoring
  core/               Game loop, input, save data, math, asset loading
  data/
    levels.js         The five levels + boss arena (levelBuilder helpers)
    themes.js         Per-level palettes, weather and background features
  game/               Simulation (no DOM — also runs in Node for tests)
    world.js          Owns entities and update order; emits events
    player.js         Movement, coyote time, jump buffer, blaster
    physics.js        Shared AABB movement / collision
    platforms.js      Static, moving and collapsing platforms
    interactables.js  Bounce pads, checkpoints, pickups, finish gate
    hazards.js        Shock strips, steam, lasers, debris, triangle rubble
    enemies.js        Crawler and Sentry robots
    drones.js         Hover/diver drones, gunship, slow-mo DroneEncounter
    boss.js           THE ARCHITECT attack sequences
    projectiles.js    Player shots, enemy bolts, drone lasers
    levelBuilder.js   Level authoring vocabulary → placement data
    eventEffects.js   Particles and shake for world events
  render/             Everything drawn on the 640×360 canvas
  audio/              Web Audio engine, SFX, music sequencer
  screens/            Boot, menu, level select, gameplay, ending
  ui/                 HUD, settings, menu navigation, transitions
assets/
  source/             Original sprite exports
  sprites/            Player frames extracted at native resolution
  fonts/              Silkscreen + VT323 (SIL Open Font License)
  reference/          Menu layout reference
tools/                Static server, sprite extractor, headless playtester
```

### How a frame works

`World.update()` advances the simulation at a fixed 120 Hz and pushes events
(`playerJump`, `swarmStart`, `bossSlam`…) into a queue. `GameScreen` drains
the queue to play sounds and update the HUD, and `WorldRenderer` draws the
current state. The simulation never touches the DOM, which is why
`npm test` can run whole levels in Node.

### Editing levels

Levels are lists of segments in `src/data/levels.js`:

```js
roof(600, { dy: -30, checkpoint: true, items: [crawler(300), pad(560)] }),
gap(250),
```

`roof(length)` places a building (`dy` changes height, negative is higher),
and `gap(width)` leaves empty space. Item positions (`at`) are measured from
the start of their segment. Set `autoRun: false` (default for all sectors) for
manual movement. Run `npm test` after changes.

### Changing the player sprite

Replace `assets/source/Sprite-0002.png` / `Sprite-0003.png` and run
`npm run sprites`. The extractor finds the character, removes the 3× export
scale and writes feet-aligned frames to `assets/sprites/`.
