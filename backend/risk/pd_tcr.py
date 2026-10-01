"""
PD-TCR (Pedestrian Distance–Trajectory–Collision Risk) Engine
Academic Risk-Fusion Algorithm for Autonomous Vehicle Safety.
"""

from typing import Dict, Any, Tuple

class PDTCRAngine:
    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or {
            "Wd": 0.20,
            "Wt": 0.15,
            "Wc": 0.20,
            "Wv": 0.15,
            "Wtcc": 0.20,
            "Wi": 0.10,
        }

    def compute_risk(
        self,
        distance_m: float,
        lateral_speed_mps: float,
        approach_rate_mps: float,
        in_collision_zone: bool,
        ttc_sec: float,
        intention: str,
    ) -> Tuple[int, str, Dict[str, int], str]:
        """
        Computes composite risk score (0-100), risk level, constituent factors, and explainable reason.
        """
        # 1. Distance Risk (R_dist): 0m -> 100, 35m+ -> 0
        r_dist = max(0.0, min(100.0, (1.0 - (distance_m - 2.0) / 33.0) * 100.0))

        # 2. Trajectory Risk (R_traj): based on lateral heading speed towards center
        r_traj = min(100.0, (lateral_speed_mps / 2.5) * 100.0)

        # 3. Collision Zone Risk (R_zone)
        r_zone = 100.0 if in_collision_zone else (40.0 if distance_m < 15.0 else 10.0)

        # 4. Relative Velocity Risk (R_vel)
        r_vel = max(0.0, min(100.0, (approach_rate_mps / 5.0) * 100.0))

        # 5. TTC Risk (R_ttc): <= 1.5s -> 100, >= 5.0s -> 0
        if ttc_sec <= 0:
            r_ttc = 0.0
        elif ttc_sec <= 1.5:
            r_ttc = 100.0
        elif ttc_sec >= 5.0:
            r_ttc = 0.0
        else:
            r_ttc = (1.0 - (ttc_sec - 1.5) / 3.5) * 100.0

        # 6. Intention Risk (R_int)
        intention_map = {
            "STATIONARY": 10.0,
            "WALKING_PARALLEL": 25.0,
            "CROSSING": 85.0,
            "IN_VEHICLE_PATH": 100.0,
        }
        r_int = intention_map.get(intention, 30.0)

        # Weighted Sum
        raw_score = (
            self.weights["Wd"] * r_dist +
            self.weights["Wt"] * r_traj +
            self.weights["Wc"] * r_zone +
            self.weights["Wv"] * r_vel +
            self.weights["Wtcc"] * r_ttc +
            self.weights["Wi"] * r_int
        )
        risk_score = int(round(max(0.0, min(100.0, raw_score))))

        # Classify Level
        if risk_score >= 76 or (in_collision_zone and ttc_sec < 2.2):
            level = "CRITICAL"
        elif risk_score >= 51:
            level = "HIGH"
        elif risk_score >= 26:
            level = "MEDIUM"
        else:
            level = "LOW"

        # Generate Explainability Sentence
        ttc_str = f"{ttc_sec:.1f}s" if ttc_sec < 100 else ">10s"
        if level == "CRITICAL":
            reason = f"Pedestrian is in collision zone ({distance_m:.1f}m) with critical TTC {ttc_str} and active crossing intention."
        elif level == "HIGH":
            reason = f"Approaching vehicle corridor at {lateral_speed_mps:.1f}m/s with projected TTC {ttc_str}."
        elif level == "MEDIUM":
            reason = f"Pedestrian detected at {distance_m:.1f}m moving in proximity to roadway."
        else:
            reason = f"Pedestrian stationary or moving parallel at safe clearance ({distance_m:.1f}m)."

        factors = {
            "distanceRisk": int(r_dist),
            "trajectoryRisk": int(r_traj),
            "collisionZoneRisk": int(r_zone),
            "relativeVelocityRisk": int(r_vel),
            "ttcRisk": int(r_ttc),
            "intentionRisk": int(r_int),
        }

        return risk_score, level, factors, reason
