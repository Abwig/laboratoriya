// Отрисовка лаборатории и приборов на canvas. Логический размер сцены 800×520.
(function () {
  const W = 800, H = 520, BENCH = 430;
  const C = {
    wall: '#1d3639', tile: '#24423f', grout: '#16292b',
    benchTop: '#c99a63', benchEdge: '#a77a48', benchFront: '#7d5232',
    glass: 'rgba(214,238,250,0.16)', glassEdge: 'rgba(232,246,252,0.85)',
    water: 'rgba(58,160,216,0.55)', waterTop: 'rgba(150,215,245,0.9)',
    metal: '#b9c4c9', metalDark: '#6c7a80', ink: '#e9f3f2', dim: '#9db6b4',
    accent: '#ffb347', red: '#ff6b5a'
  };

  const IMG = {};
  const SRC = {
    beaker: 'assets/beaker.svg', lamp: 'assets/alcohol-lamp.svg',
    flask: 'assets/flask-blue.svg', decor: 'assets/flask-decor.svg', thermo: 'assets/thermometer.svg'
  };
  function loadImages() {
    return Promise.all(Object.entries(SRC).map(([k, src]) => new Promise(res => {
      const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src;
    })));
  }
  function img(ctx, k, x, y, w, h) { if (IMG[k]) ctx.drawImage(IMG[k], x, y, w, h); }

  function background(ctx) {
    // стена из кафеля
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, W, BENCH);
    const s = 40;
    for (let y = 0; y < BENCH; y += s) for (let x = ((y / s) % 2) * (s / 2) - s; x < W; x += s) {
      ctx.fillStyle = C.tile; ctx.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
    }
    // полка с посудой
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(28, 96, 210, 8);
    ctx.fillStyle = '#8d6440'; ctx.fillRect(24, 88, 218, 9);
    img(ctx, 'decor', 30, 30, 62, 62);
    img(ctx, 'flask', 100, 42, 34, 46);
    img(ctx, 'decor', 146, 46, 42, 42);
    img(ctx, 'beaker', 196, 54, 26, 35);
    // настенный термометр
    img(ctx, 'thermo', 748, 40, 26, 120);
    // стол
    ctx.fillStyle = C.benchTop; ctx.fillRect(0, BENCH, W, 14);
    ctx.fillStyle = C.benchEdge; ctx.fillRect(0, BENCH + 14, W, 4);
    ctx.fillStyle = C.benchFront; ctx.fillRect(0, BENCH + 18, W, H - BENCH - 18);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 180) { ctx.beginPath(); ctx.moveTo(x, BENCH + 30); ctx.lineTo(x, H); ctx.stroke(); }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function plate(ctx, x, y, text, color) {
    ctx.save(); ctx.font = '600 12px "JetBrains Mono", monospace';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(10,24,26,.82)'; roundRect(ctx, x - w / 2, y - 11, w, 22, 5); ctx.fill();
    ctx.fillStyle = color || C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  // Стрелочный прибор: манометр/вакуумметр.
  function gauge(ctx, x, y, r, val, max, unit, label, mark) {
    ctx.save();
    ctx.fillStyle = C.metalDark; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f7f6'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = v => a0 + (a1 - a0) * Math.max(0, Math.min(1, v / max));
    if (mark != null) { // отметка давления насыщенного пара
      ctx.strokeStyle = 'rgba(255,107,90,.55)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, r - 6, ang(mark) - 0.04, ang(mark) + 0.04); ctx.stroke();
    }
    ctx.strokeStyle = '#2b3a40'; ctx.fillStyle = '#2b3a40';
    ctx.font = `${Math.round(r * 0.2)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps;
      ctx.lineWidth = i % 2 ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
      ctx.lineTo(x + Math.cos(a) * (r - (i % 2 ? 8 : 12)), y + Math.sin(a) * (r - (i % 2 ? 8 : 12))); ctx.stroke();
      if (i % 2 === 0) {
        const v = max * i / steps;
        ctx.fillText(v >= 10 ? Math.round(v) : String(+v.toFixed(1)).replace(".", ","), x + Math.cos(a) * (r - 22), y + Math.sin(a) * (r - 22));
      }
    }
    ctx.font = `600 ${Math.round(r * 0.18)}px "JetBrains Mono", monospace`;
    ctx.fillText(unit, x, y + r * 0.42);
    ctx.strokeStyle = C.red; ctx.lineWidth = 2.5;
    const a = ang(val);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10)); ctx.stroke();
    ctx.fillStyle = '#2b3a40'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (label) plate(ctx, x, y + r + 20, label);
  }

  // Жидкостный термометр с собственной шкалой.
  function thermo(ctx, x, y, h, t, tmin, tmax, step) {
    ctx.save();
    ctx.fillStyle = 'rgba(240,248,250,.9)'; roundRect(ctx, x - 7, y, 14, h, 7); ctx.fill();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x, y + h + 4, 10, 0, Math.PI * 2); ctx.fill();
    const k = Math.max(0, Math.min(1, (t - tmin) / (tmax - tmin)));
    const top = y + h - 6 - k * (h - 14);
    ctx.fillRect(x - 3, top, 6, y + h - top + 2);
    ctx.strokeStyle = '#33434a'; ctx.fillStyle = '#e9f3f2'; ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    step = step || 10;
    for (let v = tmin; v <= tmax + 0.001; v += step) {
      const yy = y + h - 6 - (v - tmin) / (tmax - tmin) * (h - 14);
      ctx.strokeStyle = '#33434a'; ctx.beginPath(); ctx.moveTo(x + 2, yy); ctx.lineTo(x + 7, yy); ctx.stroke();
      ctx.fillText(Math.round(v), x + 11, yy);
    }
    ctx.restore();
  }

  function flame(ctx, x, y, size, time) {
    if (size <= 0.02) return;
    ctx.save();
    const h = 18 + 62 * size, w = 7 + 11 * size;
    const flick = Math.sin(time * 23) * 2 + Math.sin(time * 37) * 1.5;
    const g = ctx.createLinearGradient(x, y - h, x, y);
    g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(0.35, 'rgba(255,170,60,.85)'); g.addColorStop(1, 'rgba(120,170,255,.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y - h - flick);
    ctx.quadraticCurveTo(x + w, y - h * 0.35, x, y); ctx.quadraticCurveTo(x - w, y - h * 0.35, x, y - h - flick); ctx.fill();
    ctx.restore();
  }

  // Подсветка перетаскиваемого элемента
  function grip(ctx, x, y, active, time) {
    ctx.save();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.globalAlpha = active ? 1 : 0.45 + 0.35 * Math.sin(time * 4);
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  window.Scene = { W, H, BENCH, C, IMG, loadImages, img, background, roundRect, plate, gauge, thermo, flame, grip };
})();
