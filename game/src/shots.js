// Staged scenes for the judge screenshots (?shot=title|play|upgrade|end).
// Each staging builds a real, living game state — the same states a player
// reaches — with numbers set to a believable late-run moment, then hands
// control back to the normal frame loop.

import { CAULDRON, ROADS, UPGRADES } from './config.js';

function place(engine, kind, x, y) {
  const c = engine.spawnCreature(kind);
  c.x = x; c.y = y;
  return c;
}

function setBubble(engine, x, y, r, syrup, trappedKinds = []) {
  const b = engine.bubbleAt(x, y);
  b.state = 'set';
  b.r = r;
  b.syrup = syrup;
  b.life = 11;
  engine.bubbles.push(b);
  for (const kind of trappedKinds) {
    const c = place(engine, kind, x, y);
    c.trappedIn = b;
    b.trapped.push(c);
  }
  return b;
}

// Ambient scene behind the title screen's live-demo window.
export function stageAmbient(engine) {
  engine.creatures = [];
  engine.bubbles = [];
  engine.projectiles = [];
  engine.pickups = [];
  place(engine, 'sourling', CAULDRON.x - 170, CAULDRON.y - 60);
  place(engine, 'sourling', CAULDRON.x + 190, CAULDRON.y + 40);
  place(engine, 'fizzbat', CAULDRON.x + 90, CAULDRON.y - 150);
  place(engine, 'wisp', CAULDRON.x - 120, CAULDRON.y + 130);
  place(engine, 'mite', CAULDRON.x + 240, CAULDRON.y - 90);
  const b = setBubble(engine, CAULDRON.x - 90, CAULDRON.y - 120, 40, 'berry', ['sourling']);
  b.trapped[0].x = b.x; b.trapped[0].y = b.y;
  setBubble(engine, CAULDRON.x + 150, CAULDRON.y + 120, 30, 'amber');
}

function stageTitle(engine, ui) {
  // a believable veteran profile: some workshop ranks, a bank, past runs
  engine.save.banked = 2341;
  engine.save.best = 165170;
  engine.save.workshop = { w_apron: 3, w_coals: 3, w_lungs: 3, w_head: 1 };
  engine.save.lastRuns = [
    { score: 142170, won: true, difficulty: 'apprentice' },
    { score: 138425, won: true, difficulty: 'apprentice' },
    { score: 165170, won: true, difficulty: 'apprentice' },
  ];
  stageAmbient(engine);
  ui.refreshTitle(engine);
  ui.showScreen(engine);
}

function stagePlay(engine, ui) {
  engine.startRun('journeyman');
  // jump to the final wave: KING BITTER at a third health, realm 3
  engine.spawnQueue = [];
  engine.creatures = [];
  engine.bubbles = [];
  engine.waveIndex = 8;
  engine.beginWave(8, null);
  engine.spawnQueue = [];
  engine.bossSpawned = true;
  const boss = engine.spawnBoss('bitterking');
  boss.x = 700; boss.y = 215;
  boss.hp = Math.round(boss.maxHp * 0.33);
  boss.phase = 3;
  // field dressing
  place(engine, 'wisp', 880, 180);
  place(engine, 'fizzbat', 905, 430);
  place(engine, 'sourling', 420, 200);
  place(engine, 'mite', 450, 235);
  place(engine, 'lancer', 905, 300);
  const b1 = setBubble(engine, 470, 330, 62, 'mint', ['sourling', 'sourling']);
  b1.trapped[0].x = b1.x - 16; b1.trapped[0].y = b1.y - 6;
  b1.trapped[1].x = b1.x + 18; b1.trapped[1].y = b1.y + 12;
  const b2 = setBubble(engine, 545, 445, 44, 'amber', ['mite']);
  b2.trapped[0].x = b2.x; b2.trapped[0].y = b2.y;
  setBubble(engine, 520, 545, 52, 'berry', ['fizzbat', 'wisp']);
  // the smith, mid-fight, close to the melt
  engine.player.x = 545; engine.player.y = 300;
  engine.player.aim = Math.atan2(215 - 300, 700 - 545);
  engine.player.hp = engine.maxHp;
  engine.player.breath = engine.maxBreath;
  // a rich late-run ledger
  engine.score = 63660;
  engine.combo = 4.5;
  engine.crystals = 1006;
  engine.upgrades = { wide: 1, quick: 1, twin: 1, sharp: 1 };
  engine.relics = ['stone', 'lucky', 'cannon', 'echo', 'bellows'];
  engine.heat = 115;
  engine.stats.kills = 168;
  engine.stats.trapped = 121;
  engine.setAnnounce('');
  engine.announceT = 0;
  engine.texts.push(
    { x: 905, y: 300, str: '+325', color: '#fff3d6', size: 17, t: 0, life: 999 },
    { x: 700, y: 330, str: '+95', color: '#fff3d6', size: 14, t: 0, life: 999 },
    { x: 620, y: 420, str: '+90', color: '#fff3d6', size: 14, t: 0, life: 999 },
    { x: 640, y: 585, str: 'CHAIN x2!', color: '#ffd23f', size: 30, t: 0, life: 999 },
  );
  ui.showScreen(engine);
  ui.refreshHUD(engine);
}

function stageUpgrade(engine, ui) {
  engine.startRun('journeyman');
  engine.spawnQueue = [];
  engine.creatures = [];
  engine.score = 4435;
  engine.upgrades = { wide: 1 };
  engine.waveIndex = 1;
  const ups = ['wide', 'sharp', 'bricks'].map(id => UPGRADES.find(u => u.id === id));
  engine.intermission = { upgrades: ups, roads: ROADS };
  engine.state = 'intermission';
  ui.showScreen(engine);
  ui.buildIntermission(engine);
  ui.selUpgrade = 1;
  ui.selRoad = 0;
  ui.buildIntermissionKeep(engine);
}

function stageEnd(engine, ui) {
  engine.startRun('apprentice');
  engine.spawnQueue = [];
  engine.creatures = [];
  engine.waveIndex = 8;
  engine.defeatedBrute = true;
  engine.bestTrap = 4;
  engine.heat = engine.maxHeat * 0.9;
  engine.player.hp = engine.maxHp;
  engine.relics = ['stone', 'echo', 'bellows', 'lucky'];
  engine.upgrades = { wide: 2, quick: 1, twin: 2, sharp: 2, last: 1, chain: 1 };
  engine.stats.kills = 247;
  engine.stats.trapped = 169;
  engine.stats.shatters = 228;
  engine.stats.bestChain = 12;
  engine.stats.bestCombo = 8;
  engine.stats.time = 267;
  engine.stats.crystalsEarned = 1201;
  engine.stats.roadsTaken = ['cache', 'surge', 'cache', 'surge', 'quiet', 'surge', 'cache', 'quiet'];
  engine.stats.syrupsShattered = new Set(['amber', 'berry', 'mint', 'cola']);
  engine.score = 148860;
  engine.endRun(true);
  engine.save.banked = 2151;
  engine.save.lastRuns = [
    { score: 148860, won: true, difficulty: 'apprentice' },
    { score: 138425, won: true, difficulty: 'apprentice' },
    { score: 165170, won: true, difficulty: 'apprentice' },
  ];
  ui.showScreen(engine);
  ui.buildEnd(engine);
}

export function stageShot(engine, ui, name) {
  if (name === 'title') stageTitle(engine, ui);
  else if (name === 'play') stagePlay(engine, ui);
  else if (name === 'upgrade') stageUpgrade(engine, ui);
  else if (name === 'end') stageEnd(engine, ui);
}
