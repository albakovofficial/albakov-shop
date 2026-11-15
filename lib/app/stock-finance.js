'use strict';
/* Модуль сервера ALBAKOV — финансы и приход товара.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Finance, db, fail, save, uid
  } = S;
  // функции модулей, которые подключаются позже
  const processWaitlist = (...a) => S.processWaitlist(...a);

  /* ---------- Финансы: настройки, себестоимость, операции вручную (отчёт считает панель — public/js/finance.js) ---------- */
  function financeApi(p, M, body) {
    // Ставки налога и комиссий, категории расходов
    if (p[2] === 'settings' && M === 'PUT') {
      const prev = db.finance, next = Finance.cleanSettings(body.value, prev);
      // категорию с операциями удалить нельзя — иначе расходы потеряются из отчёта
      const used = new Set(db.expenses.map((e) => e.categoryId));
      const gone = prev.categories.filter((c) => used.has(c.id) && !next.categories.some((x) => x.id === c.id));
      if (gone.length) fail(400, 'В категории «' + gone[0].name + '» есть операции — сначала перенесите или удалите их');
      db.finance = next; save(); return { finance: db.finance };
    }
    // Себестоимость: { id товара: ₽ }, пустое значение — убрать
    if (p[2] === 'costs' && M === 'PUT') {
      const v = body.costs; if (!v || typeof v !== 'object') fail(400, 'Нет данных');
      const ids = db.products.map((x) => x.id), costs = Object.assign({}, db.finance.costs);
      Object.keys(v).forEach((id) => { if (ids.includes(id)) delete costs[id]; });
      Object.assign(costs, Finance.cleanCosts(v, ids));
      db.finance.costs = costs; save(); return { finance: db.finance };
    }
    // Приход товара: остатки растут, закупка уходит в расходы, себестоимость пересчитывается
    if (p[2] === 'receive' && !p[3] && M === 'POST') return receiveGoods(body);
    if (p[2] === 'receive' && p[3] && M === 'DELETE') return receiveCancel(p[3]);
    if (p[2] === 'expenses') {
      if (!p[3] && M === 'POST') {
        const r = Finance.cleanExpense(body, db.finance); if (r.error) fail(400, r.error);
        const e = Object.assign({ id: uid('x'), createdAt: new Date().toISOString() }, r.value);
        db.expenses.push(e); save(); return { expense: e };
      }
      const e = p[3] && db.expenses.find((x) => x.id === p[3]); if (!e) fail(404, 'Операция не найдена');
      if (M === 'PUT') { const r = Finance.cleanExpense(body, db.finance); if (r.error) fail(400, r.error); Object.assign(e, r.value, { updatedAt: new Date().toISOString() }); save(); return { expense: e }; }
      if (M === 'DELETE') { db.expenses = db.expenses.filter((x) => x !== e); save(); return {}; }
    }
    fail(404, 'Не найдено');
  }
  /* ---------- Приход товара ----------
     Пришла партия: указываете товар, сколько штук каждого цвета и размера и сколько стоила одна вещь.
     Остатки сразу растут (и уходят письма «Снова в наличии»), сумма закупки записывается операцией
     в «Финансы» (категория закупки), себестоимость товара пересчитывается — средняя по складу или новая цена. */
  function receiveGoods(b) {
    const pr = db.products.find((x) => x.id === b.productId); if (!pr) fail(400, 'Выберите товар');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
    const lines = [];
    (Array.isArray(b.lines) ? b.lines : []).forEach((l) => {
      const qty = Math.round(Number(l && l.qty) || 0); if (qty <= 0) return;
      if (qty > 100000) fail(400, 'Слишком большое количество');
      const c = (pr.colors || []).find((x) => x.id === l.colorId); const sz = c && (c.sizes || []).find((x) => x.size === l.size);
      if (!sz) fail(400, 'Такого цвета или размера у товара нет — добавьте его в карточке товара');
      lines.push({ colorId: c.id, color: c.name || '', size: sz.size, qty });
    });
    if (!lines.length) fail(400, 'Укажите количество хотя бы для одного размера');
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const unit = Math.round(Math.max(0, Math.min(10000000, Number(b.unitCost) || 0)) * 100) / 100;
    const units0 = (pr.colors || []).reduce((s, c) => s + (c.sizes || []).reduce((t, z) => t + Math.max(0, Number(z.stock) || 0), 0), 0);
    const costBefore = Number(db.finance.costs[pr.id]) || 0;
    const mode = ['avg', 'set', 'keep'].includes(b.costMode) ? b.costMode : 'avg';
    let costAfter = costBefore;
    if (unit > 0 && mode !== 'keep') costAfter = mode === 'set' || !(costBefore > 0) || units0 <= 0 ? unit : Math.round((units0 * costBefore + qty * unit) / (units0 + qty) * 100) / 100;
    // операция в «Финансах»
    let expense = null;
    if (unit > 0) {
      const cats = db.finance.categories || [];
      const cat = cats.find((c) => c.id === b.categoryId && c.kind === 'purchase') || cats.find((c) => c.kind === 'purchase');
      if (!cat) fail(400, 'В «Финансах» нет категории закупки — добавьте её в настройках');
      const note = ('Приход: ' + pr.name + ' — ' + lines.map((l) => (l.color ? l.color + ' ' : '') + l.size + ' × ' + l.qty).join(', ') + (b.note ? '. ' + String(b.note) : '')).slice(0, 300);
      const r = Finance.cleanExpense({ date, categoryId: cat.id, amount: Math.round(unit * qty * 100) / 100, note }, db.finance); if (r.error) fail(400, r.error);
      expense = Object.assign({ id: uid('x'), createdAt: new Date().toISOString(), auto: 'receive' }, r.value);
    }
    // остатки
    lines.forEach((l) => { const sz = pr.colors.find((c) => c.id === l.colorId).sizes.find((z) => z.size === l.size); sz.stock = Math.max(0, Number(sz.stock) || 0) + l.qty; });
    if (expense) db.expenses.push(expense);
    if (costAfter !== costBefore) db.finance.costs = Object.assign({}, db.finance.costs, { [pr.id]: costAfter });
    const rec = { id: uid('r'), at: new Date().toISOString(), date, productId: pr.id, name: pr.name, lines, qty, unitCost: unit, total: Math.round(unit * qty * 100) / 100, costMode: mode, costBefore, costAfter, expenseId: expense ? expense.id : '', note: String(b.note || '').slice(0, 200) };
    db.receipts.push(rec);
    save();
    processWaitlist().catch((e) => console.error('Снова в наличии:', e.message));
    return { receipt: rec, product: pr, finance: db.finance, expense };
  }
  // Отмена прихода (ошиблись при вводе): остатки уменьшаются обратно, операция закупки удаляется
  function receiveCancel(id) {
    const rec = db.receipts.find((x) => x.id === id); if (!rec) fail(404, 'Приход не найден');
    const pr = db.products.find((x) => x.id === rec.productId);
    if (pr) {
      for (const l of rec.lines) { const c = (pr.colors || []).find((x) => x.id === l.colorId), sz = c && c.sizes.find((z) => z.size === l.size); if (sz && (Number(sz.stock) || 0) < l.qty) fail(400, 'Часть этой партии уже продана (' + (l.color ? l.color + ' ' : '') + l.size + ') — отменить приход целиком нельзя. Поправьте остатки в карточке товара'); }
      rec.lines.forEach((l) => { const sz = pr.colors.find((x) => x.id === l.colorId).sizes.find((z) => z.size === l.size); sz.stock = Math.max(0, (Number(sz.stock) || 0) - l.qty); });
      if (Number(db.finance.costs[pr.id]) === rec.costAfter && rec.costAfter !== rec.costBefore) { const c = Object.assign({}, db.finance.costs); if (rec.costBefore > 0) c[pr.id] = rec.costBefore; else delete c[pr.id]; db.finance.costs = c; }
    }
    if (rec.expenseId) db.expenses = db.expenses.filter((x) => x.id !== rec.expenseId);
    db.receipts = db.receipts.filter((x) => x !== rec);
    save(); return { finance: db.finance, product: pr || null };
  }

  return {
    financeApi
  };
};
