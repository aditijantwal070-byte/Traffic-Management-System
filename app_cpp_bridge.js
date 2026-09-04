/* =========================================================
   C++ ENGINE FRONTEND BRIDGE
   Connects UI Controls & Canvas Renderer to C++ Server API
   ========================================================= */

const ROAD_NAMES = ["A", "B", "C", "D"];

class CppSimulationBridge {
    constructor() {
        this.roads = {
            A: { count: 0, waitTime: 0, hasEmergency: false, signalState: "red", remaining: 0, vehicles: [] },
            B: { count: 0, waitTime: 0, hasEmergency: false, signalState: "red", remaining: 0, vehicles: [] },
            C: { count: 0, waitTime: 0, hasEmergency: false, signalState: "red", remaining: 0, vehicles: [] },
            D: { count: 0, waitTime: 0, hasEmergency: false, signalState: "red", remaining: 0, vehicles: [] }
        };
        this.activeRoad = "A";
        this.cyclesRun  = 0;
        this.isRunning  = false;
        this.timer      = null;

        // Sync initial state from C++ backend
        this.fetchState();
    }

    async fetchState() {
        try {
            const res = await fetch('/api/state');
            if (res.ok) {
                const data = await res.json();
                this.updateFromCppData(data);
            }
        } catch (err) {
            console.warn("C++ server not reachable:", err.message);
        }
    }

    async sendAction(type, road = "") {
        try {
            const res = await fetch(`/api/action?type=${type}&road=${road}`);
            if (res.ok) {
                const data = await res.json();
                this.updateFromCppData(data);
            }
        } catch (err) {
            console.warn("Action error:", err.message);
        }
    }

    updateFromCppData(data) {
        if (!data) return;

        this.activeRoad = data.activeRoad;
        this.cyclesRun  = data.cyclesRun;

        for (const name of ROAD_NAMES) {
            if (data.roads && data.roads[name]) {
                const r = data.roads[name];
                this.roads[name].count        = r.count;
                this.roads[name].waitTime     = r.waitTime;
                this.roads[name].hasEmergency = r.hasEmergency;
                this.roads[name].signalState  = r.signalState;
                this.roads[name].remaining    = r.remaining;
                this.roads[name].vehicles     = (r.vehicles || []).map(v => ({ type: v.type }));
            }
        }

        if (data.logs) this.renderLogs(data.logs);
        this.updateUI();
    }

    renderLogs(logs) {
        const consoleEl = document.getElementById("logConsole");
        if (!consoleEl) return;

        consoleEl.innerHTML = "";
        logs.forEach(l => {
            const entry = document.createElement("div");
            entry.className = "log-entry";

            let catSpan = `<span class="log-category cat-info">[INFO]</span>`;
            if (l.category === "decide")    catSpan = `<span class="log-category cat-decide">[DECIDE]</span>`;
            if (l.category === "emergency") catSpan = `<span class="log-category cat-emergency">[EMERGENCY]</span>`;

            entry.innerHTML = `<span class="log-time">${l.timestamp}</span> ${catSpan} <span class="log-text">${l.message}</span>`;
            consoleEl.appendChild(entry);
        });
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    updateUI() {
        for (const name of ROAD_NAMES) {
            const road = this.roads[name];

            const metaEl = document.getElementById(`meta-${name}`);
            if (metaEl) {
                const word = road.count === 1 ? "vehicle" : "vehicles";
                metaEl.textContent = `${road.count} ${word} on road`;
            }

            const badgeEl = document.getElementById(`badge-${name}`);
            if (badgeEl) badgeEl.style.display = road.hasEmergency ? "inline-block" : "none";

            const indEl = document.getElementById(`ind-${name}`);
            if (indEl) {
                indEl.className = `status-indicator indicator-${name} ${road.signalState === "green" ? "active" : ""}`;
            }
        }
    }
}

// ── Global Bridge Instance ─────────────────────────────────────────────────
const sim = new CppSimulationBridge();

// ── UI Event Controllers ───────────────────────────────────────────────────
function toggleRun() {
    sim.isRunning = !sim.isRunning;
    const btn  = document.getElementById("toggleRunBtn");
    const icon = document.getElementById("runIcon");
    const text = document.getElementById("runText");

    if (sim.isRunning) {
        btn.classList.add("paused");
        icon.textContent = "⏸";
        text.textContent = "PAUSE";
        sim.timer = setInterval(() => sim.sendAction("step"), 1000);
    } else {
        btn.classList.remove("paused");
        icon.textContent = "▶";
        text.textContent = "RUN";
        clearInterval(sim.timer);
    }
}

function stepSimulation() {
    if (sim.isRunning) toggleRun();
    sim.sendAction("step");
}

function addCar(road)        { sim.sendAction("add_car",        road); }
function removeCar(road)     { sim.sendAction("remove_car",     road); }
function sendAmbulance(road) { sim.sendAction("send_ambulance", road); }
function randomizeTraffic()  { sim.sendAction("randomize"); }

window.addEventListener("DOMContentLoaded", () => sim.fetchState());
