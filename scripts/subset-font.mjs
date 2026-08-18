import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = new URL("./silkscreen-full.woff2", import.meta.url);
const output = new URL("./src/silkscreen-js13k.woff2", root);
const characters = new Set(" +-0123456789·ANY KEY TO TITLECLICK OUTSIDE PRESS A");
const collect = (text) => {
  for (const character of text)
    if (!/\s/.test(character)) characters.add(character);
};

const html = readFileSync(new URL("./index.html", root), "utf8");
collect(html.match(/<body>([^]*)<\/body>/)?.[1].replace(/<[^>]*>/g, " ") || "");

const tempDir = mkdtempSync(join(tmpdir(), "prismatic-prey-font-"));
const textPath = join(tempDir, "characters.txt");
const subsetPath = join(tempDir, "silkscreen.woff2");
const tablesPath = join(tempDir, "tables.ttx");
const finalPath = join(tempDir, "silkscreen-final.woff2");
writeFileSync(
  textPath,
  [...characters].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join(""),
);
execFileSync(process.env.PYFTSUBSET || "pyftsubset", [
  fileURLToPath(source),
  `--output-file=${subsetPath}`,
  `--text-file=${textPath}`,
  "--flavor=woff2",
  "--no-hinting",
  "--drop-tables+=GDEF,GPOS,GSUB,gasp",
  "--name-IDs=1",
]);
execFileSync("ttx", [
  "-q",
  "-o",
  tablesPath,
  "-t",
  "name",
  "-t",
  "head",
  subsetPath,
]);
writeFileSync(
  tablesPath,
  readFileSync(tablesPath, "utf8")
    .replace(/\n      Silkscreen\n/, "\n      A\n")
    .replace(
      /<modified value="[^"]+"\/>/,
      '<modified value="Tue Aug 18 15:06:27 2026"/>',
    ),
);
execFileSync("ttx", [
  "-q",
  "--no-recalc-timestamp",
  "-m",
  subsetPath,
  "-o",
  finalPath,
  tablesPath,
]);
copyFileSync(finalPath, output);
const result = {
  characters: characters.size,
  before: statSync(source).size,
  after: statSync(output).size,
};
unlinkSync(textPath);
unlinkSync(subsetPath);
unlinkSync(tablesPath);
unlinkSync(finalPath);
rmdirSync(tempDir);
console.log(JSON.stringify(result));
