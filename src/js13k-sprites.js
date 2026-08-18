import atlasUrl, { D } from "./js13k-atlas.js";

const sprite = (index, kind = 0) => ({
  frame: D[index * 3],
  w: D[index * 3 + 1],
  h: D[index * 3 + 2],
  kind,
});

export { atlasUrl };
export const SPRITES = {
  unicorn: sprite(0, 1),
  peasant: sprite(1),
  pitchfork: sprite(2),
  hunter: sprite(3),
  torch: sprite(4),
  knight: sprite(5),
};
export const ICONS = {
  pause: sprite(6),
  play: sprite(7),
};
export const POOLS = {
  trees: [8, 9, 10, 11, 12, 13].map(sprite),
  grass: [sprite(14)],
  flowers: [sprite(15, 2)],
  stains: [16, 17, 18, 19].map(sprite),
};
