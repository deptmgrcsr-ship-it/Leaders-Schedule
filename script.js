// ============================
//  Configuration
// ============================
const API_URL = "https://script.google.com/macros/s/AKfycbzyhlxVVdCoi2H5V8Bn2U3x4pELmlVo1O_4NwD1jILlK0xPueMOlVR1DbZFUpPvcfiCKg/exec";

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

function formatTime(value) {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute:"2-digit" });
}

// ============================
//  Load Employees
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
        console.error(err);
        showLoader(false);
    }
}

// ============================
//  Load Schedule
// ============================
async function loadSchedule() {
    try {
        showLoader(true);

        const name = document.getElementById("employeeSelect").value;
        const week = document.getElementById("weekDate").value;

        if (!name || !week) return showLoader(false);

        const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}&week=${week}`);
        const json = await res.json();

        if (!json.success || !json.data) {
            showLoader(false);
            return;
        }

        ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
            document.getElementById(day + "Start").value = formatTime(json.data[day + " Start"]);
            document.getElementById(day + "End").value = formatTime(json.data[day + " End"]);
        });

        showLoader(false);
    } catch (err) {
        console.error(err);
        showLoader(false);
    }
}

// ============================
//  Submit / Update Schedule
// ============================
async function submitSchedule() {
    const emp = document.getElementById("employeeSelect").value;
    const week = document.getElementById("weekDate").value;

    if (!emp || !week) {
        alert("Please select employee and choose week.");
        return;
    }

    let schedule = {};

    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
        schedule[day + " Start"] = document.getElementById(day + "Start").value;
        schedule[day + " End"] = document.getElementById(day + "End").value;
    });

    try {
        showLoader(true);

        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: emp,
                week: week,
                schedule: schedule
            })
        });

        const json = await res.json();

        if (json.success) {
            showSuccess("Saved successfully!");
            loadSchedule();
        } else {
            alert("Save failed. Please try again.");
        }

        showLoader(false);
    } catch (err) {
        alert("Network error. Try again.");
        console.error(err);
        showLoader(false);
    }
}

// ============================
//  Reset
// ============================
function resetFields() {
    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(day => {
        document.getElementById(day + "Start").value = "";
        document.getElementById(day + "End").value = "";
    });
}

// ============================
//  Events
// ============================
document.getElementById("employeeSelect").addEventListener("change", loadSchedule);
document.getElementById("weekDate").addEventListener("change", loadSchedule);
saveBtn.addEventListener("click", submitSchedule);
updateBtn.addEventListener("click", submitSchedule);
resetBtn.addEventListener("click", resetFields);

// ============================
//  Init
// ============================
loadEmployees();
