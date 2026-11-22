// Пять опытов лаборатории. Каждый раунд описывает сцену, приборы, управление и задания.
(function () {
  const { p0, tSat } = Physics;
  const { Vapor, Bubbles } = Particles;
  const S = Scene, C = Scene.C, BENCH = Scene.BENCH;
  const fmt = (v, d = 1) => Number(v).toFixed(d).replace('.', ',');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const near = (x, y, px, py, r) => Math.hypot(x - px, y - py) <= r;

  // Внутренние границы стакана из спрайта beaker.svg
  function beakerBox(bx, by, w, h) {
    // стакан нарисован в перспективе: дно и поверхность воды — эллипсы
    return { l: bx + w * 0.115, r: bx + w * 0.855, top: by + h * 0.2, bottom: by + h * 0.83, ry: h * 0.12, rimY: by + h * 0.085 };
  }
  function water(ctx, l, r, level, bottom, ry) {
    ry = ry ?? 6;
    const cx = (l + r) / 2, rx = (r - l) / 2;
    ctx.save();
    ctx.fillStyle = C.water;
    ctx.beginPath(); ctx.moveTo(l, level); ctx.lineTo(l, bottom);
    ctx.ellipse(cx, bottom, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(r, level); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.waterTop; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.ellipse(cx, level, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ─────────────────────────────── 1. Динамическое равновесие
  const R1 = {
    title: 'Динамическое равновесие',
    goal: 'В стакане с водой при 40 °C молекулы всё время вылетают из воды и возвращаются обратно. Перетащите стекло на стакан или нажмите кнопку и проследите, как меняются счётчики.',
    theory: `<p>С поверхности жидкости постоянно вылетают самые быстрые молекулы — это <b>испарение</b>. Часть молекул пара, ударяясь о поверхность, возвращается в жидкость — это <b>конденсация</b>.</p>
      <p>В открытом сосуде пар уносится, и испарение преобладает. В закрытом сосуде концентрация пара растёт, пока число молекул, возвращающихся в жидкость за секунду, не сравняется с числом вылетающих. Это <b>динамическое равновесие</b>.</p>
      <p><b>Насыщенный пар</b> — пар, находящийся в динамическом равновесии со своей жидкостью. Пар, концентрация которого меньше, — <b>ненасыщенный</b>.</p>`,
    setup() {
      const w = 200, h = w / 0.7475, bx = 300, by = BENCH - h + 3;
      const b = beakerBox(bx, by, w, h);
      const level = by + h * 0.55;
      this.s = {
        bx, by, w, h, b, level, closed: false, closedAt: 0, time: 0,
        lid: { x: 610, y: BENCH - 5 }, drag: false,
        vapor: new Vapor({ region: { x: b.l + 3, y: b.top + 4, w: b.r - b.l - 6, h: level - b.top - 4 }, mode: 'emergent', emitRate: 24, temp: 40, initial: 18 })
      };
      this.s.vapor.open = true;
    },
    lidHome() { const s = this.s; return { x: s.b.l + (s.b.r - s.b.l) / 2, y: s.b.rimY - 4 }; },
    setClosed(c) {
      const s = this.s; s.closed = c; s.vapor.open = !c;
      if (c) { s.closedAt = s.time; Object.assign(s.lid, this.lidHome()); } else { s.lid.x = 610; s.lid.y = BENCH - 5; }
      this.btn && (this.btn.textContent = c ? 'Снять стекло' : 'Накрыть стеклом');
    },
    controls(ui) { this.btn = ui.button('Накрыть стеклом', () => this.setClosed(!this.s.closed)); },
    update(dt) { this.s.time += dt; this.s.vapor.step(dt); },
    draw(ctx, t) {
      const s = this.s, b = s.b;
      water(ctx, b.l, b.r, s.level, b.bottom, b.ry);
      s.vapor.draw(ctx);
      S.img(ctx, 'beaker', s.bx, s.by, s.w, s.h);
      // стеклянная пластинка
      ctx.save(); ctx.fillStyle = 'rgba(200,235,250,.45)'; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 1.5;
      S.roundRect(ctx, s.lid.x - 115, s.lid.y - 5, 230, 9, 3); ctx.fill(); ctx.stroke(); ctx.restore();
      if (!s.closed && !s.drag) S.grip(ctx, s.lid.x, s.lid.y, false, t);
      S.plate(ctx, s.bx + s.w * 0.45, BENCH + 40, 't = 40 °C');
      const v = s.vapor;
      S.plate(ctx, 640, 190, `вылетает ${fmt(v.rate('out', 3), 0)} /с`, '#ffd28a');
      S.plate(ctx, 640, 222, `возвращается ${fmt(v.rate('back', 3), 0)} /с`, '#9fe3ff');
      if (!s.closed) S.plate(ctx, 640, 254, `улетает ${fmt(v.rate('gone', 3), 0)} /с`, '#ff9c8f');
    },
    readings() {
      const v = this.s.vapor;
      return [['Вылетает из воды', fmt(v.rate('out', 3), 0) + ' мол/с'], ['Возвращается в воду', fmt(v.rate('back', 3), 0) + ' мол/с'],
        ['Молекул в паре', v.mols.length], ['Стакан', this.s.closed ? 'закрыт' : 'открыт']];
    },
    hit(x, y) { return near(x, y, this.s.lid.x, this.s.lid.y, 40) || (Math.abs(x - this.s.lid.x) < 115 && Math.abs(y - this.s.lid.y) < 14); },
    drag(x, y) { const s = this.s; if (!s.drag) { s.drag = true; if (s.closed) { s.closed = false; s.vapor.open = true; this.btn.textContent = 'Накрыть стеклом'; } } s.lid.x = clamp(x, 120, 680); s.lid.y = clamp(y, 40, BENCH - 5); },
    release() {
      const s = this.s; s.drag = false; const home = this.lidHome();
      if (near(s.lid.x, s.lid.y, home.x, home.y, 80)) this.setClosed(true); else { s.lid.y = BENCH - 5; }
    },
    tasks: [
      {
        type: 'action', prompt: 'Накройте стакан и дождитесь, когда пар станет насыщенным. Нажмите кнопку, когда сравняются числа вылетающих и возвращающихся молекул.',
        button: 'Пар насыщен!', hint: 'Пока стакан открыт, молекулы улетают и равновесия нет. Накройте его и подождите 10–15 секунд.',
        check(r) {
          const s = r.s, v = s.vapor;
          if (!s.closed) return [false, 'Стакан открыт: молекулы пара улетают, равновесие не наступит.'];
          const out = v.rate('out', 3), back = v.rate('back', 3);
          if (s.time - s.closedAt < 6 || back < out * 0.8) return [false, 'Ещё рано: в воду возвращается заметно меньше молекул, чем вылетает. Подождите.'];
          return [true, 'Верно. Сколько молекул вылетает, столько и возвращается — пар насыщенный.'];
        }
      },
      {
        type: 'mcq', prompt: 'Какой пар называют насыщенным?', hint: 'Вспомните, какие два процесса вы видели и как соотносились их скорости.',
        options: ['Пар, находящийся в динамическом равновесии со своей жидкостью', 'Пар, в котором молекулы перестали двигаться', 'Пар при температуре кипения', 'Пар, из которого больше не вылетают молекулы'], correct: 0,
        explain: 'Равновесие динамическое: и испарение, и конденсация продолжаются, но с одинаковой скоростью.'
      },
      {
        type: 'mcq', prompt: 'Снимите стекло и понаблюдайте. Каким станет пар над водой?', hint: 'Сравните «вылетает» и «возвращается» при открытом стакане.',
        options: ['Ненасыщенным: вылетает больше молекул, чем возвращается', 'Останется насыщенным', 'Пар исчезнет полностью'], correct: 0,
        explain: 'Пар уходит из стакана, его концентрация падает, и испарение преобладает над конденсацией.'
      }
    ]
  };

  // ─────────────────────────────── 2. Сжатие пара поршнем
  const R2 = {
    title: 'Сжатие пара поршнем',
    goal: 'В цилиндре под поршнем — только водяной пар при 20 °C, без воды. Опускайте поршень (тяните за ручку или двигайте ползунок) и следите за манометром и графиком p(V).',
    theory: `<p>Ненасыщенный пар ведёт себя почти как идеальный газ: при изотермическом сжатии его давление растёт по закону Бойля — Мариотта, <i>pV = const</i>.</p>
      <p>Когда давление достигает <b>p₀</b> — давления насыщенного пара при данной температуре, — пар становится насыщенным. При дальнейшем сжатии часть пара конденсируется, а давление остаётся равным p₀: оно <b>не зависит от объёма</b>, только от температуры.</p>
      <p>При 20 °C p₀ = 2,34 кПа.</p>`,
    V0: 100, n: 0.4 * p0(20),
    setup() {
      const x = 320, w = 150, bottom = BENCH - 18, top = 120;
      this.s = { x, w, bottom, top, V: 100, drag: false, trace: [], time: 0,
        vapor: new Vapor({ region: { x: x + 4, y: top, w: w - 8, h: bottom - top }, mode: 'target', liquid: false, temp: 20, initial: 84 }) };
      this.s.vapor.target = 84;
    },
    pistonY() { const s = this.s; return s.bottom - (s.bottom - s.top) * s.V / 100; },
    state() { return Physics.vessel({ n: this.n, V: this.s.V, V0: this.V0, t: 20 }); },
    setV(v) { this.s.V = clamp(v, 20, 100); this.slider && this.slider.set(this.s.V); },
    controls(ui) {
      this.slider = ui.slider({ id: 'r2-volume', label: 'Объём V', unit: 'см³', min: 20, max: 100, step: 1, value: 100, onInput: v => this.setV(v) });
    },
    update(dt) {
      const s = this.s, st = this.state();
      const py = this.pistonY(), puddle = 2 + st.liquidFrac * 22;
      s.vapor.region.y = py + 12; s.vapor.region.h = Math.max(10, s.bottom - puddle - py - 12);
      s.vapor.liquid = st.saturated;
      s.vapor.target = 90 * st.p * s.V / 100;
      s.vapor.step(dt);
      const last = s.trace[s.trace.length - 1];
      if (!last || Math.abs(last[0] - s.V) >= 0.5) s.trace.push([s.V, st.p]);
    },
    draw(ctx, t) {
      const s = this.s, st = this.state(), py = this.pistonY();
      const puddle = st.liquidFrac > 0 ? 2 + st.liquidFrac * 22 : 0;
      // подставка
      ctx.fillStyle = C.metalDark; ctx.fillRect(s.x - 20, s.bottom, s.w + 40, 18);
      if (puddle) water(ctx, s.x + 3, s.x + s.w - 3, s.bottom - puddle, s.bottom - 4, 4);
      s.vapor.draw(ctx);
      // стенки цилиндра
      ctx.save(); ctx.fillStyle = C.glass; ctx.fillRect(s.x, s.top - 30, s.w, s.bottom - s.top + 30);
      ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x, s.top - 30); ctx.lineTo(s.x, s.bottom); ctx.moveTo(s.x + s.w, s.top - 30); ctx.lineTo(s.x + s.w, s.bottom); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(232,246,252,.5)'; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = C.dim; ctx.textAlign = 'right';
      for (let v = 20; v <= 100; v += 10) {
        const yy = s.bottom - (s.bottom - s.top) * v / 100;
        ctx.beginPath(); ctx.moveTo(s.x, yy); ctx.lineTo(s.x + (v % 20 ? 8 : 14), yy); ctx.stroke();
        if (v % 20 === 0) ctx.fillText(v, s.x - 6, yy + 3);
      }
      // поршень и шток
      const g = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0); g.addColorStop(0, '#7e8b91'); g.addColorStop(0.5, '#dfe6e8'); g.addColorStop(1, '#7e8b91');
      ctx.fillStyle = g; ctx.fillRect(s.x + 2, py, s.w - 4, 12);
      ctx.fillStyle = '#9aa7ac'; ctx.fillRect(s.x + s.w / 2 - 5, py - 80, 10, 80);
      ctx.fillStyle = '#4a565b'; S.roundRect(ctx, s.x + s.w / 2 - 36, py - 92, 72, 14, 6); ctx.fill();
      ctx.restore();
      if (!s.drag) S.grip(ctx, s.x + s.w / 2, py - 85, false, t);
      // трубка к манометру
      ctx.strokeStyle = '#5d6b70'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(s.x + s.w, s.bottom - 10); ctx.lineTo(600, s.bottom - 10); ctx.lineTo(600, 280); ctx.stroke();
      S.gauge(ctx, 600, 210, 66, st.p, 3, 'кПа', `p = ${fmt(st.p, 2)} кПа`, p0(20));
      S.plate(ctx, s.x + s.w / 2, BENCH + 42, `V = ${fmt(s.V, 0)} см³   t = 20 °C`);
      if (st.saturated) S.plate(ctx, 600, 330, 'пар насыщенный', '#9fe3ff');
    },
    readings() {
      const st = this.state();
      return [['Объём', fmt(this.s.V, 0) + ' см³'], ['Давление пара', fmt(st.p, 2) + ' кПа'], ['Пар', st.saturated ? 'насыщенный' : 'ненасыщенный'],
        ['Влажность φ', fmt(st.p / p0(20) * 100, 0) + ' %']];
    },
    graph: {
      xr: [0, 100], yr: [0, 3], xl: 'V, см³', yl: 'p, кПа', xs: 20, ys: 0.5,
      data(r) { return { line: r.s.trace.slice().sort((a, b) => a[0] - b[0]) }; }
    },
    hit(x, y) { const s = this.s, py = this.pistonY(); return Math.abs(x - (s.x + s.w / 2)) < 50 && y > py - 110 && y < py - 60; },
    drag(x, y) { const s = this.s; s.drag = true; const py = clamp(y + 85, s.top, s.bottom); this.setV((s.bottom - py) / (s.bottom - s.top) * 100); },
    release() { this.s.drag = false; },
    tasks: [
      {
        type: 'num', prompt: 'Медленно опускайте поршень. При каком объёме пар становится насыщенным (появляются первые капли)?', unit: 'см³', answer: 40, tol: 3,
        hint: 'Капли появляются, когда стрелка манометра доходит до красной отметки p₀ = 2,34 кПа. Можно посчитать: p₁V₁ = p₀V.',
        explain: 'p₁V₁ = p₀V ⇒ V = 0,94 · 100 / 2,34 ≈ 40 см³.'
      },
      {
        type: 'mcq', prompt: 'Почему при дальнейшем сжатии давление насыщенного пара не растёт?', hint: 'Посмотрите, что происходит с молекулами и водой на дне при сжатии.',
        options: ['Лишний пар конденсируется, и концентрация молекул пара не меняется', 'Поршень перестаёт сжимать пар', 'Молекулы пара начинают двигаться медленнее', 'Давление растёт, но манометр этого не показывает'], correct: 0,
        explain: 'Давление пара определяется концентрацией и температурой. Концентрация насыщенного пара при данной температуре постоянна.'
      },
      {
        type: 'mcq', prompt: 'Как давление насыщенного пара зависит от объёма при постоянной температуре?', hint: 'Сравните участки графика до и после 40 см³.',
        options: ['Не зависит от объёма', 'Обратно пропорционально объёму, как у идеального газа', 'Прямо пропорционально объёму'], correct: 0,
        explain: 'Закон Бойля — Мариотта к насыщенному пару неприменим.'
      }
    ]
  };

  // ─────────────────────────────── 3. Нагревание: p₀(t)
  const R3 = {
    title: 'Давление пара и температура',
    goal: 'В закрытой колбе — вода и её насыщенный пар. Разожгите спиртовку, нагрейте колбу и запишите показания манометра при разных температурах.',
    theory: `<p>Давление насыщенного пара зависит только от температуры. С ростом температуры растут и средняя скорость молекул, и их <b>концентрация</b>: испаряется всё больше жидкости.</p>
      <p>Поэтому p₀ растёт гораздо быстрее, чем давление идеального газа в закрытом сосуде, для которого <i>p ~ T</i> (закон Шарля).</p>`,
    setup() {
      const fw = 170, fh = fw * 509.81 / 370.07, fx = 315, fy = 322 - fh;
      this.s = { fx, fy, fw, fh, power: 0, T: 20, rec: [], time: 0,
        vapor: new Vapor({ region: { x: fx + fw * 0.3, y: fy + fh * 0.27, w: fw * 0.4, h: fh * 0.2 }, mode: 'target', liquid: true, temp: 20, initial: 16 }),
        bubbles: new Bubbles({ x: fx + fw * 0.2, y: fy + fh * 0.52, w: fw * 0.6, h: fh * 0.42 }) };
    },
    controls(ui) {
      this.slider = ui.slider({ id: 'r3-flame', label: 'Мощность пламени (не температура)', unit: '%', min: 0, max: 100, step: 1, value: 0, onInput: v => { this.s.power = v; } });
      ui.button('Записать показания', () => {
        const s = this.s, t = Math.round(s.T), p = +p0(s.T).toFixed(2);
        if (s.rec.some(r => Math.abs(r[0] - t) < 3)) { ui.toast('Точка при этой температуре уже записана. Нагрейте колбу сильнее.'); return; }
        s.rec.push([t, p]); s.rec.sort((a, b) => a[0] - b[0]); ui.refresh();
      });
    },
    update(dt) {
      const s = this.s, target = 20 + 0.68 * s.power;
      s.T += (target - s.T) * Math.min(1, dt * 0.35);
      s.vapor.temp = s.T;
      s.vapor.target = 8 + 3.2 * p0(s.T) * 293 / (s.T + 273);
      s.vapor.step(dt);
      s.bubbles.rate = s.T > 70 ? (s.T - 70) * 0.8 : 0; s.bubbles.step(dt);
      s.time += dt;
    },
    draw(ctx, t) {
      const s = this.s;
      // треножник
      ctx.strokeStyle = '#3b464a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(322, BENCH); ctx.lineTo(348, 322); ctx.moveTo(478, BENCH); ctx.lineTo(452, 322); ctx.moveTo(336, 322); ctx.lineTo(464, 322); ctx.stroke();
      S.img(ctx, 'flask', s.fx, s.fy, s.fw, s.fh);
      s.bubbles.draw(ctx);
      s.vapor.draw(ctx);
      // пробка и трубка к манометру
      ctx.fillStyle = '#6b3f2a'; ctx.fillRect(s.fx + s.fw * 0.36, s.fy - 14, s.fw * 0.28, 22);
      ctx.strokeStyle = '#5d6b70'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(s.fx + s.fw * 0.55, s.fy - 12); ctx.lineTo(s.fx + s.fw * 0.55, s.fy - 40); ctx.lineTo(620, s.fy - 40); ctx.lineTo(620, 150); ctx.stroke();
      S.img(ctx, 'lamp', 352, 334, 96, 96);
      S.flame(ctx, 400, 352, s.power / 100, t);
      S.thermo(ctx, 230, 130, 260, s.T, 0, 100, 10);
      S.plate(ctx, 236, 425, `t = ${fmt(s.T, 1)} °C`);
      S.gauge(ctx, 620, 220, 66, p0(s.T), 60, 'кПа', `p = ${fmt(p0(s.T), 2)} кПа`);
      if (s.power === 0) S.plate(ctx, 400, 470, 'сдвиньте ползунок «Пламя»', C.accent);
    },
    readings() {
      const s = this.s;
      return [['Температура', fmt(s.T, 1) + ' °C'], ['Давление пара', fmt(p0(s.T), 2) + ' кПа'], ['Записано точек', s.rec.length]];
    },
    graph: {
      xr: [0, 100], yr: [0, 60], xl: 't, °C', yl: 'p, кПа', xs: 20, ys: 10,
      data(r, done) {
        const out = { points: r.s.rec };
        if (done && r.s.rec.length) {
          const [t1, p1] = r.s.rec[0], curve = [], charles = [];
          for (let t = 10; t <= 90; t += 2) { curve.push([t, p0(t)]); charles.push([t, p1 * (t + 273) / (t1 + 273)]); }
          out.curve = curve; out.dashed = charles;
        }
        return out;
      }
    },
    table(r) { return r.s.rec.length ? { head: ['t, °C', 'p, кПа'], rows: r.s.rec.map(([t, p]) => [t, fmt(p, 2)]) } : null; },
    tasks: [
      {
        type: 'action', prompt: 'Запишите не меньше 5 точек, чтобы температуры отличались хотя бы на 40 °C (например, от 25 до 75 °C).', button: 'Проверить таблицу',
        hint: 'Поставьте пламя на 30–40 %, подождите, запишите. Потом прибавьте огонь и повторите.',
        check(r) {
          const rec = r.s.rec;
          if (rec.length < 5) return [false, `Записано точек: ${rec.length}. Нужно хотя бы 5.`];
          if (rec[rec.length - 1][0] - rec[0][0] < 40) return [false, 'Точки слишком близко друг к другу. Нагрейте колбу сильнее.'];
          return [true, 'Готово. На графике появились кривая p₀(t) и пунктир — как росло бы давление идеального газа.'];
        }
      },
      {
        type: 'num', prompt: 'Каково давление насыщенного пара воды при 70 °C?', unit: 'кПа', answer: 31.2, tol: 1.5,
        hint: 'Смотрите на термометр, а не на проценты у ползунка: проценты — это мощность огня. Добавляйте огонь, пока термометр не покажет 70 °C, и прочитайте манометр. Или найдите t = 70 °C на кривой графика.',
        wrong(r, v) {
          const T = r.s.T;
          if (Math.abs(T - 70) > 1 && Math.abs(v - p0(T)) <= 1.5)
            return `Это давление при ${fmt(T, 1)} °C, а нужно при 70 °C. Проценты у ползунка — мощность огня, температуру показывает термометр. Прибавьте огонь.`;
        },
        explain: 'По таблице p₀(70 °C) = 31,2 кПа.'
      },
      {
        type: 'mcq', prompt: 'Почему давление насыщенного пара растёт с температурой быстрее, чем по закону Шарля?', hint: 'Подумайте, что происходит с числом молекул пара в колбе при нагреве.',
        options: ['Растёт и скорость молекул, и их концентрация: испаряется больше воды', 'Молекулы пара становятся тяжелее', 'Объём колбы уменьшается при нагревании', 'Манометр завышает показания'], correct: 0,
        explain: 'Для идеального газа p = nkT растёт только из-за T, а у насыщенного пара растёт ещё и n.'
      }
    ]
  };

  // ─────────────────────────────── 4. Кипение при пониженном давлении
  const R4 = {
    title: 'Кипение под колоколом',
    goal: 'Стакан с водой, подогретой до 60 °C, стоит под стеклянным колоколом. Откачивайте воздух насосом: тяните ручку вверх-вниз или жмите «Качнуть».',
    theory: `<p>Жидкость кипит, когда давление насыщенного пара внутри пузырьков сравнивается с внешним давлением. Тогда пузырьки растут и всплывают по всему объёму.</p>
      <p>Чем ниже внешнее давление, тем ниже температура кипения. При нормальном давлении 101,3 кПа вода кипит при 100 °C, а в горах — при меньшей температуре.</p>`,
    T: 60,
    setup() {
      const w = 130, h = w / 0.7475, bx = 250, by = BENCH - 20 - h + 3;
      const b = beakerBox(bx, by, w, h);
      this.s = { bx, by, w, h, b, level: by + h * 0.45, p: 101.3, handle: 0, down: false, drag: false, time: 0, boil: false,
        bubbles: new Bubbles({ x: b.l + 4, y: by + h * 0.45, w: b.r - b.l - 8, h: b.bottom - by - h * 0.45 }),
        vapor: new Vapor({ region: { x: 200, y: 140, w: 250, h: by + h * 0.45 - 140 }, mode: 'target', liquid: false, temp: 60, initial: 4 }) };
    },
    stroke() { this.s.p = Math.max(4, this.s.p * 0.8); },
    controls(ui) {
      ui.button('Качнуть насос', () => { this.stroke(); this.s.handle = 1; });
      ui.button('Впустить немного воздуха', () => { this.s.p = Math.min(101.3, this.s.p + 1.5); });
      ui.button('Открыть клапан', () => { this.s.p = 101.3; });
    },
    update(dt) {
      const s = this.s, ps = p0(this.T);
      s.time += dt;
      s.boil = s.p <= ps;
      s.bubbles.rate = s.boil ? 30 + (ps - s.p) * 4 : (s.p < ps * 1.3 ? 1.5 : 0);
      s.bubbles.step(dt);
      s.vapor.target = s.boil ? 70 : Math.max(4, 40 * (1 - (s.p - ps) / 40));
      s.vapor.step(dt);
      if (!s.drag && s.handle > 0) s.handle = Math.max(0, s.handle - dt * 2.5);
    },
    draw(ctx, t) {
      const s = this.s, b = s.b;
      // тарелка насоса
      ctx.fillStyle = '#4c585d'; ctx.fillRect(150, BENCH - 20, 350, 20);
      water(ctx, b.l, b.r, s.level, b.bottom, b.ry);
      s.bubbles.draw(ctx);
      S.img(ctx, 'beaker', s.bx, s.by, s.w, s.h);
      s.vapor.draw(ctx);
      // колокол
      ctx.save(); ctx.fillStyle = 'rgba(214,238,250,.12)'; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(170, BENCH - 20); ctx.lineTo(170, 190); ctx.bezierCurveTo(170, 90, 480, 90, 480, 190); ctx.lineTo(480, BENCH - 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.glassEdge; S.roundRect(ctx, 305, 98, 40, 22, 8); ctx.fill();
      ctx.restore();
      // нагреватель-термостат под стаканом
      S.plate(ctx, s.bx + s.w * 0.45, BENCH - 10, 'нагрев 60 °C', '#ffd28a');
      // шланг к насосу
      ctx.strokeStyle = '#2f3a3e'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(500, BENCH - 10); ctx.lineTo(640, BENCH - 10); ctx.stroke();
      // насос
      const hy = 250 + s.handle * 90;
      ctx.fillStyle = '#7e8b91'; ctx.fillRect(625, 230, 34, BENCH - 230);
      ctx.fillStyle = '#c3ccd0'; ctx.fillRect(637, hy - 60, 10, 70);
      ctx.fillStyle = '#3a4448'; S.roundRect(ctx, 605, hy - 72, 74, 14, 6); ctx.fill();
      if (!s.drag) S.grip(ctx, 642, hy - 65, false, t);
      S.gauge(ctx, 560, 170, 56, s.p, 110, 'кПа', `p = ${fmt(s.p, 1)} кПа`, null);
      S.plate(ctx, 325, 150, s.boil ? 'вода кипит!' : (s.p < p0(this.T) * 1.3 ? 'появляются пузырьки' : 'вода не кипит'), s.boil ? '#ffd28a' : C.ink);
    },
    readings() {
      const s = this.s;
      return [['Давление под колоколом', fmt(s.p, 1) + ' кПа'], ['Температура воды', '60,0 °C'], ['Состояние', s.boil ? 'кипит' : 'не кипит']];
    },
    hit(x, y) { const hy = 250 + this.s.handle * 90; return Math.abs(x - 642) < 50 && Math.abs(y - (hy - 65)) < 30; },
    drag(x, y) {
      const s = this.s; s.drag = true;
      const h = clamp((y + 65 - 250) / 90, 0, 1);
      if (h > 0.95 && !s.down) { s.down = true; this.stroke(); }
      if (h < 0.1) s.down = false;
      s.handle = h;
    },
    release() { this.s.drag = false; },
    tasks: [
      {
        type: 'action', prompt: 'Откачивайте воздух, пока вода не закипит.', button: 'Вода кипит',
        hint: 'Каждый ход насоса уменьшает давление примерно на 20 %. Понадобится 7–8 ходов.',
        check(r) { return r.s.boil ? [true, 'Вода кипит при 60 °C — без всякого дополнительного нагрева.'] : [false, 'Пока не кипит: давление под колоколом ещё слишком велико.']; }
      },
      {
        type: 'num', prompt: 'При каком давлении вода закипает при 60 °C? Уточните значение по таблице p₀(t).', unit: 'кПа', answer: 19.9, tol: 1.5,
        hint: 'Кипение начинается, когда внешнее давление равно p₀ при температуре воды. Откройте «Таблицу p₀».',
        explain: 'p₀(60 °C) = 19,9 кПа: именно до этого давления нужно откачать воздух.'
      },
      {
        type: 'mcq', prompt: 'Жидкость кипит, когда…', hint: 'Сравните показания манометра с табличным p₀(60 °C).',
        options: ['давление насыщенного пара в пузырьках равно внешнему давлению', 'температура достигает 100 °C при любом давлении', 'из воды уходит весь растворённый воздух', 'давление насыщенного пара становится равным нулю'], correct: 0,
        explain: 'Поэтому на высоте 3 км, где давление около 70 кПа, вода кипит примерно при 90 °C.'
      }
    ]
  };

  // ─────────────────────────────── 5. Влажность и точка росы
  const R5 = {
    title: 'Влажность и точка росы',
    goal: 'В лаборатории 24 °C. Перетаскивайте кубики льда в металлический стакан с водой и заметьте температуру, при которой его стенки запотеют.',
    theory: `<p><b>Относительная влажность</b> φ показывает, насколько пар в воздухе близок к насыщению: <i>φ = p / p₀(t) · 100 %</i>, где p — парциальное давление водяного пара, p₀(t) — давление насыщенного пара при температуре воздуха.</p>
      <p><b>Точка росы</b> — температура, при которой пар в воздухе становится насыщенным. У холодной стенки воздух охлаждается до точки росы, и пар конденсируется: стенка запотевает. Значит, p = p₀(t<sub>росы</sub>).</p>`,
    room: 24, pAir: p0(12),
    setup() {
      this.s = { T: 24, target: 24, ice: [], tray: [0, 1, 2, 3, 4, 5].map(i => ({ x: 560 + (i % 3) * 38, y: BENCH - 30 - Math.floor(i / 3) * 34, home: true })), dragIce: null, time: 0, fog: 0, drops: [] };
    },
    cup: { x: 330, y: 240, w: 120, h: 190 },
    addIce() { const s = this.s; s.target = Math.max(1, s.target - 3.5); s.ice.push({ r: Math.random() }); },
    controls(ui) {
      ui.button('Бросить кубик льда', () => { const k = this.s.tray.find(c => c.home); if (k) { k.home = false; k.used = true; } this.addIce(); });
      ui.button('Налить тёплой воды', () => { const s = this.s; s.target = 24; s.T = 24; s.ice = []; s.tray.forEach(c => { c.home = true; c.used = false; }); s.drops = []; });
    },
    update(dt) {
      const s = this.s, dew = tSat(this.pAir);
      s.time += dt;
      s.T += (s.target - s.T) * Math.min(1, dt * 0.25);
      const want = clamp((dew - s.T) / 3, 0, 1);
      s.fog += (want - s.fog) * Math.min(1, dt * 1.5);
      const c = this.cup;
      if (s.T <= dew && s.drops.length < 160 * s.fog && Math.random() < 0.6) s.drops.push({ x: c.x + 6 + Math.random() * (c.w - 12), y: c.y + 30 + Math.random() * (c.h - 40), r: 1 + Math.random() * 2.2 });
      if (s.T > dew + 0.3 && s.drops.length) s.drops.splice(0, Math.ceil(dt * 30));
    },
    draw(ctx, t) {
      const s = this.s, c = this.cup;
      // металлический стакан
      const g = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
      g.addColorStop(0, '#8d999e'); g.addColorStop(0.35, '#eef3f5'); g.addColorStop(0.6, '#b9c4c9'); g.addColorStop(1, '#6f7c82');
      ctx.fillStyle = g; S.roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.fill();
      ctx.fillStyle = 'rgba(58,160,216,.8)'; ctx.beginPath(); ctx.ellipse(c.x + c.w / 2, c.y + 6, c.w / 2 - 3, 7, 0, 0, Math.PI * 2); ctx.fill();
      s.ice.forEach((k, i) => { ctx.fillStyle = 'rgba(230,248,255,.9)'; ctx.fillRect(c.x + 14 + (i * 23) % 80, c.y - 2 + (i % 2) * 4, 18, 9); });
      // запотевание
      if (s.fog > 0.01) { ctx.fillStyle = `rgba(235,245,250,${0.35 * s.fog})`; S.roundRect(ctx, c.x, c.y + 12, c.w, c.h - 12, 8); ctx.fill(); }
      ctx.fillStyle = 'rgba(210,238,252,.9)';
      for (const d of s.drops) { ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.8, d.r, 0, 0, Math.PI * 2); ctx.fill(); }
      // термометр в стакане
      S.thermo(ctx, c.x + c.w - 26, c.y - 150, 250, s.T, 0, 30, 5);
      S.plate(ctx, c.x + c.w / 2, BENCH + 40, `стакан: ${fmt(s.T, 1)} °C`);
      // термометр воздуха и гигрометр-справка
      S.thermo(ctx, 130, 150, 220, this.room, 0, 40, 5);
      S.plate(ctx, 140, 410, `воздух: ${this.room} °C`);
      // лоток со льдом
      ctx.fillStyle = '#d4dde1'; ctx.fillRect(545, BENCH - 8, 130, 8);
      for (const k of s.tray) if (k.home || s.dragIce === k) {
        ctx.fillStyle = 'rgba(225,246,255,.92)'; ctx.strokeStyle = '#9fd3ea'; ctx.lineWidth = 1.5;
        S.roundRect(ctx, k.x, k.y, 30, 28, 5); ctx.fill(); ctx.stroke();
      }
      if (s.tray.some(k => k.home) && !s.dragIce) S.grip(ctx, 610, BENCH - 50, false, t);
      if (s.fog > 0.2) S.plate(ctx, c.x + c.w / 2, c.y - 24, 'стенки запотели', '#9fe3ff');
    },
    readings() {
      const s = this.s;
      return [['Температура воздуха', this.room + ',0 °C'], ['Температура стакана', fmt(s.T, 1) + ' °C'], ['Стенки', s.fog > 0.05 ? 'запотели' : 'сухие']];
    },
    hit(x, y) { const k = this.s.tray.find(k => k.home && x >= k.x - 6 && x <= k.x + 36 && y >= k.y - 6 && y <= k.y + 34); if (k) { this.s.dragIce = k; k.home = false; return true; } return false; },
    drag(x, y) { const k = this.s.dragIce; if (k) { k.x = x - 15; k.y = y - 14; } },
    release() {
      const s = this.s, k = s.dragIce, c = this.cup; if (!k) return;
      s.dragIce = null;
      if (k.x + 15 > c.x - 20 && k.x + 15 < c.x + c.w + 20 && k.y < c.y + 60 && k.y > c.y - 120) { k.used = true; this.addIce(); }
      else { const i = s.tray.indexOf(k); k.x = 560 + (i % 3) * 38; k.y = BENCH - 30 - Math.floor(i / 3) * 34; k.home = true; }
    },
    tasks: [
      {
        type: 'num', prompt: 'Охлаждайте стакан льдом. При какой температуре стенки начинают запотевать? Это точка росы.', unit: '°C', answer: 12, tol: 1,
        hint: 'Бросайте лёд по одному кубику и следите за термометром в стакане. Если пропустили момент, налейте тёплой воды и повторите.',
        explain: 'Точка росы 12 °C: при этой температуре пар в воздухе становится насыщенным.'
      },
      {
        type: 'num', prompt: 'Вычислите относительную влажность воздуха: φ = p₀(t росы) / p₀(t воздуха) · 100 %.', unit: '%', answer: 47, tol: 2,
        hint: 'По таблице p₀(12 °C) = 1,40 кПа, p₀(24 °C) = 2,98 кПа.',
        explain: 'φ = 1,40 / 2,98 · 100 % ≈ 47 %.'
      },
      {
        type: 'mcq', prompt: 'В комнату внесли таз с горячей водой, и влажность выросла. Как изменится точка росы?', hint: 'Больше пара — больше его парциальное давление p.',
        options: ['Повысится', 'Понизится', 'Не изменится'], correct: 0,
        explain: 'Чем больше пара в воздухе, тем выше температура, при которой он становится насыщенным.'
      }
    ]
  };

  window.ROUNDS = [R1, R2, R3, R4, R5];
})();
