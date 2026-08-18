import { writeFileSync } from "node:fs";
import {
  ICONS,
  SPRITES,
  makeFlowerSprite,
  makeGrassSprite,
  makeStainSprite,
  makeTreeSprite,
  seededRandom,
} from "./js13k-sprite-source.mjs";

const trees = Array.from({ length: 6 }, (_, index) =>
  makeTreeSprite(seededRandom(index, 101)),
);
const grass = makeGrassSprite(seededRandom(0, 211));
const flower = makeFlowerSprite(seededRandom(0, 307));
const stains = Array.from({ length: 4 }, (_, index) =>
  makeStainSprite(seededRandom(index, 401)),
);

// The game reconstructs the atlas at startup. Packing only occupied sprite
// rectangles avoids paying for the empty 24x32 atlas cells.
const atlasBits = [];
const packSprite = (rows, value) =>
  rows.forEach((row) =>
    [...row].forEach((char) => {
      atlasBits.push(value(char));
    }),
  );
const packSprite2 = (rows, value) => {
  for (let bit = 0; bit < 2; bit++)
    packSprite(rows, (char) => (value(char) >> bit) & 1);
};
packSprite2(SPRITES.unicorn, (char) =>
  char === "." ? 0 : char === "t" ? 2 : 1,
);
packSprite2(flower, (char) =>
  char === "." ? 0 : char === "g" ? 1 : char === "c" ? 2 : 3,
);
stains.forEach((sprite) =>
  packSprite2(sprite, (char) =>
    char === "." ? 0 : char === "d" ? 2 : 1,
  ),
);
[
  SPRITES.peasant,
  SPRITES.pitchfork,
  SPRITES.hunter,
  SPRITES.torch,
  SPRITES.knight,
  ICONS.pause,
  ICONS.play,
  ...trees,
  grass,
].forEach((sprite) => packSprite(sprite, (char) => +(char !== ".")));
const atlasBytes = Buffer.alloc(Math.ceil(atlasBits.length / 8));
atlasBits.forEach((value, index) => {
  atlasBytes[index >> 3] |= value << (index & 7);
});
const descriptors = [
  [0, SPRITES.unicorn],
  [1, SPRITES.peasant],
  [2, SPRITES.pitchfork],
  [3, SPRITES.hunter],
  [4, SPRITES.torch],
  [5, SPRITES.knight],
  [6, ICONS.pause],
  [7, ICONS.play],
  ...trees.map((sprite, index) => [8 + index, sprite]),
  [14, grass],
  [15, flower],
  ...stains.map((sprite, index) => [22 + index, sprite]),
].flatMap(([frame, sprite]) => [frame, sprite[0].length, sprite.length]);
const atlasSource = `export const D=${JSON.stringify(descriptors)};export default C=>{const c=document.createElement("canvas"),x=c.getContext("2d"),s=atob("${atlasBytes.toString("base64")}");c.width=480;c.height=192;let p=0,d=(n,a,f=D[n*3])=>{let w=D[n*3+1],h=D[n*3+2];x.fillStyle=a;for(let i=0;i<w*h;i++,p++)s.charCodeAt(p>>3)>>(p&7)&1&&x.fillRect(2*(f%10*24+i%w),2*((f/10|0)*32+(i/w|0)),2,2)};d(0,"#fff");d(0,"#bcd8ff");let q=p;for(let f=15;f<22;f++)p=q,d(15,"#a9ada9",f),d(15,C[f-15][1],f),x.fillStyle="#f0efe8",x.fillRect(2*(f%10*24+5),2*((f/10|0)*32+3),2,2);p=q+286;for(let f=16;f<20;f++)d(f,"#555956"),d(f,"#262927");for(let f=1;f<6;f++)d(f,"#fff");for(let f=6;f<8;f++)d(f,"#efeee7");for(let f=8;f<15;f++)d(f,"#fff");return c.toDataURL()}`;
writeFileSync(new URL("../src/js13k-atlas.js", import.meta.url), atlasSource);

console.log(
  JSON.stringify({
    bits: atlasBits.length,
    bytes: atlasBytes.length,
    trees: trees.map((sprite) => [sprite[0].length, sprite.length]),
    grass: [grass[0].length, grass.length],
  }),
);
