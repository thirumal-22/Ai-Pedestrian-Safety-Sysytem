"""
FastAPI Backend Application
Pedestrian Intention Prediction & PD-TCR Safety Alert System.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time

app = FastAPI(
    title="Pedestrian Intention Prediction & PD-TCR Safety System",
    description="Real-Time Computer Vision & ADAS Pedestrian Risk Assessment API",
    version="2.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryRecord(BaseModel):
    timestamp: str
    pedestrian_id: int
    distance: float
    velocity: float
    ttc: Optional[float]
    intention: str
    risk_score: int
    risk_level: str
    reason: str

in_memory_logs: List[TelemetryRecord] = []

@app.get("/api/health")
def health_check():
    return {
        "status": "active",
        "service": "AI Pedestrian Safety ADAS Engine",
        "version": "2.4.0",
        "method": "PD-TCR",
        "timestamp": time.time(),
        "disclaimer": "Research prototype - Not a certified automotive safety system."
    }

@app.get("/api/logs", response_model=List[TelemetryRecord])
def get_telemetry_logs():
    return in_memory_logs[-200:]

@app.post("/api/logs")
def add_telemetry_log(record: TelemetryRecord):
    in_memory_logs.append(record)
    if len(in_memory_logs) > 2000:
        in_memory_logs.pop(0)
    return {"status": "recorded"}

@app.delete("/api/logs")
def clear_telemetry_logs():
    in_memory_logs.clear()
    return {"status": "cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
