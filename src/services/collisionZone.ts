import { BoundingBox, CollisionZonePolygon, CollisionZoneStatus, SystemConfig } from '../types';

/**
 * Dynamic Vehicle Collision Zone Engine
 * Computes the perspective-projected vehicle lane and hazard polygon based on
 * vehicle speed, camera FOV, and road geometry.
 */
export class CollisionZoneEngine {
  /**
   * Generates the dynamic collision zone polygon in pixel coordinates
   * dynamically responsive to vehicle speed, horizontal/vertical FOV, and camera pitch.
   */
  public static computeZonePolygon(
    frameWidth: number,
    frameHeight: number,
    config: SystemConfig
  ): CollisionZonePolygon {
    const vSpeedKmh = Math.max(5, config.vehicleSpeed);
    const vSpeedMs = vSpeedKmh / 3.6;

    // Camera parameters
    const hfovDeg = config.calibration?.hfov || 72.0;
    const vfovDeg = config.calibration?.vfov || 44.0;
    const camHeightM = config.calibration?.cameraHeight || 1.35;
    const camPitchDeg = config.calibration?.cameraPitch || 2.0;
    const laneWidthM = config.laneWidth || 3.6;

    const hfovRad = (hfovDeg * Math.PI) / 180;
    const vfovRad = (vfovDeg * Math.PI) / 180;
    const pitchRad = (camPitchDeg * Math.PI) / 180;

    // Pinhole camera focal lengths derived from FOV
    const fx = (frameWidth / 2) / Math.tan(hfovRad / 2);
    const fy = (frameHeight / 2) / Math.tan(vfovRad / 2);

    // Horizon position from pitch angle and vertical FOV
    // Downward pitch shifts horizon upward in the image
    const horizonY = frameHeight * (0.5 - Math.tan(pitchRad) / (2 * Math.tan(vfovRad / 2)));
    const clampedHorizonY = Math.max(frameHeight * 0.35, Math.min(frameHeight * 0.58, horizonY));

    // Dynamic longitudinal lookahead adapting to vehicle speed:
    // Reaction distance (1.3s) + emergency braking distance (friction mu = 0.75)
    const reactionDist = vSpeedMs * 1.3;
    const brakingDist = (vSpeedMs * vSpeedMs) / (2 * 0.75 * 9.81);
    const stoppingDistance = reactionDist + brakingDist;

    // Lookahead distance in meters (scales cleanly from ~18m at 15km/h to ~75m at 90km/h)
    const lookaheadMeters = Math.max(16, Math.min(85, stoppingDistance + 6));

    // Near distance: ground intersection at the bottom edge of the frame
    const bottomAngle = vfovRad / 2 + pitchRad;
    const nearDistMeters = Math.max(2.0, camHeightM / Math.tan(Math.max(0.1, bottomAngle)));

    // Speed-dependent dynamic lane expansion margin:
    // At higher speeds, lateral deviation margin expands slightly for safety
    const speedMargin = Math.min(1.0, Math.max(0, (vSpeedKmh - 30) * 0.012));
    const effectiveLaneWidthM = laneWidthM + speedMargin;

    // Near width in pixels at vehicle hood (frameHeight)
    // Projected from effective lane width via horizontal FOV
    const nearWidthPx = Math.min(
      frameWidth * 0.88,
      Math.max(frameWidth * 0.28, (effectiveLaneWidthM * fx) / nearDistMeters)
    );
    const hoodBottom = frameHeight;
    const hoodLeft = (frameWidth - nearWidthPx) / 2;
    const hoodRight = frameWidth - hoodLeft;

    // Far distance ground contact projected to image Y
    // alpha is angle below horizon to the point at distance lookaheadMeters
    const farAngleToGround = Math.atan2(camHeightM, lookaheadMeters) - pitchRad;
    const farDeltaY = fy * Math.tan(Math.max(0.01, farAngleToGround));
    const topY = Math.max(clampedHorizonY + 14, Math.min(frameHeight - 45, clampedHorizonY + farDeltaY));

    // Far width in pixels at lookahead distance (perspective convergence)
    const farWidthPx = Math.min(
      nearWidthPx * 0.65,
      Math.max(24, (effectiveLaneWidthM * fx) / lookaheadMeters)
    );
    const farLeft = (frameWidth - farWidthPx) / 2;
    const farRight = frameWidth - farLeft;

    // Compute metric depth interval cross-sections (e.g. 5m, 10m, 15m, 20m, 30m, 40m...)
    const intervalDistances = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80].filter(
      (d) => d > nearDistMeters && d < lookaheadMeters
    );

    const depthIntervals = intervalDistances.map((dist) => {
      const angle = Math.atan2(camHeightM, dist) - pitchRad;
      const dY = fy * Math.tan(Math.max(0.01, angle));
      const yPos = Math.max(topY, Math.min(hoodBottom, clampedHorizonY + dY));
      const widthAtDist = (effectiveLaneWidthM * fx) / dist;
      const leftAtDist = (frameWidth - widthAtDist) / 2;
      const rightAtDist = frameWidth - leftAtDist;
      return {
        distanceMeters: dist,
        y: yPos,
        leftX: leftAtDist,
        rightX: rightAtDist,
      };
    });

    return {
      points: [
        [hoodLeft, hoodBottom],
        [farLeft, topY],
        [farRight, topY],
        [hoodRight, hoodBottom],
      ],
      nearWidth: hoodRight - hoodLeft,
      farWidth: farRight - farLeft,
      height: hoodBottom - topY,
      stoppingDistanceMeters: Math.round(stoppingDistance * 10) / 10,
      lookaheadMeters: Math.round(lookaheadMeters * 10) / 10,
      speedKmh: vSpeedKmh,
      hfovDeg,
      vfovDeg,
      depthIntervals,
    };
  }

  /**
   * Checks if a point (x, y) is inside the polygon using ray-casting
   */
  public static isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Evaluates pedestrian contact point and trajectory against collision zone
   */
  public static evaluatePedestrian(
    bbox: BoundingBox,
    frameWidth: number,
    frameHeight: number,
    config: SystemConfig,
    metricLateralOffset: number, // m
    velocityVx: number           // lateral velocity m/s
  ): { inZone: boolean; status: CollisionZoneStatus; riskFactor: number } {
    const polygon = this.computeZonePolygon(frameWidth, frameHeight, config);
    const footPoint: [number, number] = [bbox.x + bbox.w / 2, bbox.y + bbox.h];

    const inPolygon = this.isPointInPolygon(footPoint, polygon.points);

    // Half lane boundary in meters
    const halfLane = (config.laneWidth / 2) + 0.3; // 2.1m boundary
    const absOffset = Math.abs(metricLateralOffset);

    let status: CollisionZoneStatus = 'OUTSIDE';
    let riskFactor = 10; // baseline outside

    if (inPolygon || absOffset <= halfLane) {
      status = 'INSIDE';
      riskFactor = 100;
    } else if (absOffset <= halfLane + 2.5) {
      // Pedestrian is on shoulder or sidewalk within 2.5m of lane
      // Check if lateral velocity is moving toward lane center
      const movingTowardLane = (metricLateralOffset > 0 && velocityVx < -0.2) ||
                               (metricLateralOffset < 0 && velocityVx > 0.2);
      if (movingTowardLane) {
        status = 'APPROACHING';
        riskFactor = 75;
      } else {
        status = 'APPROACHING';
        riskFactor = 45;
      }
    } else {
      // Further out, but check fast crossing motion
      const movingRapidlyTowardLane = (metricLateralOffset > 0 && velocityVx < -1.0) ||
                                     (metricLateralOffset < 0 && velocityVx > 1.0);
      if (movingRapidlyTowardLane) {
        status = 'APPROACHING';
        riskFactor = 35;
      }
    }

    return {
      inZone: inPolygon || status === 'INSIDE',
      status,
      riskFactor,
    };
  }
}
