const KEY = "miDineroNu_v2";
const OLD_KEY = "miDineroNu_v1";

const defaults = {
  initialMoney: 500000,
  transportPrice: 3500,
  lunchPrice: 20000,
  goal: 500000,
  goalName: "Meta de ahorro",
  totalSavings: 0,
  periodSavings: 0,
  transport: 0,
  lunch: 0,
  expenses: [],
  history: [],
  periodStart: null,
  periodEnd: null
};

let state = load();

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function load() {
  let raw = localStorage.getItem(KEY);
  if (!raw) raw = localStorage.getItem(OLD_KEY);

  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

  const s = { ...cloneDefaults(), ...parsed };
  s.expenses = Array.isArray(s.expenses) ? s.expenses : [];
  s.history = Array.isArray(s.history) ? s.history : [];

  // Migration from version 1.
  if (parsed && parsed.saved !== undefined && parsed.totalSavings === undefined) {
    s.totalSavings = Number(parsed.saved) || 0;
  }
  if (parsed && parsed.savings && parsed.totalSavings === undefined) {
    const oldSavings = Array.isArray(parsed.savings) ? parsed.savings.reduce((a, x) => a + Number(x.amount || 0), 0) : 0;
    s.totalSavings = oldSavings;
  }
  if (parsed && parsed.periodSavings === undefined && Array.isArray(parsed.savings)) {
    s.periodSavings = parsed.savings.reduce((a, x) => a + Number(x.amount || 0), 0);
  }

  if (!s.periodStart || !s.periodEnd) beginCurrentPeriod(s);
  rolloverIfNeeded(s);
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function getPeriodDates(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  if (d <= 15) {
    return {
      start: new Date(y, m, 1, 0, 0, 0, 0),
      end: new Date(y, m, 15, 23, 59, 59, 999)
    };
  }
  return {
    start: new Date(y, m, 16, 0, 0, 0, 0),
    end: new Date(y, m + 1, 0, 23, 59, 59, 999)
  };
}

function beginCurrentPeriod(s, startBalance = null) {
  const { start, end } = getPeriodDates();
  s.periodStart = start.toISOString();
  s.periodEnd = end.toISOString();
  s.transport = 0;
  s.lunch = 0;
  s.expenses = [];
  s.periodSavings = 0;
  // IMPORTANT: initialMoney, goal and totalSavings are persistent.
  // If a period has a carried balance, that becomes the new starting balance.
  if (startBalance !== null) s.initialMoney = Math.max(0, Number(startBalance) || 0);
}

function calculateExpenseTotal(s) {
  return s.transport * s.transportPrice +
    s.lunch * s.lunchPrice +
    s.expenses.reduce((a, x) => a + Number(x.amount || 0), 0);
}

function calculatePeriodSavings(s) {
  return Number(s.periodSavings || 0);
}

function calculateBalance(s) {
  return Number(s.initialMoney || 0) - calculateExpenseTotal(s) - calculatePeriodSavings(s);
}

function rolloverIfNeeded(s) {
  const now = new Date();
  let guard = 0;

  while (s.periodEnd && now > new Date(s.periodEnd) && guard < 24) {
    const periodExpenses = calculateExpenseTotal(s);
    const periodSavings = calculatePeriodSavings(s);
    const endBalance = calculateBalance(s);

    s.history.unshift({
      start: s.periodStart,
      end: s.periodEnd,
      initial: Number(s.initialMoney || 0),
      transport: Number(s.transport || 0),
      transportPrice: Number(s.transportPrice || 0),
      lunch: Number(s.lunch || 0),
      lunchPrice: Number(s.lunchPrice || 0),
      expenses: JSON.parse(JSON.stringify(s.expenses || [])),
      periodSavings,
      totalExpenses: periodExpenses,
      endBalance,
      closedAutomatically: true,
      closedAt: new Date().toISOString()
    });

    // The previous quincena's ending available money becomes the next
    // quincena's starting money. It does NOT reset to zero.
    beginCurrentPeriod(s, endBalance);
    guard++;
  }
}

function money(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  }).format(Math.round(Number(n) || 0));
}

function dateLabel(d) {
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel() {
  return `${dateLabel(state.periodStart)} — ${dateLabel(state.periodEnd)}`;
}

function expenseTotal() { return calculateExpenseTotal(state); }
function balance() { return calculateBalance(state); }

function render() {
  document.getElementById("periodLabel").textContent = periodLabel();
  document.getElementById("initialMoney").textContent = money(state.initialMoney);
  document.getElementById("balance").textContent = money(balance());
  document.getElementById("periodExpenses").textContent = money(expenseTotal());
  document.getElementById("periodSavings").textContent = money(state.periodSavings);
  const used = Number(state.initialMoney) > 0
    ? Math.min(100, Math.round((expenseTotal() + state.periodSavings) / state.initialMoney * 100))
    : 0;
  document.getElementById("usedPercent").textContent = `${used}%`;

  document.getElementById("transportCount").textContent = state.transport;
  document.getElementById("transportTotal").textContent = money(state.transport * state.transportPrice);
  document.getElementById("lunchCount").textContent = state.lunch;
  document.getElementById("lunchTotal").textContent = money(state.lunch * state.lunchPrice);

  const pct = state.goal ? Math.min(100, Math.round(state.totalSavings / state.goal * 100)) : 0;
  document.getElementById("savedAmount").textContent = money(state.totalSavings);
  document.getElementById("periodSavingsGoal" ).textContent = money(state.periodSavings);
  document.getElementById("goalAmount").textContent = money(state.goal);
  document.getElementById("goalPercent").textContent = `${pct}%`;
  document.getElementById("goalProgress").style.width = `${pct}%`;
  document.getElementById("goalName").textContent = state.goalName || "Meta de ahorro";
  document.getElementById("goalRemaining").textContent = `Faltan ${money(Math.max(0, state.goal - state.totalSavings))}`;

  const movements = [
    ...state.expenses.map(x => ({ icon: "💸", name: x.description, sub: x.category, amount: -Number(x.amount), date: x.date })),
    ...(state.transport ? [{ icon: "🚌", name: "Transporte", sub: `${state.transport} pasajes`, amount: -state.transport * state.transportPrice, date: new Date() }] : []),
    ...(state.lunch ? [{ icon: "🍔", name: "Almuerzos", sub: `${state.lunch} almuerzos`, amount: -state.lunch * state.lunchPrice, date: new Date() }] : []),
    ...(state.periodSavings ? [{ icon: "💜", name: "Ahorro de esta quincena", sub: state.goalName || "Meta de ahorro", amount: state.periodSavings, date: new Date() }] : [])
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

  document.getElementById("recentMovements").innerHTML = movements.length
    ? movements.map(x => `<div class="movement"><div class="movement-main"><div class="movement-icon">${x.icon}</div><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.sub)}</small></div></div><strong class="${x.amount < 0 ? "negative" : "positive"}">${x.amount < 0 ? "−" : "+"}${money(Math.abs(x.amount))}</strong></div>`).join("")
    : `<p class="muted">Aún no tienes movimientos.</p>`;

  document.getElementById("currentReport").innerHTML = `
    <tr><td>🚌 Transporte</td><td>${state.transport}</td><td>${money(state.transportPrice)}</td><td>${money(state.transport * state.transportPrice)}</td></tr>
    <tr><td>🍔 Almuerzos</td><td>${state.lunch}</td><td>${money(state.lunchPrice)}</td><td>${money(state.lunch * state.lunchPrice)}</td></tr>
    ${state.expenses.map(x => `<tr><td>💸 ${escapeHtml(x.description)}</td><td>1</td><td>${money(x.amount)}</td><td>${money(x.amount)}</td></tr>`).join("")}
    <tr><td><b>Total gastos</b></td><td></td><td></td><td><b>${money(expenseTotal())}</b></td></tr>
    <tr><td>💜 Ahorro de esta quincena</td><td></td><td></td><td><b>${money(state.periodSavings)}</b></td></tr>
    <tr><td><b>Saldo al cierre</b></td><td></td><td></td><td><b>${money(balance())}</b></td></tr>`;

  renderHistory();
  fillSettings();
}

function renderHistory() {
  const el = document.getElementById("historyList");
  if (!state.history.length) {
    el.innerHTML = `<div class="panel"><b>Tu historial aparecerá aquí.</b><p class="muted">Al cerrar una quincena, el resumen se guarda automáticamente.</p></div>`;
    return;
  }

  el.innerHTML = state.history.map(h => `
    <article class="history-card">
      <div class="history-head">
        <div><p class="eyebrow">QUINCENA CERRADA AUTOMÁTICAMENTE ✓</p><h2>${dateLabel(h.start)} — ${dateLabel(h.end)}</h2></div>
        <b>${money(h.endBalance)}</b>
      </div>
      <div class="history-stats">
        <div class="history-stat"><span>Saldo inicial</span><strong>${money(h.initial)}</strong></div>
        <div class="history-stat"><span>Gastos</span><strong>${money(h.totalExpenses)}</strong></div>
        <div class="history-stat"><span>Ahorro</span><strong>${money(h.periodSavings)}</strong></div>
        <div class="history-stat"><span>Saldo final</span><strong>${money(h.endBalance)}</strong></div>
      </div>
      <div class="history-detail"><span>🚌 ${h.transport} pasajes × ${money(h.transportPrice)}</span><span>🍔 ${h.lunch} almuerzos × ${money(h.lunchPrice)}</span></div>
    </article>`).join("");
}

function fillSettings() {
  document.getElementById("settingInitial").value = state.initialMoney;
  document.getElementById("settingTransport").value = state.transportPrice;
  document.getElementById("settingLunch").value = state.lunchPrice;
  document.getElementById("settingGoal").value = state.goal;
  document.getElementById("settingGoalName").value = state.goalName;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function setupEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(btn.dataset.section).classList.add("active");
  }));

  document.querySelectorAll("[data-counter]").forEach(btn => btn.addEventListener("click", () => {
    const key = btn.dataset.counter;
    const delta = Number(btn.dataset.delta);
    state[key] = Math.max(0, Number(state[key] || 0) + delta);
    persist(); render();
  }));

  document.getElementById("resetCounters").addEventListener("click", () => {
    if (confirm("¿Restablecer los contadores de transporte y almuerzos de esta quincena?")) {
      state.transport = 0; state.lunch = 0; persist(); render();
    }
  });

  document.getElementById("addOtherBtn").addEventListener("click", () => openModal("expenseModal"));
  document.getElementById("addSavingBtn").addEventListener("click", () => openModal("savingModal"));
  document.querySelectorAll(".modal-close").forEach(x => x.addEventListener("click", () => closeModal(x.dataset.close)));

  document.getElementById("expenseForm").addEventListener("submit", e => {
    e.preventDefault();
    const amount = Number(document.getElementById("expenseAmount").value);
    if (amount <= 0 || amount > balance()) { alert("El valor debe ser mayor que 0 y no puede superar el saldo disponible."); return; }
    state.expenses.push({
      description: document.getElementById("expenseDescription").value.trim(),
      category: document.getElementById("expenseCategory").value,
      amount,
      date: new Date().toISOString()
    });
    persist(); e.target.reset(); closeModal("expenseModal"); render();
  });

  document.getElementById("savingForm").addEventListener("submit", e => {
    e.preventDefault();
    const amount = Number(document.getElementById("savingAmount").value);
    if (amount <= 0 || amount > balance()) { alert("No puedes ahorrar una cantidad mayor al saldo disponible."); return; }
    state.periodSavings += amount;
    state.totalSavings += amount;
    persist(); e.target.reset(); closeModal("savingModal"); render();
  });

  document.getElementById("saveSettings").addEventListener("click", () => {
    const newInitial = Number(document.getElementById("settingInitial").value);
    const newTransport = Number(document.getElementById("settingTransport").value);
    const newLunch = Number(document.getElementById("settingLunch").value);
    const newGoal = Number(document.getElementById("settingGoal").value);
    if ([newInitial, newTransport, newLunch, newGoal].some(v => v < 0 || !Number.isFinite(v))) {
      alert("Revisa los valores de configuración."); return;
    }
    state.initialMoney = newInitial;
    state.transportPrice = newTransport;
    state.lunchPrice = newLunch;
    state.goal = newGoal;
    state.goalName = document.getElementById("settingGoalName").value.trim() || "Meta de ahorro";
    persist(); render(); alert("Configuración guardada.");
  });

  document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); }));
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

setupEvents();
render();

