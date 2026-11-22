// Игровой цикл: раунды, задания, очки, журнал наблюдений.
(function () {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fmt = (v, d = 1) => Number(v).toFixed(d).replace('.', ',');
  const W = Scene.W, H = Scene.H;

  const canvas = $('#stage'), ctx = canvas.getContext('2d');
  const G = { round: 0, task: 0, penalty: [0, 0, 0, 0, 0], stars: [null, null, null, null, null], done: false, time: 0 };
  let R = null, dragging = false, readingEls = [], graphCanvas = null, order = [];

  // ── размер canvas под экран
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * H / W * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', () => { fit(); drawGraph(); });

  // ── управление сценой мышью и пальцем
  function toScene(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  canvas.addEventListener('pointerdown', e => {
    if (!R || !R.hit) return;
    const [x, y] = toScene(e);
    if (R.hit(x, y)) { dragging = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); R.drag(x, y); e.preventDefault(); }
  });
  canvas.addEventListener('pointermove', e => { if (dragging) { const [x, y] = toScene(e); R.drag(x, y); } });
  const end = () => { if (dragging) { dragging = false; canvas.classList.remove('dragging'); R.release && R.release(); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  // ── элементы управления для раундов
  function makeUI(box) {
    return {
      slider(o) {
        const wrap = el('div', 'ctl-slider');
        wrap.innerHTML = `<label for="${o.id}">${o.label}<output>${fmt(o.value, 0)} ${o.unit}</output></label>
          <input type="range" id="${o.id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}">`;
        const inp = wrap.querySelector('input'), out = wrap.querySelector('output');
        inp.addEventListener('input', () => { out.textContent = `${fmt(inp.value, 0)} ${o.unit}`; o.onInput(+inp.value); });
        box.appendChild(wrap);
        return { set(v) { inp.value = v; out.textContent = `${fmt(v, 0)} ${o.unit}`; } };
      },
      button(label, fn) { const b = el('button', 'btn btn-tool', label); b.type = 'button'; b.addEventListener('click', fn); box.appendChild(b); return b; },
      toast,
      refresh() { renderTable(); drawGraph(); }
    };
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ── журнал
  function renderProgress() {
    const box = $('#progress'); box.innerHTML = '';
    ROUNDS.forEach((r, i) => {
      const s = G.stars[i];
      const item = el('li', 'step' + (i === G.round && !G.done ? ' now' : '') + (s != null ? ' done' : ''));
      item.innerHTML = `<span class="step-n">${i + 1}</span><span class="step-stars" aria-label="звёзд: ${s ?? 0}">${s != null ? '★'.repeat(s) + '☆'.repeat(3 - s) : '☆☆☆'}</span>`;
      item.title = r.title;
      box.appendChild(item);
    });
    const total = G.stars.reduce((a, b) => a + (b || 0), 0);
    $('#score').textContent = `${total} / 15 ★`;
  }

  function startRound(i) {
    G.round = i; G.task = 0; G.done = false;
    R = ROUNDS[i]; R.setup();
    $('#round-kicker').textContent = `Опыт ${i + 1} из 5`;
    $('#round-title').textContent = R.title;
    $('#round-goal').textContent = R.goal;
    const ctl = $('#controls'); ctl.innerHTML = ''; R.controls(makeUI(ctl));
    const rd = $('#readings'); rd.innerHTML = ''; readingEls = R.readings().map(([k]) => {
      const row = el('div', 'reading'); row.innerHTML = `<dt>${k}</dt><dd></dd>`; rd.appendChild(row); return row.querySelector('dd');
    });
    const gb = $('#graph-box'); gb.hidden = !R.graph;
    if (R.graph) { $('#graph-caption').textContent = `График ${R.graph.yl.split(',')[0]}(${R.graph.xl.split(',')[0]})`; }
    renderTable(); renderTask(); renderProgress(); drawGraph();
    $('#next').hidden = true;
  }

  function renderTable() {
    const box = $('#table-box'); const tb = R.table && R.table(R);
    box.hidden = !tb; if (!tb) return;
    box.innerHTML = `<table><thead><tr>${tb.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderTask() {
    const box = $('#task'); box.innerHTML = ''; $('#feedback').hidden = true;
    const t = R.tasks[G.task];
    $('#task-count').textContent = `Задание ${G.task + 1} из ${R.tasks.length}`;
    box.appendChild(el('p', 'task-prompt', t.prompt));
    if (t.type === 'mcq') {
      order = t.options.map((_, i) => i).sort(() => Math.random() - 0.5);
      const list = el('div', 'options');
      order.forEach(i => {
        const b = el('button', 'option', t.options[i]); b.type = 'button';
        b.addEventListener('click', () => {
          if (i === t.correct) { b.classList.add('right'); list.querySelectorAll('button').forEach(x => x.disabled = true); solved(t.explain); }
          else { b.classList.add('wrong'); b.disabled = true; miss('Неверно. Подумайте ещё или возьмите подсказку.'); }
        });
        list.appendChild(b);
      });
      box.appendChild(list);
    } else if (t.type === 'num') {
      const f = el('form', 'num-form');
      f.innerHTML = `<input id="answer-${G.round}-${G.task}" inputmode="decimal" autocomplete="off" placeholder="Ответ" aria-label="Ответ"><span class="unit">${t.unit}</span><button class="btn" type="submit">Проверить</button>`;
      f.addEventListener('submit', e => {
        e.preventDefault();
        const inp = f.querySelector('input'), v = parseFloat(inp.value.replace(',', '.').trim());
        if (Number.isNaN(v)) { show('Введите число, например 12,5.', 'warn'); return; }
        if (Math.abs(v - t.answer) <= t.tol) { inp.disabled = true; f.querySelector('button').disabled = true; solved(t.explain); }
        else miss((t.wrong && t.wrong(R, v)) || (v > t.answer ? 'Слишком много. Проверьте измерение или расчёт.' : 'Слишком мало. Проверьте измерение или расчёт.'));
      });
      box.appendChild(f);
    } else {
      const b = el('button', 'btn', t.button); b.type = 'button';
      b.addEventListener('click', () => { const [ok, msg] = t.check(R); if (ok) { b.disabled = true; solved(msg); } else miss(msg); });
      box.appendChild(b);
    }
  }

  function show(msg, kind) { const f = $('#feedback'); f.className = 'feedback ' + kind; f.textContent = msg; f.hidden = false; }
  function miss(msg) { G.penalty[G.round]++; show(msg, 'bad'); }
  function solved(msg) {
    show(msg || 'Верно!', 'good');
    const last = G.task === R.tasks.length - 1;
    const n = $('#next'); n.hidden = false;
    if (last) {
      const p = G.penalty[G.round];
      G.stars[G.round] = p === 0 ? 3 : p <= 2 ? 2 : 1;
      renderProgress();
      n.textContent = G.round === ROUNDS.length - 1 ? 'Подвести итоги' : 'Следующий опыт →';
    } else n.textContent = 'Следующее задание →';
    if (R.graph) drawGraph();
  }
  $('#next').addEventListener('click', () => {
    if (G.task < R.tasks.length - 1) { G.task++; renderTask(); $('#next').hidden = true; if (R.graph) drawGraph(); return; }
    if (G.round < ROUNDS.length - 1) { startRound(G.round + 1); document.querySelector('.lab').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else finish();
  });
  $('#hint').addEventListener('click', () => { G.penalty[G.round]++; show('Подсказка: ' + R.tasks[G.task].hint, 'hint'); });

  // ── модальные окна
  function modal(title, html, actions) {
    $('#modal-title').textContent = title; $('#modal-body').innerHTML = html;
    const a = $('#modal-actions'); a.innerHTML = '';
    (actions || [['Закрыть', closeModal]]).forEach(([label, fn]) => { const b = el('button', 'btn', label); b.type = 'button'; b.addEventListener('click', fn); a.appendChild(b); });
    $('#modal').hidden = false; a.querySelector('button').focus();
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  $('#theory').addEventListener('click', () => modal(R.title, R.theory));
  $('#table-btn').addEventListener('click', () => {
    const rows = Physics.TABLE.filter(([t]) => t % 2 === 0 || t === 15 || t === 25 || t % 5 === 0);
    const half = Math.ceil(rows.length / 2);
    const cell = ([t, p]) => `<td>${t}</td><td>${fmt(p, p < 10 ? 2 : 1)}</td>`;
    let body = '';
    for (let i = 0; i < half; i++) body += `<tr>${cell(rows[i])}${rows[i + half] ? cell(rows[i + half]) : '<td></td><td></td>'}</tr>`;
    modal('Давление насыщенного водяного пара', `<div class="ptable"><table><thead><tr><th>t, °C</th><th>p₀, кПа</th><th>t, °C</th><th>p₀, кПа</th></tr></thead><tbody>${body}</tbody></table></div>`);
  });
  $('#about').addEventListener('click', () => modal('Об игре', `<p>Пять опытов о насыщенном и ненасыщенном паре для 10 класса. Значения p₀(t) — справочные данные для воды.</p>
    <p><b>Графика.</b> Стакан и термометр на полке — Amada44 и Werneuchen, Wikimedia Commons, общественное достояние. Спиртовка и колбы — DataBase Center for Life Science (DBCLS), Wikimedia Commons, лицензия CC BY 4.0. Цилиндр с поршнем, манометры, колокол и молекулы нарисованы кодом.</p>`));

  function finish() {
    G.done = true; renderProgress();
    const total = G.stars.reduce((a, b) => a + (b || 0), 0);
    const verdict = total >= 14 ? 'Отлично: вы уверенно владеете темой.' : total >= 11 ? 'Хорошо: осталось закрепить пару моментов.' : total >= 8 ? 'Удовлетворительно: перечитайте теорию к опытам с одной звездой.' : 'Стоит пройти опыты ещё раз с теорией.';
    const rows = ROUNDS.map((r, i) => `<tr><td>${i + 1}. ${r.title}</td><td class="st">${'★'.repeat(G.stars[i] || 0)}${'☆'.repeat(3 - (G.stars[i] || 0))}</td></tr>`).join('');
    modal('Лабораторная работа завершена', `<p class="final-score">${total} из 15 ★</p><p>${verdict}</p><table class="final">${rows}</table>`,
      [['Пройти заново', () => { closeModal(); G.penalty = [0, 0, 0, 0, 0]; G.stars = [null, null, null, null, null]; startRound(0); }], ['Закрыть', closeModal]]);
  }

  // ── график в журнале
  function drawGraph() {
    if (!R || !R.graph) return;
    const gc = $('#graph'), g = gc.getContext('2d'), cfg = R.graph;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = gc.clientWidth || 320, h = Math.round(w * 0.62);
    gc.width = w * dpr; gc.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = 40, B = 30, T = 22, Rr = 12, pw = w - L - Rr, ph = h - T - B;
    const X = v => L + (v - cfg.xr[0]) / (cfg.xr[1] - cfg.xr[0]) * pw, Y = v => T + ph - (v - cfg.yr[0]) / (cfg.yr[1] - cfg.yr[0]) * ph;
    g.clearRect(0, 0, w, h);
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#4c5d6b'; g.strokeStyle = 'rgba(44,74,110,.15)'; g.lineWidth = 1;
    g.textAlign = 'center';
    for (let v = cfg.xr[0]; v <= cfg.xr[1] + 1e-9; v += cfg.xs) { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke(); g.fillText(v, X(v), T + ph + 14); }
    g.textAlign = 'right';
    for (let v = cfg.yr[0]; v <= cfg.yr[1] + 1e-9; v += cfg.ys) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); g.fillText(String(+v.toFixed(1)).replace('.', ','), L - 5, Y(v) + 4); }
    g.strokeStyle = '#2c3e50'; g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + ph); g.lineTo(L + pw, T + ph); g.stroke();
    g.textAlign = 'right'; g.fillText(cfg.xl, L + pw, T + ph + 27); g.textAlign = "left"; g.fillText(cfg.yl, 4, 12);
    const d = cfg.data(R, G.task > 0 || G.stars[G.round] != null);
    const poly = (pts, color, dash, wdt) => { if (!pts || pts.length < 2) return; g.save(); g.strokeStyle = color; g.lineWidth = wdt || 2; g.setLineDash(dash || []); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(Math.min(y, cfg.yr[1]))) : g.moveTo(X(x), Y(Math.min(y, cfg.yr[1])))); g.stroke(); g.restore(); };
    poly(d.dashed, '#8a9aa8', [5, 4], 1.5);
    poly(d.curve, '#c0392b', null, 1.5);
    poly(d.line, '#1f6fb2', null, 2.5);
    (d.points || []).forEach(([x, y]) => { g.fillStyle = '#1f6fb2'; g.beginPath(); g.arc(X(x), Y(y), 4, 0, Math.PI * 2); g.fill(); });
    if (d.dashed) { g.font = '10px "Golos Text", sans-serif'; g.fillStyle = '#6b7b88'; g.textAlign = 'left'; g.fillText("пунктир — закон Шарля, красная — p₀(t)", L + 6, T + 12); }
  }

  // ── главный цикл
  let last = performance.now(), graphTick = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; G.time += dt;
    if (R) {
      R.update(dt);
      ctx.clearRect(0, 0, W, H);
      Scene.background(ctx);
      R.draw(ctx, G.time);
      const rd = R.readings(); readingEls.forEach((e, i) => { const v = String(rd[i][1]); if (e.textContent !== v) e.textContent = v; });
      if (R.graph && (graphTick += dt) > 0.25) { graphTick = 0; drawGraph(); }
    }
    requestAnimationFrame(frame);
  }

  Scene.loadImages().then(() => { fit(); startRound(0); requestAnimationFrame(frame); });
  window.__lab = { G, start: startRound, get round() { return R; } };
})();
