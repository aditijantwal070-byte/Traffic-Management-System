/* =========================================================
   TRAFFIC CANVAS RENDERER
   High-performance 2D Canvas Renderer for 4-Way Intersection
   ========================================================= */

const canvas = document.getElementById("trafficCanvas");
const ctx = canvas.getContext("2d");

// Constants for canvas dimensions and road layout
const SIZE = 600;
const CENTER = SIZE / 2; // 300
const ROAD_WIDTH = 120; // 60px each side of center line
const HALF_ROAD = ROAD_WIDTH / 2; // 60
const LANE_WIDTH = HALF_ROAD / 2; // 30

// Corner quadrant boundaries
// NW: (0, 0) to (CENTER - HALF_ROAD, CENTER - HALF_ROAD) -> (0,0) to (240, 240)
// NE: (CENTER + HALF_ROAD, 0) to (SIZE, CENTER - HALF_ROAD) -> (360,0) to (600, 240)
// SW: (0, CENTER + HALF_ROAD) to (CENTER - HALF_ROAD, SIZE) -> (0,360) to (240, 600)
// SE: (CENTER + HALF_ROAD, CENTER + HALF_ROAD) to (SIZE, SIZE) -> (360,360) to (600, 600)

let animationFrameId = null;
let sirenPulse = 0;

function drawBuildings(x, y, w, h, patternSeed) {
    // Dark green grass base
    ctx.fillStyle = "#112218";
    ctx.fillRect(x, y, w, h);

    // Decorative subtle trees (dark green circles)
    ctx.fillStyle = "#183623";
    const treeCoords = [
        { tx: x + 25, ty: y + 25 },
        { tx: x + 40, ty: y + 35 },
        { tx: x + 200, ty: y + 200 },
        { tx: x + 180, ty: y + 215 }
    ];
    treeCoords.forEach(t => {
        ctx.beginPath();
        ctx.arc(t.tx, t.ty, 10, 0, Math.PI * 2);
        ctx.fill();
    });

    // City Building Blocks
    const pad = 35;
    const bw = w - pad * 2;
    const bh = h - pad * 2;
    const bx = x + pad;
    const by = y + pad;

    ctx.fillStyle = "#19221B";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "#253328";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    // Windows grid with warm amber/yellow lit windows
    const cols = 5;
    const rows = 5;
    const winW = 8;
    const winH = 8;
    const gapX = (bw - cols * winW) / (cols + 1);
    const gapY = (bh - rows * winH) / (rows + 1);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wx = bx + gapX + c * (winW + gapX);
            const wy = by + gapY + r * (winH + gapY);
            
            // Random-looking but deterministic lit windows pattern
            const lit = ((r * 7 + c * 3 + patternSeed) % 3) !== 0;
            ctx.fillStyle = lit ? "#F59E0B" : "#28382C";
            ctx.fillRect(wx, wy, winW, winH);
        }
    }
}

function drawRoads() {
    // Canvas background
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Draw Corner Quadrants with Grass and Buildings
    drawBuildings(0, 0, CENTER - HALF_ROAD, CENTER - HALF_ROAD, 1); // NW
    drawBuildings(CENTER + HALF_ROAD, 0, CENTER - HALF_ROAD, CENTER - HALF_ROAD, 2); // NE
    drawBuildings(0, CENTER + HALF_ROAD, CENTER - HALF_ROAD, CENTER - HALF_ROAD, 3); // SW
    drawBuildings(CENTER + HALF_ROAD, CENTER + HALF_ROAD, CENTER - HALF_ROAD, CENTER - HALF_ROAD, 4); // SE

    // Asphalt Roads
    ctx.fillStyle = "#1C2436";
    // Vertical Road (A & C)
    ctx.fillRect(CENTER - HALF_ROAD, 0, ROAD_WIDTH, SIZE);
    // Horizontal Road (D & B)
    ctx.fillRect(0, CENTER - HALF_ROAD, SIZE, ROAD_WIDTH);

    // Center Intersection Box
    ctx.fillStyle = "#222B3F";
    ctx.fillRect(CENTER - HALF_ROAD, CENTER - HALF_ROAD, ROAD_WIDTH, ROAD_WIDTH);

    // Double Yellow Center Dividers
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2;

    // Road A Center Divider
    ctx.beginPath();
    ctx.moveTo(CENTER - 1, 0); ctx.lineTo(CENTER - 1, CENTER - HALF_ROAD);
    ctx.moveTo(CENTER + 1, 0); ctx.lineTo(CENTER + 1, CENTER - HALF_ROAD);
    ctx.stroke();

    // Road C Center Divider
    ctx.beginPath();
    ctx.moveTo(CENTER - 1, CENTER + HALF_ROAD); ctx.lineTo(CENTER - 1, SIZE);
    ctx.moveTo(CENTER + 1, CENTER + HALF_ROAD); ctx.lineTo(CENTER + 1, SIZE);
    ctx.stroke();

    // Road D Center Divider
    ctx.beginPath();
    ctx.moveTo(0, CENTER - 1); ctx.lineTo(CENTER - HALF_ROAD, CENTER - 1);
    ctx.moveTo(0, CENTER + 1); ctx.lineTo(CENTER - HALF_ROAD, CENTER + 1);
    ctx.stroke();

    // Road B Center Divider
    ctx.beginPath();
    ctx.moveTo(CENTER + HALF_ROAD, CENTER - 1); ctx.lineTo(SIZE, CENTER - 1);
    ctx.moveTo(CENTER + HALF_ROAD, CENTER + 1); ctx.lineTo(SIZE, CENTER + 1);
    ctx.stroke();

    // Dashed White Lane Lines
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);

    // Road A & C Lanes
    ctx.beginPath();
    ctx.moveTo(CENTER - HALF_ROAD / 2, 0); ctx.lineTo(CENTER - HALF_ROAD / 2, CENTER - HALF_ROAD);
    ctx.moveTo(CENTER + HALF_ROAD / 2, 0); ctx.lineTo(CENTER + HALF_ROAD / 2, CENTER - HALF_ROAD);
    ctx.moveTo(CENTER - HALF_ROAD / 2, CENTER + HALF_ROAD); ctx.lineTo(CENTER - HALF_ROAD / 2, SIZE);
    ctx.moveTo(CENTER + HALF_ROAD / 2, CENTER + HALF_ROAD); ctx.lineTo(CENTER + HALF_ROAD / 2, SIZE);
    
    // Road D & B Lanes
    ctx.moveTo(0, CENTER - HALF_ROAD / 2); ctx.lineTo(CENTER - HALF_ROAD, CENTER - HALF_ROAD / 2);
    ctx.moveTo(0, CENTER + HALF_ROAD / 2); ctx.lineTo(CENTER - HALF_ROAD, CENTER + HALF_ROAD / 2);
    ctx.moveTo(CENTER + HALF_ROAD, CENTER - HALF_ROAD / 2); ctx.lineTo(SIZE, CENTER - HALF_ROAD / 2);
    ctx.moveTo(CENTER + HALF_ROAD, CENTER + HALF_ROAD / 2); ctx.lineTo(SIZE, CENTER + HALF_ROAD / 2);
    ctx.stroke();

    ctx.setLineDash([]); // Reset dash

    // Zebra Crosswalk Stripes at Intersection Entrances
    drawCrosswalk(CENTER - HALF_ROAD, CENTER - HALF_ROAD - 20, ROAD_WIDTH, 16, true);  // Road A entrance
    drawCrosswalk(CENTER - HALF_ROAD, CENTER + HALF_ROAD + 4, ROAD_WIDTH, 16, true);   // Road C entrance
    drawCrosswalk(CENTER - HALF_ROAD - 20, CENTER - HALF_ROAD, 16, ROAD_WIDTH, false); // Road D entrance
    drawCrosswalk(CENTER + HALF_ROAD + 4, CENTER - HALF_ROAD, 16, ROAD_WIDTH, false);  // Road B entrance
}

function drawCrosswalk(x, y, w, h, isHorizontal) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#CBD5E1";

    if (isHorizontal) {
        const stripeW = 8;
        const gap = 6;
        for (let sx = x + 4; sx < x + w - stripeW; sx += stripeW + gap) {
            ctx.fillRect(sx, y + 2, stripeW, h - 4);
        }
    } else {
        const stripeH = 8;
        const gap = 6;
        for (let sy = y + 4; sy < y + h - stripeH; sy += stripeH + gap) {
            ctx.fillRect(x + 2, sy, w - 4, stripeH);
        }
    }
}

function drawTrafficLights() {
    // Light housing positions for Roads A, B, C, D
    const signalPos = {
        A: { x: CENTER - HALF_ROAD - 24, y: CENTER - HALF_ROAD - 30, state: sim.roads.A.signalState },
        B: { x: CENTER + HALF_ROAD + 10, y: CENTER - HALF_ROAD - 24, state: sim.roads.B.signalState },
        C: { x: CENTER + HALF_ROAD + 10, y: CENTER + HALF_ROAD + 10, state: sim.roads.C.signalState },
        D: { x: CENTER - HALF_ROAD - 30, y: CENTER + HALF_ROAD + 10, state: sim.roads.D.signalState }
    };

    for (const roadName of ROAD_NAMES) {
        const p = signalPos[roadName];
        
        // Light Housing Box
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(p.x, p.y, 20, 24);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, 20, 24);

        // LED circle
        const cx = p.x + 10;
        const cy = p.y + 12;
        const isGreen = p.state === "green";
        const isAmber = p.state === "amber";

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);

        if (isGreen) {
            ctx.fillStyle = "#10B981";
            ctx.shadowColor = "#10B981";
            ctx.shadowBlur = 12;
        } else if (isAmber) {
            ctx.fillStyle = "#F59E0B";
            ctx.shadowColor = "#F59E0B";
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = "#EF4444";
            ctx.shadowColor = "#EF4444";
            ctx.shadowBlur = 12;
        }
        ctx.fill();
        ctx.shadowBlur = 0; // Reset glow
    }
}

function drawRoadAnnotations() {
    ctx.font = "600 13px 'JetBrains Mono', monospace";

    // Road A Label & Wait Time (Top North)
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("A", CENTER - HALF_ROAD + 15, 40);
    if (sim.roads.A.count > 0 && sim.roads.A.signalState !== "green") {
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#64748B";
        ctx.fillText(`wait ${sim.roads.A.waitTime}s`, CENTER - HALF_ROAD + 15, 60);
    }

    // Road B Label & Wait Time (Right East)
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("B", SIZE - 40, CENTER + 25);
    if (sim.roads.B.count > 0 && sim.roads.B.signalState !== "green") {
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#64748B";
        ctx.fillText(`wait ${sim.roads.B.waitTime}s`, SIZE - 70, CENTER + 45);
    }

    // Road C Label & Wait Time (Bottom South)
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("C", CENTER - 25, SIZE - 30);
    if (sim.roads.C.count > 0 && sim.roads.C.signalState !== "green") {
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#64748B";
        ctx.fillText(`wait ${sim.roads.C.waitTime}s`, CENTER - 45, SIZE - 12);
    }

    // Road D Label & Wait Time (Left West)
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("D", 30, CENTER + 25);
    if (sim.roads.D.count > 0 && sim.roads.D.signalState !== "green") {
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#64748B";
        ctx.fillText(`wait ${sim.roads.D.waitTime}s`, 25, CENTER + 45);
    }

    // Active Signal Green Countdown Box Overlay (e.g. 19s)
    const active = sim.roads[sim.activeRoad];
    if (active && active.signalState === "green") {
        ctx.font = "700 12px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#10B981";
        
        let tx = CENTER, ty = CENTER;
        if (sim.activeRoad === "A") { tx = CENTER + 25; ty = CENTER - HALF_ROAD - 35; }
        if (sim.activeRoad === "B") { tx = CENTER + HALF_ROAD + 25; ty = CENTER + 30; }
        if (sim.activeRoad === "C") { tx = CENTER - 45; ty = CENTER + HALF_ROAD + 35; }
        if (sim.activeRoad === "D") { tx = CENTER - HALF_ROAD - 50; ty = CENTER - 20; }

        ctx.fillText(`${active.remaining}s`, tx, ty);
    }
}

function drawVehicles() {
    sirenPulse = (sirenPulse + 0.1) % (Math.PI * 2);

    // Draw vehicles for each road in queue order
    for (const name of ROAD_NAMES) {
        const road = sim.roads[name];
        const count = road.vehicles.length;

        for (let i = 0; i < count; i++) {
            const vehicle = road.vehicles[i];
            const isAmbulance = vehicle.type === "AMBULANCE";
            
            // Queue spacing offset from intersection entrance
            const offset = (i * 34) + 30;
            let vx = 0, vy = 0, angle = 0;

            if (name === "A") {
                // Incoming Southbound lane (Right of center divider)
                vx = CENTER - HALF_ROAD / 2;
                vy = CENTER - HALF_ROAD - offset;
                angle = Math.PI / 2;
            } else if (name === "B") {
                // Incoming Westbound lane (Top of center divider)
                vx = CENTER + HALF_ROAD + offset;
                vy = CENTER - HALF_ROAD / 2;
                angle = Math.PI;
            } else if (name === "C") {
                // Incoming Northbound lane (Right of center divider)
                vx = CENTER + HALF_ROAD / 2;
                vy = CENTER + HALF_ROAD + offset;
                angle = -Math.PI / 2;
            } else if (name === "D") {
                // Incoming Eastbound lane (Bottom of center divider)
                vx = CENTER - HALF_ROAD - offset;
                vy = CENTER + HALF_ROAD / 2;
                angle = 0;
            }

            renderVehicleShape(vx, vy, angle, isAmbulance);
        }
    }
}

function renderVehicleShape(x, y, angle, isAmbulance) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const vWidth = 26;
    const vHeight = 14;

    if (isAmbulance) {
        // Ambulance Body (Bright White)
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(-vWidth / 2, -vHeight / 2, vWidth, vHeight, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Red Cross Symbol on roof
        ctx.fillStyle = "#EF4444";
        ctx.fillRect(-3, -1, 6, 2);
        ctx.fillRect(-1, -3, 2, 6);

        // Flashing Emergency Siren LED
        const sirenColor = Math.sin(sirenPulse) > 0 ? "#EF4444" : "#3B82F6";
        ctx.fillStyle = sirenColor;
        ctx.shadowColor = sirenColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(6, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

    } else {
        // Standard Car Body (Sleek Blue Capsule)
        ctx.fillStyle = "#60A5FA";
        ctx.beginPath();
        ctx.roundRect(-vWidth / 2, -vHeight / 2, vWidth, vHeight, 5);
        ctx.fill();

        // Windshield
        ctx.fillStyle = "#1E3A8A";
        ctx.beginPath();
        ctx.roundRect(-2, -vHeight / 2 + 2, 8, vHeight - 4, 2);
        ctx.fill();

        // Headlights
        ctx.fillStyle = "#FEF08A";
        ctx.fillRect(vWidth / 2 - 2, -vHeight / 2 + 1, 2, 3);
        ctx.fillRect(vWidth / 2 - 2, vHeight / 2 - 4, 2, 3);
    }

    ctx.restore();
}

function renderLoop() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawRoads();
    drawTrafficLights();
    drawRoadAnnotations();
    drawVehicles();

    animationFrameId = requestAnimationFrame(renderLoop);
}

// Start Render Engine
renderLoop();
