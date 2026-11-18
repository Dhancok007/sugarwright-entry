// Boot, input, the frame loop, and wiring between engine, renderer, UI and
// sound. Also handles ?shot= staging for the judge screenshots.

import { Engine } from './engine.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { stageShot, stageAmbient } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const engine = new Engine(seed);
const renderer = new Renderer(canvas);
const sound = new Sound();

const input = {
  moveX: 0, moveY: 0, aimX: 640, aimY: 300,
  blow: false, shatter: false, dash: false, syrup: -1,
};
const keys = new Set();

const ui = new UI({
  onPlay: diff => { sound.ensure(); engine.startRun(diff); },
  onAgain: () => { sound.ensure(); engine.startRun(engine.difficulty.id); },
  onEndless: () => { sound.ensure(); engine.startRun(engine.difficulty.id, true); },
  onTitle: () => toTitle(),
  onBuyWorkshop: id => { const ok = engine.buyWorkshop(id); if (ok) sound.uiClick(); return ok; },
  onIntermission: (upId, roadId) => { sound.uiClick(); engine.chooseIntermission(upId, roadId); },
  onSyrup: i => { input.syrup = i; },
  onResume: () => { engine.paused = false; },
  onQuit: () => toTitle(),
  onUiClick: () => sound.uiClick(),
});

function toTitle() {
  engine.state = 'title';
  engine.paused = false;
  stageAmbient(engine);
  ui.refreshTitle(engine);
  ui.showScreen(engine);
}

// ---------- stage scaling ----------
function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  document.getElementById('stage').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

// ---------- pointer ----------
function toStage(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (1280 / rect.width),
    y: (evt.clientY - rect.top) * (720 / rect.height),
  };
}
canvas.addEventListener('pointermove', evt => {
  const p = toStage(evt);
  input.aimX = p.x; input.aimY = p.y;
});
canvas.addEventListener('pointerdown', evt => {
  sound.ensure();
  if (engine.state !== 'playing' || engine.paused) return;
  if (evt.button === 0) input.blow = true;
  if (evt.button === 2) input.shatter = true;
});
window.addEventListener('pointerup', evt => {
  if (evt.button === 0) input.blow = false;
});
canvas.addEventListener('contextmenu', evt => evt.preventDefault());

// ---------- keyboard ----------
window.addEventListener('keydown', evt => {
  if (evt.repeat) return;
  keys.add(evt.code);
  sound.ensure();
  if (engine.state === 'playing') {
    if (evt.code === 'Space') { input.dash = true; evt.preventDefault(); }
    if (evt.code === 'KeyK') input.shatter = true;
    if (evt.code === 'KeyJ') input.blow = true;
    if (evt.code === 'KeyP' || evt.code === 'Escape') engine.paused = !engine.paused;
    if (evt.code === 'KeyM') sound.muted = !sound.muted;
    if (evt.code.startsWith('Digit')) {
      const n = Number(evt.code.slice(5));
      if (n >= 1 && n <= 4) input.syrup = n - 1;
    }
  } else if (engine.state === 'title') {
    if (evt.code.startsWith('Digit')) {
      const n = Number(evt.code.slice(5));
      if (n >= 1 && n <= 3) ui.selectDifficultyByIndex(n - 1);
    }
    if (evt.code === 'Enter') ui.h.onPlay(ui.selDiff);
  } else if (engine.state === 'intermission') {
    if (evt.code.startsWith('Digit')) {
      const n = Number(evt.code.slice(5));
      if (n >= 1 && n <= 3) ui.selectUpgrade(n - 1, engine);
    }
    if (evt.code === 'KeyQ') ui.selectRoad(0, engine);
    if (evt.code === 'KeyW') ui.selectRoad(1, engine);
    if (evt.code === 'KeyE') ui.selectRoad(2, engine);
    if (evt.code === 'Enter') ui.confirmIntermission();
  } else if (engine.state === 'over' || engine.state === 'win') {
    if (evt.code === 'KeyR') ui.h.onAgain();
    if (evt.code === 'KeyT') toTitle();
  }
});
window.addEventListener('keyup', evt => {
  keys.delete(evt.code);
  if (evt.code === 'KeyJ') input.blow = false;
});

function pollAxes() {
  const l = keys.has('KeyA') || keys.has('ArrowLeft');
  const r = keys.has('KeyD') || keys.has('ArrowRight');
  const u = keys.has('KeyW') || keys.has('ArrowUp');
  const d = keys.has('KeyS') || keys.has('ArrowDown');
  input.moveX = (r ? 1 : 0) - (l ? 1 : 0);
  input.moveY = (d ? 1 : 0) - (u ? 1 : 0);
}

// ---------- engine events -> sound + screens ----------
function drainEvents() {
  for (const ev of engine.events) {
    switch (ev.type) {
      case 'blow': sound.blow(); break;
      case 'trap': sound.trap(); break;
      case 'pop': sound.pop(); break;
      case 'shatter': sound.shatter(ev.chain); break;
      case 'freeze': sound.freeze(); break;
      case 'boom': sound.boom(); break;
      case 'hurt': sound.hurt(); break;
      case 'dash': sound.dash(); break;
      case 'pickup': sound.pickup(); break;
      case 'waveclear': sound.waveClear(); break;
      case 'boss': sound.bossRoar(); break;
      case 'victory': sound.victory(); break;
      case 'defeat': sound.defeat(); break;
      case 'state':
        ui.showScreen(engine);
        if (ev.state === 'intermission') ui.buildIntermission(engine);
        if (ev.state === 'over' || ev.state === 'win') ui.buildEnd(engine);
        if (ev.state === 'title') ui.refreshTitle(engine);
        break;
    }
  }
  engine.events.length = 0;
}

// ---------- boot ----------
stageAmbient(engine);
ui.refreshTitle(engine);
ui.showScreen(engine);

if (shotName) {
  stageShot(engine, ui, shotName);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

// ---------- frame loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pollAxes();
  engine.update(dt, input);
  input.dash = false;
  if (input.syrup >= 0) input.syrup = -1;
  drainEvents();
  renderer.draw(engine);
  if (engine.state === 'playing' || engine.state === 'intermission') ui.refreshHUD(engine);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
