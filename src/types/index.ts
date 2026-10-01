/**
 * Core Type Definitions for AI-Based Pedestrian Intention Prediction
 * and Context-Aware Safety Alert System (PD-TCR).
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CrossingIntention =
  | 'STATIONARY'
  | 'WALKING_PARALLEL'
  | 'APPROACHING_ROAD'
  | 'CROSSING'
  | 'IN_VEHICLE_PATH'
  | 'UNKNOWN';

export type CollisionZoneStatus = 'OUTSIDE' | 'APPROACHING' | 'INSIDE';

export type DistanceMethod = 'ground_plane' | 'bbox_height';

export type SpeedSource = 'manual' | 'simulated_can' | 'gps';

export interface BoundingBox {
  x: number; // Top-left x
  y: number; // Top-left y
  w: number; // Width
  h: number; // Height
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  timestamp: number;
  distance: number;
  riskScore: number;
}

export interface PDTCRFactors {
  distanceRisk: number;       // 0-100
  trajectoryRisk: number;     // 0-100
  collisionZoneRisk: number;  // 0-100
  relativeVelocityRisk: number; // 0-100
  ttcRisk: number;            // 0-100
  intentionRisk: number;      // 0-100
}

export interface TrackedPedestrian {
  id: number;
  bbox: BoundingBox;
  center: [number, number];
  footPoint: [number, number]; // [x, y] contact point on ground
  confidence: number;
  
  // Distance Estimation
  estimatedDistance: number;   // In meters
  lateralOffset: number;       // Lateral distance from vehicle centerline (meters)
  distanceMethod: DistanceMethod;

  // Motion & Trajectory
  pixelVelocity: { vx: number; vy: number; speed: number }; // px/s
  metricVelocity: { vx: number; vy: number; speed: number }; // m/s
  directionSymbol: string;     // e.g. '→', '←', '↘', '↙', '↑', '↓', '•'
  trajectoryAngle: number;     // degrees
  approachRate: number;        // Closing speed toward vehicle in m/s

  // Safety & Prediction
  ttc: number;                 // Time-to-collision in seconds (or Infinity)
  inCollisionZone: boolean;
  collisionZoneStatus: CollisionZoneStatus;
  intention: CrossingIntention;
  intentionConfidence: number;

  // Risk Scores
  pdTcrFactors: PDTCRFactors;
  riskScore: number;           // 0-100 normalized
  riskLevel: RiskLevel;
  explainableReason: string;

  // History buffer
  history: TrajectoryPoint[];
}

export interface CameraCalibration {
  focalLength: number;         // px (effective focal length)
  cameraHeight: number;        // meters above ground (e.g. 1.35m)
  cameraPitch: number;         // degrees tilt downward/upward
  pedestrianHeight: number;    // estimated physical height (e.g. 1.70m)
  hfov: number;                // horizontal FOV in degrees
  vfov: number;                // vertical FOV in degrees
}

export interface PDTCRWeights {
  Wd: number;    // Distance weight
  Wt: number;    // Trajectory weight
  Wc: number;    // Collision zone weight
  Wv: number;    // Relative velocity weight
  Wtcc: number;  // Time-to-collision weight
  Wi: number;    // Intention weight
}

export interface RiskThresholds {
  lowMax: number;     // 25
  mediumMax: number;  // 50
  highMax: number;    // 75
  criticalMin: number;// 76
  ttcCritical: number;// 2.0s
  ttcWarning: number; // 3.8s
}

export interface AblationSettings {
  enableDistance: boolean;
  enableTrajectory: boolean;
  enableTTC: boolean;
  enableCollisionZone: boolean;
  enableIntention: boolean;
}

export type SupportedModelArchitecture =
  | 'YOLOv8n'
  | 'YOLOv8s'
  | 'YOLOv8m'
  | 'YOLOv8x'
  | 'Faster R-CNN (ResNet-50)'
  | 'SSD-MobileNetV2'
  | 'RetinaNet (ResNet-50)'
  | 'EfficientDet-D1'
  | 'Mask R-CNN'
  | 'ConvNeXt-Tiny'
  | 'Custom-YOLOv8';

export interface SystemConfig {
  calibration: CameraCalibration;
  weights: PDTCRWeights;
  thresholds: RiskThresholds;
  ablation: AblationSettings;
  vehicleSpeed: number;        // km/h
  speedSource: SpeedSource;
  confidenceThreshold: number; // 0.1 - 0.9
  iouThreshold: number;        // 0.1 - 0.9
  distanceMethod: DistanceMethod;
  soundEnabled: boolean;
  soundVolume: number;         // 0 - 1
  laneWidth: number;           // meters (e.g. 3.6m)
  lookaheadDistance: number;   // meters (e.g. 40m)
  modelVariant: SupportedModelArchitecture;
}

export interface DepthInterval {
  distanceMeters: number;
  y: number;
  leftX: number;
  rightX: number;
}

export interface CollisionZonePolygon {
  points: [number, number][];  // [[hoodLeft, hoodBottom], [farLeft, topY], [farRight, topY], [hoodRight, hoodBottom]]
  nearWidth: number;
  farWidth: number;
  height: number;
  stoppingDistanceMeters?: number;
  lookaheadMeters?: number;
  speedKmh?: number;
  hfovDeg?: number;
  vfovDeg?: number;
  depthIntervals?: DepthInterval[];
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  pedestrianId: number;
  distance: number;
  velocity: number;
  ttc: number;
  intention: CrossingIntention;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
}

export interface PipelineMetrics {
  fps: number;
  inferenceTimeMs: number;
  trackingCount: number;
  avgConfidence: number;
  processedFrames: number;
}

export interface ComparativeModelMetrics {
  modelName: string;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  avgWarningLeadTimeSec: number;
  mAP50: number;
}

export interface CNNModelVariation {
  id: SupportedModelArchitecture;
  name: string;
  family: 'YOLO Family' | 'CNN Two-Stage' | 'CNN Single-Stage' | 'Compound CNN' | 'Modern Pure CNN';
  backbone: string;
  detectorType: string;
  paramsM: number;
  flopsG: number;
  memoryMB: number;
  mAP50: number;
  mAP50_95: number;
  precision: number;
  recall: number;
  f1Score: number;
  latencyJetsonMs: number;
  latencyGpuMs: number;
  fpsJetson: number;
  targetHardware: string;
  description: string;
  pros: string[];
  cons: string[];
  occlusionResistance: 'High' | 'Very High' | 'Moderate' | 'Good';
  nightPerformance: 'High' | 'Very High' | 'Moderate' | 'Good';
  badgeColor: string;
}

export interface ModelEvaluationRunResult {
  modelId: SupportedModelArchitecture;
  modelName: string;
  family: string;
  dataset: string;
  condition: string;
  hardware: string;
  testedFrames: number;
  precision: number;
  recall: number;
  f1Score: number;
  mAP50: number;
  mAP50_95: number;
  latencyMs: number;
  fps: number;
  fpr: number; // False positive rate
  fnr: number; // False negative rate
  criticalHazardRecall: number;
  avgWarningLeadTimeSec: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  rank: number;
}
