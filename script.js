// ============================
//  Configuration
// ============================
const API_URL = "https://script.google.com/macros/s/AKfycbzaJPbjUXw_lI17cJBgHT3NV4CN0MOP-jlmkDb2XocFm-GQ5Hl1gLatt192fdk09a9m/exec";

// ============================
//  DOM Elements
// ============================
const loader = document.getElementById("loader");
const saveBtn = document.getElementById("saveBtn");
const updateBtn = document.getElementById("updateBtn");
const resetBtn = document.getElementById("resetBtn");
const successDiv = document.getElementById("success");

// ============================
//  Utility Functions
// ============================
function showLoader(show) {
    loader.style.display = show ? "block" : "none";
}

function showSuccess(msg) {
    successDiv.style.display = "block";
    successDiv.innerText = msg;
    setTimeout(() => (successDiv.style.display = "none"), 3000);
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function convertToDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return "";
    const [h, m] = timeStr.split(":");
    let date = new Date(dateStr);
    date.setHours(h, m);
    return date.toISOString();
}

// ============================
//  Load Employee List
// ============================
async function loadEmployees() {
    try {
        showLoader(true);

        const res = await fetch(API_URL);
        const json = await res.json();

        const select = document.getElementById("employeeSelect");
        select.innerHTML = "";

        json.data.forEach(emp => {
            const opt = document.createElement("option");
            opt.value = emp.Name;
            opt.textContent = emp.Name;
            select.appendChild(opt);
        });

        showLoader(false);
    } catch (err) {
        console.error("Error loading employees:", err);
        showLoader(false);
    }
}

// ============================
//  Load Existing Schedule
// ============================
async function loadSchedule() {
    try {
        showLoader(true);

        const name = document.getElementById("employeeSelect").value;
        const date = document.getElementById("weekDate").value;

        if (!name || !date) {
            showLoader(false);
            return;
        }

        const res = await fetch(API_URL + `?name=${encodeURIComponent(name)}&date=${date}`);
        const json = await res.json();

        if (!json || !json.data) {
            showLoader(false);
            return;
        }

        ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
            document.getElementById(day + "Start").value = formatTime(json.data[day + " Start"]);
            document.getElementById(day + "End").value = formatTime(json.data[day + " End"]);
        });

        showLoader(false);
    } catch (err) {
        console.error("Error loading schedule:", err);
        showLoader(false);
    }
}

// ============================
//  Submit Schedule (Save New)
// ============================
async function submitSchedule() {
    const emp = document.getElementById("employeeSelect").value;
    const date = document.getElementById("weekDate").value;

    if (!emp || !date) {
        alert("Please select employee and date.");
        return;
    }

    let schedule = {};
    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
        const start = document.getElementById(day + "Start").value;
        const end = document.getElementById(day + "End").value;
        schedule[day + "Start"] = start;
        schedule[day + "End"] = end;
    });

    try {
        showLoader(true);

        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ name: emp, date: date, schedule: schedule })
        });

        const json = await res.json();

        if (json.status === "success") {
            showSuccess("Schedule saved successfully.");
        }

        showLoader(false);
    } catch (err) {
        console.error("Error saving schedule:", err);
        showLoader(false);
    }
}

// ============================
//  Update Existing Schedule
// ============================
async function updateSchedule() {
    return submitSchedule(); 
}

// ============================
//  Reset Fields
// ============================
function resetFields() {
    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
        document.getElementById(day + "Start").value = "";
        document.getElementById(day + "End").value = "";
    });
}

// ============================
//  Event Listeners
// ============================
document.getElementById("employeeSelect").addEventListener("change", loadSchedule);
document.getElementById("weekDate").addEventListener("change", loadSchedule);

saveBtn.addEventListener("click", submitSchedule);
updateBtn.addEventListener("click", updateSchedule);
resetBtn.addEventListener("click", resetFields);

// ============================
//  Init
// ============================
loadEmployees();
