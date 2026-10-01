"""
YOLOv8 Pedestrian Detector Module
Loads lightweight YOLOv8n model and performs pedestrian inference (COCO class 0).
"""

import numpy as np
from typing import List, Dict, Any

class YOLOv8PedestrianDetector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_thresh: float = 0.45, device: str = "cpu"):
        self.model_path = model_path
        self.conf_thresh = conf_thresh
        self.device = device
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
        except ImportError:
            # Fallback or stub if running in minimal environment
            self.model = None

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs pedestrian detection on a single BGR video frame.
        Returns bounding boxes in [x, y, w, h] format with confidence.
        """
        detections = []
        if self.model is None:
            return detections

        results = self.model(frame, conf=self.conf_thresh, classes=[0], device=self.device, verbose=False)
        for r in results:
            boxes = r.boxes
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())

                x1, y1, x2, y2 = xyxy
                w = x2 - x1
                h = y2 - y1

                detections.append({
                    "bbox": [float(x1), float(y1), float(w), float(h)],
                    "confidence": conf,
                    "class_id": cls_id
                })

        return detections
