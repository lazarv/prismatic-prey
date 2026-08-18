const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const SPRITES = {
  unicorn: [
    "...................h",
    ".................hh.",
    ".............wwwhh..",
    "............wwwwwh..",
    "...........wwwww.ww.",
    ".....wwww..wwwww....",
    "..ttwwwwwwwwwwww....",
    ".tttwwwwwwwwwwww....",
    ".tttwwwwwwwwwwww....",
    "ttttwwwwwwwwwww.....",
    "ttt.www.....www.....",
    "ttttwww.....www.....",
    "tttt.ww.....www.....",
    "tt.t.ww.....www.....",
    "..ww..w....wwww.....",
    "..ww..ww....w.w.....",
  ],
  peasant: [
    "..wwww..",
    ".wwwwww.",
    "..wwww..",
    "..wwww..",
    ".wwwwww.",
    "wwwwwwww",
    "...ww...",
    "..wwww..",
    "..wwww..",
    "..ww.ww.",
    ".ww...ww",
    "ww.....w",
  ],
  pitchfork: [
    "........w.w.",
    ".........w..",
    "........www.",
    "..wwww...w..",
    ".wwwwww..w..",
    "..wwww...w..",
    ".wwwwww..w..",
    "wwwwwwww.w..",
    "...ww....w..",
    "..wwww...w..",
    "..ww.ww..w..",
    "..ww.ww..w..",
    ".ww...ww.w..",
    "ww.....www..",
  ],
  hunter: [
    "..wwwwww....",
    ".wwwwwwww...",
    "..wwww......",
    "..wwww..w...",
    ".wwwwww.w...",
    "wwwwwwww.w..",
    "...ww...w.w.",
    "..wwww...w..",
    "..ww.ww.....",
    "..ww.ww.....",
    ".ww...ww....",
    "ww.....ww...",
  ],
  torch: [
    ".........w..",
    "........www.",
    ".......wwww.",
    "........ww..",
    "..wwww...w..",
    ".wwwwww..w..",
    "..wwww...w..",
    ".wwwwww..w..",
    "wwwwwwww.w..",
    "...ww....w..",
    "..wwww...w..",
    "..ww.ww.....",
    ".ww...ww....",
    "ww.....ww...",
  ],
  knight: [
    "..............w.",
    ".............www",
    ".....wwww....ww.",
    "....wwwwww...ww.",
    "....ww..ww...ww.",
    "....wwwwww...ww.",
    "..wwwwwwwwww.ww.",
    ".wwwwwwwwwwwwww.",
    ".www.wwww.ww.ww.",
    "....wwwwwwwwwww.",
    "....wwww..wwwwww",
    "....wwwwwwwwww..",
    "....wwww....ww..",
    "....wwww...www..",
    "....wwwwww......",
    "....ww..ww......",
    "....ww..ww......",
    "...www..www.....",
    "..wwww..wwww....",
  ],
};

export const ICONS = {
  pause: Array(10).fill(".ww....ww."),
  play: [
    "w........",
    "www......",
    "wwwww....",
    "wwwwwww..",
    "wwwwwwwww",
    "wwwwwwwww",
    "wwwwwww..",
    "wwwww....",
    "www......",
    "w........",
  ],
};

function drawSpriteLine(pixels, x0, y0, x1, y1, char = "w", thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    for (
      let oy = -Math.floor((thickness - 1) / 2);
      oy <= Math.floor(thickness / 2);
      oy++
    ) {
      for (
        let ox = -Math.floor((thickness - 1) / 2);
        ox <= Math.floor(thickness / 2);
        ox++
      ) {
        if (pixels[y + oy]?.[x + ox] !== undefined)
          pixels[y + oy][x + ox] = char;
      }
    }
  }
}

export function seededRandom(cx, cy) {
  let state =
    (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 13026) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTreeSprite(random = Math.random) {
  const range = (min, max) => min + random() * (max - min);
  const width = Math.floor(range(18, 23));
  const height = Math.floor(range(23, 29));
  const pixels = Array.from({ length: height }, () => Array(width).fill("."));
  const center = Math.floor(width / 2 + range(-1.5, 1.5));
  const top = Math.floor(range(3, 6));
  const trunk = [];
  let x = center;

  for (let y = height - 1; y >= top; y--) {
    trunk[y] = x;
    const depth = (y - top) / (height - 1 - top);
    drawSpriteLine(
      pixels,
      x,
      y,
      x,
      y,
      "w",
      depth > 0.72 ? 3 : depth > 0.28 ? 2 : 1,
    );
    if (y < height - 4 && y > top + 1 && random() < 0.17) {
      x = clamp(x + (random() < 0.5 ? -1 : 1), 4, width - 5);
    }
  }

  // Flared roots anchor the trunk and keep the base from reading as a pole.
  for (const direction of [-1, 1]) {
    drawSpriteLine(
      pixels,
      center + direction,
      height - 4,
      clamp(center + direction * Math.floor(range(4, 8)), 0, width - 1),
      height - 1,
    );
  }
  if (random() < 0.7)
    drawSpriteLine(
      pixels,
      center,
      height - 3,
      center + Math.floor(range(-3, 4)),
      height - 1,
    );

  // Alternating limbs fork into thin terminal twigs; there is deliberately no foliage.
  const branches = Math.floor(range(5, 8));
  for (let i = 0; i < branches; i++) {
    const startY = Math.floor(range(top + 3, height - 7));
    const startX = trunk[startY] ?? center;
    const direction = i % 2 ? 1 : -1;
    const endX = clamp(
      startX + direction * Math.floor(range(4, 8)),
      1,
      width - 2,
    );
    const endY = Math.max(2, startY - Math.floor(range(3, 7)));
    drawSpriteLine(
      pixels,
      startX,
      startY,
      endX,
      endY,
      "w",
      startY > height * 0.55 ? 2 : 1,
    );
    drawSpriteLine(
      pixels,
      endX,
      endY,
      clamp(endX + direction * Math.floor(range(2, 5)), 0, width - 1),
      Math.max(0, endY - Math.floor(range(2, 5))),
    );
    drawSpriteLine(
      pixels,
      endX,
      endY,
      clamp(endX - direction * Math.floor(range(1, 4)), 0, width - 1),
      Math.max(0, endY - Math.floor(range(2, 5))),
    );
  }

  drawSpriteLine(
    pixels,
    trunk[top] ?? center,
    top + 2,
    clamp(center - Math.floor(range(2, 5)), 0, width - 1),
    0,
  );
  drawSpriteLine(
    pixels,
    trunk[top] ?? center,
    top + 2,
    clamp(center + Math.floor(range(2, 5)), 0, width - 1),
    0,
  );
  return pixels.map((row) => row.join(""));
}


export function makeGrassSprite(random = Math.random) {
  const width = random() < 0.5 ? 7 : 8;
  const height = 6;
  const pixels = Array.from({ length: height }, () => Array(width).fill("."));
  const center = Math.floor(width / 2);
  const blades = 4 + Math.floor(random() * 3);
  for (let i = 0; i < blades; i++) {
    const root = clamp(center + Math.floor(random() * 3) - 1, 1, width - 2);
    const tip = clamp(root + Math.floor(random() * 7) - 3, 0, width - 1);
    drawSpriteLine(pixels, root, height - 1, tip, Math.floor(random() * 4));
  }
  pixels[height - 1][center] = "w";
  return pixels.map((row) => row.join(""));
}

export function makeFlowerSprite(random = Math.random) {
  const width = 11;
  const height = 13;
  const pixels = Array.from({ length: height }, () => Array(width).fill("."));
  const cx = 5;
  const cy = 3;
  const petals = random() < 0.55 ? 5 : 6;
  const phase = petals === 5 ? 0 : Math.PI / 6;

  for (let i = 0; i < petals; i++) {
    const angle = phase - Math.PI / 2 + (i * TAU) / petals;
    const innerX = Math.round(cx + Math.cos(angle) * 1.7);
    const innerY = Math.round(cy + Math.sin(angle) * 1.7);
    const outerX = Math.round(cx + Math.cos(angle) * 3.1);
    const outerY = Math.round(cy + Math.sin(angle) * 3.1);
    drawSpriteLine(pixels, innerX, innerY, outerX, outerY, "c");
    const sideX = outerX + Math.round(-Math.sin(angle));
    const sideY = outerY + Math.round(Math.cos(angle));
    if (pixels[sideY]?.[sideX] !== undefined && random() < 0.72)
      pixels[sideY][sideX] = "c";
  }
  pixels[cy][cx] = "w";

  let stemX = cx;
  const stem = [];
  for (let y = cy + 1; y < height; y++) {
    pixels[y][stemX] = "g";
    stem[y] = stemX;
    if (y > cy + 3 && y < height - 2 && random() < 0.18)
      stemX = clamp(stemX + (random() < 0.5 ? -1 : 1), 3, width - 4);
  }
  const leafY = Math.floor(8 + random() * 3);
  const leafX = stem[leafY] ?? cx;
  const leafDirection = random() < 0.5 ? -1 : 1;
  drawSpriteLine(
    pixels,
    leafX,
    leafY,
    leafX + leafDirection * 3,
    leafY - 2,
    "g",
  );
  if (random() < 0.6)
    drawSpriteLine(
      pixels,
      stem[leafY + 2] ?? leafX,
      leafY + 2,
      leafX - leafDirection * 2,
      leafY + 1,
      "g",
    );
  return pixels.map((row) => row.join(""));
}

export function makeStainSprite(random = Math.random) {
  const width = 13;
  const height = 9;
  const pixels = Array.from({ length: height }, () => Array(width).fill("."));
  const count = 4 + Math.floor(random() * 6);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    pixels[y][x] = random() < 0.25 ? "l" : "d";
  }
  return pixels.map((row) => row.join(""));
}
