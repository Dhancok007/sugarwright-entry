// SUGARWRIGHT engine: all game state and rules, no DOM. main.js feeds it an
// input object each frame; render.js draws from it; ui.js reads its events.
//
// Input shape (mutated by main.js):
//   input.moveX, input.moveY  -1..1 movement axes
//   input.aimX, input.aimY    pointer position in view coordinates
//   input.blow                true while the blow button is held
//   input.shatter             edge flag: set true by main.js, engine consumes
//   input.dash                edge flag, same pattern
//   input.syrup               -1, or 0..3 when a syrup key was pressed
// Events: engine.events is an array of {type, ...} drained by main.js each
// frame (sounds, screen changes, announcements).

import {
  ARENA, CAULDRON, SYRUPS, REALMS, CREATURES, BOSSES, WAVES, ROADS,
  UPGRADES, RELICS, WORKSHOP, DIFFICULTIES, FEATS, gradeFor,
} from './config.js';
import { makeRng, pick, range } from './random.js';

const SAVE_KEY = 'sugarwright-save-v1';

export function loadSave() {
  const fallback = { banked: 0, workshop: {}, best: 0, lastRuns: [], wins: 0 };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed, workshop: parsed.workshop || {} };
  } catch {
    return fallback;
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

export class Engine {
  constructor(seed = 7) {
    this.rng = makeRng(seed);
    this.save = loadSave();
    this.state = 'title'; // title | playing | intermission | over | win
    this.paused = false;
    this.endless = false;
    this.time = 0;
    this.events = [];
    this.difficulty = DIFFICULTIES[1];
    // field state exists from birth so the title screen can render a live
    // ambient scene behind its demo window before any run starts
    this.upgrades = {};
    this.relics = [];
    this.bestTrap = 0;
    this.defeatedBrute = false;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.crystals = 0;
    this.heat = 110;
    this.syrupIndex = 0;
    this.unlockedSyrups = this.shop('w_cola') ? 4 : 3;
    this.player = {
      x: CAULDRON.x, y: CAULDRON.y + 120, hp: 150, breath: 100,
      aim: -Math.PI / 2, dashCd: 0, dashTime: 0, invuln: 0, dead: false,
    };
    this.bubbles = [];
    this.creatures = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.growing = null;
    this.boss = null;
    this.waveIndex = 0;
    this.waveDef = WAVES[0];
    this.incoming = {};
    this.intermission = null;
    this.roadChoice = null;
    this.pendingRelic = false;
    this.announce = null;
    this.announceT = 0;
    this.shake = 0;
    this.resetRunStats();
  }

  // ---- derived stats from upgrades / relics / workshop -----------------
  up(id) { return this.upgrades[id] || 0; }
  hasRelic(id) { return this.relics.includes(id); }
  shop(id) { return this.save.workshop[id] || 0; }

  get maxHp() { return 150 + this.up('apron') * 25 + this.shop('w_apron') * 15 - (this.hasRelic('cannon') ? 20 : 0); }
  get maxBreath() { return 100 + this.up('lungs') * 25 + this.shop('w_lungs') * 12; }
  get maxHeat() { return 120 + this.up('bricks') * 25; }
  get bubbleMaxR() { return (54 + this.up('wide') * 8) * (1 + this.shop('w_heirloom') * 0.08); }
  get bubbleGrow() { return 46 * (1 + this.up('quick') * 0.22); }
  get bubbleLife() { return 12 * (1 + this.up('last') * 0.4); }
  get bubbleCapacity() { return 3 + this.up('catch'); }
  get shardDamage() { return 3 * (1 + this.up('sharp') * 0.35) * (this.hasRelic('cannon') ? 1.6 : 1); }
  get shardCount() { return 6 + this.up('twin') * 2; }
  get chainRadius() { return 120 * (1 + this.up('chain') * 0.25); }
  get moveSpeed() { return 168 * (1 + this.up('rush') * 0.12); }
  get dashCooldown() { return 2.2 * (1 - this.up('boots') * 0.3); }
  get crystalMult() { return 1 + this.up('tooth') * 0.2; }

  resetRunStats() {
    this.stats = {
      kills: 0, trapped: 0, shatters: 0, bestChain: 0, bestCombo: 1,
      time: 0, crystalsEarned: 0, roadsTaken: [], syrupsShattered: new Set(),
    };
  }

  // ---- run lifecycle ----------------------------------------------------
  startRun(difficultyId, endless = false) {
    this.difficulty = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
    this.endless = endless;
    this.upgrades = {};
    this.relics = [];
    this.bestTrap = 0;
    this.defeatedBrute = false;
    this.resetRunStats();
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.crystals = 40 * this.shop('w_head');
    this.player = {
      x: CAULDRON.x, y: CAULDRON.y + 120, hp: this.maxHp, breath: this.maxBreath,
      aim: -Math.PI / 2, dashCd: 0, dashTime: 0, invuln: 0, dead: false,
    };
    this.heat = Math.min(this.maxHeat, 100 + this.shop('w_coals') * 15);
    this.syrupIndex = 0;
    this.unlockedSyrups = this.shop('w_cola') ? 4 : 3;
    this.bubbles = [];
    this.creatures = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.growing = null;
    this.boss = null;
    this.waveIndex = 0;
    this.roadChoice = null;
    this.pendingRelic = false;
    this.announce = null;
    this.announceT = 0;
    this.shake = 0;
    this.state = 'playing';
    this.paused = false;
    this.beginWave(0, null);
    this.emit({ type: 'state', state: 'playing' });
  }

  realmIndex() { return Math.min(2, Math.floor(this.waveIndex / 3)); }
  realm() { return REALMS[this.realmIndex()]; }

  beginWave(index, road) {
    this.waveIndex = index;
    const def = WAVES[index % WAVES.length];
    const scale = this.endless && index >= WAVES.length ? 1 + (index - WAVES.length + 1) * 0.25 : 1;
    this.waveDef = def;
    this.spawnQueue = [];
    const mult = (road ? road.mult : 1) * this.difficulty.enemyMult * scale;
    for (const [kind, count] of def.comp) {
      const n = Math.max(1, Math.round(count * mult));
      for (let i = 0; i < n; i++) this.spawnQueue.push(kind);
    }
    if (road && road.id === 'cache') {
      for (let i = 0; i < 4; i++) this.spawnQueue.push('fizzbat');
      this.gainCrystals(50, CAULDRON.x, CAULDRON.y - 70);
    }
    if (road && road.id === 'quiet') {
      this.heat = Math.min(this.maxHeat, this.heat + 20);
      this.player.hp = Math.min(this.maxHp, this.player.hp + 10);
    }
    // shuffle the queue with the run rng so compositions interleave
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 1.2;
    this.trickleTimer = 6;
    this.waveTime = 0;
    this.bossSpawned = false;
    this.setAnnounce(`WAVE ${index + 1}/${WAVES.length} · ${def.name}`);
    this.incoming = this.previewComp(def, mult);
  }

  previewComp(def, mult) {
    const counts = {};
    for (const [kind, count] of def.comp) counts[kind] = Math.max(1, Math.round(count * mult));
    if (def.boss) counts[def.boss] = 1;
    return counts;
  }

  setAnnounce(text) {
    this.announce = text;
    this.announceT = 2.6;
  }

  emit(ev) { this.events.push(ev); }

  // ---- spawning ----------------------------------------------------------
  spawnPoint() {
    const side = Math.floor(this.rng() * 4);
    const m = 26;
    if (side === 0) return { x: range(this.rng, ARENA.x + m, ARENA.x + ARENA.w - m), y: ARENA.y + m };
    if (side === 1) return { x: range(this.rng, ARENA.x + m, ARENA.x + ARENA.w - m), y: ARENA.y + ARENA.h - m };
    if (side === 2) return { x: ARENA.x + m, y: range(this.rng, ARENA.y + m, ARENA.y + ARENA.h - m) };
    return { x: ARENA.x + ARENA.w - m, y: range(this.rng, ARENA.y + m, ARENA.y + ARENA.h - m) };
  }

  spawnCreature(kind) {
    const base = CREATURES[kind];
    const p = this.spawnPoint();
    const c = {
      kind, ...base,
      hp: Math.round(base.hp * this.difficulty.hpMult),
      maxHp: Math.round(base.hp * this.difficulty.hpMult),
      x: p.x, y: p.y, vx: 0, vy: 0,
      frozen: 0, trappedIn: null, state: 'roam', stateT: range(this.rng, 0.5, 1.5),
      fireT: range(this.rng, 1.4, 2.6), wobble: range(this.rng, 0, Math.PI * 2), isBoss: false,
    };
    this.creatures.push(c);
    return c;
  }

  spawnBoss(kind) {
    const base = BOSSES[kind];
    const c = {
      kind, ...base,
      hp: Math.round(base.hp * this.difficulty.hpMult),
      maxHp: Math.round(base.hp * this.difficulty.hpMult),
      x: CAULDRON.x, y: ARENA.y + 90, vx: 0, vy: 0,
      frozen: 0, trappedIn: null, state: 'roam', stateT: 1, fireT: 2.5,
      wobble: 0, isBoss: true, phase: 1, behaviour: 'hunter', leech: 2.4, dmg: 22,
    };
    this.creatures.push(c);
    this.boss = c;
    this.setAnnounce(`${base.name} · PHASE 1/${base.phases}`);
    this.emit({ type: 'boss' });
    return c;
  }

  // ---- economy -----------------------------------------------------------
  gainCrystals(n, x, y) {
    let v = Math.round(n * this.crystalMult);
    if (this.hasRelic('lucky') && this.rng() < 0.2) v *= 2;
    this.crystals += v;
    this.stats.crystalsEarned += v;
    if (x !== undefined) this.addText(x, y, `+${v}`, '#ffe066');
  }

  dropPickups(c) {
    const n = c.crystals || 0;
    for (let i = 0; i < n; i++) {
      this.pickups.push({
        x: c.x + range(this.rng, -14, 14), y: c.y + range(this.rng, -14, 14),
        vx: range(this.rng, -30, 30), vy: range(this.rng, -30, 30), t: 0,
      });
    }
  }

  addText(x, y, str, color = '#fff3d6', size = 15) {
    this.texts.push({ x, y, str, color, size, t: 0, life: 1.1 });
  }

  burst(x, y, color, n = 10, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: range(this.rng, 0.25, 0.6), color, r: range(this.rng, 1.5, 3.5) });
    }
  }

  // ---- bubbles -------------------------------------------------------------
  bubbleAt(x, y) {
    // bubbles live at the pipe tip: ahead of the smith, toward the aim
    return {
      x, y, r: 12, syrup: SYRUPS[this.syrupIndex].id, state: 'growing',
      life: this.bubbleLife, trapped: [], wobble: this.rng() * Math.PI * 2,
    };
  }

  releaseBubble() {
    const b = this.growing;
    if (!b) return;
    b.state = 'set';
    this.growing = null;
    // keep the field readable: the oldest set bubble pops when over capacity
    const set = this.bubbles.filter(x => x.state === 'set');
    if (set.length > 10) this.expireBubble(set[0]);
    if (this.hasRelic('pipe')) {
      const twin = {
        x: b.x + 34, y: b.y + 18, r: b.r * 0.55, syrup: b.syrup, state: 'set',
        life: this.bubbleLife, trapped: [], wobble: this.rng() * Math.PI * 2,
      };
      twin.x = Math.min(ARENA.x + ARENA.w - twin.r, Math.max(ARENA.x + twin.r, twin.x));
      twin.y = Math.min(ARENA.y + ARENA.h - twin.r, Math.max(ARENA.y + twin.r, twin.y));
      this.bubbles.push(twin);
    }
    this.emit({ type: 'release' });
  }

  tryTrap(c) {
    for (const b of this.bubbles) {
      if (b.state !== 'set') continue;
      if (b.trapped.length >= this.bubbleCapacity) continue;
      if (dist2(c.x, c.y, b.x, b.y) < (b.r + c.r * 0.4) ** 2) {
        c.trappedIn = b;
        b.trapped.push(c);
        this.stats.trapped += 1;
        this.bestTrap = Math.max(this.bestTrap, b.trapped.length);
        this.emit({ type: 'trap' });
        return true;
      }
    }
    return false;
  }

  shatterAll() {
    const set = this.bubbles.filter(b => b.state === 'set');
    if (!set.length) return;
    let chain = 0;
    let killed = 0;
    for (const b of set) {
      chain += 1;
      killed += this.popBubble(b, 1);
    }
    if (this.hasRelic('echo')) {
      for (const b of set) this.popBubble(b, 0.5, true);
    }
    this.stats.shatters += set.length;
    this.stats.bestChain = Math.max(this.stats.bestChain, chain);
    if (chain >= 2) {
      this.setAnnounce(`CHAIN x${chain}!`);
      this.addText(this.player.x, this.player.y - 44, `CHAIN x${chain}!`, '#ffd23f', 26);
    }
    if (this.up('wind')) this.player.breath = Math.min(this.maxBreath, this.player.breath + this.up('wind') * 4 * set.length);
    this.shake = Math.min(10, 3 + chain);
    this.emit({ type: 'shatter', chain });
  }

  // Pop one bubble: trapped creatures die, shards fly, syrup effect applies.
  // Returns kills. echo=true means a half-strength aftershock with no re-trap.
  popBubble(b, power, echo = false) {
    const idx = this.bubbles.indexOf(b);
    if (idx >= 0) this.bubbles.splice(idx, 1);
    const syrup = SYRUPS.find(s => s.id === b.syrup) || SYRUPS[0];
    this.stats.syrupsShattered.add(b.syrup);
    let kills = 0;
    for (const c of [...b.trapped]) {
      c.trappedIn = null;
      kills += this.killCreature(c, true);
    }
    b.trapped = [];
    const radius = b.syrup === 'cola' ? 150 : 92 + b.r * 0.5;
    const dmg = this.shardDamage * (b.syrup === 'cola' ? 1.8 : 1) * power;
    for (const c of [...this.creatures]) {
      if (c.trappedIn) continue;
      const d2 = dist2(c.x, c.y, b.x, b.y);
      if (d2 < (radius + c.r) ** 2) {
        if (b.syrup === 'mint') {
          c.frozen = Math.max(c.frozen, this.hasRelic('veil') ? 5 : 2.6);
          this.emit({ type: 'freeze' });
        }
        kills += this.damageCreature(c, dmg, b.x, b.y);
      }
    }
    // stoke the melt when the shatter happens close to the cauldron
    if (dist2(b.x, b.y, CAULDRON.x, CAULDRON.y) < 200 ** 2) {
      this.heat = Math.min(this.maxHeat, this.heat + 1.5);
    }
    this.burst(b.x, b.y, syrup.color, echo ? 6 : 14, echo ? 120 : 200);
    if (b.syrup === 'cola' && !echo) this.emit({ type: 'boom' });
    return kills;
  }

  damageCreature(c, dmg, fromX, fromY) {
    if (c.hp <= 0) return 0;
    c.hp -= dmg;
    const kb = c.knockResist ? 1 - c.knockResist : 1;
    const d = Math.max(1, Math.hypot(c.x - fromX, c.y - fromY));
    c.vx += ((c.x - fromX) / d) * 130 * kb;
    c.vy += ((c.y - fromY) / d) * 130 * kb;
    if (c.hp <= 0) return this.killCreature(c, false);
    return 0;
  }

  killCreature(c, wasTrapped) {
    const idx = this.creatures.indexOf(c);
    if (idx < 0) return 0;
    this.creatures.splice(idx, 1);
    if (c.trappedIn) {
      const arr = c.trappedIn.trapped;
      const ti = arr.indexOf(c);
      if (ti >= 0) arr.splice(ti, 1);
      c.trappedIn = null;
    }
    this.stats.kills += 1;
    this.combo = Math.min(8, this.combo + 0.12);
    this.comboTimer = 2.5;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const gained = Math.round(c.score * this.combo * this.difficulty.scoreMult);
    this.score += gained;
    this.addText(c.x, c.y - 10, `+${gained}`, '#fff3d6', c.isBoss ? 24 : 14);
    this.dropPickups(c);
    this.burst(c.x, c.y, c.color, c.isBoss ? 42 : 9, c.isBoss ? 260 : 150);
    if (c.splits && !wasTrapped) {
      for (let i = 0; i < 2; i++) {
        const m = this.spawnCreature('mite');
        m.x = c.x + range(this.rng, -16, 16);
        m.y = c.y + range(this.rng, -16, 16);
      }
    }
    if (c.isBoss) this.onBossDown(c);
    return 1;
  }

  onBossDown(c) {
    this.boss = null;
    if (c.kind === 'caramel') this.defeatedBrute = true;
    this.gainCrystals(c.crystals, c.x, c.y);
    this.pendingRelic = true;
    this.setAnnounce(`${c.name} SHATTERED!`);
    this.shake = 12;
    this.emit({ type: 'bossdown' });
  }

  // ---- choices between waves ----------------------------------------------
  rollUpgradeChoices() {
    const pool = UPGRADES.filter(u => this.up(u.id) < u.max);
    const choices = [];
    const copy = [...pool];
    while (choices.length < 3 && copy.length) {
      const i = Math.floor(this.rng() * copy.length);
      choices.push(copy.splice(i, 1)[0]);
    }
    return choices;
  }

  randomRelic() {
    const pool = RELICS.filter(r => !this.relics.includes(r.id));
    if (!pool.length) return null;
    return pick(this.rng, pool);
  }

  applyUpgrade(id) {
    this.upgrades[id] = this.up(id) + 1;
    if (id === 'apron') this.player.hp = Math.min(this.maxHp, this.player.hp + 25);
    if (id === 'bricks') this.heat = Math.min(this.maxHeat, this.heat + 25);
    if (id === 'lungs') this.player.breath = this.maxBreath;
  }

  chooseIntermission(upgradeId, roadId) {
    if (upgradeId) this.applyUpgrade(upgradeId);
    const road = ROADS.find(r => r.id === roadId) || ROADS[1];
    this.roadChoice = road;
    this.stats.roadsTaken.push(road.id);
    if (this.pendingRelic) {
      const relic = this.randomRelic();
      if (relic) {
        this.relics.push(relic.id);
        this.setAnnounce(`RELIC · ${relic.name}`);
      }
      this.pendingRelic = false;
    }
    this.state = 'playing';
    this.beginWave(this.waveIndex + 1, road);
    this.emit({ type: 'state', state: 'playing' });
  }

  // ---- run end ---------------------------------------------------------------
  endRun(won) {
    this.state = won ? 'win' : 'over';
    const save = this.save;
    save.banked += this.stats.crystalsEarned;
    if (won) save.wins += 1;
    save.best = Math.max(save.best, this.score);
    save.lastRuns.unshift({ score: this.score, won, difficulty: this.difficulty.id });
    save.lastRuns = save.lastRuns.slice(0, 3);
    storeSave(save);
    this.feats = this.evaluateFeats(won);
    this.grade = gradeFor(this.score);
    this.emit({ type: 'state', state: this.state });
    this.emit({ type: won ? 'victory' : 'defeat' });
  }

  evaluateFeats(won) {
    const s = this.stats;
    const got = {
      king: won && this.waveIndex >= 8,
      brute: s.kills > 0 && this.defeatedBrute === true,
      heat: won && this.heat >= this.maxHeat / 2,
      health: won && this.player.hp >= this.maxHp / 2,
      chain5: s.bestChain >= 5,
      trap4: this.bestTrap >= 4,
      combo5: s.bestCombo >= 5,
      allsyrup: s.syrupsShattered.size >= 4,
    };
    return FEATS.map(f => ({ ...f, done: !!got[f.id] }));
  }

  buyWorkshop(id) {
    const item = WORKSHOP.find(w => w.id === id);
    if (!item) return false;
    const rank = this.shop(id);
    if (rank >= item.max) return false;
    const discount = 1 - this.shop('w_haggle') * 0.15;
    const price = Math.round(item.prices[rank] * (id === 'w_haggle' ? 1 : discount));
    if (this.save.banked < price) return false;
    this.save.banked -= price;
    this.save.workshop[id] = rank + 1;
    if (id === 'w_cola') this.unlockedSyrups = 4;
    storeSave(this.save);
    this.emit({ type: 'buy' });
    return true;
  }

  workshopPrice(item) {
    const rank = this.shop(item.id);
    if (rank >= item.max) return null;
    const discount = 1 - this.shop('w_haggle') * 0.15;
    return Math.round(item.prices[rank] * (item.id === 'w_haggle' ? 1 : discount));
  }

  // ---- per-frame update ------------------------------------------------------
  update(dt, input) {
    this.time += dt;
    if (this.announceT > 0) this.announceT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    this.updateFx(dt);
    if (this.state === 'title') {
      // ambient drift for the title screen's live demo window
      for (const c of this.creatures) {
        if (c.trappedIn) continue;
        c.wobble += dt * 2;
        const a = Math.atan2(c.y - CAULDRON.y, c.x - CAULDRON.x) + dt * 0.25;
        const d = Math.hypot(c.x - CAULDRON.x, c.y - CAULDRON.y);
        c.x = CAULDRON.x + Math.cos(a) * d;
        c.y = CAULDRON.y + Math.sin(a) * d * 0.82;
      }
      for (const b of this.bubbles) b.wobble += dt * 2;
      return;
    }
    if (this.state !== 'playing' || this.paused) return;
    this.stats.time += dt;
    const p = this.player;

    // combo decay
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = Math.max(1, this.combo - dt * 0.9);

    // --- player movement & dash
    let mx = input.moveX || 0, my = input.moveY || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.aim = Math.atan2((input.aimY ?? p.y) - p.y, (input.aimX ?? p.x) - p.x);
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (input.dash && p.dashCd <= 0 && p.dashTime <= 0) {
      p.dashTime = 0.16;
      p.dashCd = this.dashCooldown;
      p.invuln = Math.max(p.invuln, 0.28);
      this.emit({ type: 'dash' });
    }
    let speed = this.moveSpeed;
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      speed *= 2.7;
      if (ml < 0.1) { mx = Math.cos(p.aim); my = Math.sin(p.aim); }
    }
    p.x = Math.min(ARENA.x + ARENA.w - 16, Math.max(ARENA.x + 16, p.x + mx * speed * dt));
    p.y = Math.min(ARENA.y + ARENA.h - 16, Math.max(ARENA.y + 16, p.y + my * speed * dt));

    // --- syrup select
    if (input.syrup !== undefined && input.syrup >= 0 && input.syrup < this.unlockedSyrups) {
      this.syrupIndex = input.syrup;
    }

    // --- blowing
    const tipX = p.x + Math.cos(p.aim) * 48;
    const tipY = p.y + Math.sin(p.aim) * 48;
    if (input.blow && p.breath > 0 && !p.dead) {
      if (!this.growing) {
        this.growing = this.bubbleAt(tipX, tipY);
        this.bubbles.push(this.growing);
      }
      const b = this.growing;
      b.x = Math.min(ARENA.x + ARENA.w - b.r, Math.max(ARENA.x + b.r, tipX));
      b.y = Math.min(ARENA.y + ARENA.h - b.r, Math.max(ARENA.y + b.r, tipY));
      b.syrup = SYRUPS[this.syrupIndex].id;
      b.r = Math.min(this.bubbleMaxR, b.r + this.bubbleGrow * dt);
      p.breath = Math.max(0, p.breath - 24 * dt);
      if (Math.random() < dt * 8) this.emit({ type: 'blow' });
      if (p.breath <= 0) this.releaseBubble();
    } else {
      if (this.growing) this.releaseBubble();
      const regen = 13 * (this.hasRelic('bellows') ? 1.5 : 1);
      p.breath = Math.min(this.maxBreath, p.breath + regen * dt);
    }

    // --- shatter (edge flag)
    if (input.shatter) {
      input.shatter = false;
      this.shatterAll();
    }

    this.updateBubbles(dt);
    this.updateSpawning(dt);
    this.updateCreatures(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);

    // --- heat: drain, ember heart, defeat checks
    let drain = 0.5 * (this.hasRelic('stone') ? 0.7 : 1);
    if (this.up('ember')) drain -= this.up('ember') * 0.22;
    this.heat = Math.min(this.maxHeat, this.heat - drain * dt);
    if (this.heat <= 0) { this.heat = 0; this.endRun(false); return; }
    if (p.hp <= 0) { p.hp = 0; p.dead = true; this.endRun(false); return; }

    // --- wave clear
    const bossPending = this.waveDef.boss && !this.bossSpawned;
    if (!this.spawnQueue.length && !this.creatures.length && !bossPending) {
      this.onWaveCleared();
    }
  }

  updateFx(dt) {
    for (const t of this.texts) { t.t += dt; t.y -= 34 * dt; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const pt of this.particles) {
      pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
    }
    this.particles = this.particles.filter(pt => pt.t < pt.life);
  }

  updateBubbles(dt) {
    for (const b of [...this.bubbles]) {
      if (b.state !== 'set') continue;
      b.life -= dt;
      b.wobble += dt * 2;
      // trapped creatures ride inside, arranged on a small ring
      b.trapped.forEach((c, i) => {
        const a = b.wobble * 0.7 + (i / Math.max(1, b.trapped.length)) * Math.PI * 2;
        const rr = b.trapped.length > 1 ? b.r * 0.42 : 0;
        c.x = b.x + Math.cos(a) * rr;
        c.y = b.y + Math.sin(a) * rr;
      });
      if (b.life <= 0) this.expireBubble(b);
    }
    // trapping: free creatures that wander into a set bubble get caught
    for (const c of this.creatures) {
      if (!c.trappedIn && c.hp > 0) this.tryTrap(c);
    }
  }

  expireBubble(b) {
    const idx = this.bubbles.indexOf(b);
    if (idx < 0) return;
    this.bubbles.splice(idx, 1);
    for (const c of b.trapped) {
      c.trappedIn = null;
      c.slowed = b.syrup === 'berry' ? 3 : 0;
      const a = this.rng() * Math.PI * 2;
      c.vx = Math.cos(a) * 90; c.vy = Math.sin(a) * 90;
    }
    b.trapped = [];
    this.burst(b.x, b.y, '#ffffff', 5, 70);
    this.emit({ type: 'pop' });
  }

  updateSpawning(dt) {
    this.waveTime += dt;
    const def = this.waveDef;
    if (def.boss && !this.bossSpawned && this.waveTime > 1.4) {
      this.bossSpawned = true;
      this.spawnBoss(def.boss);
    }
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.85;
        const n = Math.min(this.spawnQueue.length, 1 + Math.floor(this.rng() * 3));
        for (let i = 0; i < n; i++) this.spawnCreature(this.spawnQueue.shift());
      }
    } else if (def.boss && this.boss) {
      this.trickleTimer -= dt;
      if (this.trickleTimer <= 0 && def.trickle) {
        this.trickleTimer = 6.5;
        for (const [kind, count] of def.trickle) {
          for (let i = 0; i < count; i++) this.spawnCreature(kind);
        }
      }
    }
  }

  updateCreatures(dt) {
    const p = this.player;
    for (const c of [...this.creatures]) {
      if (c.trappedIn) continue;
      if (c.frozen > 0) { c.frozen -= dt; continue; }
      if (c.slowed > 0) c.slowed -= dt;
      const slow = c.slowed > 0 ? 0.45 : 1;
      c.wobble += dt * 3;
      let tx = CAULDRON.x, ty = CAULDRON.y, speed = c.speed * slow;
      const dCauldron = Math.hypot(c.x - CAULDRON.x, c.y - CAULDRON.y);
      const leeching = c.behaviour === 'cauldron' && dCauldron < CAULDRON.r + c.r + 8;

      if (c.isBoss) this.updateBoss(c, dt);
      else if (c.behaviour === 'hunter') { tx = p.x; ty = p.y; }
      else if (c.behaviour === 'spitter') {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < 200) { tx = c.x + (c.x - p.x); ty = c.y + (c.y - p.y); }
        else if (d > 280) { tx = p.x; ty = p.y; }
        else { tx = c.x + Math.cos(c.wobble * 0.6) * 30; ty = c.y + Math.sin(c.wobble * 0.6) * 30; }
        c.fireT -= dt;
        if (c.fireT <= 0 && d < 330) {
          c.fireT = 2.4;
          const a = Math.atan2(p.y - c.y, p.x - c.x);
          this.projectiles.push({ x: c.x, y: c.y, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, r: 6, dmg: c.dmg || 10, color: '#b26bff', t: 0 });
          this.emit({ type: 'spit' });
        }
      } else if (c.behaviour === 'charger') {
        c.stateT -= dt;
        if (c.state === 'roam' && c.stateT <= 0 && Math.hypot(c.x - p.x, c.y - p.y) < 330) {
          c.state = 'aim'; c.stateT = 0.55;
        } else if (c.state === 'aim') {
          speed = 12;
          tx = p.x; ty = p.y;
          if (c.stateT <= 0) {
            c.state = 'rush'; c.stateT = 0.55;
            const a = Math.atan2(p.y - c.y, p.x - c.x);
            c.vx = Math.cos(a) * 305; c.vy = Math.sin(a) * 305;
          }
        } else if (c.state === 'rush') {
          if (c.stateT <= 0) { c.state = 'tired'; c.stateT = 0.8; }
        } else if (c.state === 'tired') {
          speed = 8;
          if (c.stateT <= 0) { c.state = 'roam'; c.stateT = range(this.rng, 0.8, 1.6); }
        }
      }

      if (leeching) {
        this.heat -= (c.leech || 1) * dt;
        if (this.hasRelic('coals')) this.damageCreature(c, 1.4 * dt, CAULDRON.x, CAULDRON.y);
        c.vx *= 0.8; c.vy *= 0.8;
      } else if (c.state !== 'rush') {
        const d = Math.max(1, Math.hypot(tx - c.x, ty - c.y));
        c.vx += ((tx - c.x) / d * speed - c.vx) * Math.min(1, dt * 3.2);
        c.vy += ((ty - c.y) / d * speed - c.vy) * Math.min(1, dt * 3.2);
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.x = Math.min(ARENA.x + ARENA.w - c.r, Math.max(ARENA.x + c.r, c.x));
      c.y = Math.min(ARENA.y + ARENA.h - c.r, Math.max(ARENA.y + c.r, c.y));

      // touch damage from hunters / chargers / bosses
      if ((c.behaviour === 'hunter' || c.behaviour === 'charger' || c.isBoss) && p.invuln <= 0) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < c.r + 15) {
          p.hp -= c.dmg || 10;
          p.invuln = 0.7;
          this.shake = Math.max(this.shake, 5);
          this.burst(p.x, p.y, '#ff5d5d', 8, 130);
          this.emit({ type: 'hurt' });
        }
      }
    }
    // gentle separation so stacks stay readable
    const list = this.creatures;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.trappedIn || b.trappedIn) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = a.r + b.r;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push * 0.4; a.y -= uy * push * 0.4;
          b.x += ux * push * 0.4; b.y += uy * push * 0.4;
        }
      }
    }
  }

  updateBoss(c, dt) {
    const frac = c.hp / c.maxHp;
    const phase = Math.min(c.phases, 1 + (frac < 0.66 ? 1 : 0) + (frac < 0.33 ? 1 : 0));
    if (phase !== c.phase) {
      c.phase = phase;
      this.setAnnounce(`${c.name} · PHASE ${phase}/${c.phases}`);
      this.emit({ type: 'boss' });
      const minions = c.kind === 'caramel' ? ['mite', 'mite', 'sourling'] : ['wisp', 'fizzbat', 'mite'];
      for (const m of minions) {
        const s = this.spawnCreature(m);
        s.x = c.x + range(this.rng, -60, 60);
        s.y = c.y + range(this.rng, -40, 60);
      }
    }
    if (c.kind === 'caramel') {
      c.fireT -= dt;
      if (c.fireT <= 0 && c.phase >= 2) {
        c.fireT = 3.4;
        const s = this.spawnCreature('mite');
        s.x = c.x; s.y = c.y + c.r;
      }
    }
    if (c.kind === 'bitterking' && c.phase >= 2) {
      c.fireT -= dt;
      if (c.fireT <= 0) {
        c.fireT = 3.1;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + this.time;
          this.projectiles.push({ x: c.x, y: c.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 6, dmg: 12, color: '#c6ff6b', t: 0 });
        }
        this.emit({ type: 'nova' });
      }
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (const pr of [...this.projectiles]) {
      pr.t += dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      let dead = pr.t > 4 || pr.x < ARENA.x || pr.x > ARENA.x + ARENA.w || pr.y < ARENA.y || pr.y > ARENA.y + ARENA.h;
      if (!dead && p.invuln <= 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 14) {
        p.hp -= pr.dmg;
        p.invuln = 0.7;
        this.shake = Math.max(this.shake, 5);
        this.burst(p.x, p.y, pr.color, 7, 120);
        this.emit({ type: 'hurt' });
        dead = true;
      }
      if (dead) this.projectiles.splice(this.projectiles.indexOf(pr), 1);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of [...this.pickups]) {
      pk.t += dt;
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      pk.vx *= 0.9; pk.vy *= 0.9;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (this.hasRelic('ribbon') && d < 190) {
        pk.vx += ((p.x - pk.x) / Math.max(1, d)) * 620 * dt;
        pk.vy += ((p.y - pk.y) / Math.max(1, d)) * 620 * dt;
      }
      if (d < 26) {
        this.crystals += 1;
        this.stats.crystalsEarned += 1;
        this.pickups.splice(this.pickups.indexOf(pk), 1);
        this.emit({ type: 'pickup' });
      } else if (pk.t > 25) {
        this.pickups.splice(this.pickups.indexOf(pk), 1);
      }
    }
  }

  onWaveCleared() {
    // sweep remaining pickups into the purse, clear the field
    if (this.pickups.length) {
      this.crystals += this.pickups.length;
      this.stats.crystalsEarned += this.pickups.length;
      this.pickups = [];
    }
    this.bubbles = [];
    this.growing = null;
    this.projectiles = [];
    this.emit({ type: 'waveclear' });
    const isLast = this.waveIndex >= WAVES.length - 1;
    if (isLast && !this.endless) {
      this.endRun(true);
      return;
    }
    if (this.waveDef.boss || (this.roadChoice && this.roadChoice.id === 'surge')) this.pendingRelic = true;
    this.intermission = { upgrades: this.rollUpgradeChoices(), roads: ROADS };
    this.state = 'intermission';
    this.emit({ type: 'state', state: 'intermission' });
  }
}
