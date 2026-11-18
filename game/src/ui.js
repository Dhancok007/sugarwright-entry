// DOM layer: HUD refresh plus the three full screens (title, intermission,
// end). The canvas paints the world; everything textual lives here. All
// element ids match game/index.html.

import {
  SYRUPS, CREATURES, BOSSES, WAVES, ROADS, UPGRADES, RELICS, WORKSHOP,
  DIFFICULTIES, REALMS,
} from './config.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.cache = new Map();
    this.selDiff = 'journeyman';
    this.selUpgrade = 0;
    this.selRoad = 0;
    this.inter = null;
    this.buildStatic();
  }

  set(id, key, value) {
    const cacheKey = id + '|' + key;
    if (this.cache.get(cacheKey) === value) return;
    this.cache.set(cacheKey, value);
    const el = $(id);
    if (!el) return;
    if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'width') el.style.width = value;
    else if (key === 'class') el.className = value;
  }

  show(id, visible) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !visible);
  }

  // ---------- static construction ----------
  buildStatic() {
    // difficulty buttons
    const row = $('diff-row');
    row.innerHTML = '';
    for (const d of DIFFICULTIES) {
      const b = document.createElement('div');
      b.className = 'diff-btn' + (d.id === this.selDiff ? ' sel' : '');
      b.innerHTML = `<div class="dn">${d.name}</div><div class="dm">score x${d.scoreMult} · sour x${d.enemyMult}</div>`;
      b.addEventListener('click', () => {
        this.selDiff = d.id;
        row.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        this.h.onUiClick();
      });
      row.appendChild(b);
    }
    $('btn-play').addEventListener('click', () => this.h.onPlay(this.selDiff));
    $('btn-continue').addEventListener('click', () => this.confirmIntermission());
    $('btn-again').addEventListener('click', () => this.h.onAgain());
    $('btn-title2').addEventListener('click', () => this.h.onTitle());
    $('btn-endless').addEventListener('click', () => this.h.onEndless());
    $('btn-resume').addEventListener('click', () => this.h.onResume());
    $('btn-quit').addEventListener('click', () => this.h.onQuit());
  }

  selectDifficultyByIndex(i) {
    const d = DIFFICULTIES[i];
    if (!d) return;
    this.selDiff = d.id;
    $('diff-row').querySelectorAll('.diff-btn').forEach((x, j) => x.classList.toggle('sel', j === i));
  }

  // ---------- title ----------
  refreshTitle(engine) {
    const save = engine.save;
    this.set('ws-banked', 'text', fmt(save.banked));
    this.set('t-best-score', 'text', fmt(save.best));
    const runs = save.lastRuns.length
      ? save.lastRuns.map(r => `<div><span class="g">${r.won ? 'S' : '·'}</span>${fmt(r.score)}&nbsp;&nbsp;${r.won ? 'WON' : 'LOST'} · ${r.difficulty.toUpperCase()}</div>`).join('')
      : '<div style="color:#8a7658">No runs yet. The melt is lit and waiting.</div>';
    this.set('t-last-runs', 'html', runs);
    // workshop cards
    const grid = $('ws-grid');
    grid.innerHTML = '';
    for (const item of WORKSHOP) {
      const rank = engine.shop(item.id);
      const price = engine.workshopPrice(item);
      const card = document.createElement('div');
      card.className = 'ws-card';
      const pips = '●'.repeat(rank) + '○'.repeat(item.max - rank);
      const priceHtml = price === null
        ? '<div class="wp max">MAX</div>'
        : `<div class="wp buy">BUY ◆${fmt(price)}</div>`;
      card.innerHTML = `<div class="wi"><span class="wic">${item.icon}</span><span class="wn">${item.name}</span></div>` +
        `<div class="wd">${item.desc}</div><div class="wp pips">${pips}</div>${priceHtml}`;
      card.addEventListener('click', () => { if (this.h.onBuyWorkshop(item.id)) this.refreshTitle(engine); });
      grid.appendChild(card);
    }
    this.set('demo-cap', 'text', `REALM 1 OF 3 — ${REALMS[0].name} · LIVE DEMO`);
  }

  // ---------- HUD ----------
  roadNodesHtml(engine, withLabels) {
    let html = '';
    for (let i = 0; i < WAVES.length; i++) {
      const def = WAVES[i];
      const cls = ['road-node'];
      if (i < engine.waveIndex) cls.push('done');
      if (i === engine.waveIndex) cls.push('now');
      if (def.boss) cls.push('boss');
      const icon = def.boss ? '♛' : (i + 1);
      html += `<div class="${cls.join(' ')}" title="Wave ${i + 1}: ${def.name}">${icon}</div>`;
      if (i < WAVES.length - 1) html += `<div class="road-link${i < engine.waveIndex ? ' done' : ''}"></div>`;
      void withLabels;
    }
    return html;
  }

  refreshHUD(engine) {
    const p = engine.player;
    const realm = engine.realm();
    this.set('hl-realm', 'text', `REALM ${engine.realmIndex() + 1} OF 3 — ${realm.name}`);
    const endlessTag = engine.endless && engine.waveIndex >= WAVES.length ? ' · ENDLESS' : '';
    this.set('hl-wave', 'text', `WAVE ${engine.waveIndex + 1}/${WAVES.length}${endlessTag} · ${engine.waveDef.name}`);
    // boss / wave progress bar
    if (engine.boss) {
      const b = engine.boss;
      this.set('hl-boss-name', 'text', `${b.name} · PHASE ${b.phase}/${b.phases}`);
      this.set('hl-boss-fill', 'width', `${Math.max(0, (b.hp / b.maxHp) * 100)}%`);
      this.set('hl-boss-num', 'text', `${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`);
      this.set('ht-boss', 'text', `BOSS ${Math.max(0, Math.ceil((b.hp / b.maxHp) * 100))}%`);
    } else {
      const total = Object.values(engine.incoming || {}).reduce((a, n) => a + n, 0) || 1;
      const remain = engine.spawnQueue.length + engine.creatures.length;
      this.set('hl-boss-name', 'text', engine.waveDef.boss ? `${BOSSES[engine.waveDef.boss].name} STIRS…` : 'FIELD PROGRESS');
      this.set('hl-boss-fill', 'width', `${Math.min(100, ((total - remain) / total) * 100)}%`);
      this.set('hl-boss-num', 'text', `${Math.max(0, total - remain)} / ${total}`);
      const nextBoss = WAVES.findIndex((w, i) => w.boss && i >= engine.waveIndex);
      this.set('ht-boss', 'text', nextBoss >= 0 ? `BOSS · WAVE ${nextBoss + 1}` : 'BOSS —');
    }
    this.set('hl-heat-num', 'text', `${Math.max(0, Math.ceil(engine.heat))} / ${engine.maxHeat}`);
    this.set('hl-heat-fill', 'width', `${Math.max(0, (engine.heat / engine.maxHeat) * 100)}%`);
    const inc = Object.entries(engine.incoming || {}).map(([kind, n]) => {
      const c = CREATURES[kind] || BOSSES[kind];
      return `<span class="inc-dot" style="background:${c ? c.color : '#fff'}"></span>x${n}`;
    }).join('');
    this.set('hl-incoming-list', 'html', inc);
    this.set('ht-road', 'html', this.roadNodesHtml(engine));
    // right column
    this.set('hr-best', 'text', fmt(Math.max(engine.save.best, engine.score)));
    this.set('hr-score', 'text', fmt(engine.score));
    this.set('hr-combo', 'text', `x${engine.combo.toFixed(2)}`);
    this.set('hr-crystals', 'text', fmt(engine.crystals));
    const upList = UPGRADES.filter(u => engine.up(u.id) > 0);
    this.set('hr-up-count', 'text', `${upList.reduce((a, u) => a + engine.up(u.id), 0)}/${UPGRADES.length}`);
    this.set('hr-up-list', 'html', upList.length
      ? upList.map(u => `<div class="hr-item"><span class="hr-ico">${u.icon}</span>${u.name}<span class="hr-pips">${'●'.repeat(engine.up(u.id))}${'○'.repeat(u.max - engine.up(u.id))}</span></div>`).join('')
      : '<div class="hr-none">None yet — clear a wave.</div>');
    this.set('hr-relic-count', 'text', `${engine.relics.length}/${RELICS.length}`);
    this.set('hr-relic-list', 'html', engine.relics.length
      ? engine.relics.map(id => { const r = RELICS.find(x => x.id === id); return `<div class="hr-item"><span class="hr-ico relic">${r.icon}</span>${r.name}</div>`; }).join('')
      : '<div class="hr-none">None yet — take a SOUR SURGE road.</div>');
    // bottom-left bars
    this.set('hb-hp-num', 'text', `${Math.max(0, Math.ceil(p.hp))} / ${engine.maxHp}`);
    this.set('hb-hp-fill', 'width', `${Math.max(0, (p.hp / engine.maxHp) * 100)}%`);
    this.set('hb-breath-num', 'text', `${Math.ceil(p.breath)} / ${engine.maxBreath}`);
    this.set('hb-breath-fill', 'width', `${Math.max(0, (p.breath / engine.maxBreath) * 100)}%`);
    // syrup chips
    const chips = SYRUPS.map((s, i) => {
      const locked = i >= engine.unlockedSyrups;
      return `<span class="chip syrup${i === engine.syrupIndex ? ' sel' : ''}${locked ? ' locked' : ''}" data-syrup="${i}"><b>${s.key}</b><span class="dot" style="background:${s.color}"></span>${s.name}</span>`;
    }).join('');
    if (this.cache.get('syrup-chips') !== chips) {
      this.cache.set('syrup-chips', chips);
      const wrap = $('syrup-chips');
      wrap.innerHTML = chips;
      wrap.querySelectorAll('.chip.syrup').forEach(chip => {
        chip.addEventListener('click', () => this.h.onSyrup(Number(chip.dataset.syrup)));
      });
    }
    // announce banner
    const showAnnounce = engine.announceT > 0 && engine.announce;
    this.show('announce', !!showAnnounce);
    if (showAnnounce) this.set('announce', 'text', engine.announce);
    this.show('pause-overlay', engine.paused && engine.state === 'playing');
  }

  // ---------- intermission ----------
  buildIntermission(engine) {
    const fresh = this.inter !== engine.intermission;
    this.inter = engine.intermission;
    if (fresh) { this.selUpgrade = 0; this.selRoad = 0; }
    this.set('inter-title', 'text', `WAVE ${engine.waveIndex + 1}/${WAVES.length} CLEARED`);
    const upWrap = $('inter-upgrades');
    upWrap.innerHTML = '';
    this.inter.upgrades.forEach((u, i) => {
      const rank = engine.up(u.id);
      const card = document.createElement('div');
      card.className = 'up-card' + (i === this.selUpgrade ? ' sel' : '');
      card.innerHTML = `<span class="key">${i + 1}</span>${i === this.selUpgrade ? '<span class="chosen">CHOSEN</span>' : ''}` +
        `<div class="uic">${u.icon}</div><div class="un">${u.name}</div><div class="ud">${u.desc}</div>` +
        `<div class="up"><span class="pips">${'●'.repeat(rank)}${'○'.repeat(u.max - rank)}</span><br><span class="new">${rank ? `RANK ${rank + 1}` : 'NEW'}</span></div>`;
      card.addEventListener('click', () => this.selectUpgrade(i, engine));
      upWrap.appendChild(card);
    });
    const roadWrap = $('inter-roads');
    roadWrap.innerHTML = '';
    ROADS.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'road-row' + (i === this.selRoad ? ' sel' : '');
      const icon = r.id === 'surge' ? '★' : r.id === 'cache' ? '◆' : '✕';
      const iconColor = r.id === 'surge' ? '#ffd23f' : r.id === 'cache' ? '#7ad0ff' : '#f5e9d2';
      row.innerHTML = `<span class="key" style="background:#f5e9d2;color:#241304;font-weight:900;font-size:12px;border-radius:4px;padding:1px 7px">${r.key}</span>` +
        `<span class="ric" style="color:${iconColor}">${icon}</span>` +
        `<span><div class="rn">${r.name}</div><div class="rd">${r.desc}</div></span>` +
        (i === this.selRoad ? '<span class="chosen">CHOSEN</span>' : '');
      row.addEventListener('click', () => this.selectRoad(i, engine));
      roadWrap.appendChild(row);
    });
    // realm map
    const realms = $('inter-realms');
    realms.innerHTML = REALMS.map((realm, ri) => {
      let nodes = '';
      for (let i = ri * 3; i < ri * 3 + 3; i++) {
        const def = WAVES[i];
        const cls = ['road-node'];
        if (i <= engine.waveIndex) cls.push('done');
        if (i === engine.waveIndex + 1) cls.push('now');
        if (def.boss) cls.push('boss');
        nodes += `<div class="${cls.join(' ')}" title="Wave ${i + 1}: ${def.name}">${def.boss ? '♛' : i + 1}</div>`;
        if (i < ri * 3 + 2) nodes += `<div class="road-link${i <= engine.waveIndex ? ' done' : ''}"></div>`;
      }
      return `<div class="realm"><h5 style="color:${ri === engine.realmIndex() ? '#ffb03a' : '#8a7658'}">${realm.name}</h5><div class="nodes">${nodes}</div></div>`;
    }).join('');
    const next = WAVES[engine.waveIndex + 1];
    if (next) {
      const comp = next.comp.map(([k, n]) => `${CREATURES[k].name} x${n}`).join(' · ');
      const boss = next.boss ? ` · ${BOSSES[next.boss].name}` : '';
      this.set('inter-next', 'html', `NEXT <b>WAVE ${engine.waveIndex + 2}: ${next.name}</b> — ${comp}${boss}`);
    }
    const owned = UPGRADES.filter(u => engine.up(u.id) > 0).map(u => `${u.name} ${engine.up(u.id)}`).join(' · ');
    this.set('inter-owned', 'text', owned ? `OWNED: ${owned}` : 'OWNED: nothing yet');
    if (engine.pendingRelic) {
      this.set('inter-next', 'html', $('inter-next').innerHTML + ' <span style="color:#b07fe8">· A RELIC WAITS — pick to claim it</span>');
    }
  }

  selectUpgrade(i, engine) {
    this.selUpgrade = i;
    this.buildIntermissionKeep(engine);
  }

  selectRoad(i, engine) {
    this.selRoad = i;
    this.buildIntermissionKeep(engine);
  }

  buildIntermissionKeep(engine) {
    const up = this.selUpgrade, road = this.selRoad;
    this.buildIntermission(engine);
    this.selUpgrade = up; this.selRoad = road;
    // re-mark selections without a full rebuild loop
    $('inter-upgrades').querySelectorAll('.up-card').forEach((c, j) => c.classList.toggle('sel', j === up));
    $('inter-roads').querySelectorAll('.road-row').forEach((c, j) => c.classList.toggle('sel', j === road));
  }

  confirmIntermission() {
    if (!this.inter) return;
    const up = this.inter.upgrades[this.selUpgrade];
    const road = ROADS[this.selRoad];
    this.inter = null;
    this.h.onIntermission(up ? up.id : null, road.id);
  }

  // ---------- end screen ----------
  buildEnd(engine) {
    const won = engine.state === 'win';
    const s = engine.stats;
    $('end-title').textContent = won ? 'VICTORY' : 'THE MELT WENT COLD';
    $('end-title').className = won ? '' : 'lost';
    const bosses = (engine.defeatedBrute ? 1 : 0) + (won ? 1 : 0);
    this.set('end-sub', 'text', `${engine.realmIndex() + 1} REALMS · ${bosses} BOSSES · ${engine.relics.length} RELICS · +${fmt(s.crystalsEarned)} CRYSTALS`);
    this.set('end-grade', 'text', engine.grade);
    this.set('end-score', 'text', fmt(engine.score));
    const diffName = engine.difficulty.name;
    this.set('end-detail', 'text', `${diffName} · ${won ? 'KING BITTER CRACKED' : `FELL ON WAVE ${engine.waveIndex + 1}`} · FOUND THIS RUN: RELICS ${engine.relics.length}/${RELICS.length} · UPGRADES ${UPGRADES.reduce((a, u) => a + engine.up(u.id), 0)}/${UPGRADES.length} · ROADS: ${s.roadsTaken.map(r => r.toUpperCase()).join(', ') || '—'}`);
    const mins = Math.floor(s.time / 60);
    const secs = Math.floor(s.time % 60).toString().padStart(2, '0');
    const stats = [
      ['KILLS', fmt(s.kills)], ['COATED', fmt(s.trapped)], ['CRACKS', fmt(s.shatters)],
      ['BEST CHAIN', `x${s.bestChain}`], ['BEST COMBO', `x${s.bestCombo.toFixed(2)}`], ['TIME', `${mins}:${secs}`],
    ];
    this.set('end-stats', 'html', stats.map(([l, v]) => `<div class="stat-box"><div class="sl">${l}</div><div class="sv">${v}</div></div>`).join(''));
    this.set('end-earned', 'html', `◆ +${fmt(s.crystalsEarned)} <small>BANKED ◆ ${fmt(engine.save.banked)}</small>`);
    this.set('end-realm', 'html', `${engine.realmIndex() + 1}/3 <small>${engine.realm().name}</small>`);
    this.set('end-relics', 'text', `${engine.relics.length}`);
    this.set('end-roads', 'html', s.roadsTaken.map(r => {
      const road = ROADS.find(x => x.id === r);
      const icon = road.id === 'surge' ? '★' : road.id === 'cache' ? '◆' : '✕';
      return `<span style="color:${road.id === 'surge' ? '#ffd23f' : road.id === 'cache' ? '#7ad0ff' : '#f5e9d2'}">${icon}</span>`;
    }).join(' '));
    const done = engine.feats.filter(f => f.done).length;
    this.set('end-feats-title', 'text', `FEATS ${done}/8`);
    this.set('end-feats-list', 'html', engine.feats.map(f =>
      `<div class="feat ${f.done ? 'done' : 'miss'}"><span class="box">${f.done ? '✓' : ''}</span>${f.name}</div>`).join(''));
    const runs = engine.save.lastRuns.map(r => `<div><span class="g">${r.won ? 'S' : '·'}</span>${fmt(r.score)}&nbsp;&nbsp;${r.won ? 'WON' : 'LOST'} · ${r.difficulty.toUpperCase()}</div>`).join('');
    this.set('end-lastruns-list', 'html', runs);
    this.show('btn-endless', won && engine.shop('w_endless') > 0 && !engine.endless);
  }

  // ---------- screen switching ----------
  showScreen(engine) {
    this.show('screen-title', engine.state === 'title');
    this.show('screen-inter', engine.state === 'intermission');
    this.show('screen-end', engine.state === 'over' || engine.state === 'win');
    this.show('hud', engine.state === 'playing' || engine.state === 'intermission');
  }
}
