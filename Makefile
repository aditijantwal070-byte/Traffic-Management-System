CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -pthread
SRCS     = main.cpp TrafficController.cpp

# ── Platform detection ────────────────────────────────────────────────────
ifeq ($(OS), Windows_NT)
    TARGET  = traffic_sim.exe
    LDFLAGS = -lws2_32        # Winsock2 — required for Windows sockets
    RM      = del /f /q
else
    TARGET  = traffic_sim
    LDFLAGS =
    RM      = rm -f
endif

# ── Build rules ───────────────────────────────────────────────────────────
all: $(TARGET)

$(TARGET): $(SRCS)
	$(CXX) $(CXXFLAGS) $(SRCS) -o $(TARGET) $(LDFLAGS)

clean:
	$(RM) traffic_sim traffic_sim.exe 2>nul || true

.PHONY: all clean
