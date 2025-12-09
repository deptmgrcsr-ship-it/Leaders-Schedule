/* ===== CONFIG - set your Apps Script URL here ===== */
const API_URL = "https://script.google.com/macros/s/AKfycbwyJ7K43EjyQjS5KUe0My2EEpuQcVdnU-CYXQ97AA8TRQEx5UaIfFYpU1JOdejljWSlVg/exec";

/* ===== UI / data config ===== */
const AGENTS = ["Dyrine","Janrey","Jang","Marimar","Ria","Ralph","Paul"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const STORAGE_SELECTED = "selected_agent_session"; // sessionStorage key to remember chosen name

/* ===== time options (30-min) ===== */
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

/* ===== DOM refs ===== */
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

/* ===== app state ===== */
let sheetData = []; // array of row objects from sheet
let headers = [];   // sheet headers (column names)
let currentAgent = null;
let editingAgent = null;
let editingDayIdx = null;
let editingEntryBackup = null; // backup before editing

/* ===== init UI ===== */
populateNameSelect();
populateTimeSelects();
setupEventHandlers();
setWeekNote();
loadSheetAndRender();

/* ===== populate functions ===== */
function populateNameSelect(){
  nameSelect.innerHTML = "";
  AGENTS.forEach(a=>{
    const o = document.createElement("option");
    o.value = a; o.text = a;
    nameSelect.appendChild(o);
  });
  // preselect from session if exists
  const prev = sessionStorage.getItem(STORAGE_SELECTED);
  if(prev) nameSelect.value = prev;
}
function populateTimeSelects(){
  startSel.innerHTML = ""; endSel.innerHTML = "";
  TIME_OPTS.forEach(opt=>{
    const o1 = document.createElement("option"); o1.value = opt.value; o1.text = opt.label;
    const o2 = document.createElement("option"); o2.value = opt.value; o2.text = opt.label;
    startSel.appendChild(o1); endSel.appendChild(o2);
  });
}

/* ===== event handlers ===== */
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
      // apply immediately to entry and go to confirm save flow
      editingEntryBackup = null;
      const entry = { type: status, start: null, end: null };
      openConfirmSave(entry);
    });
  });

  saveBtn.addEventListener("click", ()=>{
    // prepare entry and open confirm modal
    const s = startSel.value; const e = endSel.value;
    if(!s || !e){ alert("Choose start and end time or pick a status."); return; }
    if(s === e){ alert("Start and end cannot be the same."); return; }
    const entry = { type: null, start: s, end: e };
    openConfirmSave(entry);
  });

  cancelBtn.addEventListener("click", ()=>{ closeModal(); });

  clearBtn.addEventListener("click", ()=>{
    if(!confirm("Clear this cell?")) return;
    const entry = { type: null, start: null, end: null };
    openConfirmSave(entry);
  });

  goBackBtn.addEventListener("click", ()=>{
    confirmModal.style.display = "none";
    // restore editing modal so they can continue editing
    modalWrap.style.display = "flex";
  });

  confirmSaveBtn.addEventListener("click", async ()=>{
    confirmModal.style.display = "none";
    // perform save -> send to Google Sheet
    await performSaveToSheet(editingAgent, editingDayIdx, editingEntryBackup);
    closeModal();
    await loadSheetAndRender(); // refresh from sheet
    showToast("Saved successfully.");
  });

  downloadBtn.addEventListener("click", downloadMainAsImage);

  // close modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach(back=>{
    back.addEventListener("click", (e)=>{ if(e.target === back){ back.style.display = "none"; } });
  });
}

/* ===== load sheet data ===== */
async function loadSheetAndRender(){
  try {
    const resp = await fetch(API_URL);
    if(!resp.ok) throw new Error("Failed to fetch sheet");
    const rows = await resp.json();
    sheetData = rows;
    headers = rows.length ? Object.keys(rows[0]) : [];
    renderGridFromSheet(rows);
  } catch(err){
    console.error(err);
    alert("Failed to load shared schedule. Check API / sheet permissions.");
    // fallback: render empty grid with agents but no data
    renderEmptyGrid();
  }
}

/* ===== render functions ===== */
function renderGridFromSheet(rows){
  // create a lookup by name
  const map = {};
  rows.forEach(r=> { map[r["Name"]] = r; });
  bodyRows.innerHTML = "";

  AGENTS.forEach(agent=>{
    const tr = document.createElement("tr");
    // name col
    const th = document.createElement("th"); th.className = "nameCol";
    th.innerHTML = `<div class="nameLabel"><div class="namePill">${agent}</div></div>`;
    tr.appendChild(th);

    // day cells
    DAYS.forEach((d, idx)=>{
      const td = document.createElement("td");
      td.style.minWidth = "120px";
      const entryObj = map[agent] || {};
      // sheet headers expected like "Monday Start", "Monday End"
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
        // display AM/PM format two-line; we store as AM/PM strings
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
        // only allow editing of selected user
        if(!currentAgent){
          // show name modal if not chosen
          nameModal.style.display = "flex";
          return;
        }
        if(currentAgent !== agent){
          // politely refuse editing others
          alert(`You are logged as ${currentAgent}. Please edit only your row.`);
          // optional: scroll to their row
          scrollToAgent(currentAgent);
          return;
        }
        // open edit modal for this agent/day
        openEditModal(agent, idx, startVal, endVal, status);
      });

      td.appendChild(div);
      tr.appendChild(td);
    });

    bodyRows.appendChild(tr);
  });

  highlightSelectedRow();
}

/* ===== helpers: day name mapping ===== */
function dayFull(short){
  const map = {Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday",Sat:"Saturday",Sun:"Sunday"};
  return map[short] || short;
}

/* ===== interpret status from sheet values (simple rule) =====
   We use the sheet cell values to hold:
   - statuses: exact strings "DAY OFF","LEAVE","TRAINEE","ROOT" stored in start cell (or end)
   - or start/end times in AM/PM strings e.g. "10:00 PM"
*/
function interpretStatus(startVal, endVal){
  const statuses = ["DAY OFF","LEAVE","TRAINEE","ROOT"];
  if(statuses.includes(startVal)) return startVal;
  if(statuses.includes(endVal)) return endVal;
  // otherwise no status
  return null;
}

/* ===== open edit modal ===== */
function openEditModal(agent, dayIdx, startVal, endVal, status){
  editingAgent = agent; editingDayIdx = dayIdx;
  // backup for confirm save
  editingEntryBackup = { start: startVal || null, end: endVal || null, type: status || null };

  modalSubtitle.textContent = `${agent} • ${DAYS[dayIdx]}`;

  // if status present, clear selects and visually let user pick status OR choose times
  if(status){
    startSel.selectedIndex = 0;
    endSel.selectedIndex = 0;
  } else {
    // set selects to the given values if they match a TIME_OPTS label
    const startValIdx = TIME_OPTS.findIndex(t => t.label === startVal || t.value === startVal);
    const endValIdx = TIME_OPTS.findIndex(t => t.label === endVal || t.value === endVal);
    startSel.selectedIndex = startValIdx >=0 ? startValIdx : 0;
    endSel.selectedIndex = endValIdx >=0 ? endValIdx : 0;
  }

  modalWrap.style.display = "flex";
}

/* ===== open confirm save modal =====
   We set editingEntryBackup temporarily as the data to PUT.
*/
function openConfirmSave(entry){
  // entry: {type, start, end}
  editingEntryBackup = entry;
  // close edit modal and open confirm
  modalWrap.style.display = "none";
  confirmText.textContent = `Save changes for ${editingAgent} • ${DAYS[editingDayIdx]}?`;
  confirmModal.style.display = "flex";
}

/* ===== perform save to sheet (POST) =====
   Build payload like:
   { "Name": "Dyrine", "Monday Start": "10:00 PM", "Monday End": "07:00 AM" }
   For statuses we write the status as the Start cell and clear End.
*/
async function performSaveToSheet(agent, dayIdx, entry){
  if(!agent || dayIdx === null) return;
  // build payload
  const dayFullName = dayFull(DAYS[dayIdx]);
  const startHeader = `${dayFullName} Start`;
  const endHeader = `${dayFullName} End`;

  const payload = { "Name": agent };

  if(entry.type){
    // write type string into START, clear END
    payload[startHeader] = entry.type;
    payload[endHeader] = "";
  } else {
    // we store times in AM/PM format (user choice B)
    // entry.start and entry.end are values like "22:00" - convert to label "10:00 PM"
    const startLabel = labelFromValue(entry.start);
    const endLabel = labelFromValue(entry.end);
    payload[startHeader] = startLabel;
    payload[endHeader] = endLabel;
  }

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    if(!resp.ok && text !== "success") {
      console.error("POST failed", resp.status, text);
      alert("Failed to save to sheet. Check Apps Script permissions.");
    }
  } catch(err){
    console.error(err);
    alert("Failed to save. Check your network or API.");
  }
}

/* ===== util: labelFromValue - convert "HH:MM" -> AM/PM label (user chose Option B) ===== */
function labelFromValue(val){
  if(!val) return "";
  // if already in AM/PM (sheet style), return as is
  if(val.includes("AM") || val.includes("PM")) return val;
  const [h,m] = val.split(":").map(Number);
  return formatLabel(h,m);
}

/* ===== isOvernight (based on HH:MM string or AM/PM label) ===== */
function toMinutesFromVal(val){
  if(!val) return 0;
  if(val.includes("AM") || val.includes("PM")){
    // parse e.g. "10:00 PM" or "10 PM"
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

/* ===== highlight selected agent row and dim others ===== */
function highlightSelectedRow(){
  const rows = Array.from(document.querySelectorAll("#bodyRows > tr"));
  rows.forEach(tr=>{
    const agentName = tr.querySelector(".namePill").textContent.trim();
    if(currentAgent && agentName === currentAgent){
      tr.classList.add("row-highlight");
      tr.classList.remove("dim-row");
      // scroll into view
      tr.scrollIntoView({behavior:"smooth", block:"center"});
    } else {
      if(currentAgent) tr.classList.add("dim-row"); else tr.classList.remove("dim-row");
      tr.classList.remove("row-highlight");
    }
  });
}

/* ===== scroll to agent's row ===== */
function scrollToAgent(agent){
  const tr = Array.from(document.querySelectorAll("#bodyRows > tr")).find(t=> t.querySelector(".namePill").textContent.trim()===agent);
  if(tr) tr.scrollIntoView({behavior:"smooth", block:"center"});
}

/* ===== render empty grid fallback ===== */
function renderEmptyGrid(){
  bodyRows.innerHTML = "";
  AGENTS.forEach(agent=>{
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.className = "nameCol"; th.innerHTML = `<div class="nameLabel"><div class="namePill">${agent}</div></div>`;
    tr.appendChild(th);
    DAYS.forEach((d, idx)=>{
      const td = document.createElement("td"); td.style.minWidth="120px";
      const div = document.createElement("div"); div.className="cell"; div.innerHTML = `<div style="opacity:.6">—</div>`;
      div.addEventListener("click", ()=>{ nameModal.style.display = "flex"; });
      td.appendChild(div); tr.appendChild(td);
    });
    bodyRows.appendChild(tr);
  });
}

/* ===== download main as image (captures <main class="page wrap">) ===== */
async function downloadMainAsImage(){
  const target = document.querySelector("main.page.wrap");
  if(!target) return alert("Main not found.");
  // hide download button while capturing (so it does not appear)
  const btn = document.getElementById("downloadBtn");
  btn.style.visibility = "hidden";

  try {
    const canvas = await html2canvas(target, {scale:2, useCORS:true, backgroundColor: null});
    btn.style.visibility = "visible";
    const link = document.createElement("a");
    link.download = `schedule-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    link.remove();
  } catch(err){
    console.error(err);
    btn.style.visibility = "visible";
    alert("Failed to capture image.");
  }
}

/* ===== setWeekNote ===== */
function setWeekNote(){
  const note = document.getElementById("weekNote");
  const now = new Date();
  const day = now.getDay(); // 0 sunday
  const diffToMon = (day === 0) ? -6 : 1 - day;
  const start = new Date(now); start.setDate(now.getDate() + diffToMon);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  function fm(d){ return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
  note.textContent = `Week of ${fm(start)} – ${fm(end)}`;
}
