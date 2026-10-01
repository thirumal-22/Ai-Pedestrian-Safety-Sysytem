import {
  BoundingBox,
  DistanceMethod,
  SystemConfig,
  TrackedPedestrian,
  TrajectoryPoint,
} from '../types';
import { CollisionZoneEngine } from './collisionZone';
import { DistanceEstimator } from './distanceEstimation';
import { IntentionPredictor } from './intentionPredictor';
import { PDTCRAngine } from './pdtcrRiskEngine';

export interface RawDetection {
  bbox: BoundingBox;
  confidence: number;
  classId: number; // 0 for person
}

interface InternalTrack {
  id: number;
  bbox: BoundingBox;
  smoothBbox: BoundingBox;
  confidence: number;
  hits: number;
  age: number;
  lostFrames: number;
  history: TrajectoryPoint[];
  lastTimestamp: number;
  estimatedDistance: number;
  lateralOffset: number;
  velocityVx: number; // m/s
  velocityVy: number; // m/s
  speed: number;      // m/s
  approachRate: number; // m/s
}

/**
 * ByteTrack-style multi-pedestrian tracker with trajectory smoothing,
 * velocity estimation, and PD-TCR integration.
 */
export class ByteTrackTracker {
  private tracks: Map<number, InternalTrack> = new Map();
  private nextTrackId: number = 1;
  private maxLostFrames: number = 20; // Keep track for up to 20 frames during temporary occlusion
  private iouMatchThreshold: number = 0.35;

  /**
   * Intersection over Union (IoU) between two bounding boxes
   */
  public static calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
    const yB = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = boxA.w * boxA.h;
    const boxBArea = boxB.w * boxB.h;
    const unionArea = boxAArea + boxBArea - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  /**
   * Updates tracker with new frame detections
   */
  public update(
    detections: RawDetection[],
    frameWidth: number,
    frameHeight: number,
    timestamp: number,
    config: SystemConfig
  ): TrackedPedestrian[] {
    // Filter for person class (classId === 0) and confidence threshold
    const validDets = detections.filter(
      (d) => d.classId === 0 && d.confidence >= config.confidenceThreshold
    );

    // Two-stage association (ByteTrack principle: high score first, then low score)
    const highThresh = Math.max(0.40, config.confidenceThreshold);
    const highDets = validDets.filter((d) => d.confidence >= highThresh);
    const lowDets = validDets.filter((d) => d.confidence < highThresh);

    const matchedTracks = new Set<number>();
    const matchedDets = new Set<number>();

    // Stage 1: Match high confidence detections
    this.associateDetections(highDets, matchedTracks, matchedDets, timestamp);

    // Stage 2: Match remaining tracks with low confidence detections (handles occlusion)
    this.associateDetections(lowDets, matchedTracks, matchedDets, timestamp);

    // Create new tracks for unmatched high confidence detections
    highDets.forEach((det, idx) => {
      if (!matchedDets.has(idx)) {
        this.createNewTrack(det, timestamp);
      }
    });

    // Age and prune stale tracks
    const activeResults: TrackedPedestrian[] = [];
    const tracksToRemove: number[] = [];

    this.tracks.forEach((track, id) => {
      if (!matchedTracks.has(id)) {
        track.lostFrames += 1;
      } else {
        track.lostFrames = 0;
      }
      track.age += 1;

      if (track.lostFrames > this.maxLostFrames) {
        tracksToRemove.push(id);
        return;
      }

      // Report tracks immediately if confidence is high or after consecutive hits
      if (track.hits >= 2 || (track.hits >= 1 && track.confidence >= 0.42)) {
        const fullTracked = this.buildTrackedPedestrian(
          track,
          frameWidth,
          frameHeight,
          config
        );
        activeResults.push(fullTracked);
      }
    });

    tracksToRemove.forEach((id) => this.tracks.delete(id));

    // Sort by risk score descending (highest risk first)
    activeResults.sort((a, b) => b.riskScore - a.riskScore);

    return activeResults;
  }

  private associateDetections(
    dets: RawDetection[],
    matchedTracks: Set<number>,
    matchedDets: Set<number>,
    timestamp: number
  ) {
    const trackIds = Array.from(this.tracks.keys()).filter((id) => !matchedTracks.has(id));

    // Compute cost matrix (IoU)
    const costMatrix: { trackId: number; detIdx: number; iou: number }[] = [];
    trackIds.forEach((trackId) => {
      const track = this.tracks.get(trackId)!;
      dets.forEach((det, detIdx) => {
        if (matchedDets.has(detIdx)) return;
        const iou = ByteTrackTracker.calculateIoU(track.smoothBbox, det.bbox);
        if (iou >= this.iouMatchThreshold) {
          costMatrix.push({ trackId, detIdx, iou });
        }
      });
    });

    // Greedy matching sorted by IoU
    costMatrix.sort((a, b) => b.iou - a.iou);
    costMatrix.forEach(({ trackId, detIdx }) => {
      if (matchedTracks.has(trackId) || matchedDets.has(detIdx)) return;

      matchedTracks.add(trackId);
      matchedDets.add(detIdx);

      this.updateTrackWithDetection(trackId, dets[detIdx], timestamp);
    });
  }

  private createNewTrack(det: RawDetection, timestamp: number) {
    const id = this.nextTrackId++;
    const track: InternalTrack = {
      id,
      bbox: { ...det.bbox },
      smoothBbox: { ...det.bbox },
      confidence: det.confidence,
      hits: 1,
      age: 1,
      lostFrames: 0,
      history: [
        {
          x: det.bbox.x + det.bbox.w / 2,
          y: det.bbox.y + det.bbox.h,
          timestamp,
          distance: 25.0,
          riskScore: 10,
        },
      ],
      lastTimestamp: timestamp,
      estimatedDistance: 25.0,
      lateralOffset: 0.0,
      velocityVx: 0.0,
      velocityVy: 0.0,
      speed: 0.0,
      approachRate: 0.0,
    };
    this.tracks.set(id, track);
  }

  private updateTrackWithDetection(trackId: number, det: RawDetection, timestamp: number) {
    const track = this.tracks.get(trackId);
    if (!track) return;

    // Exponential moving average filter for bounding box coordinates
    const alpha = 0.65;
    track.smoothBbox.x = alpha * det.bbox.x + (1 - alpha) * track.smoothBbox.x;
    track.smoothBbox.y = alpha * det.bbox.y + (1 - alpha) * track.smoothBbox.y;
    track.smoothBbox.w = alpha * det.bbox.w + (1 - alpha) * track.smoothBbox.w;
    track.smoothBbox.h = alpha * det.bbox.h + (1 - alpha) * track.smoothBbox.h;
    track.bbox = { ...det.bbox };
    track.confidence = det.confidence;
    track.hits += 1;
    track.lastTimestamp = timestamp;
  }

  private buildTrackedPedestrian(
    track: InternalTrack,
    frameWidth: number,
    frameHeight: number,
    config: SystemConfig
  ): TrackedPedestrian {
    const bbox = track.smoothBbox;
    const center: [number, number] = [bbox.x + bbox.w / 2, bbox.y + bbox.h / 2];
    const footPoint: [number, number] = [bbox.x + bbox.w / 2, bbox.y + bbox.h];

    // Distance estimation
    const distResult = DistanceEstimator.estimate(
      bbox,
      frameWidth,
      frameHeight,
      config.calibration,
      config.distanceMethod
    );

    // Compute velocity over history
    const prevDist = track.estimatedDistance || distResult.distance;
    const dt = Math.max(0.033, (track.lastTimestamp - (track.history[track.history.length - 1]?.timestamp || track.lastTimestamp - 33)) / 1000);

    // Calculate approach rate: change in distance per second (positive = getting closer)
    const rawApproachRate = (prevDist - distResult.distance) / dt;
    // Low-pass filter approach rate
    track.approachRate = 0.7 * track.approachRate + 0.3 * rawApproachRate;

    // Metric lateral velocity estimation
    const prevOffset = track.lateralOffset;
    const rawVx = (distResult.lateralOffset - prevOffset) / dt;
    track.velocityVx = 0.65 * track.velocityVx + 0.35 * rawVx;

    // Speed in m/s
    track.speed = Math.sqrt(track.velocityVx * track.velocityVx + track.approachRate * track.approachRate);
    track.estimatedDistance = distResult.distance;
    track.lateralOffset = distResult.lateralOffset;

    // Direction symbol
    let directionSymbol = '•';
    const angleRad = Math.atan2(track.approachRate, track.velocityVx);
    const trajectoryAngle = Math.round((angleRad * 180) / Math.PI);

    if (track.speed > 0.3) {
      if (Math.abs(track.velocityVx) > Math.abs(track.approachRate) * 1.5) {
        directionSymbol = track.velocityVx > 0 ? '→' : '←';
      } else if (track.approachRate > 0.5) {
        directionSymbol = track.velocityVx > 0 ? '↘' : '↙';
      } else {
        directionSymbol = track.approachRate > 0 ? '↓' : '↑';
      }
    }

    // Evaluate Collision Zone
    const zoneEval = CollisionZoneEngine.evaluatePedestrian(
      bbox,
      frameWidth,
      frameHeight,
      config,
      distResult.lateralOffset,
      track.velocityVx
    );

    // Crossing Intention Prediction
    const intentionResult = IntentionPredictor.predict(
      track.history,
      { vx: track.velocityVx, vy: 0, speed: track.speed },
      distResult.lateralOffset,
      zoneEval.status,
      track.approachRate
    );

    // Calculate PD-TCR Risk
    const pdtcr = PDTCRAngine.computeRisk({
      distance: distResult.distance,
      lateralOffset: distResult.lateralOffset,
      approachRate: track.approachRate,
      metricVelocity: { vx: track.velocityVx, vy: 0, speed: track.speed },
      collisionStatus: zoneEval.status,
      zoneRiskFactor: zoneEval.riskFactor,
      intention: intentionResult.intention,
      intentionRiskFactor: intentionResult.intentionRisk,
      weights: config.weights,
      thresholds: config.thresholds,
      ablation: config.ablation,
      vehicleSpeedKmh: config.vehicleSpeed,
    });

    // Record trajectory point
    track.history.push({
      x: center[0],
      y: footPoint[1],
      timestamp: track.lastTimestamp,
      distance: distResult.distance,
      riskScore: pdtcr.riskScore,
    });
    if (track.history.length > 40) {
      track.history.shift();
    }

    return {
      id: track.id,
      bbox,
      center,
      footPoint,
      confidence: track.confidence,
      estimatedDistance: distResult.distance,
      lateralOffset: distResult.lateralOffset,
      distanceMethod: distResult.method,
      pixelVelocity: {
        vx: track.velocityVx * 20,
        vy: track.approachRate * 20,
        speed: track.speed * 20,
      },
      metricVelocity: {
        vx: Math.round(track.velocityVx * 10) / 10,
        vy: 0,
        speed: Math.round(track.speed * 10) / 10,
      },
      directionSymbol,
      trajectoryAngle,
      approachRate: Math.round(track.approachRate * 10) / 10,
      ttc: pdtcr.ttc,
      inCollisionZone: zoneEval.inZone,
      collisionZoneStatus: zoneEval.status,
      intention: intentionResult.intention,
      intentionConfidence: intentionResult.confidence,
      pdTcrFactors: pdtcr.factors,
      riskScore: pdtcr.riskScore,
      riskLevel: pdtcr.riskLevel,
      explainableReason: pdtcr.explainableReason,
      history: [...track.history],
    };
  }

  public reset() {
    this.tracks.clear();
    this.nextTrackId = 1;
  }
}
