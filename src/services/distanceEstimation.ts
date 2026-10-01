import { BoundingBox, CameraCalibration, DistanceMethod } from '../types';

export interface DistanceResult {
  distance: number;       // In meters
  lateralOffset: number;  // In meters from camera optical axis (positive = right, negative = left)
  method: DistanceMethod;
}

/**
 * Monocular Distance Estimation Module
 * Supports both:
 * 1. Bounding-Box Height formulation: D = (f_y * H_real) / h_pixel
 * 2. Calibrated Ground-Plane Projection: Z = H_cam / tan(alpha)
 */
export class DistanceEstimator {
  /**
   * Method 1: Bounding-box-height distance estimation
   */
  public static estimateByBboxHeight(
    bbox: BoundingBox,
    frameHeight: number,
    calibration: CameraCalibration
  ): number {
    const pixelHeight = Math.max(bbox.h, 10);
    // Effective focal length normalized to frame resolution
    const effectiveFocal = calibration.focalLength * (frameHeight / 720);
    const distance = (effectiveFocal * calibration.pedestrianHeight) / pixelHeight;
    return Math.max(1.5, Math.min(120.0, Math.round(distance * 10) / 10));
  }

  /**
   * Method 2: Calibrated Ground-Plane Projection
   * Uses camera mounting height, pitch angle, and contact point (bottom-center of bounding box)
   */
  public static estimateByGroundPlane(
    bbox: BoundingBox,
    frameWidth: number,
    frameHeight: number,
    calibration: CameraCalibration
  ): DistanceResult {
    const xCenter = bbox.x + bbox.w / 2;
    const yBottom = bbox.y + bbox.h;

    const x0 = frameWidth / 2;
    const y0 = frameHeight / 2; // Optical center assumption

    const effectiveFocalY = calibration.focalLength * (frameHeight / 720);
    const effectiveFocalX = effectiveFocalY; // Assuming square pixels

    const pitchRad = (calibration.cameraPitch * Math.PI) / 180;
    
    // Pixel displacement from principal point
    const dy = yBottom - y0;
    const dx = xCenter - x0;

    // Angle of ray below optical axis
    const rayAngle = Math.atan2(dy, effectiveFocalY);
    const totalAngle = rayAngle + pitchRad;

    let forwardDistance: number;
    if (totalAngle <= 0.01) {
      // Ray is parallel or above horizon -> fallback to bbox height
      forwardDistance = this.estimateByBboxHeight(bbox, frameHeight, calibration);
    } else {
      forwardDistance = calibration.cameraHeight / Math.tan(totalAngle);
      // Ensure positive and realistic automotive range
      forwardDistance = Math.max(1.5, Math.min(100.0, forwardDistance));
    }

    // Lateral displacement (X) relative to vehicle centerline
    const lateralOffset = (dx * forwardDistance) / effectiveFocalX;

    return {
      distance: Math.round(forwardDistance * 10) / 10,
      lateralOffset: Math.round(lateralOffset * 10) / 10,
      method: 'ground_plane',
    };
  }

  /**
   * Primary distance estimator: picks ground plane or bbox height based on config
   */
  public static estimate(
    bbox: BoundingBox,
    frameWidth: number,
    frameHeight: number,
    calibration: CameraCalibration,
    preferredMethod: DistanceMethod = 'ground_plane'
  ): DistanceResult {
    if (preferredMethod === 'ground_plane') {
      return this.estimateByGroundPlane(bbox, frameWidth, frameHeight, calibration);
    }

    const dist = this.estimateByBboxHeight(bbox, frameHeight, calibration);
    const xCenter = bbox.x + bbox.w / 2;
    const x0 = frameWidth / 2;
    const effectiveFocalX = calibration.focalLength * (frameHeight / 720);
    const lateralOffset = ((xCenter - x0) * dist) / effectiveFocalX;

    return {
      distance: dist,
      lateralOffset: Math.round(lateralOffset * 10) / 10,
      method: 'bbox_height',
    };
  }
}
