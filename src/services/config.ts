import { SystemConfig } from '../types';

export const DEFAULT_CONFIG: SystemConfig = {
  calibration: {
    focalLength: 1150,           // px (nominal at 1280x720)
    cameraHeight: 1.35,          // 1.35 meters from ground to dashcam
    cameraPitch: 2.0,            // 2.0 degrees downward pitch
    pedestrianHeight: 1.70,      // standard ISO/SAE pedestrian reference height (m)
    hfov: 72.0,                  // 72 degrees horizontal field of view
    vfov: 44.0,                  // 44 degrees vertical field of view
  },
  weights: {
    Wd: 0.20,                    // Distance risk weight
    Wt: 0.15,                    // Trajectory risk weight
    Wc: 0.20,                    // Collision zone risk weight
    Wv: 0.15,                    // Relative velocity risk weight
    Wtcc: 0.20,                  // Time-to-Collision risk weight
    Wi: 0.10,                    // Crossing intention risk weight
  },
  thresholds: {
    lowMax: 25,
    mediumMax: 50,
    highMax: 75,
    criticalMin: 76,
    ttcCritical: 2.0,            // seconds
    ttcWarning: 3.8,             // seconds
  },
  ablation: {
    enableDistance: true,
    enableTrajectory: true,
    enableTTC: true,
    enableCollisionZone: true,
    enableIntention: true,
  },
  vehicleSpeed: 35.0,            // 35 km/h standard urban driving speed
  speedSource: 'manual',
  confidenceThreshold: 0.45,
  iouThreshold: 0.45,
  distanceMethod: 'ground_plane',
  soundEnabled: true,
  soundVolume: 0.65,
  laneWidth: 3.6,                // 3.6 meters standard lane
  lookaheadDistance: 45.0,       // 45 meters projected corridor
  modelVariant: 'YOLOv8n',
};

export const RISK_COLORS = {
  LOW: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    hex: '#10b981',
    glow: 'rgba(16, 185, 129, 0.3)',
  },
  MEDIUM: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    hex: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.3)',
  },
  HIGH: {
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    badge: 'bg-orange-500/25 text-orange-300 border-orange-500/40',
    hex: '#f97316',
    glow: 'rgba(249, 115, 22, 0.4)',
  },
  CRITICAL: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/60',
    text: 'text-red-400',
    badge: 'bg-red-500/30 text-red-200 border-red-500/50',
    hex: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.6)',
  },
};
