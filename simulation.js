/* =========================================================
   TRAFFIC SIMULATION ENGINE (JS Implementation of TrafficState.h)
   ========================================================= */

const ROAD_NAMES = ["A", "B", "C", "D"];

// Data Structures mirroring C++ TrafficState.h
class Vehicle {
    constructor(type = "CAR") {
        this.type = type; // "CAR" or "AMBULANCE"
        this.id = Math.random().toString(36).substr(2, 9);
        this.progress = 0; // Position along road lane (0 to 1)
    }
}

class RoadState {
    constructor(name) {
        this.name = name;
        this.vehicles = []; // Array of Vehicle objects
        this.waitTime = 0; // Cumulative wait seconds
        this.hasEmergency = false;
        this.signalState = "red"; // "red", "amber", "green"
        this.remaining = 0; // seconds remaining in current signal phase
    }

    get count() {
        return this.vehicles.length;
    }
}

class ControllerConfig {
    constructor() {
        this.minGreen = 10;
        this.maxGreen = 50;
        this.waitWeight = 0.6;
    }
}

class TrafficStateEngine {
    constructor() {
        this.roads = {
            A: new RoadState("A"),
            B: new RoadState("B"),
            C: new RoadState("C"),
            D: new RoadState("D")
        };
        this.config = new ControllerConfig();
        this.activeRoad = "A";
        this.cyclesRun = 0;
        this.isRunning = false;
        this.timer = null;

        // Set initial state: e.g. Road A active green
        this.roads.A.signalState = "green";
        this.roads.A.remaining = 15;

        // Populate initial traffic matching the reference UI screenshot
        this.roads.A.vehicles = [new Vehicle("CAR"), new Vehicle("CAR"), new Vehicle("CAR")];
        this.roads.A.waitTime = 1;
        
        this.roads.B.vehicles = [new Vehicle("CAR"), new Vehicle("CAR"), new Vehicle("CAR"), new Vehicle("CAR")];
        this.roads.B.waitTime = 2;

        this.roads.C.vehicles = [new Vehicle("AMBULANCE")];
        this.roads.C.hasEmergency = true;
        this.roads.C.waitTime = 3;

        this.roads.D.vehicles = [];
        this.roads.D.waitTime = 0;

        // Trigger initial priority evaluation to handle emergency on C
        this.evaluateNextSignal(true);
    }

    // priority queue sorting formula:
    // priority = (count * 1.0) + (waitTime * waitWeight) + (hasEmergency ? 1000 : 0)
    calculatePriority(roadName) {
        const r = this.roads[roadName];
        if (r.count === 0 && !r.hasEmergency) return -1;
        let p = (r.count * 1.0) + (r.waitTime * this.config.waitWeight);
        if (r.hasEmergency) p += 1000;
        return p;
    }

    decideNextRoad() {
        let bestRoad = null;
        let maxPriority = -1;

        for (const name of ROAD_NAMES) {
            const p = this.calculatePriority(name);
            if (p > maxPriority) {
                maxPriority = p;
                bestRoad = name;
            }
        }

        // If no vehicles on any road, keep or cycle
        if (!bestRoad) {
            const currentIndex = ROAD_NAMES.indexOf(this.activeRoad);
            bestRoad = ROAD_NAMES[(currentIndex + 1) % ROAD_NAMES.length];
        }

        const isEmergency = this.roads[bestRoad].hasEmergency;
        
        // Calculate dynamic green duration based on vehicle load
        let greenDuration = Math.min(
            this.config.maxGreen,
            Math.max(this.config.minGreen, this.roads[bestRoad].count * 4)
        );

        if (isEmergency) {
            greenDuration = 12; // Emergency corridor priority time
        }

        return {
            roadName: bestRoad,
            isEmergency,
            greenDuration
        };
    }

    evaluateNextSignal(forceImmediate = false) {
        const decision = this.decideNextRoad();
        const prevActive = this.activeRoad;
        this.activeRoad = decision.roadName;

        // Update signal states
        for (const name of ROAD_NAMES) {
            if (name === this.activeRoad) {
                this.roads[name].signalState = "green";
                this.roads[name].remaining = decision.greenDuration;
            } else {
                this.roads[name].signalState = "red";
                this.roads[name].remaining = 0;
            }
        }

        if (decision.isEmergency) {
            this.addLog(`EMERGENCY OVERRIDE: Prioritizing Road ${decision.roadName} (${decision.greenDuration}s green)`, "emergency");
        } else if (prevActive !== decision.roadName || forceImmediate) {
            this.addLog(`Decision: Signal switched to Road ${decision.roadName} for ${decision.greenDuration}s`, "decide");
        }
    }

    tick() {
        this.cyclesRun++;
        const active = this.roads[this.activeRoad];

        // Increment wait times for stopped vehicles on red light roads
        for (const name of ROAD_NAMES) {
            if (name !== this.activeRoad && this.roads[name].count > 0) {
                this.roads[name].waitTime += 1;
            }
        }

        // Process active road green phase
        if (active.signalState === "green") {
            active.remaining--;

            // Move vehicles through intersection
            if (active.count > 0) {
                const hadEmergencyBefore = active.hasEmergency;

                // Vehicle leaves intersection
                const departed = active.vehicles.shift();
                
                // Recheck emergency status for active road
                active.hasEmergency = active.vehicles.some(v => v.type === "AMBULANCE");
                
                if (active.count === 0) {
                    active.waitTime = 0;
                }

                // Emergency Preemption: If the active road's emergency vehicle just cleared,
                // check if any other road has a waiting emergency vehicle.
                if (hadEmergencyBefore && !active.hasEmergency) {
                    const otherEmergencyRoad = ROAD_NAMES.find(name => name !== this.activeRoad && this.roads[name].hasEmergency);
                    if (otherEmergencyRoad) {
                        this.addLog(`Emergency vehicle passed on Road ${this.activeRoad}. Immediately preempting green signal for waiting emergency on Road ${otherEmergencyRoad}!`, "emergency");
                        this.evaluateNextSignal(true);
                        this.updateUI();
                        return;
                    }
                }
            }

            // Phase complete or road emptied
            if (active.remaining <= 0 || active.count === 0) {
                this.addLog(`Road ${this.activeRoad} green phase complete. Evaluating priorities...`, "info");
                this.evaluateNextSignal();
            }
        }

        this.updateUI();
    }

    addCar(roadName) {
        this.roads[roadName].vehicles.push(new Vehicle("CAR"));
        this.addLog(`Manual Action: Added Car to Road ${roadName} (Total: ${this.roads[roadName].count})`, "info");
        this.updateUI();
    }

    removeCar(roadName) {
        if (this.roads[roadName].count > 0) {
            const removed = this.roads[roadName].vehicles.pop();
            this.roads[roadName].hasEmergency = this.roads[roadName].vehicles.some(v => v.type === "AMBULANCE");
            this.addLog(`Manual Action: Removed vehicle from Road ${roadName}`, "info");
            this.updateUI();
        }
    }

    sendAmbulance(roadName) {
        this.roads[roadName].vehicles.unshift(new Vehicle("AMBULANCE"));
        this.roads[roadName].hasEmergency = true;
        this.addLog(`🚨 EMERGENCY: Ambulance dispatched to Road ${roadName}!`, "emergency");
        
        // Immediate recalculation for emergency dispatch
        if (this.activeRoad !== roadName) {
            this.evaluateNextSignal(true);
        }
        this.updateUI();
    }

    randomize() {
        for (const name of ROAD_NAMES) {
            const numCars = Math.floor(Math.random() * 5);
            this.roads[name].vehicles = [];
            for (let i = 0; i < numCars; i++) {
                this.roads[name].vehicles.push(new Vehicle("CAR"));
            }
            this.roads[name].hasEmergency = false;
            this.roads[name].waitTime = Math.floor(Math.random() * 5);
        }

        // 25% chance of ambulance on a random road
        if (Math.random() < 0.35) {
            const randomRoad = ROAD_NAMES[Math.floor(Math.random() * ROAD_NAMES.length)];
            this.roads[randomRoad].vehicles.unshift(new Vehicle("AMBULANCE"));
            this.roads[randomRoad].hasEmergency = true;
        }

        this.addLog("Randomized traffic load across all roads.", "info");
        this.evaluateNextSignal(true);
        this.updateUI();
    }

    addLog(message, category = "info") {
        const consoleEl = document.getElementById("logConsole");
        if (!consoleEl) return;

        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0];

        const entry = document.createElement("div");
        entry.className = "log-entry";

        let catSpan = `<span class="log-category cat-info">[INFO]</span>`;
        if (category === "decide") catSpan = `<span class="log-category cat-decide">[DECIDE]</span>`;
        if (category === "emergency") catSpan = `<span class="log-category cat-emergency">[EMERGENCY]</span>`;

        entry.innerHTML = `<span class="log-time">${timestamp}</span> ${catSpan} <span class="log-text">${message}</span>`;
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    updateUI() {
        for (const name of ROAD_NAMES) {
            const road = this.roads[name];
            
            // Meta string
            const metaEl = document.getElementById(`meta-${name}`);
            if (metaEl) {
                const vehicleWord = road.count === 1 ? "vehicle" : "vehicles";
                metaEl.textContent = `${road.count} ${vehicleWord} on road`;
            }

            // Emergency Badge
            const badgeEl = document.getElementById(`badge-${name}`);
            if (badgeEl) {
                badgeEl.style.display = road.hasEmergency ? "inline-block" : "none";
            }

            // Signal status indicator
            const indEl = document.getElementById(`ind-${name}`);
            if (indEl) {
                indEl.className = `status-indicator indicator-${name} ${road.signalState === 'green' ? 'active' : ''}`;
            }
        }
    }
}

// Global Instance
const sim = new TrafficStateEngine();

// UI Controllers
function toggleRun() {
    sim.isRunning = !sim.isRunning;
    const btn = document.getElementById("toggleRunBtn");
    const icon = document.getElementById("runIcon");
    const text = document.getElementById("runText");

    if (sim.isRunning) {
        btn.classList.add("paused");
        icon.textContent = "⏸";
        text.textContent = "PAUSE";
        sim.addLog("Simulation started (auto-run mode active).", "info");
        sim.timer = setInterval(() => sim.tick(), 1000);
    } else {
        btn.classList.remove("paused");
        icon.textContent = "▶";
        text.textContent = "RUN";
        sim.addLog("Simulation paused.", "info");
        clearInterval(sim.timer);
    }
}

function stepSimulation() {
    if (sim.isRunning) {
        toggleRun(); // Pause auto-run if stepping manually
    }
    sim.tick();
}

function addCar(road) {
    sim.addCar(road);
}

function removeCar(road) {
    sim.removeCar(road);
}

function sendAmbulance(road) {
    sim.sendAmbulance(road);
}

function randomizeTraffic() {
    sim.randomize();
}

// Initial UI Refresh
window.addEventListener("DOMContentLoaded", () => {
    sim.updateUI();
    sim.addLog("Traffic Controller Initialized.", "info");
});
