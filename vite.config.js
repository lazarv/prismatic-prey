import { defineConfig } from "vite";

const minifyHtmlWhitespace = (source) =>
  source
    .replace(/\s+/g, " ")
    .replace(/\s*\/>/g, ">")
    .replace(/\s+>/g, ">")
    .replace(/> </g, "><")
    .trim();
const shortNames = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const js13kIds = [
  "viewport",
  "game",
  "stains",
  "flora",
  "world",
  "lighting",
  "fx",
  "foreground",
  "shade",
  "hud",
  "vitals",
  "hp-fill",
  "stamina",
  "stamina-fill",
  "xp",
  "xp-fill",
  "effects",
  "powers",
  "score-panel",
  "score",
  "clock",
  "pointer-controls",
  "pointer-pause",
  "death-screen",
  "death-title",
  "death-stats",
  "death-input",
  "pause-screen",
  "pause-title",
  "pause-actions",
  "pause-resume",
  "pause-new",
  "pause-fullscreen",
  "pause-exit",
  "curtain",
  "title-logo",
  "title-actions",
  "play",
];
const js13kClasses = [
  "layer",
  "vital",
  "meter",
  "stamina-vital",
  "xp-vital",
  "label",
  "hidden",
  "power",
  "pointer-ui",
  "visible",
  "art",
  "atlas-art",
  "entity",
  "static-sprite",
  "flower",
  "stain",
  "grass",
  "bob",
  "moving",
  "player",
  "hurt",
  "arriving",
  "paused",
  "dying",
  "selected",
  "active",
];
const js13kCssNames = new Map([
  ["--scale", "--a"],
  ["--view-width", "--b"],
  ["--view-height", "--c"],
  ["--sprite-atlas", "--d"],
  ["--flower", "--e"],
  ["--color", "--f"],
]);
const js13kAnimations = new Map([
  ["ladder-walk", "a"],
  ["damage-flash", "b"],
  ["enemy-arrival", "c"],
  ["death-overlay", "d"],
  ["death-title", "e"],
  ["death-details", "f"],
]);
const nameMap = (names) =>
  new Map(names.map((name, index) => [name, shortNames[index]]));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const js13kNamePlugin = () => {
  const ids = nameMap(js13kIds);
  const classes = nameMap(js13kClasses);
  const replaceHtml = (html) => {
    html = html.replace(/\s+type="button"/g, "");
    html = html.replace(/\s+(?:aria-[\w-]+|role)="[^"]*"/g, "");
    html = html.replace(/\b(id|aria-labelledby)="([^"]+)"/g, (all, key, value) =>
      `${key}="${ids.get(value) || value}"`,
    );
    return html.replace(/\bclass="([^"]*)"/g, (all, value) =>
      `class="${value
        .split(/\s+/)
        .map((name) => classes.get(name) || name)
        .join(" ")}"`,
    );
  };
  return {
    name: "js13k-name-mangler",
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith(".css")) {
        for (const [name, short] of ids)
          code = code.replace(
            new RegExp(`#${escapeRegex(name)}(?![\\w-])`, "g"),
            `#${short}`,
          );
        for (const [name, short] of classes)
          code = code.replace(
            new RegExp(`\\.${escapeRegex(name)}(?![\\w-])`, "g"),
            `.${short}`,
          );
        for (const [name, short] of js13kCssNames)
          code = code.replaceAll(name, short);
        for (const [name, short] of js13kAnimations)
          code = code.replaceAll(name, short);
        return code;
      }
      if (!id.endsWith("/src/game.js")) return;
      code = code.replace(
        /^\s*[\w.]+\.setAttribute\("aria-[^"]+",[^\n]*\);\s*$/gm,
        "",
      );
      for (const [name, short] of ids)
        code = code.replaceAll(`$("${name}")`, `$("${short}")`);
      for (const [name, short] of classes) {
        const quoted = new RegExp(
          `(["'\\x60])${escapeRegex(name)}\\1`,
          "g",
        );
        code = code.replace(quoted, (value, quote) => `${quote}${short}${quote}`);
      }
      for (const [name, short] of js13kCssNames)
        code = code.replaceAll(name, short);
      code = code.replace(
        "`entity ${kind}`",
        `\`${classes.get("entity")} \${kind}\``,
      );
      code = code.replace(
        '"art atlas-art"',
        `"${classes.get("art")} ${classes.get("atlas-art")}"`,
      );
      return code;
    },
    transformIndexHtml: {
      order: "pre",
      handler: replaceHtml,
    },
  };
};
export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    target: "esnext",
    modulePreload: { polyfill: false },
    assetsDir: "",
    minify: "terser",
    terserOptions: {
      ecma: 2020,
      module: true,
      toplevel: true,
      compress: {
        passes: 10,
        drop_console: true,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_math: true,
        booleans_as_integers: true,
        pure_getters: true,
        keep_fargs: false,
      },
      mangle: {
        toplevel: true,
        properties: {
          builtins: true,
          regex:
            /^(active|arrival|attracted|charge|chargeX|chargeY|chunkKey|color|colorIndex|cooldown|cooldowns|crit|damage|dashCooldown|dashFoot|dashInvulnerability|dashStride|dashTimer|dashX|dashY|dead|dragged|el|elements|elite|frame|hitEffectCooldown|hitFlash|hp|hpRegenClock|kind|knockbackTime|knockbackX|knockbackY|level|life|maxHp|maxStamina|mode|moveX|moveY|noLight|over|phase|points|powerInstances|powers|powerStrengths|pressTime|pressX|pressY|priority|radius|shotDamage|size|slow|speed|stamina|target|targetX|targetY|trailClock|trailColor|value|visible|walking|windup|xp)$/,
        },
      },
      format: { comments: false },
    },
    rolldownOptions: {
      output: {
        entryFileNames: "j.js",
        chunkFileNames: "[name].js",
        assetFileNames: "a[extname]",
      },
    },
  },
  plugins: [
    js13kNamePlugin(),
    {
      name: "minify-html-whitespace",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler: minifyHtmlWhitespace,
      },
    },
  ],
});
