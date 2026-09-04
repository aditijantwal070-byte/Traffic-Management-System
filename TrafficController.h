#ifndef TRAFFIC_CONTROLLER_H
#define TRAFFIC_CONTROLLER_H

#include "TrafficState.h"
#include <iostream>
#include <vector>
#include <map>
#include <queue>
#include <string>
#include <algorithm>
#include <sstream>
#include <ctime>
#include <chrono>

// Comparator struct for std::priority_queue (DSA implementation)
struct PriorityComparator {
    ControllerConfig config;

    PriorityComparator(const ControllerConfig& cfg) : config(cfg) {}

    double calculateScore(const RoadState& r) const {
        if (r.count == 0 && !r.hasEmergency) return -1.0;
        double score = (r.count * 1.0) + (r.waitTime * config.waitWeight);
        if (r.hasEmergency) score += 10000.0; // Emergency vehicle priority boost
        return score;
    }

    bool operator()(const RoadState& r1, const RoadState& r2) const {
        // Higher priority score should be at top of queue
        return calculateScore(r1) < calculateScore(r2);
    }
};

class TrafficController {
private:
    TrafficState state;
    ControllerConfig config;
    std::map<std::string, std::vector<Vehicle>> vehicleQueues;
    std::vector<LogEntry> logs;
    bool isRunning;

public:
    TrafficController();

    // Core Decision & DSA Logic
    Decision decideNextRoad();
    void evaluateNextSignal(bool forceImmediate = false);
    void tick();

    // User Actions
    void addCar(const std::string& roadName);
    void removeCar(const std::string& roadName);
    void sendAmbulance(const std::string& roadName);
    void randomize();

    // Helpers & Logging
    void addLog(const std::string& message, const std::string& category = "info");
    std::string getTimestamp();
    std::string toJSON();

    // Getters / Setters
    bool getIsRunning() const { return isRunning; }
    void setIsRunning(bool run) { isRunning = run; }
};

#endif // TRAFFIC_CONTROLLER_H
