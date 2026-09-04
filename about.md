# Smart Traffic Management System — Project Documentation

An interactive, high-performance **Smart Traffic Management System** built with **C++17** (Data Structures, Algorithms, and Object-Oriented Programming) and a modern HTML5/Canvas dark-themed web dashboard.

---

## 📌 1. Project Overview

The **Smart Traffic Management System** simulates a **4-Way Intersection (Roads A, B, C, D)** designed to solve urban traffic congestion and emergency response delays. Instead of traditional fixed-timer traffic signals, this system dynamically evaluates road traffic density, vehicle waiting times, and emergency vehicle arrivals (`AMBULANCE`) to allocate green-light signals intelligently.

### Key Objectives & System Features:
- **Object-Oriented Programming (OOP)**: Clean, modular architecture separating vehicles, road states, signal timing, and controller orchestration into C++ classes.
- **Data Structures & Algorithms (DSA)**:
  - **Priority Queue (`std::priority_queue`)**: Calculates dynamic priority scores for each road each cycle.
  - **Emergency Vehicle Preemption**: Guarantees immediate green-light override for emergency vehicles (`AMBULANCE`).
  - **Inter-Road Preemption**: When an ambulance clears from an active road, the system checks if any other road has a waiting emergency vehicle and immediately yields green right-of-way to it.
- **Native C++ HTTP Micro-Server**: Runs a high-speed C++ socket server listening on port `8080`, handling REST API requests (`/api/state`, `/api/action`) and serving static frontend assets.
- **Interactive Dark Dashboard**: Modern HTML5 Canvas 2D visualization rendering asphalt roads, center lines, zebra crosswalks, buildings, glowing LEDs, flashing emergency sirens, and a live activity console.

---

## 📁 2. File Breakdown & Language Specifications

Below is the complete inventory of all project files, their file extensions, programming languages, and exact responsibilities:

| File Name | File Extension | Language | Description & Responsibility |
| :--- | :---: | :---: | :--- |
| `TrafficState.h` | `.h` | C++ | **Shared Data Contract**: Defines core data structures (`Vehicle`, `RoadState`, `TrafficState`, `ControllerConfig`, `Decision`, `LogEntry`, `SimulationStats`, `UserAction`). |
| `TrafficController.h` | `.h` | C++ | **Controller Interface**: Header file declaring the `TrafficController` class and the `PriorityComparator` struct used by `std::priority_queue`. |
| `TrafficController.cpp` | `.cpp` | C++ | **Core Engine Logic**: Implements C++ priority queue sorting, green phase countdowns, emergency preemption, tick cycles, and JSON state formatting. |
| `main.cpp` | `.cpp` | C++ | **Server Entry Point**: Multi-threaded BSD socket HTTP server listening on port `8080` handling `/api/state`, `/api/action`, and serving static files. |
| `Makefile` | `Makefile` | Make | **Build Automation**: Compilation script to build the C++ executable binary `traffic_sim` using `clang++ -std=c++17`. |
| `index.html` | `.html` | HTML5 | **Frontend Markup**: Web page structure containing the intersection viewport canvas, legend bar, activity log console, and road control cards. |
| `style.css` | `.css` | CSS3 | **Visual Design System**: Dark slate theme (`#0B0F19`), card layouts, glowing signal LEDs, pulsing emergency badges, and responsive design. |
| `renderer.js` | `.js` | JavaScript | **Canvas Renderer Engine**: HTML5 2D Canvas engine rendering asphalt roads, center lines, crosswalks, buildings, cars, ambulances, and light timers. |
| `app_cpp_bridge.js` | `.js` | JavaScript | **Frontend Client Bridge**: Connects UI button events (`-`, `+`, `🚨 Send`, `RUN`, `Step`) to the C++ server REST API endpoints via asynchronous `fetch()`. |
| `simulation.js` | `.js` | JavaScript | **Client Fallback Engine**: Standalone client-side JavaScript implementation of `TrafficState.h` for fallback offline simulation. |

---

## 🧠 3. Data Structures & Algorithms (DSA) Details

### 1. Dynamic Priority Queue Formula
The C++ controller evaluates every road using a custom comparator (`PriorityComparator`) in a max-priority queue:

$$\text{Priority Score} = (\text{Vehicle Count} \times 1.0) + (\text{Wait Time} \times \text{WaitWeight}) + (\text{hasEmergency} ? 10000.0 : 0.0)$$

- **Vehicle Count**: Higher density increases priority.
- **Wait Time Weight (`waitWeight = 0.6`)**: Prevents vehicle starvation on low-density roads over time.
- **Emergency Boost (`+10000.0`)**: Forces immediate override for any road containing an `AMBULANCE`.

### 2. Signal Time Allocation
- **Standard Green Duration**: Dynamically calculated between **10 seconds (`minGreen`)** and **50 seconds (`maxGreen`)** based on vehicle volume.
- **Emergency Corridor**: Allocated **12 seconds** of green priority time.

### 3. Emergency Preemption Flow
When an active green road's ambulance departs:
1. The engine checks if `hasEmergency` is now `false` on the active road.
2. If another road has a waiting emergency vehicle (`hasEmergency == true`), the engine **immediately preempts** the remaining green phase.
3. Signal instantly switches green to the waiting emergency road before non-emergency vehicles pass.

---

## 🚀 4. How to Run the Application

### Prerequisites

| Platform | Requirement |
|---|---|
| **Windows** | [Python 3](https://python.org/downloads) — check ✅ **"Add Python to PATH"** during install |
| **macOS / Linux** | Python 3 (usually pre-installed — verify with `python3 --version`) |

---

### ▶ Windows — Quickest Way (Recommended)

**Double-click `run.bat`** in the project folder.

It will:
1. Check Python is installed
2. Start the local web server on port `8080`
3. Automatically open `http://localhost:8080` in your browser

To stop the server, press **`Ctrl + C`** in the terminal window that opens.

---

### ▶ Windows — Manual (Command Prompt)

```cmd
cd "path\to\project_folder"
python -m http.server 8080
```
Then open your browser and go to: `http://localhost:8080`

---

### ▶ macOS / Linux — Terminal

```bash
cd /path/to/project_folder
python3 -m http.server 8080
```
Then open: `http://localhost:8080`

Or use the one-liner:
```bash
python3 -m http.server 8080 & open http://localhost:8080
```

---

> **Note:** The web frontend runs fully in-browser (no C++ server required). The `Makefile` and C++ source files are included for reference / advanced use.

---

## 🎮 5. How to Use & Test

1. **Adjust Vehicle Count**: Click **`-`** or **`+`** on any road (Road A, B, C, D) to modify traffic density.
2. **Dispatch Emergency Ambulance**: Click **`🚨 Send`** on any road to add an `AMBULANCE`. The engine triggers an immediate emergency override.
3. **Simulation Controls**:
   - **`▶ RUN / ⏸ PAUSE`**: Starts or pauses automated simulation (1 vehicle drains per tick).
   - **`Step`**: Executes a single simulation step — one vehicle passes immediately.
   - **`Randomize`**: Generates random traffic loads across all 4 roads.

