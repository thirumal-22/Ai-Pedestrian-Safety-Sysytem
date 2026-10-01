# AI-Based Pedestrian Intention Prediction and Context-Aware Safety Alert System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18.x-cyan.svg)](https://reactjs.org/)
[![YOLOv8](https://img.shields.io/badge/detector-YOLOv8n-green.svg)](https://github.com/ultralytics/ultralytics)

> **Research Prototype Disclaimer:** This system is an academic research prototype designed for autonomous-vehicle pedestrian safety exploration. It must not be used as a certified automotive safety system.

---

## 1. System Architecture

```text
[ Dashcam Video Stream / Benchmark Feed / Live Camera ]
                         │
                         ▼
        [ YOLOv8n Pedestrian Detection (Class 0) ]
                         │
                         ▼
           [ ByteTrack Multi-Object Tracker ]
                         │
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
[ Monocular         [ Trajectory &        [ Dynamic
  Distance            Motion              Collision
  (Ground-Plane) ]    Smoothing ]         Corridor ]
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
         [ Crossing Intention Predictor ]
                         │
                         ▼
         [ PD-TCR Composite Risk Fusion ]
                         │
                         ▼
         [ Explainable Safety Decision Engine ]
                         │
    ┌────────────────────┴────────────────────┐
    ▼                                         ▼
[ Acoustic Alert Unit ]              [ Real-Time ADAS HUD ]
  - Web Audio Warning Chimes           - AR Bounding Boxes & Tags
                                       - Collision Polygon Overlay
                                       - Real-Time Telemetry Plots
```

---

## 2. Core Innovation: The PD-TCR Methodology

Unlike simplistic distance-threshold systems that generate high false alarm rates on sidewalks, **PD-TCR** (*Pedestrian Distance–Trajectory–Collision Risk*) fuses six complementary physical signals:

$$\text{RiskScore} = W_d \cdot R_{\text{dist}} + W_t \cdot R_{\text{traj}} + W_c \cdot R_{\text{zone}} + W_v \cdot R_{\text{vel}} + W_{\text{tcc}} \cdot R_{\text{ttc}} + W_i \cdot R_{\text{int}}$$

Where:
- $R_{\text{dist}}$: Monocular ground-plane distance proximity penalty
- $R_{\text{traj}}$: Lateral motion vector angle towards vehicle travel path
- $R_{\text{zone}}$: Occupancy within dynamic perspective collision trapezoid
- $R_{\text{vel}}$: Relative closing rate between pedestrian and vehicle
- $R_{\text{ttc}}$: Time-to-Collision ($D / V_{\text{approach}}$)
- $R_{\text{int}}$: Multi-frame temporal crossing intention confidence

---

## 3. Getting Started

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+ (for backend services)

### Quick Start (Web Application)
```bash
# 1. Install dependencies
npm install

# 2. Start the interactive ADAS dashboard
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the real-time dashboard.

### Python Backend (Optional)
```bash
# Install Python packages
pip install -r requirements.txt

# Start FastAPI engine
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. Benchmark Dataset Support
The architecture is structured to validate against leading autonomous driving benchmarks:
- **JAAD** (*Joint Attention for Autonomous Driving*): 346 video clips with crossing annotations
- **BDD100K**: 100,000 diverse driving videos under varying weather and illumination
- **CityPersons**: Heavy occlusion and dense urban crosswalks
- **Caltech Pedestrian Dataset**: Standard benchmark for pedestrian detection
