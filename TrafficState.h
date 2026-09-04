#ifndef TRAFFIC_STATE_H
#define TRAFFIC_STATE_H

#include <string>
#include <map>
#include <vector>
#include <queue>

/* =========================================================
   SHARED DATA CONTRACT — TrafficState.h
   ---------------------------------------------------------
   Everyone builds against these structs. Don't change field
   names/types without telling the team — other members'
   code depends on this exact shape.
   ========================================================= */

// ---------------------------------------------------------
// Vehicle type
// ---------------------------------------------------------
enum class VehicleType {
    CAR,
    AMBULANCE
};

struct Vehicle {
    VehicleType type;
};

// ---------------------------------------------------------
// State of a single road (your original, kept as-is)
// ---------------------------------------------------------
struct RoadState {
    int count;
    int waitTime;
    bool hasEmergency;
    std::string signalState; // "red", "amber", "green"
    int remaining;
};

// ---------------------------------------------------------
// Overall simulation state (your original, kept as-is)
// ---------------------------------------------------------
struct TrafficState {
    std::map<std::string, RoadState> roads;
    std::string activeRoad;
    int cyclesRun;
};

/* =========================================================
   ADDITIONAL STRUCTS — useful once you split work
   ========================================================= */

// ---------------------------------------------------------
// Tunable constants — whoever owns the "decision logic"
// module changes these without touching anyone else's code
// ---------------------------------------------------------
struct ControllerConfig {
    int minGreen      = 10;   // seconds
    int maxGreen       = 50;  // seconds
    double waitWeight  = 0.6; // how much waiting time affects priority
};

// ---------------------------------------------------------
// What the decision/scheduling function returns each cycle
// (owner: person writing calculatePriority / decideNextRoad)
// ---------------------------------------------------------
struct Decision {
    std::string roadName;
    bool isEmergency;
    int greenDuration;
};

// ---------------------------------------------------------
// One entry in the activity log panel
// (owner: person building the console/log UI)
// ---------------------------------------------------------
struct LogEntry {
    std::string timestamp;
    std::string message;
    std::string category; // "info", "decide", "emergency"
};

// ---------------------------------------------------------
// Top-level dashboard stats (matches the stat-strip in UI)
// (owner: person building the header/stats display)
// ---------------------------------------------------------
struct SimulationStats {
    int totalVehicles;
    int cyclesRun;
    std::string activeRoadLabel; // e.g. "Road A" or "-"
};

// ---------------------------------------------------------
// A pending manual action from user input
// (owner: person wiring buttons/controls)
// e.g. "add car to Road B", "send ambulance to Road D"
// ---------------------------------------------------------
struct UserAction {
    std::string roadName;
    std::string actionType; // "add_car", "remove_car", "send_ambulance"
};

// ---------------------------------------------------------
// Handy constant — road identifiers used everywhere
// ---------------------------------------------------------
const std::vector<std::string> ROAD_NAMES = {"A", "B", "C", "D"};

#endif // TRAFFIC_STATE_H
