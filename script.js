/* ====== CONFIG ====== */
const AGENTS = ["Dyrine","Janrey","Jang","Marimar","Ria","Ralph","Paul"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const STORAGE_KEY = "leaders_weekly_schedule_v2";

/* ====== TIME OPTIONS (30-min steps) ====== */
function buildTimeOptions(){
  const opts = [];
  for(let h=0; h<24; h++){
    for(let m=0; m<60; m+=30){
      const hh = String(h).padStart(2,"0");
      const mm = String(m).padStart(2,"0");
      const label = formatLabel(h, m);
      opts.push({value:`${hh}:${mm}`, label});
    }
  }
  return opts;
}
function formatLabel(h, m){
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return (m === 0) ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2,"0")} ${ampm}`;
}
const TIME_OPTS = buildTimeOptions();

/* ====== DATA MODEL ====== */
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || buildEmpty();
function buildEmpty(){
  const model = {};
  AGENTS.forEach(a => {
    model[a] = {};
    DAYS.forEach((d,i) => model[a][i] = {type:null, start:null, end:null});
  });
  return model;
}

/* ====== RENDER GRID ====== */
function renderGrid(){
  const tbody = document.getElementById("bodyRows");
  tbody.innerHTML = "";
  AGENTS.forEach(agent => {
    const tr = document.createElement("tr");

    // name column
    const th = document.createElement("th");
    th.className = "nameCol";
    th.innerHTML = `<div class="nameLabel"><div class="namePill">${agent}</div></div>`;
    tr.appendChild(th);

    // day cells
    DAYS.forEach((day, dayIdx) => {
      const td = document.createElement("td");
      td.style.minWidth = "120px";

      const entry = data[agent][dayIdx];
      const div = document.createElement("div");
      div.className = "cell";
      div.tabIndex = 0;
      div.setAttribute("role","button");
      div.setAttribute("data-agent", agent);
      div.setAttribute("data-day", dayIdx);

      if(entry.type === "DAY OFF"){
        div.innerHTML = `<div class="tag-dayoff">DAY OFF</div>`;
      } else if(entry.type === "LEAVE"){
        div.innerHTML = `<div class="tag-leave">LEAVE</div>`;
      } else if(entry.type === "TRAINEE"){
        div.innerHTML = `<div class="tag-trainee">TRAINEE</div>`;
      } else if(entry.type === "ROOT"){
        div.innerHTML = `<div class="tag-root">ROOT</div>`;
      } else if(entry.start && entry.end){
        // display two-line format, and include "next day" label if overnight (end <= start)
        const startLbl = labelFromValue(entry.start);
        const endLbl = labelFromValue(entry.end);
        const nextDay = isOvernight(entry.start, entry.end);
        if(nextDay){
          div.innerHTML = `<div class="tag-time">${startLbl} –${"\n"}next day ${endLbl}</div>`;
        } else {
          div.innerHTML = `<div class="tag-time">${startLbl} –${"\n"}${endLbl}</div>`;
        }
      } else {
        div.innerHTML = `<div style="opacity:.6">—</div>`;
      }

      div.addEventListener("click", ()=> openModal(agent, dayIdx));
      td.appendChild(div);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/* ====== helpers ====== */
function labelFromValue(val){
  const it = TIME_OPTS.find(t => t.value === val);
  return it ? it.label : val;
}
function toMinutes(val){ // "HH:MM" -> minutes since midnight
  const [h,m] = val.split(":").map(Number);
  return h*60 + m;
}
function isOvernight(start, end){
  if(!start || !end) return false;
  return toMinutes(end) <= toMinutes(start);
}

/* ====== MODAL ====== */
const modalWrap = document.getElementById("modalWrap");
const modalSubtitle = document.getElementById("modalSubtitle");
const startSel = document.getElementById("startSel");
const endSel = document.getElementById("endSel");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");
let currentAgent = null;
let currentDay = null;

function populateTimeSelects(){
  startSel.innerHTML = "";
  endSel.innerHTML = "";
  TIME_OPTS.forEach(opt => {
    const o1 = document.createElement("option"); o1.value = opt.value; o1.text = opt.label;
    const o2 = document.createElement("option"); o2.value = opt.value; o2.text = opt.label;
    startSel.appendChild(o1); endSel.appendChild(o2);
  });
}
populateTimeSelects();

function openModal(agent, dayIdx){
  currentAgent = agent; currentDay = dayIdx;
  modalSubtitle.textContent = `${agent} • ${DAYS[dayIdx]}`;
  // prefill
  const e = data[agent][dayIdx];
  if(e.start) startSel.value = e.start; else startSel.selectedIndex = 0;
  if(e.end) endSel.value = e.end; else endSel.selectedIndex = 0;
  // show modal
  modalWrap.style.display = "flex";
  modalWrap.setAttribute("aria-hidden","false");
  setTimeout(()=> startSel.focus(), 80);
}

/* status button behavior */
document.querySelectorAll(".sbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const status = btn.getAttribute("data-status");
    data[currentAgent][currentDay] = { type: status, start:null, end:null };
    saveAndClose();
  });
});

saveBtn.addEventListener("click", ()=>{
  const s = startSel.value;
  const e = endSel.value;
  if(!s || !e){
    alert("Please choose start and end time (or pick a status).");
    return;
  }

  // allow overnight shifts — treat end <= start as next-day
  // but prevent identical start==end
  if(s === e){
    alert("Start and end cannot be the same. Please choose a correct time range.");
    return;
  }

  data[currentAgent][currentDay] = { type:null, start: s, end: e };
  saveAndClose();
});

cancelBtn.addEventListener("click", ()=>{
  modalWrap.style.display = "none";
  modalWrap.setAttribute("aria-hidden","true");
  currentAgent = null; currentDay = null;
});

clearBtn.addEventListener("click", ()=>{
  if(!confirm("Clear this cell?")) return;
  data[currentAgent][currentDay] = {type:null, start:null, end:null};
  saveAndClose();
});

function saveAndClose(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  modalWrap.style.display = "none";
  modalWrap.setAttribute("aria-hidden","true");
  currentAgent = null; currentDay = null;
  renderGrid();
}

/* close by clicking backdrop */
modalWrap.addEventListener("click", (e)=>{
  if(e.target === modalWrap) cancelBtn.click();
});

/* initialize */
renderGrid();

/* optional: show week of note */
(function setWeekNote(){
  const note = document.getElementById("weekNote");
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1); // monday
  const end = new Date(start); end.setDate(start.getDate() + 6);
  function fm(d){ return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
  note.textContent = `Week of ${fm(start)} – ${fm(end)}`;
})();

document.getElementById("downloadScheduleBtn").addEventListener("click", () => {
  const target = document.querySelector("main.page.wrap");

  html2canvas(target, {
    scale: 2,           // Higher quality
    useCORS: true,
    allowTaint: true
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "schedule.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
});
