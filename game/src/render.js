// Canvas renderer: draws the arena scene inside the HUD frame. DOM panels
// (index.html + ui.js) carry the text HUD; this module paints only the world:
// brick floor per realm, the melt cauldron, bubbles, creatures, the smith,
// projectiles, pickups, particles and floating score text.

import { ARENA, CAULDRON, SYRUPS } from './config.js';

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(engine) {
    const ctx = this.ctx;
    const t = engine.time;
    ctx.save();
    if (engine.state === 'title') {
      // centre the cauldron in the title screen's live-demo window
      ctx.translate(311, -200);
    }
    if (engine.shake > 0) {
      ctx.translate((Math.random() - 0.5) * engine.shake, (Math.random() - 0.5) * engine.shake);
    }
    this.drawFloor(engine, t);
    this.drawCauldron(engine, t);
    this.drawPickups(engine, t);
    // free creatures first, then bubbles over them, then trapped creatures
    // are already positioned inside bubbles by the engine
    for (const c of engine.creatures) if (!c.trappedIn) this.drawCreature(engine, c, t);
    for (const b of engine.bubbles) this.drawBubble(engine, b, t);
    for (const c of engine.creatures) if (c.trappedIn) this.drawCreature(engine, c, t);
    for (const b of engine.bubbles) this.drawBubbleShine(engine, b, t);
    this.drawProjectiles(engine);
    if (engine.state !== 'title') this.drawPlayer(engine, t);
    this.drawParticles(engine);
    this.drawTexts(engine);
    ctx.restore();
    // soft vignette over the arena
    const grad = ctx.createRadialGradient(640, 352, 320, 640, 352, 760);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);
  }

  drawFloor(engine, t) {
    const ctx = this.ctx;
    const realm = engine.realm();
    ctx.fillStyle = '#17100c';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = realm.floor;
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    // brick courses
    ctx.strokeStyle = realm.line;
    ctx.lineWidth = 2;
    const bh = 34, bw = 62;
    for (let row = 0, y = ARENA.y; y < ARENA.y + ARENA.h; row++, y += bh) {
      ctx.beginPath();
      ctx.moveTo(ARENA.x, y);
      ctx.lineTo(ARENA.x + ARENA.w, y);
      ctx.stroke();
      const off = row % 2 ? bw / 2 : 0;
      for (let x = ARENA.x + off; x < ARENA.x + ARENA.w; x += bw) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + bh, ARENA.y + ARENA.h));
        ctx.stroke();
      }
    }
    // cauldron glow wash
    const heatFrac = engine.maxHeat ? engine.heat / engine.maxHeat : 0.5;
    const glow = ctx.createRadialGradient(CAULDRON.x, CAULDRON.y, 10, CAULDRON.x, CAULDRON.y, 300);
    glow.addColorStop(0, realm.glow + (0.30 + heatFrac * 0.25) + ')');
    glow.addColorStop(1, realm.glow + '0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    // frame
    ctx.strokeStyle = '#c98a3d';
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.x - 2, ARENA.y - 2, ARENA.w + 4, ARENA.h + 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ARENA.x + 3, ARENA.y + 3, ARENA.w - 6, ARENA.h - 6);
    void t;
  }

  drawCauldron(engine, t) {
    const ctx = this.ctx;
    const { x, y, r } = CAULDRON;
    const heatFrac = Math.max(0, engine.heat / engine.maxHeat);
    // pot body
    ctx.fillStyle = '#241a14';
    circle(ctx, x, y, r + 8);
    ctx.fillStyle = '#3a2a1e';
    circle(ctx, x, y, r + 3);
    // molten surface: a fixed warm candy palette; heat drives the glow and
    // the flicker, not the hue, so the melt reads molten in every realm
    const flicker = 0.85 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13.7) * 0.05;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,224,138,1)');
    grad.addColorStop(0.55, 'rgba(255,158,44,0.97)');
    grad.addColorStop(1, 'rgba(168,58,10,0.92)');
    ctx.fillStyle = grad;
    circle(ctx, x, y, r * flicker);
    // swirling candy strands
    ctx.strokeStyle = 'rgba(255,230,160,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = t * (0.7 + i * 0.23) + i * 2.1;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.35 + i * 0.18), a, a + 1.5);
      ctx.stroke();
    }
    // rim ticks
    ctx.fillStyle = '#120c08';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillRect(x + Math.cos(a) * (r + 5) - 2, y + Math.sin(a) * (r + 5) - 2, 4, 4);
    }
  }

  drawPickups(engine, t) {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffe066';
    for (const pk of engine.pickups) {
      const s = 5 + Math.sin(t * 6 + pk.x) * 1.2;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  drawBubble(engine, b, t) {
    const ctx = this.ctx;
    const syrup = SYRUPS.find(s => s.id === b.syrup) || SYRUPS[0];
    const blink = b.state === 'set' && b.life < 2.5 ? (Math.sin(t * 14) > 0 ? 0.55 : 1) : 1;
    ctx.globalAlpha = 0.34 * blink;
    ctx.fillStyle = syrup.tint + '0.9)';
    circle(ctx, b.x, b.y, b.r);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = syrup.color;
    ctx.lineWidth = b.state === 'growing' ? 2 : 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    if (b.trapped.length) {
      ctx.fillStyle = 'rgba(10,10,14,0.72)';
      const label = `COATED ${b.trapped.length}`;
      ctx.font = '700 10px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 10;
      ctx.fillRect(b.x - w / 2, b.y + b.r + 4, w, 14);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.fillText(label, b.x, b.y + b.r + 15);
    }
  }

  drawBubbleShine(engine, b, t) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.78, -2.4 + Math.sin(t + b.wobble) * 0.08, -1.7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    circle(ctx, b.x - b.r * 0.38, b.y - b.r * 0.42, Math.max(1.6, b.r * 0.07));
  }

  drawCreature(engine, c, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.frozen > 0) ctx.globalAlpha = 0.85;
    const bob = Math.sin(t * 5 + c.wobble) * 1.6;
    ctx.translate(0, bob * 0.4);
    switch (c.kind) {
      case 'mite': {
        ctx.fillStyle = c.color;
        circle(ctx, 0, 0, c.r);
        ctx.strokeStyle = '#7a6a1c';
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i * 5, c.r - 2); ctx.lineTo(i * 6, c.r + 4); ctx.stroke();
        }
        this.eyes(ctx, -3, -2, 3, -2, 1.6);
        break;
      }
      case 'fizzbat': {
        const flap = Math.sin(t * 18 + c.wobble) * 6;
        ctx.fillStyle = '#3f7fbf';
        ctx.beginPath();
        ctx.moveTo(-c.r, 0); ctx.lineTo(-c.r - 12, -8 - flap); ctx.lineTo(-c.r - 3, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c.r, 0); ctx.lineTo(c.r + 12, -8 - flap); ctx.lineTo(c.r + 3, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.color;
        circle(ctx, 0, 0, c.r);
        this.eyes(ctx, -4, -2, 4, -2, 2);
        break;
      }
      case 'roller': {
        ctx.fillStyle = '#fff5f5';
        circle(ctx, 0, 0, c.r);
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, c.r * 0.62, a, a + 1.1);
          ctx.stroke();
        }
        if (c.state === 'aim') {
          ctx.strokeStyle = 'rgba(255,60,60,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, c.r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      }
      case 'lancer': {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.r * 0.8, c.r * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d9c8ff';
        ctx.lineWidth = 3;
        const a = Math.atan2(engine.player.y - c.y, engine.player.x - c.x);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * (c.r + 14), Math.sin(a) * (c.r + 14));
        ctx.stroke();
        this.eyes(ctx, -4, -4, 4, -4, 2);
        break;
      }
      case 'wisp': {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(0, -2, c.r, Math.PI, 0);
        ctx.lineTo(c.r, c.r);
        for (let i = 0; i < 3; i++) {
          ctx.lineTo(c.r - (i + 0.5) * (c.r * 2 / 3), c.r - 4 + Math.sin(t * 8 + i) * 2);
        }
        ctx.lineTo(-c.r, c.r);
        ctx.closePath(); ctx.fill();
        this.eyes(ctx, -4, -4, 4, -4, 2.2);
        break;
      }
      case 'brute': {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 2, c.r, c.r * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        circle(ctx, -c.r * 0.3, -c.r * 0.35, c.r * 0.28);
        this.eyes(ctx, -8, -4, 8, -4, 3);
        this.mouth(ctx, 0, 6, 8);
        break;
      }
      case 'golem': {
        ctx.fillStyle = c.color;
        circle(ctx, 0, 0, c.r);
        ctx.fillStyle = '#ff9f43';
        circle(ctx, -c.r * 0.45, -c.r * 0.5, c.r * 0.3);
        ctx.fillStyle = '#ff6b81';
        circle(ctx, c.r * 0.5, -c.r * 0.42, c.r * 0.24);
        ctx.fillStyle = '#7ad0ff';
        circle(ctx, c.r * 0.2, c.r * 0.5, c.r * 0.2);
        this.eyes(ctx, -7, -2, 7, -2, 2.6);
        break;
      }
      case 'tortoise': {
        // toffee shell: a domed carapace with segment arcs over a darker rim
        ctx.fillStyle = '#8a5a30';
        ctx.beginPath();
        ctx.ellipse(0, 3, c.r, c.r * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.r * 0.82, c.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,50,16,0.65)';
        ctx.lineWidth = 2;
        for (const f of [-0.45, 0, 0.45]) {
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.abs(f) * c.r + 2, c.r * 0.7, 0, -1.1, 1.1);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-c.r * 0.8, 0); ctx.lineTo(c.r * 0.8, 0);
        ctx.stroke();
        this.eyes(ctx, -7, -3, 7, -3, 2.8);
        this.mouth(ctx, 0, 5, 7);
        break;
      }
      case 'caramel': {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 4, c.r, c.r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a35b12';
        for (let i = -2; i <= 2; i++) {
          const dx = i * c.r * 0.32;
          ctx.fillRect(dx - 5, -c.r * 0.92, 10, c.r * (0.3 + (i % 2 ? 0.14 : 0)));
        }
        ctx.fillStyle = 'rgba(255,220,150,0.5)';
        circle(ctx, -c.r * 0.3, -c.r * 0.3, c.r * 0.3);
        this.eyes(ctx, -14, -6, 14, -6, 5);
        this.mouth(ctx, 0, 14, 16);
        break;
      }
      case 'bitterking': {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 0.4;
          const rr = i % 2 ? c.r * 0.82 : c.r * 1.08;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5da23f';
        circle(ctx, 0, 0, c.r * 0.62);
        ctx.fillStyle = '#ffd23f';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 18 - 7, -c.r - 2);
          ctx.lineTo(i * 18, -c.r - 18);
          ctx.lineTo(i * 18 + 7, -c.r - 2);
          ctx.closePath(); ctx.fill();
        }
        this.eyes(ctx, -13, -6, 13, -6, 4.6);
        this.mouth(ctx, 0, 12, 14);
        break;
      }
      default: { // sourling
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.r, c.r * 0.92, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        circle(ctx, -c.r * 0.3, -c.r * 0.4, c.r * 0.25);
        this.eyes(ctx, -5, -3, 5, -3, 2.2);
        // zigzag sour mouth
        ctx.strokeStyle = '#2d4a12';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-6, 5);
        ctx.lineTo(-3, 2); ctx.lineTo(0, 5); ctx.lineTo(3, 2); ctx.lineTo(6, 5);
        ctx.stroke();
      }
    }
    // hp arc for tough creatures and bosses
    if ((c.maxHp >= 10 || c.isBoss) && c.hp < c.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-c.r, -c.r - 12, c.r * 2, 5);
      ctx.fillStyle = c.isBoss ? '#ff5d5d' : '#ffd23f';
      ctx.fillRect(-c.r, -c.r - 12, c.r * 2 * Math.max(0, c.hp / c.maxHp), 5);
    }
    if (c.frozen > 0) {
      ctx.fillStyle = 'rgba(160,230,255,0.4)';
      circle(ctx, 0, 0, c.r + 3);
      ctx.strokeStyle = 'rgba(220,250,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r + 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  eyes(ctx, x1, y1, x2, y2, r) {
    ctx.fillStyle = '#10131a';
    circle(ctx, x1, y1, r);
    circle(ctx, x2, y2, r);
  }

  mouth(ctx, x, y, w) {
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, w / 2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  drawPlayer(engine, t) {
    const ctx = this.ctx;
    const p = engine.player;
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && p.dashTime <= 0) ctx.globalAlpha = 0.55 + Math.sin(t * 30) * 0.2;
    // dash trail
    if (p.dashTime > 0) {
      ctx.fillStyle = 'rgba(255,200,120,0.3)';
      circle(ctx, -Math.cos(p.aim) * 14, -Math.sin(p.aim) * 14, 13);
    }
    // apron body
    ctx.fillStyle = '#7a4a21';
    circle(ctx, 0, 2, 15);
    ctx.fillStyle = '#f2e3c6';
    ctx.fillRect(-9, -2, 18, 13);
    // head
    ctx.fillStyle = '#e8b08a';
    circle(ctx, 0, -9, 8.5);
    // cap
    ctx.fillStyle = '#fff7ea';
    ctx.beginPath();
    ctx.arc(0, -12, 8.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8.5, -13, 17, 3.4);
    // pipe toward aim
    const a = p.aim;
    ctx.strokeStyle = '#4a2f18';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8 - 4);
    ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46 - 4);
    ctx.stroke();
    ctx.fillStyle = '#c98a3d';
    circle(ctx, Math.cos(a) * 46, Math.sin(a) * 46 - 4, 4.5);
    ctx.restore();
    // "YOU" tag like the reference HUD
    ctx.fillStyle = 'rgba(10,10,14,0.72)';
    ctx.font = '700 9px system-ui, sans-serif';
    const w = ctx.measureText('YOU').width + 8;
    ctx.fillRect(p.x - w / 2, p.y - 40, w, 12);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', p.x, p.y - 30.5);
  }

  drawProjectiles(engine) {
    const ctx = this.ctx;
    for (const pr of engine.projectiles) {
      ctx.fillStyle = pr.color;
      circle(ctx, pr.x, pr.y, pr.r);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      circle(ctx, pr.x - 1.5, pr.y - 1.5, pr.r * 0.4);
    }
  }

  drawParticles(engine) {
    const ctx = this.ctx;
    for (const pt of engine.particles) {
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.r / 2, pt.y - pt.r / 2, pt.r, pt.r);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(engine) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const t of engine.texts) {
      ctx.globalAlpha = 1 - (t.t / t.life) * 0.8;
      ctx.font = `800 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
