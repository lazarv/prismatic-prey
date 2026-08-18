import "./style.css";

import { atlasUrl, ICONS, POOLS, SPRITES } from "./js13k-sprites.js";

let VIEW_W = 320;

let VIEW_H = 200;

let W = VIEW_W / 2;

let H = VIEW_H / 2;

const TAU = Math.PI * 2;

const COLORS = [ [ "RED", "#ff3155" ], [ "ORANGE", "#ff872e" ], [ "YELLOW", "#ffe13b" ], [ "GREEN", "#5cf05c" ], [ "BLUE", "#36bfff" ], [ "INDIGO", "#5260ff" ], [ "VIOLET", "#c65cff" ] ];

const MAGIC_COLORS = new Set(COLORS.map(([, color]) => color));

const $ = id => document.getElementById(id);

const game = $("game");

const floraLayer = $("flora");

const worldLayer = $("world");

const stainLayer = $("stains");

const lightingLayer = $("lighting");

const canvas = $("fx");

const ctx = canvas.getContext("2d", {
    alpha: true
});

const curtain = $("curtain");

const deathScreen = $("death-screen");

const deathStats = $("death-stats");

const deathInput = $("death-input");

const pauseScreen = $("pause-screen");

const pauseResume = $("pause-resume");

const pauseNew = $("pause-new");

const pauseExit = $("pause-exit");

const playButton = $("play");

const scoreEl = $("score");

const hpFill = $("hp-fill");

const staminaEl = $("stamina");

const staminaFill = $("stamina-fill");

const xpEl = $("xp");

const xpFill = $("xp-fill");

const clockEl = $("clock");

const powersEl = $("powers");

const pointerControlsEl = $("pointer-controls");

const pointerPause = $("pointer-pause");

let mode = "menu";

let deathInputLock = 0;

let elapsed = 0;

let score = 0;

let anger = 0;

let spawnClock = 0;

let enemies = [];

let flowers = [];

let particles = [];

let xpParticles = [];

let magicShots = [];

let enemyShots = [];

let stains = [];

let xpColorIndex = 0;

let lastFrame = performance.now();

let assetsReady = false;

let camera = {
    x: -W / 2,
    y: -H / 2
};

let worldChunks = new Map;

let collectedFlowers = new Set;

const keys = new Set;

const touch = {
    active: false,
    walking: false,
    over: false,
    x: W / 2,
    y: H / 2,
    targetX: 0,
    targetY: 0,
    pressX: 0,
    pressY: 0,
    pressTime: 0,
    dragged: false
};

let pointerUiVisible = false;

let gamepad;

let gamepadButtons = [];

let gamepadY = 0;

const createPlayer = (el = null) => ({
    x: 0,
    y: 0,
    maxHp: 100,
    hp: 100,
    hpRegenClock: 0,
    maxStamina: 100,
    stamina: 100,
    xp: 0,
    level: 1,
    dir: 1,
    moveX: 0,
    moveY: 0,
    hitFlash: 0,
    hitEffectCooldown: 0,
    trailClock: 0,
    trailColor: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashInvulnerability: 0,
    dashStride: 0,
    dashFoot: 0,
    dashX: 1,
    dashY: 0,
    powerInstances: Array.from({
        length: 7
    }, () => []),
    powers: Array(7).fill(0),
    powerStrengths: Array(7).fill(1),
    cooldowns: Array(7).fill(0),
    el: el
});

const player = createPlayer();

const pauseOptions = [ pauseResume, $("pause-fullscreen"), pauseNew, pauseExit ];

let selectedPauseOption = 0;

const titleOptions = [ playButton ];

let selectedTitleOption = 0;

let controlType = "keyboard";

const powerPips = COLORS.map(([name, color]) => {
    const pip = document.createElement("span");
    pip.className = "power";
    pip.title = name;
    pip.style.setProperty("--color", color);
    const fill = document.createElement("i");
    pip.append(fill);
    powersEl.append(pip);
    return [ pip, fill ];
});

const rand = (min = 1, max) => {
    if (max === void 0) return Math.random() * min;
    return min + Math.random() * (max - min);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function releasePrismaticBurst(colors) {
    colors.forEach((color, index) => {
        for (let i = 0; i < 52; i++) {
            const angle = i / 52 * TAU + index * .06;
            const speed = 25 + index * 8 + rand(0, 16);
            particles.push({
                x: player.x,
                y: player.y - 3,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: rand(.65, 1.25),
                max: 1.25,
                color: color,
                size: Math.random() < .22 ? 2 : 1,
                priority: true
            });
        }
    });
    trimParticles();
}

function seededRandom(cx, cy) {
    let state = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 13026) >>> 0;
    return () => {
        state += 1831565813;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function prepareAtlas() {
    game.style.setProperty("--sprite-atlas", `url("${atlasUrl(COLORS)}")`);
}

const makeArt = function(sprite, variant = 0) {
    const frame = sprite.frame + (sprite.kind === 2 ? variant : 0);
    const x = frame % 10 * 24;
    const y = Math.floor(frame / 10) * 32;
    const art = document.createElement("i");
    art.className = "art atlas-art";
    art.setAttribute("aria-hidden", "true");
    art.style.width = `${sprite.w}px`;
    art.style.height = `${sprite.h}px`;
    art.style.backgroundPosition = `${-x}px ${-y}px`;
    return art;
};

function makeEntity(kind, sprite, x, y) {
    const el = document.createElement("span");
    el.className = `entity ${kind}`;
    const bob = document.createElement("span");
    bob.className = "bob";
    const width = sprite.w;
    const height = sprite.h;
    bob.style.left = -Math.floor(width / 2) + "px";
    bob.style.top = -height + "px";
    bob.style.width = `${width}px`;
    bob.style.height = `${height}px`;
    bob.style.animationDelay = -rand(0, .4) + "s";
    bob.append(makeArt(sprite));
    el.append(bob);
    worldLayer.append(el);
    const entity = {
        el: el,
        x: x,
        y: y,
        dir: 1
    };
    place(entity);
    return entity;
}

function makeStatic(layer, sprite, x, y, className = "static-sprite", variant = 0) {
    const el = document.createElement("span");
    el.className = className;
    el.style.left = x * 2 - Math.floor(sprite.w / 2) + "px";
    el.style.top = y * 2 - sprite.h + "px";
    el.style.zIndex = Math.floor(y) + 1e5;
    el.append(makeArt(sprite, variant));
    layer.append(el);
    return el;
}

function place(entity) {
    let x = Math.round(entity.x * 2);
    let y = Math.round(entity.y * 2);
    if (entity === player) {
        x = Math.round(camera.x * 2) + Math.round(2 * (entity.x - camera.x));
        y = Math.round(camera.y * 2) + Math.round(2 * (entity.y - camera.y));
    }
    entity.el.style.transform = `translate3d(${x}px,${y}px,0) scaleX(${entity.dir || 1})`;
    entity.el.style.zIndex = Math.floor(entity.y) + 1e5;
}

function loadChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (worldChunks.has(key)) return;
    const random = seededRandom(cx, cy);
    const range = (min, max) => min + random() * (max - min);
    const elements = [];
    const originX = cx * 32;
    const originY = cy * 32;
    const treeCount = (random() < .65 ? 1 : 0) + (random() < .12 ? 1 : 0);
    for (let i = 0; i < treeCount; i++) {
        const sprite = POOLS.trees[Math.floor(random() * POOLS.trees.length)];
        elements.push(makeStatic(worldLayer, sprite, originX + range(4, 28), originY + range(8, 29)));
    }
    if (random() < .48) {
        const sprite = POOLS.grass[Math.floor(random() * POOLS.grass.length)];
        elements.push(makeStatic(floraLayer, sprite, originX + range(3, 29), originY + range(4, 30), "grass"));
    }
    if (random() < .46) {
        const id = `${key}:flower`;
        if (!collectedFlowers.has(id)) {
            const x = originX + range(5, 27);
            const y = originY + range(7, 29);
            const colorIndex = ((cx * 3 + cy * 5) % 7 + 7) % 7;
            const color = COLORS[colorIndex][1];
            const sprite = POOLS.flowers[Math.floor(random() * POOLS.flowers.length)];
            const el = makeStatic(floraLayer, sprite, x, y, "flower", colorIndex);
            el.style.setProperty("--flower", color);
            elements.push(el);
            flowers.push({
                id: id,
                chunkKey: key,
                x: x,
                y: y,
                colorIndex: colorIndex,
                el: el
            });
        }
    }
    worldChunks.set(key, {
        elements: elements
    });
}

function updateWorld() {
    const minX = Math.floor((camera.x - 32) / 32);
    const maxX = Math.floor((camera.x + W + 32) / 32);
    const minY = Math.floor((camera.y - 32) / 32);
    const maxY = Math.floor((camera.y + H + 32) / 32);
    const visible = new Set;
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
        const key = `${cx},${cy}`;
        visible.add(key);
        loadChunk(cx, cy);
    }
    for (const [key, chunk] of worldChunks) {
        if (visible.has(key)) continue;
        chunk.elements.forEach(element => element.remove());
        flowers = flowers.filter(flower => flower.chunkKey !== key);
        worldChunks.delete(key);
    }
}

function clearWorld() {
    worldChunks.forEach(chunk => chunk.elements.forEach(element => element.remove()));
    worldChunks.clear();
    flowers = [];
}

function updateCamera(dt, snap = false) {
    const targetX = player.x - W / 2;
    const targetY = player.y - H / 2;
    const follow = snap ? 1 : 1 - Math.exp(9 * -dt);
    camera.x += (targetX - camera.x) * follow;
    camera.y += (targetY - camera.y) * follow;
    const transform = `translate3d(${-Math.round(camera.x * 2)}px,${-Math.round(camera.y * 2)}px,0)`;
    floraLayer.style.transform = transform;
    worldLayer.style.transform = transform;
    stainLayer.style.transform = transform;
    player.el && place(player);
}

function setMotion(entity, moving) {
    entity.el.classList.toggle("moving", moving);
}

function resize() {
    const view = visualViewport;
    const availableWidth = view?.width || innerWidth;
    const availableHeight = view?.height || innerHeight;
    const fit = Math.min(availableWidth / 320, availableHeight / 200);
    const scale = Math.max(1, Math.floor(fit));
    const nextViewWidth = Math.max(320, Math.ceil(availableWidth / scale / 2) * 2);
    const nextViewHeight = Math.max(200, Math.ceil(availableHeight / scale / 2) * 2);
    const changed = nextViewWidth !== VIEW_W || nextViewHeight !== VIEW_H;
    VIEW_W = nextViewWidth;
    VIEW_H = nextViewHeight;
    W = VIEW_W / 2;
    H = VIEW_H / 2;
    document.documentElement.style.setProperty("--scale", scale);
    document.documentElement.style.setProperty("--view-width", `${VIEW_W}px`);
    document.documentElement.style.setProperty("--view-height", `${VIEW_H}px`);
    canvas.width !== VIEW_W && (canvas.width = VIEW_W);
    canvas.height !== VIEW_H && (canvas.height = VIEW_H);
    if (changed && player.el) {
        updateCamera(0, true);
        assetsReady && updateWorld();
    }
}

let audioContext = 0;

let oscillator;

let audioGain;

function initAudio() {
    if (audioContext) return;
    audioContext = new AudioContext;
    oscillator = audioContext.createOscillator();
    audioGain = new GainNode(audioContext, {
        gain: 0
    });
    oscillator.connect(audioGain).connect(audioContext.destination);
    oscillator.start();
}

function playSound(pitch) {
    const now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(pitch * 80 || 320, now);
    oscillator.frequency.setTargetAtTime(pitch * 25 || 600, now, .03);
    audioGain.gain.setValueAtTime(.07, now);
    audioGain.gain.setTargetAtTime(0, now, .02);
}

function trimParticles() {
    let remove = particles.length - 4096;
    if (remove <= 0) return;
    let write = 0;
    for (let read = 0; read < particles.length; read++) {
        const particle = particles[read];
        if (remove > 0 && !particle.priority) {
            remove--;
            continue;
        }
        particles[write++] = particle;
    }
    particles.length = write;
}

function emit(x, y, color, count = 1, speed = 8, life = .45, size = 1, priority = false) {
    for (let i = 0; i < count; i++) {
        const angle = rand(TAU);
        const velocity = rand(speed * .25, speed);
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            life: rand(life * .65, life),
            max: life,
            color: color,
            size: Math.random() < .16 ? size + 1 : size,
            priority: priority
        });
    }
    trimParticles();
}

function lineParticles(ax, ay, bx, by, color, count = 10) {
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        particles.push({
            x: x + rand(-.45, .45),
            y: y + rand(-.45, .45),
            vx: rand(-2, 2),
            vy: rand(-2, 2),
            life: rand(.12, .28),
            max: .28,
            color: color,
            size: 1
        });
    }
}

function xpGoal() {
    const rank = player.level - 1;
    return Math.round(20 + rank * 10 + rank * rank * 1.5);
}

function dropXp(enemy) {
    let reward = enemy.xp;
    reward = Math.max(1, Math.round(reward));
    const count = Math.min(reward, enemy.elite ? 12 : 6);
    let remaining = reward;
    for (let i = 0; i < count; i++) {
        const value = Math.ceil(remaining / (count - i));
        remaining -= value;
        const angle = rand(TAU);
        const speed = rand(3.5, 10);
        const life = 18 + rand(-2, 4);
        xpParticles.push({
            x: enemy.x + rand(-.5, .5),
            y: enemy.y - 2 + rand(-.5, .5),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: life,
            max: life,
            value: value,
            phase: rand(TAU),
            attracted: false,
            color: COLORS[xpColorIndex++ % COLORS.length][1]
        });
    }
}

function gainXp(value) {
    player.xp += value;
    score += value * 4;
    while (player.xp >= xpGoal()) {
        player.xp -= xpGoal();
        player.level++;
    }
}

function updateXpParticles(dt) {
    for (let i = xpParticles.length - 1; i >= 0; i--) {
        const particle = xpParticles[i];
        particle.life -= dt;
        particle.phase += dt * 9;
        if (particle.life <= 0) {
            xpParticles.splice(i, 1);
            continue;
        }
        let dx = player.x - particle.x;
        let dy = player.y - 2 - particle.y;
        let distance = Math.hypot(dx, dy) || .001;
        const magnetRadius = 24;
        if (distance < magnetRadius || particle.attracted) {
            particle.attracted = true;
            const pull = 110 + Math.max(0, 1 - distance / magnetRadius) * 390;
            particle.vx += dx / distance * pull * dt;
            particle.vy += dy / distance * pull * dt;
            const speed = Math.hypot(particle.vx, particle.vy);
            if (speed > 170) {
                particle.vx *= 170 / speed;
                particle.vy *= 170 / speed;
            }
        }
        const drag = Math.exp(-(particle.attracted ? .45 : 3.6) * dt);
        particle.vx *= drag;
        particle.vy *= drag;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        dx = player.x - particle.x;
        dy = player.y - 2 - particle.y;
        if (dx * dx + dy * dy < 2.6 * 2.6) {
            gainXp(particle.value);
            xpParticles.splice(i, 1);
        }
    }
}

function drawXpParticles() {
    for (const particle of xpParticles) {
        const x = Math.round(2 * (particle.x - camera.x));
        const y = Math.round(2 * (particle.y - camera.y));
        if (x < -4 || x > VIEW_W + 4 || y < -4 || y > VIEW_H + 4) continue;
        const age = particle.max - particle.life;
        const alpha = clamp(Math.min(age * 7, particle.life * 2), 0, 1);
        ctx.fillStyle = particle.color || "#f0efe8";
        if (particle.attracted) {
            ctx.globalAlpha = alpha * .04;
            ctx.fillRect(x - Math.round(particle.vx * .04 * 2), y - Math.round(particle.vy * .04 * 2), 2, 2);
        }
        ctx.globalAlpha = alpha * (.14 + Math.sin(particle.phase) * .04);
        ctx.fillRect(x, y, 2, 2);
        if (Math.sin(particle.phase) > .72) {
            ctx.globalAlpha = alpha * .08;
            ctx.fillRect(x - 2, y, 6, 2);
        }
    }
}

function updateParticles(dt) {
    trimParticles();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = "lighter";
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= .97;
        p.vy *= .97;
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.alpha ?? 1);
        ctx.fillStyle = p.color;
        const x = Math.round(2 * (p.x - camera.x));
        const y = Math.round(2 * (p.y - camera.y));
        if (p.text) {
            ctx.textAlign = "center";
            if (p.crit) {
                ctx.font = "5px Silkscreen";
                ctx.fillText("CRIT!", x, y - p.size);
            }
            ctx.font = p.size + "px Silkscreen";
            ctx.fillText(p.text, x, y);
        } else ctx.fillRect(x, y, p.size * 2, p.size * 2);
    }
    drawXpParticles();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}

function lightColor(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${value >> 16},${value >> 8 & 255},${value & 255},${alpha})`;
}

function renderLighting() {
    const sources = [ [ 2 * (player.x - camera.x), 2 * (player.y - camera.y - 3), "#ffffff", 88, 1 ] ];
    for (let i = particles.length - 1; i >= 0 && sources.length < 13; i--) {
        const particle = particles[i];
        if (particle.noLight || !MAGIC_COLORS.has(particle.color) || particle.life < .08) continue;
        const x = 2 * (particle.x - camera.x);
        const y = 2 * (particle.y - camera.y);
        if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
        if (sources.some(([lx, ly]) => (lx - x) ** 2 + (ly - y) ** 2 < 72)) continue;
        const strength = clamp(particle.life / particle.max, .35, 1);
        sources.push([ x, y, "#ffffff", 2 * (11 + particle.size * 3), strength ]);
    }
    const gradients = sources.map(([x, y, color, radius, strength]) => `radial-gradient(circle ${radius}px at ${x.toFixed(1)}px ${y.toFixed(1)}px,${lightColor(color, strength)},${lightColor(color, strength * .48)} 52%,transparent 100%)`);
    lightingLayer.style.background = `${gradients.join(",")},#050606`;
}

function removeFlower(flower) {
    collectedFlowers.add(flower.id);
    flower.el.remove();
    flowers.splice(flowers.indexOf(flower), 1);
}

function syncPower(index) {
    const instances = player.powerInstances[index];
    player.powers[index] = instances.length ? Math.max(...instances) : 0;
    player.powerStrengths[index] = instances.length ? 2 ** (instances.length - 1) : 1;
}

function clearPowers() {
    player.powerInstances.forEach(instances => {
        instances.length = 0;
    });
    player.powers.fill(0);
    player.powerStrengths.fill(1);
}

function collectFlower(flower) {
    const index = flower.colorIndex;
    const color = COLORS[index][1];
    const stacked = player.powerInstances[index].length > 0;
    player.powerInstances[index].push(14);
    syncPower(index);
    score += 40 + activePowerCount() * 20;
    emit(flower.x, flower.y - 2, color, 18, (stacked ? 25 : 19) * player.powerStrengths[index], stacked ? .85 : .65);
    lineParticles(flower.x, flower.y, player.x, player.y - 2, color, 7);
    removeFlower(flower);
    player.powers.every(power => power > 0) && rainbowStampede();
}

function activePowerCount() {
    return player.powers.reduce((total, timer) => total + (timer > 0), 0);
}

function rainbowStampede() {
    anger += 1;
    score += 1e3 + enemies.length * 35;
    clearPowers();
    releasePrismaticBurst(COLORS.map(([, color]) => color));
    [ ...enemies ].forEach(enemy => hurtEnemy(enemy, enemy.elite ? 7 : 999, "#ffffff", true));
    enemyShots.length = 0;
    playSound(0);
}

const ENEMY_DATA = {
    peasant: {
        hp: 1.4,
        speed: 6.5,
        radius: 2,
        damage: 7,
        points: 25,
        xp: 2,
        sprite: SPRITES.peasant
    },
    pitchfork: {
        hp: 3,
        speed: 5.2,
        radius: 2.2,
        damage: 18,
        points: 60,
        xp: 4,
        sprite: SPRITES.pitchfork
    },
    hunter: {
        hp: 2.2,
        speed: 4.4,
        radius: 2,
        damage: 8,
        shotDamage: 14,
        points: 75,
        xp: 5,
        sprite: SPRITES.hunter
    },
    torch: {
        hp: 2.4,
        speed: 8.2,
        radius: 2.1,
        damage: 12,
        points: 80,
        xp: 5,
        sprite: SPRITES.torch
    },
    knight: {
        hp: 10,
        speed: 3.8,
        radius: 3.1,
        damage: 26,
        points: 300,
        xp: 16,
        sprite: SPRITES.knight,
        elite: true
    }
};

function huntTimeCurve() {
    const compressedTime = Math.max(0, elapsed / 1800);
    return compressedTime <= 1 ? compressedTime ** 3 : compressedTime;
}

function enemySpeedScale() {
    const hunt = huntTimeCurve();
    return 2 ** (hunt * 1.5);
}

function scaledEnemyStats(type) {
    const data = ENEMY_DATA[type];
    const hunt = huntTimeCurve();
    const healthScale = 2 ** (hunt * 7);
    const damageScale = 2 ** (hunt * 5);
    return {
        hp: Math.max(1, Math.round(data.hp * 7 * healthScale)),
        speed: data.speed * enemySpeedScale(),
        damage: data.damage * damageScale,
        shotDamage: data.shotDamage ? data.shotDamage * damageScale : void 0,
        points: data.points,
        xp: data.xp
    };
}

function chooseEnemyType() {
    const threat = elapsed;
    const roll = Math.random();
    if (threat > 68 && roll < Math.min(.18, .035 + anger * .012)) return "knight";
    if (threat > 42 && roll < .24) return "hunter";
    if (threat > 30 && roll < .42) return "torch";
    if (threat > 15 && roll < .65) return "pitchfork";
    return "peasant";
}

function playerHeading() {
    const length = Math.hypot(player.moveX, player.moveY);
    return length > .15 ? [ player.moveX / length, player.moveY / length ] : null;
}

function enemySpawnAngle() {
    const heading = playerHeading();
    if (!heading) return rand(TAU);
    const frontChance = Math.min(.85, .34 + huntTimeCurve() * .25);
    if (Math.random() >= frontChance) return rand(TAU);
    const side = Math.random() < .5 ? -1 : 1;
    return Math.atan2(heading[1], heading[0]) + side * rand(.15, 1.15);
}

function cameraEdgeSpawn(angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const horizontal = Math.abs(dx) < 1e-4 ? 1 / 0 : ((dx > 0 ? camera.x + W + 5 : camera.x - 5) - player.x) / dx;
    const vertical = Math.abs(dy) < 1e-4 ? 1 / 0 : ((dy > 0 ? camera.y + H + 5 : camera.y - 5) - player.y) / dy;
    const distance = Math.min(horizontal, vertical);
    return [ player.x + dx * distance, player.y + dy * distance ];
}

function spawnEnemy() {
    if (enemies.length >= 125) return;
    const [x, y] = cameraEdgeSpawn(enemySpawnAngle());
    const type = chooseEnemyType();
    const data = ENEMY_DATA[type];
    const scaled = scaledEnemyStats(type);
    const entity = makeEntity(type, data.sprite, x, y);
    Object.assign(entity, {
        type: type,
        hp: scaled.hp,
        maxHp: scaled.hp,
        speed: scaled.speed,
        radius: data.radius,
        damage: scaled.damage,
        shotDamage: scaled.shotDamage,
        points: scaled.points,
        xp: scaled.xp,
        elite: data.elite,
        dead: false,
        cooldown: rand(.4, 2.2),
        windup: 0,
        charge: 0,
        chargeX: 0,
        chargeY: 0,
        knockbackX: 0,
        knockbackY: 0,
        knockbackTime: 0,
        slow: 0,
        orangeCooldown: 0,
        greenCooldown: 0,
        arrival: 0
    });
    enemies.push(entity);
}

function recycleEnemy(enemy) {
    const healthRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    const scaled = scaledEnemyStats(enemy.type);
    enemy.maxHp = scaled.hp;
    enemy.hp = Math.max(1, Math.round(scaled.hp * healthRatio));
    enemy.speed = scaled.speed;
    enemy.damage = scaled.damage;
    enemy.shotDamage = scaled.shotDamage;
    enemy.points = scaled.points;
    enemy.xp = scaled.xp;
    const heading = playerHeading();
    const movementSpeed = 27 * (player.dashTimer > 0 ? 3.45 : 1);
    const lead = heading ? Math.min(Math.min(W, H) * .35, movementSpeed * .45) : 0;
    const centerX = player.x + (heading?.[0] || 0) * lead;
    const centerY = player.y + (heading?.[1] || 0) * lead;
    const angle = enemySpawnAngle();
    enemy.x = centerX + Math.cos(angle) * W * .55;
    enemy.y = centerY + Math.sin(angle) * H * .55;
    enemy.arrival = .7;
    enemy.windup = 0;
    enemy.charge = 0;
    enemy.knockbackX = 0;
    enemy.knockbackY = 0;
    enemy.knockbackTime = 0;
    enemy.cooldown = Math.max(enemy.cooldown, .7 + .35);
    setMotion(enemy, false);
    place(enemy);
    enemy.el.classList.add("arriving");
}

function nearestEnemy(x = player.x, y = player.y, range = 1 / 0, excluded = new Set) {
    let nearest = null;
    let best = range * range;
    for (const enemy of enemies) {
        if (enemy.dead || excluded.has(enemy)) continue;
        const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
        if (d < best) {
            best = d;
            nearest = enemy;
        }
    }
    return nearest;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function healPlayer(amount) {
    if (amount <= 0 || player.hp >= player.maxHp) return 0;
    const healed = Math.min(amount, player.maxHp - player.hp);
    player.hp += healed;
    combatText(player, healed, true);
    return healed;
}

function combatText(target, amount, healing = false, crit = false) {
    const shown = Math.round(amount);
    particles.push({
        x: target.x + rand(-.8, .8),
        y: target.y - (healing ? 8 : 7),
        vx: 0,
        vy: -6,
        life: .62,
        max: .62,
        color: COLORS[crit ? 2 : healing ? 3 : 0][1],
        size: 5 + 2 * Math.min(3, Math.log10(shown) | 0),
        text: (healing ? "+" : "-") + shown,
        crit: crit,
        noLight: true
    });
}

function flushCombat(enemy) {
    combatText(enemy, Math.abs(enemy.value), false, enemy.value < 0);
    enemy.value = 0;
}

function orangeShieldStrength() {
    const stacks = player.powerInstances[1].length;
    return stacks ? .15 + .08 * (stacks - 1) : 0;
}

function hurtEnemy(enemy, damage, color, ultimate = false) {
    if (!enemy || enemy.dead) return;
    const critical = Math.random() < .01;
    const hit = Math.max(1, Math.round(damage * 7 * player.level * (1 + critical)));
    const dealt = Math.min(enemy.hp, hit);
    enemy.hp -= hit;
    const shown = critical ? -dealt : dealt;
    enemy.value && enemy.value * shown < 0 && flushCombat(enemy);
    if (enemy.value) enemy.value += shown; else {
        enemy.value = shown;
        enemy.phase = .5;
    }
    emit(enemy.x, enemy.y - 3, color, ultimate ? 8 : 3, ultimate ? 18 : 8, .35, 1, ultimate);
    enemy.hp <= 0 && killEnemy(enemy);
}

function killEnemy(enemy) {
    flushCombat(enemy);
    enemy.dead = true;
    enemy.el.remove();
    score += Math.round(enemy.points * (1 + activePowerCount() * .32));
    addStain(enemy.x, enemy.y);
    dropXp(enemy);
    emit(enemy.x, enemy.y - 2, Math.random() < .5 ? "#d7d8d2" : "#606461", enemy.elite ? 24 : 11, 17, .65);
}

function addStain(x, y) {
    const stain = document.createElement("i");
    stain.className = "stain";
    const sprite = POOLS.stains[Math.floor(Math.random() * POOLS.stains.length)];
    stain.style.left = Math.round(x * 2) - Math.floor(sprite.w / 2) + "px";
    stain.style.top = Math.round(y * 2) - Math.floor(sprite.h / 2) + "px";
    stain.append(makeArt(sprite));
    stainLayer.append(stain);
    stains.push(stain);
    stains.length > 75 && stains.shift().remove();
}

function damagePlayer(source, damage = source?.damage ?? 7, knockback = true) {
    if (mode !== "playing" || player.dashInvulnerability > 0) return;
    const shield = orangeShieldStrength();
    player.hp = Math.max(0, player.hp - damage / (1 + shield));
    const lethal = player.hp <= 0;
    // Visual/audio feedback is limited independently; damage itself is never throttled.
    if (player.hitEffectCooldown <= 0) {
        player.hitEffectCooldown = .26;
        player.hitFlash = .22;
        player.el.classList.add("hurt");
        emit(player.x, player.y - 3, shield > 0 ? COLORS[1][1] : "#ffffff", 9, 18, .4);
        playSound(4);
    }
    if (source && knockback) {
        const dx = player.x - source.x;
        const dy = player.y - source.y;
        const length = Math.hypot(dx, dy) || 1;
        player.x += dx / length * 5;
        player.y += dy / length * 5;
    }
    lethal && endGame();
}

function fireHunter(enemy) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    enemyShots.push({
        x: enemy.x,
        y: enemy.y - 3,
        vx: dx / length * 21,
        vy: dy / length * 21,
        damage: enemy.shotDamage,
        life: 3
    });
    lineParticles(enemy.x, enemy.y - 3, enemy.x + dx / length * 4, enemy.y - 3 + dy / length * 4, "#b7bab6", 3);
}

function updateEnemies(dt) {
    const liveSpeedScale = enemySpeedScale();
    for (const enemy of enemies) {
        if (enemy.dead) continue;
        enemy.value && (enemy.phase -= dt) <= 0 && flushCombat(enemy);
        enemy.speed = ENEMY_DATA[enemy.type].speed * liveSpeedScale;
        const screenDistance = Math.hypot((enemy.x - player.x) / W, (enemy.y - player.y) / H);
        screenDistance > 1.5 && recycleEnemy(enemy);
        if (enemy.arrival > 0) {
            enemy.arrival = Math.max(0, enemy.arrival - dt);
            enemy.arrival === 0 && enemy.el.classList.remove("arriving");
            continue;
        }
        enemy.cooldown -= dt;
        enemy.slow = Math.max(0, enemy.slow - dt);
        enemy.orangeCooldown -= dt;
        enemy.greenCooldown -= dt;
        enemy.knockbackTime = Math.max(0, enemy.knockbackTime - dt);
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.hypot(dx, dy) || 1;
        let mx = dx / distance;
        let my = dy / distance;
        let speed = enemy.speed * (enemy.slow > 0 ? .24 : 1) * (1 + anger * .045);
        if (enemy.type === "hunter") {
            distance < 18 ? [mx, my] = [ -mx, -my ] : distance < 28 && ([mx, my] = [ .45 * -my, mx * .45 ]);
            if (enemy.cooldown <= 0 && distance < 44) {
                fireHunter(enemy);
                enemy.cooldown = rand(1.8, 2.5) / (1 + anger * .04);
            }
        } else if (enemy.type === "pitchfork") {
            if (enemy.charge > 0) {
                enemy.charge -= dt;
                mx = enemy.chargeX;
                my = enemy.chargeY;
                speed = 23 * liveSpeedScale;
                Math.random() < .35 && emit(enemy.x, enemy.y, "#888c89", 1, 2, .2);
            } else if (enemy.windup > 0) {
                enemy.windup -= dt;
                speed = 0;
                enemy.windup <= 0 && (enemy.charge = .55);
            } else if (enemy.cooldown <= 0 && distance < 35) {
                enemy.chargeX = mx;
                enemy.chargeY = my;
                enemy.windup = .45;
                enemy.cooldown = rand(3.2, 4.5);
                lineParticles(enemy.x, enemy.y - 2, player.x, player.y - 2, "#666a67", 12);
            }
        } else enemy.type === "torch" && Math.random() < dt * 18 && emit(enemy.x + enemy.dir * 3, enemy.y - 5, "#d9d9d2", 1, 3, .25);
        const pushed = enemy.knockbackTime > 0;
        const moving = pushed || speed > .1 && Math.abs(mx) + Math.abs(my) > .01;
        enemy.x += (mx * speed + enemy.knockbackX) * dt;
        enemy.y += (my * speed + enemy.knockbackY) * dt;
        if (pushed) {
            const damping = Math.max(0, 1 - dt * 8);
            enemy.knockbackX *= damping;
            enemy.knockbackY *= damping;
        } else enemy.knockbackX = enemy.knockbackY = 0;
        enemy.dir = dx < 0 ? -1 : 1;
        setMotion(enemy, moving);
        place(enemy);
        dx = player.x - enemy.x;
        dy = player.y - enemy.y;
        distance = Math.hypot(dx, dy);
        distance < enemy.radius + 2.3 && damagePlayer(enemy, enemy.damage * dt, false);
    }
    for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        if (a.dead || a.arrival > 0) continue;
        for (let j = i + 1; j < enemies.length; j++) {
            const b = enemies[j];
            if (b.dead || b.arrival > 0) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy;
            const min = a.radius + b.radius - .4;
            if (d2 > .01 && d2 < min * min) {
                const distance = Math.sqrt(d2);
                const push = .35 * (min - distance);
                const px = dx / distance * push;
                const py = dy / distance * push;
                a.x -= px;
                a.y -= py;
                b.x += px;
                b.y += py;
            }
        }
    }
    enemies = enemies.filter(enemy => !enemy.dead);
}

function updateEnemyShots(dt) {
    for (let i = enemyShots.length - 1; i >= 0; i--) {
        const shot = enemyShots[i];
        shot.life -= dt;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        Math.random() < .65 && emit(shot.x, shot.y, "#aaaDA9", 1, 1, .16);
        if ((shot.x - player.x) ** 2 + (shot.y - player.y + 2) ** 2 < 8) {
            damagePlayer(shot, shot.damage, true);
            enemyShots.splice(i, 1);
        } else (shot.life <= 0 || shot.x < camera.x - 12 || shot.x > camera.x + W + 12 || shot.y < camera.y - 12 || shot.y > camera.y + H + 12) && enemyShots.splice(i, 1);
    }
}

function redLance(damageScale = 1) {
    const target = nearestEnemy(player.x, player.y, 50);
    if (!target) return false;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    const bx = player.x + dx / length * 52;
    const by = player.y - 3 + dy / length * 52;
    lineParticles(player.x, player.y - 3, bx, by, COLORS[0][1], 22);
    enemies.forEach(enemy => {
        !enemy.dead && distanceToSegment(enemy.x, enemy.y - 2, player.x, player.y - 3, bx, by) < enemy.radius + .7 && hurtEnemy(enemy, 1.15 * damageScale, COLORS[0][1]);
    });
    return true;
}

function orangeOrbit(strength = player.powerStrengths[1], damageScale = 1, cooldownKey = "orangeCooldown", hitInterval = .22) {
    const count = 3 * strength;
    const angle = elapsed * 5.4;
    for (let i = 0; i < count; i++) {
        const a = angle + i / count * TAU;
        const ox = player.x + Math.cos(a) * 7 * strength;
        const oy = player.y - 3 + Math.sin(a) * 4.4 * strength;
        emit(ox, oy, COLORS[1][1], 1, 2, .13);
        enemies.forEach(enemy => {
            if (!enemy.dead && enemy[cooldownKey] <= 0 && (enemy.x - ox) ** 2 + (enemy.y - 2 - oy) ** 2 < 15) {
                enemy[cooldownKey] = hitInterval;
                hurtEnemy(enemy, .55 * damageScale, COLORS[1][1]);
            }
        });
    }
}

function yellowChain(damageScale = 1) {
    let currentX = player.x;
    let currentY = player.y - 3;
    const used = new Set;
    for (let i = 0; i < 5; i++) {
        const target = nearestEnemy(currentX, currentY, i ? 15 : 27, used);
        if (!target) break;
        used.add(target);
        lineParticles(currentX, currentY, target.x, target.y - 2, COLORS[2][1], 8);
        hurtEnemy(target, .85 * damageScale, COLORS[2][1]);
        currentX = target.x;
        currentY = target.y - 2;
    }
    return used.size > 0;
}

function greenMist(strength = player.powerStrengths[3], damageScale = 1, cooldowns = player.cooldowns, cooldownKey = "greenCooldown", rate = 1) {
    const mistRadius = 17.5 * strength;
    if (cooldowns[3] <= 0) {
        for (let i = 0; i < 5 * strength; i++) {
            const angle = rand(TAU);
            const radius = Math.sqrt(rand(1)) * rand(5, mistRadius);
            const life = rand(.22, .4);
            const ox = Math.cos(angle) * radius;
            const oy = Math.sin(angle) * radius * .58;
            particles.push({
                x: player.x + ox,
                y: player.y - 3 + oy,
                vx: rand(-.7, .7),
                vy: rand(-1.2, -.15),
                life: life,
                max: life,
                color: COLORS[3][1],
                size: Math.random() < .22 ? 2 : 1,
                alpha: rand(.32, .62),
                noLight: true
            });
        }
        cooldowns[3] = .035 / rate;
    }
    enemies.forEach(enemy => {
        if (!enemy.dead && enemy[cooldownKey] <= 0 && distance2(enemy, player) < mistRadius ** 2) {
            enemy[cooldownKey] = .32 / (rate / 1);
            hurtEnemy(enemy, .3 * damageScale, COLORS[3][1]);
        }
    });
}

function bluePulse(strength = player.powerStrengths[4], damageScale = 1) {
    const count = 52 * strength;
    for (let i = 0; i < count; i++) {
        const angle = i / count * TAU;
        const speed = rand(19, 29) * strength;
        particles.push({
            x: player.x,
            y: player.y - 3,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: .6,
            max: .6,
            color: COLORS[4][1],
            size: 1
        });
    }
    enemies.forEach(enemy => {
        if (!enemy.dead && distance2(enemy, player) < (23 * strength) ** 2) {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.hypot(dx, dy) || 1;
            const resistance = enemy.elite ? .45 : 1;
            const force = 44 * Math.sqrt(strength) * resistance;
            enemy.knockbackX = dx / distance * force;
            enemy.knockbackY = dy / distance * force;
            enemy.knockbackTime = .24;
            enemy.windup = 0;
            enemy.charge = 0;
            enemy.slow = enemy.elite ? .65 : 1.25;
            hurtEnemy(enemy, .45 * damageScale, COLORS[4][1]);
        }
    });
}

function indigoGravity(dt, strength = player.powerStrengths[5], effectScale = 1, cooldowns = player.cooldowns, rate = 1) {
    const range = 27 * strength;
    enemies.forEach(enemy => {
        if (enemy.dead) return;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < range && distance > 6) {
            const force = 6 * (1 - distance / range) * effectScale * dt;
            enemy.x += dx / distance * force;
            enemy.y += dy / distance * force;
            enemy.slow = Math.max(enemy.slow, .1);
        }
    });
    if (cooldowns[5] <= 0) {
        const angle = elapsed * 4.7;
        const count = 4 * strength;
        for (let i = 0; i < count; i++) {
            const a = angle + i * TAU / count;
            const radius = (11 + Math.sin(elapsed * 3 + i) * 5) * strength;
            emit(player.x + Math.cos(a) * radius, player.y - 3 + Math.sin(a) * radius * .55, COLORS[5][1], 1, 2, .25);
        }
        cooldowns[5] = .06 / rate;
    }
}

function fireViolet(damageScale = 1) {
    const target = nearestEnemy(player.x, player.y, 65);
    if (!target) return false;
    magicShots.push({
        x: player.x,
        y: player.y - 3,
        target: target,
        speed: 31,
        life: 2.6,
        damage: 1.35 * damageScale,
        color: COLORS[6][1]
    });
    return true;
}

function updateMagicShots(dt) {
    for (let i = magicShots.length - 1; i >= 0; i--) {
        const shot = magicShots[i];
        shot.life -= dt;
        shot.target && !shot.target.dead || (shot.target = nearestEnemy(shot.x, shot.y, 45));
        if (!shot.target || shot.life <= 0) {
            magicShots.splice(i, 1);
            continue;
        }
        const dx = shot.target.x - shot.x;
        const dy = shot.target.y - 2 - shot.y;
        const distance = Math.hypot(dx, dy) || 1;
        shot.x += dx / distance * shot.speed * dt;
        shot.y += dy / distance * shot.speed * dt;
        emit(shot.x, shot.y, shot.color, 1, 3, .2);
        if (distance < 2.6) {
            hurtEnemy(shot.target, shot.damage, shot.color);
            emit(shot.x, shot.y, shot.color, 9, 12, .45);
            magicShots.splice(i, 1);
        }
    }
}

function updateWeapons(dt) {
    player.powerInstances.forEach((instances, index) => {
        for (let i = instances.length - 1; i >= 0; i--) {
            instances[i] -= dt;
            instances[i] <= 0 && instances.splice(i, 1);
        }
        syncPower(index);
        player.cooldowns[index] -= dt;
    });
    if (player.powers[0] > 0 && player.cooldowns[0] <= 0) {
        const fired = redLance();
        fired && playSound(12);
        player.cooldowns[0] = .42 / player.powerStrengths[0] / 1;
    }
    player.powers[1] > 0 && orangeOrbit();
    if (player.powers[2] > 0 && player.cooldowns[2] <= 0) {
        const fired = yellowChain();
        fired && playSound(14);
        player.cooldowns[2] = .78 / player.powerStrengths[2] / 1;
    }
    player.powers[3] > 0 && greenMist();
    if (player.powers[4] > 0 && player.cooldowns[4] <= 0) {
        bluePulse();
        playSound(6);
        player.cooldowns[4] = 1.65;
    }
    player.powers[5] > 0 && indigoGravity(dt);
    if (player.powers[6] > 0 && player.cooldowns[6] <= 0) {
        const fired = fireViolet();
        fired && playSound(18);
        player.cooldowns[6] = .64 / player.powerStrengths[6] / 1;
    }
    updateMagicShots(dt);
}

function movementVector() {
    if (controlType === "gamepad" && gamepad) {
        let x = gamepad.buttons[14]?.pressed ? -1 : gamepad.buttons[15]?.pressed ? 1 : gamepad.axes[0] || 0;
        let y = gamepad.buttons[12]?.pressed ? -1 : gamepad.buttons[13]?.pressed ? 1 : gamepad.axes[1] || 0;
        const length = Math.hypot(x, y);
        return length > .2 ? [ x / Math.max(1, length), y / Math.max(1, length) ] : [ 0, 0 ];
    }
    if (controlType === "keyboard") {
        let x = 0;
        let y = 0;
        (keys.has("ArrowLeft") || keys.has("a")) && x--;
        (keys.has("ArrowRight") || keys.has("d")) && x++;
        (keys.has("ArrowUp") || keys.has("w")) && y--;
        (keys.has("ArrowDown") || keys.has("s")) && y++;
        const length = Math.hypot(x, y);
        return length ? [ x / length, y / length ] : [ 0, 0 ];
    }
    if (controlType === "mouse" && (touch.walking || touch.active)) {
        const x = touch.active ? touch.x - (player.x - camera.x) : touch.targetX - player.x;
        const y = touch.active ? touch.y - (player.y - camera.y) : touch.targetY - player.y;
        const distance = Math.hypot(x, y);
        if (distance <= 8) {
            touch.active || (touch.walking = false);
            return [ 0, 0 ];
        }
        return distance > 8 ? [ x / distance, y / distance ] : [ 0, 0 ];
    }
    return [ 0, 0 ];
}

function leaveRainbowTrail(dt) {
    player.trailClock -= dt;
    if (player.trailClock > 0) return;
    const life = rand(.42, .68);
    particles.push({
        x: player.x - player.dir * rand(3, 4.3) + rand(-.3, .3),
        y: player.y - rand(.4, 2.2),
        vx: -player.dir * rand(.2, .8),
        vy: rand(-.6, .15),
        life: life,
        max: life,
        color: COLORS[player.trailColor++ % COLORS.length][1],
        size: 1,
        alpha: rand(.18, .28),
        noLight: true
    });
    player.trailClock = rand(.075, .115);
}

function leaveDashFootsteps(ax, ay, bx, by) {
    const sideX = -player.dashY;
    const sideY = player.dashX;
    const dx = bx - ax;
    const dy = by - ay;
    const distance = Math.hypot(dx, dy);
    let along = player.dashStride;
    while (along <= distance) {
        const t = distance ? along / distance : 0;
        const foot = player.dashFoot++;
        const side = foot % 2 ? .65 : -.65;
        const x = ax + dx * t + sideX * side;
        const y = ay + dy * t + sideY * side - .15;
        for (let pixel = 0; pixel < 2; pixel++) particles.push({
            x: x - player.dashX * pixel * .5,
            y: y - player.dashY * pixel * .5,
            vx: 0,
            vy: 0,
            life: .3,
            max: .3,
            color: COLORS[foot % COLORS.length][1],
            size: 1,
            alpha: .34,
            noLight: true
        });
        along += 2.4;
    }
    player.dashStride = along - distance;
}

function startDash(direction) {
    if (player.dashCooldown > 0 || player.dashTimer > 0 || player.stamina < 35) return;
    let [x, y] = direction || movementVector();
    x || y || (x = player.dir);
    touch.active = false;
    touch.walking = false;
    player.dashX = x;
    player.dashY = y;
    player.dashTimer = .17;
    player.dashCooldown = .38;
    player.dashInvulnerability = .14;
    player.stamina -= 35;
    player.dashStride = 0;
    player.dashFoot = 0;
    playSound(7);
}

function updatePlayer(dt) {
    let [mx, my] = movementVector();
    if (player.hp < player.maxHp) {
        player.hpRegenClock += dt;
        const regenTime = 6;
        if (player.hpRegenClock >= regenTime) {
            healPlayer(Math.floor(player.hpRegenClock / regenTime));
            player.hpRegenClock %= regenTime;
        }
    } else player.hpRegenClock = 0;
    player.stamina = Math.min(player.maxStamina, player.stamina + 20 * dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashInvulnerability = Math.max(0, player.dashInvulnerability - dt);
    const dashing = player.dashTimer > 0;
    let speed = 27;
    if (dashing) {
        player.dashTimer = Math.max(0, player.dashTimer - dt);
        mx = player.dashX;
        my = player.dashY;
        speed *= 3.45;
    }
    const previousX = player.x;
    const previousY = player.y;
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
    dashing && leaveDashFootsteps(previousX, previousY, player.x, player.y);
    mx && (player.dir = mx < 0 ? -1 : 1);
    const moving = Math.abs(mx) + Math.abs(my) > .01;
    if (moving) {
        const follow = 1 - Math.exp(8 * -dt);
        player.moveX += (mx - player.moveX) * follow;
        player.moveY += (my - player.moveY) * follow;
    } else {
        const decay = Math.exp(2 * -dt);
        player.moveX *= decay;
        player.moveY *= decay;
    }
    setMotion(player, moving);
    moving && !dashing ? leaveRainbowTrail(dt) : player.trailClock = 0;
    player.hitEffectCooldown = Math.max(0, player.hitEffectCooldown - dt);
    const wasFlashing = player.hitFlash > 0;
    player.hitFlash = Math.max(0, player.hitFlash - dt);
    wasFlashing && player.hitFlash === 0 && player.el.classList.remove("hurt");
    place(player);
}

function updateFlowers() {
    for (let i = flowers.length - 1; i >= 0; i--) {
        const flower = flowers[i];
        (flower.x - player.x) ** 2 + (flower.y - player.y) ** 2 < 18 && collectFlower(flower);
    }
}

function setControlType(type) {
    if (controlType === type) return;
    type !== "mouse" && (touch.walking = false);
    controlType = type;
    resize();
    updateControlHints();
    updatePointerControls();
    mode === "menu" && setTitleSelection(selectedTitleOption);
}

function updateControlHints() {
    const hints = {
        keyboard: {
            deathRetry: "ANY KEY TO TITLE"
        },
        mouse: {
            deathRetry: "CLICK OUTSIDE TO TITLE"
        },
        gamepad: {
            deathRetry: "PRESS A TO TITLE"
        }
    }[controlType];
    deathInput.textContent = hints.deathRetry;
}

function updateHud() {
    scoreEl.textContent = Math.floor(score).toString().padStart(6, "0");
    hpFill.style.transform = `scaleX(${player.hp / player.maxHp})`;
    const staminaRatio = player.stamina / player.maxStamina;
    staminaFill.style.transform = `scaleX(${staminaRatio})`;
    const stamina = Math.round(player.stamina);
    staminaEl.setAttribute("aria-valuenow", stamina);
    staminaEl.setAttribute("aria-valuemax", Math.round(player.maxStamina));
    const neededXp = xpGoal();
    xpFill.style.transform = `scaleX(${player.xp / neededXp})`;
    xpEl.setAttribute("aria-valuenow", player.xp);
    xpEl.setAttribute("aria-valuemax", neededXp);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
    clockEl.textContent = `${minutes}:${seconds}`;
    powerPips.forEach(([pip, fill], index) => {
        const ratio = clamp(player.powers[index] / 14, 0, 1);
        pip.classList.toggle("active", ratio > 0);
        pip.title = ratio > 0 && player.powerStrengths[index] > 1 ? `${COLORS[index][0]} ×${player.powerStrengths[index]}` : COLORS[index][0];
        fill.style.height = ratio * 100 + "%";
    });
}

function update(dt) {
    elapsed += dt;
    score += dt * (10 + activePowerCount() * 3);
    updatePlayer(dt);
    updateCamera(dt);
    updateWorld();
    updateFlowers();
    updateXpParticles(dt);
    updateWeapons(dt);
    spawnClock -= dt;
    if (spawnClock <= 0) {
        spawnEnemy();
        const hunt = huntTimeCurve();
        const openingPressure = .45 * (1 - Math.exp(-elapsed / 75));
        const pressure = hunt * .85 + openingPressure + anger * .11;
        spawnClock = Math.max(.075, Math.max(.12, 1 - pressure) * rand(.78, 1.18) / 2 ** (hunt * 1.5));
    }
    updateEnemies(dt);
    updateEnemyShots(dt);
    updateHud();
}

function resetGame() {
    enemies.forEach(enemy => enemy.el.remove());
    stains.forEach(stain => stain.remove());
    clearWorld();
    enemies = [];
    stains = [];
    particles = [];
    xpParticles = [];
    xpColorIndex = 0;
    magicShots = [];
    enemyShots = [];
    collectedFlowers = new Set;
    keys.clear();
    touch.active = false;
    touch.walking = false;
    elapsed = 0;
    deathInputLock = 0;
    score = 0;
    anger = 0;
    spawnClock = 1.2;
    Object.assign(player, createPlayer(player.el));
    game.classList.remove("dying");
    deathScreen.classList.add("hidden");
    deathScreen.setAttribute("aria-hidden", "true");
    player.el.classList.remove("hurt");
    setMotion(player, false);
    place(player);
    updateCamera(0, true);
    updateWorld();
    updateHud();
}

function setTitleSelection(index, focus = false) {
    selectedTitleOption = (index + titleOptions.length) % titleOptions.length;
    const showSelection = controlType !== "mouse";
    titleOptions.forEach((button, buttonIndex) => button.classList.toggle("selected", showSelection && buttonIndex === selectedTitleOption));
    focus && titleOptions[selectedTitleOption].focus({
        preventScroll: true
    });
}

function startTitleRun() {
    startGame();
}

function activateTitleOption(index = selectedTitleOption) {
    if (mode !== "menu") return;
    titleOptions[index] === playButton && startTitleRun();
}

function setPauseSelection(index, focus = false) {
    selectedPauseOption = (index + pauseOptions.length) % pauseOptions.length;
    pauseOptions.forEach((button, buttonIndex) => button.classList.toggle("selected", buttonIndex === selectedPauseOption));
    focus && pauseOptions[selectedPauseOption].focus({
        preventScroll: true
    });
}

function movePauseSelection(direction) {
    setPauseSelection(selectedPauseOption + Math.sign(direction), true);
}

function exitToTitle() {
    if (mode !== "paused" && mode !== "gameover") return;
    resetGame();
    mode = "menu";
    game.classList.remove("paused");
    pauseScreen.classList.add("hidden");
    pauseScreen.setAttribute("aria-hidden", "true");
    playButton.textContent = "START GAME";
    curtain.classList.remove("hidden");
    setTitleSelection(0);
    document.activeElement?.blur();
}

function activatePauseOption(index = selectedPauseOption) {
    if (mode !== "paused" || document.hidden || !document.hasFocus()) return;
    const option = pauseOptions[index];
    option === pauseResume ? resumeGame() : option === pauseNew ? startGame() : index === 1 ? document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() : option === pauseExit && exitToTitle();
}

function pauseGame(focusMenu = true) {
    if (mode === "paused") return;
    if (mode !== "playing") return;
    mode = "paused";
    keys.clear();
    touch.active = false;
    touch.walking = false;
    setMotion(player, false);
    game.classList.add("paused");
    pauseScreen.classList.remove("hidden");
    pauseScreen.setAttribute("aria-hidden", "false");
    setPauseSelection(0, focusMenu && document.hasFocus());
}

function resumeGame() {
    if (mode !== "paused" || document.hidden || !document.hasFocus()) return;
    mode = "playing";
    game.classList.remove("paused");
    pauseScreen.classList.add("hidden");
    pauseScreen.setAttribute("aria-hidden", "true");
    document.activeElement?.blur();
    lastFrame = performance.now();
}

function togglePause() {
    mode === "playing" ? pauseGame() : mode === "paused" && resumeGame();
}

function startGame() {
    if (!assetsReady) return;
    initAudio();
    document.activeElement?.blur();
    resetGame();
    game.classList.remove("paused");
    pauseScreen.classList.add("hidden");
    pauseScreen.setAttribute("aria-hidden", "true");
    curtain.classList.add("hidden");
    mode = "playing";
    lastFrame = performance.now();
}

function endGame() {
    if (mode !== "playing") return;
    mode = "gameover";
    deathInputLock = 1.5;
    touch.active = false;
    touch.walking = false;
    keys.clear();
    setMotion(player, false);
    game.classList.remove("paused");
    game.classList.add("dying");
    pauseScreen.classList.add("hidden");
    pauseScreen.setAttribute("aria-hidden", "true");
    curtain.classList.add("hidden");
    const finalScore = Math.floor(score);
    const previous = Number(localStorage.getItem("prismatic-prey-high") || 0);
    const high = Math.max(previous, finalScore);
    localStorage.setItem("prismatic-prey-high", high);
    deathStats.textContent = `SCORE ${finalScore.toString().padStart(6, "0")} · HIGH ${high.toString().padStart(6, "0")}`;
    deathScreen.classList.remove("hidden");
    deathScreen.setAttribute("aria-hidden", "false");
}

function frame(now) {
    const dt = Math.min(.034, (now - lastFrame) / 1e3 || 0);
    lastFrame = now;
    pollGamepad();
    updatePointerControls();
    mode === "playing" ? update(dt) : mode === "gameover" && (deathInputLock = Math.max(0, deathInputLock - dt));
    if (mode !== "paused") {
        updateParticles(dt);
        renderLighting();
    }
    requestAnimationFrame(frame);
}

function pointerPosition(event) {
    const rect = game.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) / rect.width * W,
        y: (event.clientY - rect.top) / rect.height * H
    };
}

function updatePointerPosition(event) {
    const point = pointerPosition(event);
    touch.x = point.x;
    touch.y = point.y;
}

function updateMouseWalkTarget() {
    touch.targetX = camera.x + touch.x;
    touch.targetY = camera.y + touch.y;
}

function keyDirection(key) {
    if (key === "ArrowLeft" || key === "a") return [ -1, 0 ];
    if (key === "ArrowRight" || key === "d") return [ 1, 0 ];
    if (key === "ArrowUp" || key === "w") return [ 0, -1 ];
    if (key === "ArrowDown" || key === "s") return [ 0, 1 ];
    return [ 0, 0 ];
}

function pollGamepad() {
    gamepad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (!gamepad) {
        gamepadButtons = [];
        gamepadY = 0;
        return;
    }
    const buttons = gamepad.buttons.map(button => button.pressed);
    const edge = index => buttons[index] && !gamepadButtons[index];
    const y = buttons[12] ? -1 : buttons[13] ? 1 : Math.abs(gamepad.axes[1]) > .5 ? Math.sign(gamepad.axes[1]) : 0;
    const step = y && y !== gamepadY;
    if (buttons.some(Boolean) || y || Math.abs(gamepad.axes[0]) > .2) setControlType("gamepad");
    if (mode === "menu" && (edge(0) || edge(9))) activateTitleOption(); else if ((mode === "playing" || mode === "paused") && edge(9)) togglePause(); else if (mode === "playing" && edge(0)) startDash(); else if (mode === "paused") {
        step && movePauseSelection(step);
        edge(0) && activatePauseOption();
    } else if (mode === "gameover" && deathInputLock <= 0 && buttons.some((pressed, index) => pressed && !gamepadButtons[index])) exitToTitle();
    gamepadButtons = buttons;
    gamepadY = y;
}

const isMousePointer = event => event.pointerType === "mouse" || !event.pointerType;

function updatePointerControls() {
    const visible = mode !== "menu" && controlType === "mouse";
    if (pointerUiVisible === visible) return;
    pointerUiVisible = visible;
    game.classList.toggle("pointer-ui", visible);
    pointerControlsEl.classList.toggle("visible", visible);
    pointerControlsEl.setAttribute("aria-hidden", String(!visible));
}

addEventListener("resize", resize);

visualViewport?.addEventListener("resize", resize);

addEventListener("pointerdown", event => {
    isMousePointer(event) && setControlType("mouse");
}, true);

addEventListener("pointermove", event => {
    event.pointerType !== "mouse" && event.pointerType || setControlType("mouse");
}, {
    passive: true
});

pointerPause.addEventListener("pointerdown", event => {
    if (mode !== "playing" || event.button !== 0 || !isMousePointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setControlType("mouse");
    pauseGame(true);
});

addEventListener("blur", () => pauseGame(false));

document.addEventListener("visibilitychange", () => {
    document.hidden && pauseGame(false);
});

addEventListener("keydown", event => {
    setControlType("keyboard");
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const [, navY] = keyDirection(key);
    if (mode === "gameover") {
        event.preventDefault();
        !event.repeat && deathInputLock <= 0 && exitToTitle();
        return;
    }
    [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Escape" ].includes(key) && event.preventDefault();
    if (key === "Escape") {
        event.repeat || togglePause();
        return;
    }
    if (mode === "menu") {
        (key === "Enter" || key === " ") && !event.repeat && activateTitleOption();
        return;
    }
    if (mode === "paused") {
        if (navY && !event.repeat) movePauseSelection(navY); else if ((key === "Enter" || key === " ") && !event.repeat) {
            event.preventDefault();
            activatePauseOption();
        }
        return;
    }
    key !== " " || mode !== "playing" || event.repeat || startDash();
    mode === "playing" && keys.add(key);
});

addEventListener("keyup", event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));

game.addEventListener("pointerdown", event => {
    if (mode !== "playing") return;
    updatePointerPosition(event);
    const isMouse = event.pointerType === "mouse" || !event.pointerType;
    if (!isMouse) return;
    if (isMouse) if (event.button === 0) {
        touch.walking = false;
        touch.active = true;
        touch.pressX = touch.x;
        touch.pressY = touch.y;
        touch.pressTime = performance.now();
        touch.dragged = false;
        game.setPointerCapture(event.pointerId);
    } else if (event.button === 2) {
        const x = touch.x - (player.x - camera.x);
        const y = touch.y - (player.y - camera.y);
        const distance = Math.hypot(x, y);
        startDash(distance ? [ x / distance, y / distance ] : void 0);
    }
});

game.addEventListener("pointermove", event => {
    if (event.pointerType === "mouse" || !event.pointerType) {
        touch.over = true;
        updatePointerPosition(event);
        touch.active && Math.hypot(touch.x - touch.pressX, touch.y - touch.pressY) > 3 && (touch.dragged = true);
    }
});

game.addEventListener("pointerenter", event => {
    if (event.pointerType !== "mouse" && event.pointerType) return;
    touch.over = true;
    updatePointerPosition(event);
});

game.addEventListener("pointerleave", event => {
    event.pointerType !== "mouse" && event.pointerType || (touch.over = false);
});

game.addEventListener("pointerup", event => {
    if (touch.active && (event.pointerType === "mouse" || !event.pointerType) && event.button === 0) {
        updatePointerPosition(event);
        const isClick = !touch.dragged && performance.now() - touch.pressTime <= 240 && Math.hypot(touch.x - touch.pressX, touch.y - touch.pressY) <= 3;
        touch.active = false;
        touch.walking = isClick;
        isClick && updateMouseWalkTarget();
    }
});

game.addEventListener("pointercancel", event => {
    touch.active = false;
    touch.walking = false;
    event.pointerType !== "mouse" && event.pointerType || (touch.over = false);
});

game.addEventListener("contextmenu", event => event.preventDefault());

pauseOptions.forEach(button => {
    const select = () => setPauseSelection(pauseOptions.indexOf(button));
    button.addEventListener("pointerenter", select);
    button.addEventListener("focus", select);
    button.addEventListener("click", () => activatePauseOption(pauseOptions.indexOf(button)));
});

titleOptions.forEach((button, index) => {
    button.addEventListener("pointerenter", () => setTitleSelection(index));
    button.addEventListener("focus", () => setTitleSelection(index));
});

deathScreen.addEventListener("click", () => {
    deathInputLock <= 0 && exitToTitle();
});

playButton.addEventListener("click", startTitleRun);

playButton.disabled = true;

setTitleSelection(0);

updateControlHints();

prepareAtlas();
const iconHolder = pointerPause.querySelector("i");
Object.entries(ICONS).forEach(([name, sprite]) => {
    const icon = makeArt(sprite);
    icon.classList.add(`${name}-icon`);
    iconHolder.append(icon);
});
player.el = makeEntity("player", SPRITES.unicorn, player.x, player.y).el;
resize();
updateCamera(0, true);
updateWorld();
updateHud();
assetsReady = true;
updateControlHints();
playButton.disabled = false;
requestAnimationFrame(frame);
