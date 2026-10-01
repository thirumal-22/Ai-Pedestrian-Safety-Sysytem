import {
  AblationSettings,
  CollisionZoneStatus,
  CrossingIntention,
  PDTCRFactors,
  PDTCRWeights,
  RiskLevel,
  RiskThresholds,
} from '../types';

export interface PDTCRCalculationInput {
  distance: number;                   // meters
  lateralOffset: number;              // meters
  approachRate: number;               // closing speed in m/s (positive = approaching)
  metricVelocity: { vx: number; vy: number; speed: number };
  collisionStatus: CollisionZoneStatus;
  zoneRiskFactor: number;             // 0 - 100
  intention: CrossingIntention;
  intentionRiskFactor: number;        // 0 - 100
  weights: PDTCRWeights;
  thresholds: RiskThresholds;
  ablation: AblationSettings;
  vehicleSpeedKmh: number;
}

export interface PDTCRResult {
  riskScore: number;
  riskLevel: RiskLevel;
  ttc: number;
  factors: PDTCRFactors;
  explainableReason: string;
}

/**
 * PD-TCR (Pedestrian Distance–Trajectory–Collision Risk) Fusion Algorithm
 * Combines Detection confidence, Metric distance, Trajectory dynamics, Collision zone occupancy,
 * Relative closing speed, Time-to-Collision (TTC), and Crossing Intention into an explainable score.
 */
export class PDTCRAngine {
  /**
   * Calculates Time-to-Collision (TTC)
   * Formula: TTC = Distance / V_relative
   * Safely handles non-closing or diverging cases (returns Infinity)
   */
  public static calculateTTC(distance: number, approachRate: number): number {
    // If distance is negative or approach rate is non-positive (pedestrian not closing distance)
    if (approachRate <= 0.1 || distance <= 0) {
      return Infinity;
    }
    const rawTtc = distance / approachRate;
    return Math.max(0.1, Math.round(rawTtc * 10) / 10);
  }

  /**
   * Computes component risks and fuses them into normalized 0-100 score
   */
  public static computeRisk(input: PDTCRCalculationInput): PDTCRResult {
    const {
      distance,
      lateralOffset,
      approachRate,
      metricVelocity,
      collisionStatus,
      zoneRiskFactor,
      intention,
      intentionRiskFactor,
      weights,
      thresholds,
      ablation,
    } = input;

    // 1. Time-to-Collision calculation
    const ttc = this.calculateTTC(distance, approachRate);

    // --- Sub-factor 1: Distance Risk (R_d) ---
    // Critical when distance < 8m, high up to 18m, tapering to 0 at 45m+
    let distanceRisk = 0;
    if (distance <= 5.0) {
      distanceRisk = 100;
    } else if (distance <= 15.0) {
      distanceRisk = 100 - ((distance - 5.0) / 10.0) * 35; // 100 down to 65
    } else if (distance <= 35.0) {
      distanceRisk = 65 - ((distance - 15.0) / 20.0) * 45; // 65 down to 20
    } else if (distance <= 55.0) {
      distanceRisk = Math.max(0, 20 - ((distance - 35.0) / 20.0) * 20); // 20 down to 0
    }

    // --- Sub-factor 2: Trajectory Risk (R_t) ---
    // Evaluates lateral heading toward vehicle path
    let trajectoryRisk = 0;
    const isHeadingTowardCenter =
      (lateralOffset > 0 && metricVelocity.vx < -0.2) ||
      (lateralOffset < 0 && metricVelocity.vx > 0.2);
    const lateralSpeed = Math.abs(metricVelocity.vx);

    if (collisionStatus === 'INSIDE') {
      trajectoryRisk = 95;
    } else if (isHeadingTowardCenter) {
      // Pedestrian is moving inward towards vehicle trajectory
      trajectoryRisk = Math.min(100, 40 + lateralSpeed * 35);
    } else if (Math.abs(metricVelocity.vx) < 0.2 && Math.abs(lateralOffset) < 3.0) {
      // Stationary close to edge
      trajectoryRisk = 30;
    } else {
      // Moving away or walking safely parallel
      trajectoryRisk = 10;
    }

    // --- Sub-factor 3: Collision Zone Risk (R_c) ---
    const collisionZoneRisk = zoneRiskFactor;

    // --- Sub-factor 4: Relative Velocity Risk (R_v) ---
    // Fast closing rate increases hazard
    let relativeVelocityRisk = 0;
    if (approachRate <= 0) {
      relativeVelocityRisk = 5;
    } else if (approachRate < 3.0) {
      relativeVelocityRisk = (approachRate / 3.0) * 40;
    } else if (approachRate < 10.0) {
      relativeVelocityRisk = 40 + ((approachRate - 3.0) / 7.0) * 40;
    } else {
      relativeVelocityRisk = Math.min(100, 80 + (approachRate - 10.0) * 2);
    }

    // --- Sub-factor 5: TTC Risk (R_ttc) ---
    let ttcRisk = 0;
    if (ttc <= thresholds.ttcCritical) {
      // e.g. <= 2.0s is maximum danger
      ttcRisk = 100;
    } else if (ttc <= thresholds.ttcWarning) {
      // e.g. 2.0s to 3.8s is high risk
      const ratio = (ttc - thresholds.ttcCritical) / (thresholds.ttcWarning - thresholds.ttcCritical);
      ttcRisk = 100 - ratio * 40; // 100 down to 60
    } else if (ttc <= 7.0) {
      const ratio = (ttc - thresholds.ttcWarning) / (7.0 - thresholds.ttcWarning);
      ttcRisk = 60 - ratio * 45; // 60 down to 15
    } else {
      ttcRisk = 0;
    }

    // --- Sub-factor 6: Intention Risk (R_i) ---
    const intentionRisk = intentionRiskFactor;

    // Apply Ablation study switches (zero out components if ablated)
    const effWd = ablation.enableDistance ? weights.Wd : 0;
    const effWt = ablation.enableTrajectory ? weights.Wt : 0;
    const effWc = ablation.enableCollisionZone ? weights.Wc : 0;
    const effWv = ablation.enableTrajectory ? weights.Wv : 0; // grouped with velocity/trajectory
    const effWtcc = ablation.enableTTC ? weights.Wtcc : 0;
    const effWi = ablation.enableIntention ? weights.Wi : 0;

    const totalActiveWeight = effWd + effWt + effWc + effWv + effWtcc + effWi;
    const normFactor = totalActiveWeight > 0 ? 1.0 / totalActiveWeight : 1.0;

    const weightedScore =
      effWd * distanceRisk +
      effWt * trajectoryRisk +
      effWc * collisionZoneRisk +
      effWv * relativeVelocityRisk +
      effWtcc * ttcRisk +
      effWi * intentionRisk;

    const finalScore = Math.min(100, Math.max(0, Math.round(weightedScore * normFactor)));

    // Categorization into LOW, MEDIUM, HIGH, CRITICAL
    let riskLevel: RiskLevel = 'LOW';
    if (finalScore >= thresholds.criticalMin || (ttc < 1.8 && collisionStatus === 'INSIDE')) {
      riskLevel = 'CRITICAL';
    } else if (finalScore > thresholds.mediumMax) {
      riskLevel = 'HIGH';
    } else if (finalScore > thresholds.lowMax) {
      riskLevel = 'MEDIUM';
    }

    // Explainable Reason Formulation
    const explainableReason = this.generateExplanation(
      riskLevel,
      distance,
      ttc,
      collisionStatus,
      intention,
      approachRate,
      metricVelocity.vx
    );

    return {
      riskScore: finalScore,
      riskLevel,
      ttc,
      factors: {
        distanceRisk: Math.round(distanceRisk),
        trajectoryRisk: Math.round(trajectoryRisk),
        collisionZoneRisk: Math.round(collisionZoneRisk),
        relativeVelocityRisk: Math.round(relativeVelocityRisk),
        ttcRisk: Math.round(ttcRisk),
        intentionRisk: Math.round(intentionRisk),
      },
      explainableReason,
    };
  }

  private static generateExplanation(
    level: RiskLevel,
    distance: number,
    ttc: number,
    collisionStatus: CollisionZoneStatus,
    intention: CrossingIntention,
    approachRate: number,
    vx: number
  ): string {
    if (level === 'CRITICAL') {
      if (collisionStatus === 'INSIDE') {
        return `Pedestrian is inside projected vehicle path with short TTC (${ttc === Infinity ? '>10' : ttc.toFixed(1)}s) at ${distance.toFixed(1)}m. Imminent collision hazard.`;
      }
      return `Rapid lateral approach (${Math.abs(vx).toFixed(1)} m/s) with critical TTC of ${ttc === Infinity ? 'N/A' : ttc.toFixed(1)}s. Intention: ${intention}.`;
    }

    if (level === 'HIGH') {
      if (collisionStatus === 'APPROACHING') {
        return `Pedestrian approaching roadway boundary at ${Math.abs(vx).toFixed(1)} m/s. Closing rate is ${approachRate.toFixed(1)} m/s, distance ${distance.toFixed(1)}m.`;
      }
      return `Close proximity (${distance.toFixed(1)}m) with intention ${intention}. Caution advised.`;
    }

    if (level === 'MEDIUM') {
      return `Pedestrian detected at ${distance.toFixed(1)}m. Intention is ${intention}; trajectory is outside primary collision zone.`;
    }

    return `Safe clearance (${distance.toFixed(1)}m). Low risk trajectory, stable non-conflicting path.`;
  }
}
