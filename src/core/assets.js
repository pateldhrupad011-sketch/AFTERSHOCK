export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

export const ASSET_PATHS = {
  // Planted, right-leg step, left-leg step — a proper alternating walk cycle.
  playerRunFrames: [
    'assets/sprites/player-run-1.png',
    'assets/sprites/player-run-2.png',
    'assets/sprites/player-run-3.png',
  ],
  // Red damage poses matching the walk cycle (plant / right / left).
  playerHurtFrames: [
    'assets/sprites/player-hurt-1.png',
    'assets/sprites/player-hurt-2.png',
    'assets/sprites/player-hurt-3.png',
  ],
  jumpPadFrames: [
    'assets/sprites/jump-pad-f0.png',
    'assets/sprites/jump-pad-f1.png',
    'assets/sprites/jump-pad-f2.png',
    'assets/sprites/jump-pad-f3.png',
    'assets/sprites/jump-pad-f4.png',
    'assets/sprites/jump-pad-f5.png',
  ],
  boss: 'assets/sprites/boss.png',
  skylines: {
    far: 'assets/backgrounds/skyline-2.png',
    mid: 'assets/backgrounds/skyline-1.png',
    near: 'assets/backgrounds/skyline-3.png',
  },
};

export async function loadAssets() {
  const [playerRunFrames, playerHurtFrames, jumpPadFrames, boss, far, mid, near] = await Promise.all([
    Promise.all(ASSET_PATHS.playerRunFrames.map(loadImage)),
    Promise.all(ASSET_PATHS.playerHurtFrames.map(loadImage)),
    Promise.all(ASSET_PATHS.jumpPadFrames.map(loadImage)),
    loadImage(ASSET_PATHS.boss),
    loadImage(ASSET_PATHS.skylines.far),
    loadImage(ASSET_PATHS.skylines.mid),
    loadImage(ASSET_PATHS.skylines.near),
  ]);
  await document.fonts.ready;
  return {
    playerRunFrames,
    playerHurtFrames,
    jumpPadFrames,
    boss,
    skylines: { far, mid, near },
  };
}
