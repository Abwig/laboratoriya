// Молекулы пара в сосуде. Два режима:
//  'emergent' — испарение с постоянной скоростью, поглощение при ударе о воду
//               (равновесие возникает само, как в реальном опыте);
//  'target'   — число молекул следует за значением из физической модели,
//               лишние молекулы превращаются в капли.
(function () {
  class Vapor {
    constructor(o) {
      this.region = o.region;            // {x, y, w, h} — область газа
      this.mode = o.mode || 'target';
      this.liquid = o.liquid !== false;  // есть ли вода снизу
      this.open = false;                 // открыт ли верх
      this.temp = o.temp ?? 20;
      this.emitRate = o.emitRate ?? 20;  // молекул/с (режим emergent)
      this.target = o.target ?? 0;
      this.color = o.color || '#9fe3ff';
      this.mols = [];
      this.drops = [];
      this.events = { out: [], back: [], gone: [] };
      this.acc = 0;
      this.time = 0;
      for (let i = 0; i < (o.initial || 0); i++) this.spawn(false);
    }
    speed() { return 70 * Math.sqrt((this.temp + 273) / 293); }
    spawn(fromSurface) {
      const r = this.region, s = this.speed();
      const a = fromSurface ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
      const v = s * (0.5 + Math.random());
      this.mols.push({
        x: r.x + 4 + Math.random() * (r.w - 8),
        y: fromSurface ? r.y + r.h - 3 : r.y + 4 + Math.random() * (r.h - 8),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, fresh: fromSurface ? 0.35 : 0
      });
    }
    condenseOne() {
      if (!this.mols.length) return;
      const m = this.mols.splice(Math.floor(Math.random() * this.mols.length), 1)[0];
      this.drops.push({ x: m.x, y: m.y, vy: 0, r: 2 + Math.random() * 1.5, life: 1 });
    }
    rate(kind, win = 2) {
      const arr = this.events[kind], t0 = this.time - win;
      while (arr.length && arr[0] < t0) arr.shift();
      return arr.length / Math.min(win, Math.max(this.time, 0.001));
    }
    step(dt) {
      this.time += dt;
      const r = this.region, sp = this.speed();
      if (this.mode === 'emergent' && this.liquid) {
        this.acc += this.emitRate * dt;
        while (this.acc >= 1) { this.acc -= 1; this.spawn(true); this.events.out.push(this.time); }
      } else if (this.mode === 'target') {
        const diff = Math.round(this.target) - this.mols.length;
        const k = Math.min(Math.abs(diff), Math.ceil(Math.abs(diff) * dt * 4) + (Math.random() < 0.5 ? 1 : 0));
        for (let i = 0; i < k; i++) diff > 0 ? this.spawn(this.liquid) : this.condenseOne();
      }
      for (let i = this.mols.length - 1; i >= 0; i--) {
        const m = this.mols[i];
        // скорость подстраивается под температуру
        const v = Math.hypot(m.vx, m.vy) || 1;
        const want = sp * (0.6 + 0.8 * ((i * 7919) % 100) / 100);
        const nv = v + (want - v) * Math.min(1, dt * 2);
        m.vx *= nv / v; m.vy *= nv / v;
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.fresh > 0) m.fresh -= dt;
        if (m.x < r.x + 2) { m.x = r.x + 2; m.vx = Math.abs(m.vx); }
        if (m.x > r.x + r.w - 2) { m.x = r.x + r.w - 2; m.vx = -Math.abs(m.vx); }
        if (m.y < r.y + 2) {
          if (this.open) { this.mols.splice(i, 1); this.events.gone.push(this.time); continue; }
          m.y = r.y + 2; m.vy = Math.abs(m.vy);
        }
        if (m.y > r.y + r.h - 2) {
          if (this.liquid && this.mode === 'emergent' && m.fresh <= 0) {
            this.mols.splice(i, 1); this.events.back.push(this.time); continue;
          }
          m.y = r.y + r.h - 2; m.vy = -Math.abs(m.vy);
        }
      }
      // капли конденсата падают на дно и сливаются с водой
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.vy += 260 * dt; d.y += d.vy * dt;
        if (d.y > r.y + r.h - 1) { d.y = r.y + r.h - 1; d.life -= dt * 2.5; }
        if (d.life <= 0) this.drops.splice(i, 1);
      }
    }
    draw(ctx) {
      ctx.save();
      for (const m of this.mols) {
        ctx.fillStyle = m.fresh > 0 ? '#ffffff' : this.color;
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      for (const d of this.drops) {
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.fillStyle = '#4fb6e8';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.8, d.r, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Пузырьки кипения / пузырьки воздуха в жидкости.
  class Bubbles {
    constructor(region) { this.region = region; this.list = []; this.rate = 0; this.acc = 0; }
    step(dt) {
      const r = this.region;
      this.acc += this.rate * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        this.list.push({ x: r.x + 6 + Math.random() * (r.w - 12), y: r.y + r.h - 3, r: 1.5 + Math.random() * 2, vy: 0 });
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const b = this.list[i];
        b.vy -= 160 * dt; b.y += b.vy * dt; b.r += dt * 4; b.x += Math.sin(b.y * 0.15) * 0.4;
        if (b.y < r.y + 2) this.list.splice(i, 1);
      }
    }
    draw(ctx) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2;
      for (const b of this.list) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
  }

  window.Particles = { Vapor, Bubbles };
})();
