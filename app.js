const KEY="miDineroNu_v1";

const defaults={
  initialMoney:500000,
  transportPrice:3500,
  lunchPrice:20000,
  goal:500000,
  goalName:"Meta de ahorro",
  saved:0,
  transport:0,
  lunch:0,
  expenses:[],
  savings:[],
  history:[],
  periodStart:null,
  periodEnd:null
};

let state=load();

function load(){
  const saved=localStorage.getItem(KEY);
  const s=saved?{...defaults,...JSON.parse(saved)}:{...defaults};
  if(!s.periodStart) startNewPeriod(s,false);
  checkPeriod(s);
  return s;
}
function persist(){localStorage.setItem(KEY,JSON.stringify(state));}
function startNewPeriod(s,save=true){
  const now=new Date();
  const day=now.getDate();
  const start=new Date(now.getFullYear(),now.getMonth(),day<=15?1:16);
  const end=day<=15?new Date(now.getFullYear(),now.getMonth(),15):new Date(now.getFullYear(),now.getMonth()+1,0);
  s.periodStart=start.toISOString();
  s.periodEnd=end.toISOString();
  s.transport=0;s.lunch=0;s.expenses=[];s.savings=[];
  if(save)localStorage.setItem(KEY,JSON.stringify(s));
}
function checkPeriod(s){
  const now=new Date();
  if(now>new Date(s.periodEnd)){
    const totalExpenses=s.expenses.reduce((a,x)=>a+x.amount,0)+s.transport*s.transportPrice+s.lunch*s.lunchPrice;
    const totalSavings=s.savings.reduce((a,x)=>a+x.amount,0);
    const endBalance=s.initialMoney-totalExpenses-totalSavings;
    s.history.unshift({
      start:s.periodStart,end:s.periodEnd,initial:s.initialMoney,transport:s.transport,
      lunch:s.lunch,expenses:s.expenses,savings:totalSavings,totalExpenses,endBalance
    });
    startNewPeriod(s,false);
    persist();
  }
}

function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Math.round(n))}
function dateLabel(d){return new Date(d).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}
function periodLabel(){return `${dateLabel(state.periodStart)} — ${dateLabel(state.periodEnd)}`}
function expenseTotal(){return state.transport*state.transportPrice+state.lunch*state.lunchPrice+state.expenses.reduce((a,x)=>a+x.amount,0)}
function savingsTotal(){return state.savings.reduce((a,x)=>a+x.amount,0)}
function balance(){return state.initialMoney-expenseTotal()-savingsTotal()}

function render(){
  document.getElementById("periodLabel").textContent=periodLabel();
  document.getElementById("initialMoney").textContent=money(state.initialMoney);
  document.getElementById("balance").textContent=money(balance());
  document.getElementById("periodExpenses").textContent=money(expenseTotal());
  document.getElementById("periodSavings").textContent=money(savingsTotal());
  document.getElementById("usedPercent").textContent=state.initialMoney?Math.min(100,Math.round((expenseTotal()+savingsTotal())/state.initialMoney*100))+"%":"0%";
  document.getElementById("transportCount").textContent=state.transport;
  document.getElementById("transportTotal").textContent=money(state.transport*state.transportPrice);
  document.getElementById("lunchCount").textContent=state.lunch;
  document.getElementById("lunchTotal").textContent=money(state.lunch*state.lunchPrice);

  const pct=state.goal?Math.min(100,Math.round(savingsTotal()/state.goal*100)):0;
  document.getElementById("savedAmount").textContent=money(savingsTotal());
  document.getElementById("goalAmount").textContent=money(state.goal);
  document.getElementById("goalPercent").textContent=pct+"%";
  document.getElementById("goalProgress").style.width=pct+"%";
  document.getElementById("goalName").textContent=state.goalName||"Meta de ahorro";
  document.getElementById("goalRemaining").textContent="Faltan "+money(Math.max(0,state.goal-savingsTotal()));

  const movements=[
    ...state.expenses.map(x=>({icon:"💸",name:x.description,sub:x.category,amount:-x.amount,date:x.date})),
    ...(state.transport?[{icon:"🚌",name:"Transporte",sub:`${state.transport} pasajes`,amount:-state.transport*state.transportPrice,date:new Date()}]:[]),
    ...(state.lunch?[{icon:"🍔",name:"Almuerzos",sub:`${state.lunch} almuerzos`,amount:-state.lunch*state.lunchPrice,date:new Date()}]:[]),
    ...state.savings.map(x=>({icon:"💜",name:"Ahorro",sub:"Meta de ahorro",amount:x.amount,date:x.date}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7);
  document.getElementById("recentMovements").innerHTML=movements.length?movements.map(x=>`
    <div class="movement"><div class="movement-main"><div class="movement-icon">${x.icon}</div><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.sub)}</small></div></div>
    <strong class="${x.amount<0?"negative":"positive"}">${x.amount<0?"−":"+"}${money(Math.abs(x.amount))}</strong></div>`).join(""):`<p class="muted">Aún no tienes movimientos.</p>`;

  document.getElementById("currentReport").innerHTML=`
    <tr><td>🚌 Transporte</td><td>${state.transport}</td><td>${money(state.transportPrice)}</td><td>${money(state.transport*state.transportPrice)}</td></tr>
    <tr><td>🍔 Almuerzos</td><td>${state.lunch}</td><td>${money(state.lunchPrice)}</td><td>${money(state.lunch*state.lunchPrice)}</td></tr>
    ${state.expenses.map(x=>`<tr><td>💸 ${escapeHtml(x.description)}</td><td>1</td><td>${money(x.amount)}</td><td>${money(x.amount)}</td></tr>`).join("")}
    <tr><td><b>Total gastos</b></td><td></td><td></td><td><b>${money(expenseTotal())}</b></td></tr>
    <tr><td>💜 Ahorro</td><td></td><td></td><td><b>${money(savingsTotal())}</b></td></tr>`;

  renderHistory();
  fillSettings();
}
function renderHistory(){
  const el=document.getElementById("historyList");
  if(!state.history.length){el.innerHTML=`<div class="panel"><b>Tu historial aparecerá aquí.</b><p class="muted">Al cerrar la primera quincena, el resumen se guardará automáticamente.</p></div>`;return}
  el.innerHTML=state.history.map(h=>`
    <article class="history-card">
      <div class="history-head"><div><p class="eyebrow">QUINCENA CERRADA</p><h2>${dateLabel(h.start)} — ${dateLabel(h.end)}</h2></div><b>${money(h.endBalance)}</b></div>
      <div class="history-stats">
        <div class="history-stat"><span>Inicial</span><strong>${money(h.initial)}</strong></div>
        <div class="history-stat"><span>Gastos</span><strong>${money(h.totalExpenses)}</strong></div>
        <div class="history-stat"><span>Ahorro</span><strong>${money(h.savings)}</strong></div>
        <div class="history-stat"><span>Transporte</span><strong>${h.transport} pasajes</strong></div>
      </div>
    </article>`).join("");
}
function fillSettings(){
  settingInitial.value=state.initialMoney;settingTransport.value=state.transportPrice;settingLunch.value=state.lunchPrice;
  settingGoal.value=state.goal;settingGoalName.value=state.goalName;
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  document.getElementById(btn.dataset.section).classList.add("active");
}));

document.querySelectorAll("[data-counter]").forEach(btn=>btn.addEventListener("click",()=>{
  const key=btn.dataset.counter, delta=Number(btn.dataset.delta);
  state[key]=Math.max(0,state[key]+delta);persist();render();
}));
document.getElementById("resetCounters").onclick=()=>{
  if(confirm("¿Restablecer los contadores de transporte y almuerzos de esta quincena?")){
    state.transport=0;state.lunch=0;persist();render();
  }
};
document.getElementById("addOtherBtn").onclick=()=>openModal("expenseModal");
document.getElementById("addSavingBtn").onclick=()=>openModal("savingModal");
document.querySelectorAll(".modal-close").forEach(x=>x.onclick=()=>closeModal(x.dataset.close));
function openModal(id){document.getElementById(id).classList.remove("hidden")}
function closeModal(id){document.getElementById(id).classList.add("hidden")}

document.getElementById("expenseForm").onsubmit=e=>{
  e.preventDefault();
  state.expenses.push({description:expenseDescription.value.trim(),category:expenseCategory.value,amount:Number(expenseAmount.value),date:new Date().toISOString()});
  persist();e.target.reset();closeModal("expenseModal");render();
};
document.getElementById("savingForm").onsubmit=e=>{
  e.preventDefault();
  const amount=Number(savingAmount.value);
  if(amount>balance()){alert("No puedes ahorrar más dinero del saldo disponible.");return}
  state.savings.push({amount,date:new Date().toISOString()});state.saved+=amount;
  persist();e.target.reset();closeModal("savingModal");render();
};
document.getElementById("saveSettings").onclick=()=>{
  state.initialMoney=Number(settingInitial.value)||0;
  state.transportPrice=Number(settingTransport.value)||0;
  state.lunchPrice=Number(settingLunch.value)||0;
  state.goal=Number(settingGoal.value)||0;
  state.goalName=settingGoalName.value.trim()||"Meta de ahorro";
  persist();render();alert("Configuración guardada.");
};

document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
render();
