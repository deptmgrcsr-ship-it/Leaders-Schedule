/* ====== CONFIG ====== */
const API_URL = "https://script.google.com/macros/s/AKfycbzyhlxVVdCoi2H5V8Bn2U3x4pELmlVo1O_4NwD1jILlK0xPueMOlVR1DbZFUpPvcfiCKg/exec"; // <- use your Drive API URL
const STORAGE_SELECTED = "selected_agent_session";

/* ====== DOM refs ====== */
const bodyRows = document.getElementById("bodyRows");
const modalWrap = document.getElementById("modalWrap");
const startSel = document.getElementById("startSel");
const endSel = document.getElementById("endSel");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

const nameModal = document.getElementById("nameModal");
const nameSelect = document.getElementById("nameSelect");
const confirmNameBtn = document.getElementById("confirmNameBtn");

const confirmModal = document.getElementById("confirmModal");
const confirmText = document.getElementById("confirmText");
const goBackBtn = document.getElementById("goBackBtn");
const confirmSaveBtn = document.getElementById("confirmSaveBtn");

const modalSubtitle = document.getElementById("modalSubtitle");
const weekNote = document.getElementById("weekNote");

/* ====== App state ====== */
let allData = {};      // data loaded from Drive JSON: { "Dyrine": { "Monday Start": "...", ... }, ... }
let agentList = [];    // ordered list of names to render
let currentAgent = null;
let editingAgent = null;
let editingDayIdx = null;
let pendingEntry = null; // {type, start, end}

/* ====== Time options ====== */
function buildTimeOptions(){
  const opts=[];
  for(let h=0; h<24; h++){
    for(let m=0; m<60; m+=30){
      const hh = String(h).padStart(2,"0");
      const mm = String(m).padStart(2,"0");
      opts.push({value:`${hh}:${mm}`, label:formatLabel(h,m)});
    }
  }
  return opts;
}
function formatLabel(h,m){
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return (m === 0) ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2,"0")} ${ampm}`;
}
const TIME_OPTS = buildTimeOptions();

/* ====== Days mapping ====== */
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function dayFull(short){
  const map = {Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday",Sat:"Saturday",Sun:"Sunday"};
  return map[short] || short;
}

/* ====== Init ====== */
populateTimeSelects();
setupEventHandlers();
setWeekNote();
loadDataAndRender();

/* ====== Populate selects ====== */
function populateTimeSelects(){
  startSel.innerHTML = ""; endSel.innerHTML = "";
  TIME_OPTS.forEach(opt=>{
    const o1 = document.createElement("option"); o1.value = opt.value; o1.text = opt.label;
    const o2 = document.createElement("option"); o2.value = opt.value; o2.text = opt.label;
    startSel.appendChild(o1); endSel.appendChild(o2);
  });
}

/* ====== Event handlers ====== */
function setupEventHandlers(){
  confirmNameBtn.addEventListener("click", ()=>{
    const name = nameSelect.value;
    if(!name) return alert("Choose your name.");
    currentAgent = name;
    sessionStorage.setItem(STORAGE_SELECTED, name);
    nameModal.style.display = "none";
    highlightSelectedRow();
  });

  // status buttons
  document.querySelectorAll(".sbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const status = btn.getAttribute("data-status");
      pendingEntry = { type: status, start: null, end: null };
      openConfirmSave();
    });
  });

  saveBtn.addEventListener("click", ()=>{
    const s = startSel.value; const e = endSel.value;
    if(!s || !e){ alert("Choose start and end time or pick a status."); return; }
    if(s === e){ alert("Start and end cannot be the same."); return; }
    pendingEntry = { type: null, start: s, end: e };
    openConfirmSave();
  });

  cancelBtn.addEventListener("click", ()=>{ closeModal(); });

  clearBtn.addEventListener("click", ()=>{
    if(!confirm("Clear this cell?")) return;
    pendingEntry = { type: null, start: null, end: null };
    openConfirmSave();
  });

  goBackBtn.addEventListener("click", ()=>{
    confirmModal.style.display = "none";
    modalWrap.style.display = "flex";
  });

  confirmSaveBtn.addEventListener("click", async ()=>{
    confirmModal.style.display = "none";
    await performSaveForDay(editingAgent, editingDayIdx, pendingEntry);
    closeModal();
    await loadDataAndRender();
    alert("Saved successfully.");
  });

  downloadBtn && downloadBtn.addEventListener("click", downloadMainAsImage);

  // close modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach(back=>{
    back.addEventListener("click", (e)=>{ if(e.target === back){ back.style.display = "none"; } });
  });
}

/* ====== Load data from Drive API and render ====== */
async function loadDataAndRender(){
  try {
    const resp = await fetch(API_URL);
    const json = await resp.json();
    if(!json || !json.success) {
      console.error("Failed to load data", json);
      allData = {};
    } else {
      allData = json.data || {};
    }

    // agent list: prefer current keys; if empty, fallback to session stored or sample
    agentList = Object.keys(allData);
    // If no agents in JSON, try to populate names from a default list visible on the sheet previously
    if(agentList.length === 0){
      // fallback names hardcoded if needed
      agentList = ["Dyrine","Janrey","Jang","Marimar","Ria","Ralph","Paul"];
    }

    // populate nameSelect if empty / not selected
    nameSelect.innerHTML = "";
    agentList.forEach(n=>{
      const o = document.createElement("option"); o.value = n; o.text = n; nameSelect.appendChild(o);
    });
    const prev = sessionStorage.getItem(STORAGE_SELECTED);
    if(prev) nameSelect.value = prev;

    renderGrid();
  } catch(err){
    console.error(err);
    alert("Failed to load shared schedule. Check API / network.");
    // still render fallback grid
    renderFallbackGrid();
  }
}

/* ====== Render grid ====== */
function renderGrid(){
  bodyRows.innerHTML = "";
  agentList.forEach(agent=>{
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.className = "nameCol";
    th.innerHTML = `<div class="nameLabel"><div class="namePill">${agent}</div></div>`;
    tr.appendChild(th);

    const entryObj = allData[agent] || {};

    DAYS.forEach((d, idx)=>{
      const td = document.createElement("td");
      td.style.minWidth = "120px";
      const startHeader = `${dayFull(d)} Start`;
      const endHeader = `${dayFull(d)} End`;
      const startVal = entryObj[startHeader] || "";
      const endVal = entryObj[endHeader] || "";
      const status = interpretStatus(startVal, endVal);

      const div = document.createElement("div");
      div.className = "cell";
      div.tabIndex = 0;
      div.setAttribute("data-agent", agent);
      div.setAttribute("data-day", idx);

      if(status === "DAY OFF"){
        div.innerHTML = `<div class="tag-dayoff">DAY OFF</div>`;
      } else if(status === "LEAVE"){
        div.innerHTML = `<div class="tag-leave">LEAVE</div>`;
      } else if(status === "TRAINEE"){
        div.innerHTML = `<div class="tag-trainee">TRAINEE</div>`;
      } else if(status === "ROOT"){
        div.innerHTML = `<div class="tag-root">ROOT</div>`;
      } else if(startVal && endVal){
        const startLbl = startVal;
        const endLbl = endVal;
        const overnight = isOvernightValue(startVal, endVal);
        if(overnight){
          div.innerHTML = `<div class="tag-time">${startLbl} –${"\n"}next day ${endLbl}</div>`;
        } else {
          div.innerHTML = `<div class="tag-time">${startLbl} –${"\n"}${endLbl}</div>`;
        }
      } else {
        div.innerHTML = `<div style="opacity:.6">—</div>`;
      }

      div.addEventListener("click", ()=>{
        // if name not chosen, show modal
        const prevName = sessionStorage.getItem(STORAGE_SELECTED);
        if(!prevName){
          nameModal.style.display = "flex";
          return;
        }
        currentAgent = prevName;
        if(currentAgent !== agent){
          alert(`You are logged as ${currentAgent}. Please edit only your row.`);
          scrollToAgent(currentAgent);
          return;
        }
        openEditModal(agent, idx, startVal, endVal, status);
      });

      td.appendChild(div);
      tr.appendChild(td);
    });

    bodyRows.appendChild(tr);
  });

  highlightSelectedRow();
}

/* ====== Interpret status ====== */
function interpretStatus(startVal,endVal){
  const statuses = ["DAY OFF","LEAVE","TRAINEE","ROOT"];
  if(statuses.includes(startVal)) return startVal;
  if(statuses.includes(endVal)) return endVal;
  return null;
}

/* ====== Open edit modal ====== */
function openEditModal(agent, dayIdx, startVal, endVal, status){
  editingAgent = agent; editingDayIdx = dayIdx;
  pendingEntry = { start: startVal || null, end: endVal || null, type: status || null };

  modalSubtitle.textContent = `${agent} • ${DAYS[dayIdx]}`;

  if(status){
    startSel.selectedIndex = 0;
    endSel.selectedIndex = 0;
  } else {
    const startValIdx = TIME_OPTS.findIndex(t => t.label === startVal || t.value === startVal);
    const endValIdx = TIME_OPTS.findIndex(t => t.label === endVal || t.value === endVal);
    startSel.selectedIndex = startValIdx >=0 ? startValIdx : 0;
    endSel.selectedIndex = endValIdx >=0 ? endValIdx : 0;
  }

  modalWrap.style.display = "flex";
}

/* ====== Confirm flow ====== */
function openConfirmSave(){
  // pendingEntry should be set
  confirmText.textContent = `Save changes for ${editingAgent} • ${DAYS[editingDayIdx]}?`;
  modalWrap.style.display = "none";
  confirmModal.style.display = "flex";
}

/* ====== Save to Drive via POST ====== */
async function performSaveForDay(agent, dayIdx, entry){
  if(!agent || dayIdx === null) return;
  const dayName = dayFull(DAYS[dayIdx]);
  const startHeader = `${dayName} Start`;
  const endHeader = `${dayName} End`;

  // prepare the schedule object to send: copy existing then update fields for the day
  const currentSchedule = Object.assign({}, allData[agent] || {});
  if(entry.type){
    currentSchedule[startHeader] = entry.type;
    currentSchedule[endHeader] = "";
  } else {
    const startLabel = labelFromValue(entry.start);
    const endLabel = labelFromValue(entry.end);
    currentSchedule[startHeader] = startLabel;
    currentSchedule[endHeader] = endLabel;
  }

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: agent, schedule: currentSchedule })
    });
    const j = await resp.json();
    if(!j || !j.success){
      console.error("Save failed", j);
      alert("Failed to save. Check API.");
    }
  } catch(err){
    console.error(err);
    alert("Failed to save. Check network.");
  }
}

/* ====== Helpers: labelFromValue ====== */
function labelFromValue(val){
  if(!val) return "";
  if(val.includes("AM") || val.includes("PM")) return val;
  const [h,m] = val.split(":").map(Number);
  return formatLabel(h,m);
}

/* ====== Overnight check ====== */
function toMinutesFromVal(val){
  if(!val) return 0;
  if(val.includes("AM") || val.includes("PM")){
    const parts = val.split(" ");
    const time = parts[0].split(":");
    let h = Number(time[0]); const m = time[1] ? Number(time[1]) : 0;
    const ampm = parts[1];
    if(ampm === "PM" && h !== 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    return h*60 + m;
  } else {
    const [h,m] = val.split(":").map(Number);
    return h*60 + m;
  }
}
function isOvernightValue(startLabel, endLabel){
  if(!startLabel || !endLabel) return false;
  const s = toMinutesFromVal(startLabel);
  const e = toMinutesFromVal(endLabel);
  return e <= s;
}

/* ====== Highlight / scroll ====== */
function highlightSelectedRow(){
  const rows = Array.from(document.querySelectorAll("#bodyRows > tr"));
  rows.forEach(tr=>{
    const agentName = tr.querySelector(".namePill").textContent.trim();
    const prev = sessionStorage.getItem(STORAGE_SELECTED);
    if(prev && agentName === prev){
      tr.classList.add("row-highlight");
      tr.classList.remove("dim-row");
      tr.scrollIntoView({behavior:"smooth", block:"center"});
    } else {
      if(prev) tr.classList.add("dim-row"); else tr.classList.remove("dim-row");
      tr.classList.remove("row-highlight");
    }
  });
}
function scrollToAgent(agent){
  const tr = Array.from(document.querySelectorAll("#bodyRows > tr")).find(t=> t.querySelector(".namePill").textContent.trim()===agent);
  if(tr) tr.scrollIntoView({behavior:"smooth", block:"center"});
}

/* ====== Fallback rendering ====== */
function renderFallbackGrid(){
  bodyRows.innerHTML = "";
  const fallback = ["Dyrine","Janrey","Jang","Marimar","Ria","Ralph","Paul"];
  fallback.forEach(agent=>{
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.className = "nameCol"; th.innerHTML = `<div class="nameLabel"><div class="namePill">${agent}</div></div>`;
    tr.appendChild(th);
    DAYS.forEach(()=>{ const td=document.createElement("td"); td.style.minWidth="120px"; const div=document.createElement("div"); div.className="cell"; div.innerHTML=`<div style="opacity:.6">—</div>`; td.appendChild(div); tr.appendChild(td); });
    bodyRows.appendChild(tr);
  });
}

/* ====== Download as image ====== */
async function downloadMainAsImage(){
  const target = document.querySelector("main.page.wrap");
  if(!target) return alert("Main not found.");
  const btn = document.getElementById("downloadBtn");
  if(btn) btn.style.visibility = "hidden";
  try {
    const canvas = await html2canvas(target, {scale:2, useCORS:true, backgroundColor: null});
    if(btn) btn.style.visibility = "visible";
    const link = document.createElement("a");
    link.download = `schedule-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch(err){
    if(btn) btn.style.visibility = "visible";
    alert("Failed to capture image.");
  }
}

/* ====== Modal helpers ====== */
function closeModal(){
  modalWrap.style.display = "none";
  pendingEntry = null;
  editingAgent = null;
  editingDayIdx = null;
}

/* ====== Misc ====== */
function setWeekNote(){
  const now = new Date();
  const day = now.getDay(); // 0 sunday
  const diffToMon = (day === 0) ? -6 : 1 - day;
  const start = new Date(now); start.setDate(now.getDate() + diffToMon);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  function fm(d){ return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
  weekNote.textContent = `Week of ${fm(start)} – ${fm(end)}`;
}

/* ====== Utility: show toast fallback ====== */
function showToast(msg){
  alert(msg);
}
