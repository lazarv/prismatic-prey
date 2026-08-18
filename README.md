# Prismatic Prey: an endless rainbow hunt in 13 KB

## How to survive the hunt

### The hunt

You are the last unicorn in an endless, lightless forest. The mob becomes more
numerous and dangerous as the hunt continues. Stay alive, defend yourself, and
push your score as high as possible.

### Flower magic

Collect colored flowers to gain temporary auto-attacking weapons. Finding the
same color again strengthens its range or fire rate; every pickup has its own
timer. Hold all seven colors at once to unleash the rainbow stampede.

| Color  | Power   | Behavior                                                    |
| ------ | ------- | ----------------------------------------------------------- |
| Red    | Lance   | Pierces every enemy along a line.                           |
| Orange | Orbit   | Burns nearby enemies and adds a defensive shield.           |
| Yellow | Chain   | Jumps between a sequence of nearby targets.                 |
| Green  | Mist    | Fills a wide area with repeated damage.                     |
| Blue   | Pulse   | Damages, slows, and knocks enemies away.                    |
| Indigo | Gravity | Pulls distant enemies toward the unicorn.                   |
| Violet | Seeker  | Launches a homing projectile that can acquire a new target. |

### Grow stronger

Fallen hunters leave faint rainbow XP. Move close and it flies to you. Fill the
XP bar to gain a level and increase the damage dealt by your weapons. Each new
level requires more XP than the last.

### Health and dashing

Damage drains HP, and a crowded mob can defeat you quickly. HP regenerates very
slowly. Dashing spends stamina but grants a brief moment of invincibility.
Stamina refills automatically.

### Controls

| Input    | Controls                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Keyboard | WASD or arrows move · Space dashes · Escape pauses · Enter or Space activates menu actions.                           |
| Mouse    | Left click sets a destination · Hold left steers until released · Right click dashes · The pause icon opens the menu. |
| Gamepad  | Left stick or D-pad moves · A dashes and selects · Menu or Start pauses and resumes.                                  |

The pause menu also provides a fullscreen toggle on supported browsers.

---

## Building an endless rainbow hunt in 13 KB

Prismatic Prey is a monochrome arcade survival game made for js13kGames 2026
and its **Unicorns and Rainbows** theme. The complete release is a 13,276-byte
ZIP: one HTML file, one 884-byte font, and no network requests.

The premise is deliberately simple. A unicorn runs through an endless forest
while an increasingly angry mob closes in. Rainbow flowers briefly unlock
color-coded powers. Collect the whole spectrum before those powers expire and
the unicorn releases a prismatic stampede that turns the hunt around.

That contrast became the organizing idea for both the game and its byte budget:
the world is almost entirely grayscale, so every colored pixel communicates
game state as well as spectacle.

### What the entry showcases

The run begins with peasants and grows into a crowd of pitchfork carriers,
torch bearers, ranged hunters, and armored knights. Enemy health, damage, and
speed rise with time, while spawn direction increasingly anticipates the
player's movement. Experience raises the unicorn's damage, and a stamina-based
dash supplies the short burst of speed needed to break through a closing mob.

Holding all seven colors triggers the rainbow stampede: normal enemies are
swept away, projectiles disappear, knights take a heavy hit, the score jumps,
and the next hunt becomes angrier. It is a compact loop with a clear rhythm:
survive, assemble the spectrum, reverse the chase, repeat.

The presentation is a hybrid rather than a miniature game engine. Persistent
sprites are DOM elements moved with CSS transforms, particles and experience
fragments share one canvas, and lighting is assembled from a limited set of CSS
radial gradients. This keeps the code small while still providing layered
scenery, animated pixel characters, additive effects, dynamic light, camera
movement, keyboard, pointer, and gamepad input, floating damage numbers,
fullscreen, pause and death screens, and responsive scaling from a 320×200 base
view.

## Designing systems that compress together

The largest saving did not come from the final minifier. It came from making
the game's systems share representations.

One seven-entry color array connects flower generation, HUD meters, weapon
selection, particles, lighting, scoring, and the stampede. Enemy differences
come from a compact data table and a shared update loop. Repeated power logic
uses the same particle, targeting, cooldown, and damage helpers. A small number
of systems combine into more behavior than their individual byte cost would
suggest.

The source also contains only the submitted game. There are no alternate
implementations for the bundler to discover, exclude, or accidentally retain.
This makes the public source match the release and keeps the build graph easy to
audit.

### An endless world without a map

The forest is divided into 32-unit chunks. A seeded random generator combines
each chunk coordinate with a world seed, so trees, grass, and flowers always
return to the same positions. Chunks outside the camera are discarded and can
later be reconstructed instead of stored.

This creates an effectively endless space without shipping level data or
retaining an ever-growing world in memory. The same idea also helps gameplay:
enemies leaving the action are recycled near the camera edge, preserving the
pressure of the hunt without continually allocating replacements.

### A sprite atlas reconstructed from a 751-byte bitstream

The readable sprite source is ASCII pixel art plus seeded generators for trees,
grass, flowers, and stains. The atlas builder extracts only occupied sprite
rectangles and encodes their masks into 6,003 bits, stored in 751 bytes. Most
sprites need one bit per source pixel; the unicorn, flower, and stain use two-bit
values where separate palette regions are required. A small descriptor table
stores each frame's atlas position, width, and height. Bitstream, decoder, and
descriptors together form the generated
[`src/js13k-atlas.js`](src/js13k-atlas.js) module used by the submitted game,
1,828 bytes before the release compression pipeline.

At startup, the generated decoder expands that bitstream into a canvas. Colors
are applied while drawing, so one flower mask becomes seven rainbow frames and
the grayscale scenery shares common palette values. Empty space between atlas
cells costs nothing in the stored data. The resulting canvas becomes a data URL
used by every CSS sprite.

This is smaller than shipping a sprite image and also turns palette reuse into
part of the compression scheme.

### Light, particles, and sound from primitives

Visual effects are tiny rectangles drawn into one additive canvas. The
lighting layer samples at most twelve suitable particles alongside the unicorn
and converts them into CSS radial gradients. Weapon effects therefore double as
light sources without needing textures, shaders, or another rendering system.
Combat numbers use the same canvas and particle lifetime rather than adding a
second overlay system. Damage rises in red, healing appears above the unicorn in
green, and critical hits turn yellow; their type grows with the displayed
amount. Every attack has a one-percent chance to deal double damage and add a
`CRIT!` label.

Sound is synthesized by one persistent Web Audio oscillator connected to a
gain node. Each effect changes the oscillator frequency and applies a very
short gain envelope. Different pitch values provide feedback for damage,
dashes, weapons, and the stampede without including audio files or a song
sequencer.

### A font reduced to the text the game can use

Silkscreen gives the interface its arcade character, but the full WOFF2 source
is 8,404 bytes. The font build collects visible document text and the few
runtime-only interface strings, creates a glyph subset, removes hinting and
unused OpenType layout tables, reduces internal naming metadata, fixes the
timestamp for reproducible compression, and writes an 884-byte WOFF2.

The font remains a separate file in the ZIP. WOFF2 already provides specialized
font compression, and keeping it external avoids base64 expansion inside the
JavaScript payload.

Silkscreen is Copyright 2001 The Silkscreen Project Authors and is licensed
separately under the SIL Open Font License 1.1. That license also applies to the
generated subset. See
[`third-party/silkscreen/OFL.txt`](third-party/silkscreen/OFL.txt).

## The compression pipeline

The readable project is transformed in stages, with each stage preparing the
next one:

1. Vite targets modern JavaScript, omits the module-preload polyfill, minifies
   CSS, and emits stable one-character asset names.
2. A build transform shortens HTML IDs, CSS classes, custom properties, and
   animation names consistently across HTML, CSS, and JavaScript.
   Submission-only accessibility attributes and HTML whitespace are removed at
   this stage.
3. Terser runs ten compression passes, removes console calls and unused
   arguments, applies safe-for-this-entry arithmetic transforms, mangles
   top-level names, and shortens a selected set of frequently repeated object
   properties.
4. The packer joins the CSS, built document body, and JavaScript into one
   program. This lets Roadroller find repetition across boundaries that would
   otherwise be separate files.
5. Roadroller's second optimization level produces the self-decoding inline
   script used by the release.
6. `zip -9 -X -D` creates an archive without directory entries or extra file
   attributes. AdvanceCOMP then searches harder for a smaller DEFLATE stream.

The current release snapshot shows why every stage matters:

| Stage                            |             Size |
| -------------------------------- | ---------------: |
| Vite HTML                        |      1,545 bytes |
| Vite CSS                         |      6,190 bytes |
| Vite JavaScript                  |     27,383 bytes |
| Combined Roadroller input        |     34,918 bytes |
| Roadroller release HTML          |     16,279 bytes |
| Standard maximum-compression ZIP |     13,551 bytes |
| ZIP after AdvanceCOMP            | **13,276 bytes** |
| Remaining competition budget     |     **36 bytes** |

The ordinary ZIP is 239 bytes over the 13,312-byte limit. AdvanceCOMP saves 275
bytes and leaves 36 bytes of headroom. The final archive contains only
`index.html` and `a.woff2`; everything else is generated into the inline
program.

## Reproducing the entry

The project uses pnpm, Vite, Terser, and Roadroller. To run the readable source:

```sh
pnpm install
pnpm dev
```

Build the unpacked project or competition archive with:

```sh
pnpm build
pnpm build:js13k
pnpm build:js13k:release
```

The release command requires `zip` and `advzip`. It writes the unpacked entry to
`dist-js13k/`, creates `dist.zip`, and prints the final byte count.

Font regeneration requires FontTools, which provides `pyftsubset` and `ttx`.

After changing sprite definitions or text, regenerate the derived assets with:

```sh
pnpm build:sprites
pnpm build:font
```

The main implementation lives in [`src/game.js`](src/game.js). The runtime atlas
mapping is in [`src/js13k-sprites.js`](src/js13k-sprites.js), the readable sprite
definitions are in
[`scripts/js13k-sprite-source.mjs`](scripts/js13k-sprite-source.mjs), and the
build pipeline is documented directly in [`vite.config.js`](vite.config.js) and
[`scripts/pack-js13k.mjs`](scripts/pack-js13k.mjs).

Prismatic Prey has no runtime framework, CDN, analytics service, or server
dependency.

## Source availability

Copyright © 2026 Viktor Lázár. All rights reserved.

The source code in this repository is made publicly available solely
for inspection and evaluation in connection with js13kGames 2026.

No permission is granted to use, copy, modify, distribute, sublicense,
or create derivative works from this source code, except as required
for viewing or forking the repository through GitHub's services.

Prismatic Prey, its source code, and all other associated assets are not
open-source software.

The Silkscreen font files are the exception. Silkscreen is Copyright 2001 The
Silkscreen Project Authors and is licensed separately under the SIL Open Font
License 1.1. The proprietary terms above do not apply to Silkscreen or its
generated subset. See
[`third-party/silkscreen/OFL.txt`](third-party/silkscreen/OFL.txt).
