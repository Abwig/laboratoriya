// Физическая модель: давление насыщенного водяного пара и производные величины.
(function () {
  // Табличные значения p0(t) для воды, кПа (справочные данные).
  const TABLE = [
    [0, 0.611], [5, 0.872], [10, 1.228], [12, 1.402], [14, 1.598], [15, 1.705],
    [16, 1.817], [18, 2.064], [20, 2.338], [22, 2.644], [24, 2.985], [25, 3.169],
    [30, 4.246], [35, 5.628], [40, 7.384], [45, 9.593], [50, 12.35], [55, 15.76],
    [60, 19.94], [65, 25.03], [70, 31.19], [75, 38.58], [80, 47.39], [85, 57.83],
    [90, 70.14], [95, 84.55], [100, 101.33]
  ];

  // Интерполяция по логарифму давления: точнее линейной на крутой кривой.
  function p0(t) {
    if (t <= TABLE[0][0]) return TABLE[0][1];
    if (t >= TABLE[TABLE.length - 1][0]) {
      const [ta, pa] = TABLE[TABLE.length - 2], [tb, pb] = TABLE[TABLE.length - 1];
      return pb * Math.exp((Math.log(pb) - Math.log(pa)) / (tb - ta) * (t - tb));
    }
    for (let i = 1; i < TABLE.length; i++) {
      const [tb, pb] = TABLE[i];
      if (t <= tb) {
        const [ta, pa] = TABLE[i - 1];
        const k = (t - ta) / (tb - ta);
        return Math.exp(Math.log(pa) + k * (Math.log(pb) - Math.log(pa)));
      }
    }
  }

  // Обратная функция: температура, при которой p0(t) = p. Это точка росы
  // (для парциального давления) или температура кипения (для внешнего давления).
  function tSat(p) {
    let lo = -10, hi = 120;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (p0(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  const humidity = (p, t) => (p / p0(t)) * 100;          // φ, %
  const R = 8.314, M = 0.018;
  const density = (pKPa, t) => (pKPa * 1000 * M) / (R * (t + 273.15)); // ρ, кг/м³

  // Закрытый сосуд с паром (и, возможно, водой). n — «количество воды» в
  // условных единицах: давление, которое создал бы весь пар в объёме V0 при T0.
  function vessel({ n, V, V0, t }) {
    const pIdeal = n * (V0 / V) * ((t + 273.15) / 293.15);
    const ps = p0(t);
    if (pIdeal <= ps) return { p: pIdeal, saturated: false, liquidFrac: 0 };
    return { p: ps, saturated: true, liquidFrac: 1 - ps / pIdeal };
  }

  window.Physics = { TABLE, p0, tSat, humidity, density, vessel };
})();
