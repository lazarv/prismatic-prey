import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { Packer } from "roadroller";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "dist");
const release = process.argv.includes("--release");
const htmlPath = join(output, "index.html");
const cssPath = join(output, "a.css");
const jsPath = join(output, "j.js");
const archivePath = join(root, "dist.zip");
const packedOutput = join(root, "dist-js13k");
mkdirSync(packedOutput, { recursive: true });
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8").replaceAll("/a.woff2", "a.woff2");
const js = readFileSync(jsPath, "utf8");
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1];

if (body === undefined) throw new Error("Could not find the built document body");

const document = `<style>${css}</style>${body}`;
const source = `document.body.innerHTML=${JSON.stringify(document)};${js}`;
const packer = new Packer(
  [{ data: source, type: "js", action: "eval" }],
  { allowFreeVars: true },
);

await packer.optimize(release ? 2 : 1);

const { firstLine, secondLine } = packer.makeDecoder();
const packed = firstLine + secondLine;
if (/<\/script/i.test(packed))
  throw new Error("Packed output contains an unsafe inline </script sequence");
writeFileSync(
  join(packedOutput, "index.html"),
  '<!doctype html><meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><body><script>' +
    packed +
    "</script>",
);
copyFileSync(join(output, "a.woff2"), join(packedOutput, "a.woff2"));
const oldScript = join(packedOutput, "j.js");
if (existsSync(oldScript)) rmSync(oldScript);
const oldAtlas = join(packedOutput, "a.webp");
if (existsSync(oldAtlas)) rmSync(oldAtlas);

if (existsSync(archivePath)) rmSync(archivePath);
execFileSync(
  "zip",
  [
    "-9",
    "-X",
    "-D",
    "-q",
    archivePath,
    "index.html",
    "a.woff2",
  ],
  { cwd: packedOutput },
);

const deflateBytes = readFileSync(archivePath).byteLength;
if (release)
  execFileSync("advzip", ["-z", "-4", "-q", archivePath], {
    cwd: packedOutput,
  });
const bytes = readFileSync(archivePath).byteLength;
console.log(
  `js13k archive: ${bytes.toLocaleString()} bytes (${release ? `Roadroller O2 + AdvanceCOMP, ${deflateBytes - bytes} bytes recompressed` : "Roadroller O1"})`,
);
