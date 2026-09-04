#include "TrafficController.h"

TrafficController::TrafficController() : isRunning(false) {
    // Initialize roads A, B, C, D
    for (const auto& name : ROAD_NAMES) {
        state.roads[name] = RoadState{0, 0, false, "red", 0};
        vehicleQueues[name] = std::vector<Vehicle>();
    }

    state.activeRoad = "A";
    state.cyclesRun = 0;

    // Set initial road states
    state.roads["A"].signalState = "green";
    state.roads["A"].remaining = 15;

    // Initial vehicle setup
    vehicleQueues["A"] = { {VehicleType::CAR}, {VehicleType::CAR}, {VehicleType::CAR} };
    state.roads["A"].count = 3;
    state.roads["A"].waitTime = 1;

    vehicleQueues["B"] = { {VehicleType::CAR}, {VehicleType::CAR}, {VehicleType::CAR}, {VehicleType::CAR} };
    state.roads["B"].count = 4;
    state.roads["B"].waitTime = 2;

    vehicleQueues["C"] = { {VehicleType::AMBULANCE} };
    state.roads["C"].count = 1;
    state.roads["C"].hasEmergency = true;
    state.roads["C"].waitTime = 3;

    vehicleQueues["D"] = {};
    state.roads["D"].count = 0;
    state.roads["D"].waitTime = 0;

    addLog("C++ Traffic Controller Initialized.", "info");
    evaluateNextSignal(true);
}

std::string TrafficController::getTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    struct tm* parts = std::localtime(&now_c);
    char buf[16];
    std::snprintf(buf, sizeof(buf), "%02d:%02d:%02d", parts->tm_hour, parts->tm_min, parts->tm_sec);
    return std::string(buf);
}

void TrafficController::addLog(const std::string& message, const std::string& category) {
    LogEntry entry{getTimestamp(), message, category};
    logs.push_back(entry);
    if (logs.size() > 50) {
        logs.erase(logs.begin());
    }
}

Decision TrafficController::decideNextRoad() {
    // DSA: Priority Queue sorting for green-light allocation
    PriorityComparator comp(config);
    std::priority_queue<RoadState, std::vector<RoadState>, PriorityComparator> pq(comp);

    for (const auto& pair : state.roads) {
        pq.push(pair.second);
    }

    if (pq.empty() || pq.top().count == 0) {
        // Default round-robin if empty
        int idx = 0;
        for (size_t i = 0; i < ROAD_NAMES.size(); ++i) {
            if (ROAD_NAMES[i] == state.activeRoad) {
                idx = (i + 1) % ROAD_NAMES.size();
                break;
            }
        }
        std::string nextRoad = ROAD_NAMES[idx];
        return Decision{nextRoad, false, config.minGreen};
    }

    RoadState topRoad = pq.top();
    bool isEmergency = topRoad.hasEmergency;
    
    int greenDuration = std::min(
        config.maxGreen,
        std::max(config.minGreen, topRoad.count * 4)
    );

    if (isEmergency) {
        greenDuration = 12; // Emergency corridor allocation
    }

    return Decision{topRoad.signalState == "red" ? ROAD_NAMES[0] : topRoad.signalState, isEmergency, greenDuration};
}

void TrafficController::evaluateNextSignal(bool forceImmediate) {
    // Determine highest priority road using priority queue
    PriorityComparator comp(config);
    std::string bestRoad = state.activeRoad;
    double maxScore = -100.0;

    for (const auto& name : ROAD_NAMES) {
        double score = comp.calculateScore(state.roads[name]);
        if (score > maxScore) {
            maxScore = score;
            bestRoad = name;
        }
    }

    std::string prevActive = state.activeRoad;
    state.activeRoad = bestRoad;
    bool isEmergency = state.roads[bestRoad].hasEmergency;

    int greenDuration = std::min(
        config.maxGreen,
        std::max(config.minGreen, state.roads[bestRoad].count * 4)
    );
    if (isEmergency) greenDuration = 12;

    for (const auto& name : ROAD_NAMES) {
        if (name == state.activeRoad) {
            state.roads[name].signalState = "green";
            state.roads[name].remaining = greenDuration;
        } else {
            state.roads[name].signalState = "red";
            state.roads[name].remaining = 0;
        }
    }

    if (isEmergency) {
        addLog("C++ Engine EMERGENCY OVERRIDE: Prioritizing Road " + bestRoad + " (" + std::to_string(greenDuration) + "s green)", "emergency");
    } else if (prevActive != bestRoad || forceImmediate) {
        addLog("C++ Engine Decision: Signal switched to Road " + bestRoad + " for " + std::to_string(greenDuration) + "s", "decide");
    }
}

void TrafficController::tick() {
    state.cyclesRun++;
    RoadState& active = state.roads[state.activeRoad];

    // Increment wait times for red roads
    for (const auto& name : ROAD_NAMES) {
        if (name != state.activeRoad && state.roads[name].count > 0) {
            state.roads[name].waitTime += 1;
        }
    }

    // Process green road phase
    if (active.signalState == "green") {
        active.remaining--;

        if (active.count > 0 && !vehicleQueues[state.activeRoad].empty()) {
            bool hadEmergencyBefore = active.hasEmergency;

            // Remove departing vehicle
            vehicleQueues[state.activeRoad].erase(vehicleQueues[state.activeRoad].begin());
            active.count = static_cast<int>(vehicleQueues[state.activeRoad].size());

            // Re-evaluate emergency status
            active.hasEmergency = false;
            for (const auto& v : vehicleQueues[state.activeRoad]) {
                if (v.type == VehicleType::AMBULANCE) {
                    active.hasEmergency = true;
                    break;
                }
            }

            if (active.count == 0) {
                active.waitTime = 0;
            }

            // Emergency Preemption: If active road emergency vehicle cleared,
            // check if any other road has an emergency vehicle waiting!
            if (hadEmergencyBefore && !active.hasEmergency) {
                std::string otherEmergencyRoad = "";
                for (const auto& name : ROAD_NAMES) {
                    if (name != state.activeRoad && state.roads[name].hasEmergency) {
                        otherEmergencyRoad = name;
                        break;
                    }
                }

                if (!otherEmergencyRoad.empty()) {
                    addLog("C++ Engine Preemption: Emergency vehicle cleared on Road " + state.activeRoad + ". Preempting green signal to Road " + otherEmergencyRoad + "!", "emergency");
                    evaluateNextSignal(true);
                    return;
                }
            }
        }

        // Phase finished
        if (active.remaining <= 0 || active.count == 0) {
            addLog("C++ Engine: Road " + state.activeRoad + " green phase complete.", "info");
            evaluateNextSignal();
        }
    }
}

void TrafficController::addCar(const std::string& roadName) {
    if (state.roads.find(roadName) != state.roads.end()) {
        vehicleQueues[roadName].push_back(Vehicle{VehicleType::CAR});
        state.roads[roadName].count = static_cast<int>(vehicleQueues[roadName].size());
        addLog("C++ Action: Added Car to Road " + roadName + " (Total: " + std::to_string(state.roads[roadName].count) + ")", "info");
    }
}

void TrafficController::removeCar(const std::string& roadName) {
    if (state.roads.find(roadName) != state.roads.end() && !vehicleQueues[roadName].empty()) {
        vehicleQueues[roadName].pop_back();
        state.roads[roadName].count = static_cast<int>(vehicleQueues[roadName].size());

        state.roads[roadName].hasEmergency = false;
        for (const auto& v : vehicleQueues[roadName]) {
            if (v.type == VehicleType::AMBULANCE) {
                state.roads[roadName].hasEmergency = true;
                break;
            }
        }
        addLog("C++ Action: Removed vehicle from Road " + roadName, "info");
    }
}

void TrafficController::sendAmbulance(const std::string& roadName) {
    if (state.roads.find(roadName) != state.roads.end()) {
        vehicleQueues[roadName].insert(vehicleQueues[roadName].begin(), Vehicle{VehicleType::AMBULANCE});
        state.roads[roadName].count = static_cast<int>(vehicleQueues[roadName].size());
        state.roads[roadName].hasEmergency = true;
        addLog("🚨 C++ EMERGENCY: Ambulance dispatched to Road " + roadName + "!", "emergency");

        if (state.activeRoad != roadName) {
            evaluateNextSignal(true);
        }
    }
}

void TrafficController::randomize() {
    for (const auto& name : ROAD_NAMES) {
        int numCars = rand() % 5;
        vehicleQueues[name].clear();
        for (int i = 0; i < numCars; ++i) {
            vehicleQueues[name].push_back(Vehicle{VehicleType::CAR});
        }
        state.roads[name].count = numCars;
        state.roads[name].hasEmergency = false;
        state.roads[name].waitTime = rand() % 5;
    }

    if (rand() % 100 < 35) {
        std::string randRoad = ROAD_NAMES[rand() % ROAD_NAMES.size()];
        vehicleQueues[randRoad].insert(vehicleQueues[randRoad].begin(), Vehicle{VehicleType::AMBULANCE});
        state.roads[randRoad].count = static_cast<int>(vehicleQueues[randRoad].size());
        state.roads[randRoad].hasEmergency = true;
    }

    addLog("C++ Engine: Randomized traffic loads across all roads.", "info");
    evaluateNextSignal(true);
}

std::string TrafficController::toJSON() {
    std::stringstream ss;
    ss << "{";
    ss << "\"activeRoad\":\"" << state.activeRoad << "\",";
    ss << "\"cyclesRun\":" << state.cyclesRun << ",";
    
    // Roads Map
    ss << "\"roads\":{";
    bool firstRoad = true;
    for (const auto& name : ROAD_NAMES) {
        if (!firstRoad) ss << ",";
        firstRoad = false;

        const auto& r = state.roads[name];
        ss << "\"" << name << "\":{";
        ss << "\"count\":" << r.count << ",";
        ss << "\"waitTime\":" << r.waitTime << ",";
        ss << "\"hasEmergency\":" << (r.hasEmergency ? "true" : "false") << ",";
        ss << "\"signalState\":\"" << r.signalState << "\",";
        ss << "\"remaining\":" << r.remaining << ",";
        
        // Vehicle Types array
        ss << "\"vehicles\":[";
        bool firstV = true;
        for (const auto& v : vehicleQueues[name]) {
            if (!firstV) ss << ",";
            firstV = false;
            ss << "{\"type\":\"" << (v.type == VehicleType::AMBULANCE ? "AMBULANCE" : "CAR") << "\"}";
        }
        ss << "]";
        ss << "}";
    }
    ss << "},";

    // Logs Array
    ss << "\"logs\":[";
    bool firstLog = true;
    for (const auto& l : logs) {
        if (!firstLog) ss << ",";
        firstLog = false;
        ss << "{";
        ss << "\"timestamp\":\"" << l.timestamp << "\",";
        ss << "\"message\":\"" << l.message << "\",";
        ss << "\"category\":\"" << l.category << "\"";
        ss << "}";
    }
    ss << "]";
    ss << "}";

    return ss.str();
}
