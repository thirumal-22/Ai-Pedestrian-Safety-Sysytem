"""
Monocular Ground-Plane Distance Estimator
Uses camera mounting height, pitch angle, and intrinsic parameters.
"""

import math
from typing import Tuple

class GroundPlaneDistanceEstimator:
    def __init__(
        self,
        camera_height: float = 1.35,
        camera_pitch_deg: float = 2.0,
        focal_length_px: float = 1150.0,
        pedestrian_ref_height: float = 1.70,
    ):
        self.camera_height = camera_height
        self.pitch_rad = math.radians(camera_pitch_deg)
        self.focal_length = focal_length_px
        self.pedestrian_ref_height = pedestrian_ref_height

    def estimate(self, bbox: list, img_width: int, img_height: int) -> Tuple[float, float]:
        """
        Calculates metric distance (Z) and lateral offset (X) in meters.
        Contact foot-point is (x + w/2, y + h).
        """
        x, y, w, h = bbox
        cx = x + w / 2.0
        y_bottom = y + h

        # Principal optical center
        cx_img = img_width / 2.0
        cy_img = img_height * 0.46 # Horizon alignment

        delta_y = y_bottom - cy_img
        if delta_y <= 0:
            delta_y = 1.0 # Avoid singularity near/above horizon

        alpha = math.atan2(delta_y, self.focal_length)
        total_angle = alpha + self.pitch_rad

        if total_angle <= 0.01:
            total_angle = 0.01

        distance_z = self.camera_height / math.tan(total_angle)
        distance_z = max(1.5, min(80.0, distance_z))

        # Lateral offset X in meters
        delta_x = cx - cx_img
        offset_x = (delta_x * distance_z) / self.focal_length

        return distance_z, offset_x
