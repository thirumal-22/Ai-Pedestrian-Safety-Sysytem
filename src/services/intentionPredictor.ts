import { CollisionZoneStatus, CrossingIntention, TrajectoryPoint } from '../types';

export interface IntentionResult {
  intention: CrossingIntention;
  confidence: number;
  intentionRisk: number; // 0 - 100 for PD-TCR fusion
}

/**
 * Pedestrian Crossing Intention Prediction Module
 * Multi-frame trajectory orientation and lateral velocity analyzer
 * Extensible for future LSTM / Temporal Transformer plugins.
 */
export class IntentionPredictor {
  public static predict(
    history: TrajectoryPoint[],
    metricVelocity: { vx: number; vy: number; speed: number },
    lateralOffset: number,
    collisionStatus: CollisionZoneStatus,
    approachRate: number
  ): IntentionResult {
    // If not enough history, unknown / stationary fallback
    if (!history || history.length < 3) {
      return {
        intention: 'UNKNOWN',
        confidence: 0.5,
        intentionRisk: 20,
      };
    }

    const { vx, vy, speed } = metricVelocity;
    const absVx = Math.abs(vx);
    const absOffset = Math.abs(lateralOffset);

    // 1. Stationary Check: Very low speed over recent frames
    if (speed < 0.35) {
      return {
        intention: 'STATIONARY',
        confidence: 0.88,
        intentionRisk: 15,
      };
    }

    // 2. Already Inside Vehicle Path
    if (collisionStatus === 'INSIDE') {
      return {
        intention: 'IN_VEHICLE_PATH',
        confidence: 0.94,
        intentionRisk: 100,
      };
    }

    // 3. Movement vector heading
    // Check if moving toward vehicle centerline (lateral convergence)
    const isHeadingTowardCenter =
      (lateralOffset > 0 && vx < -0.2) || (lateralOffset < 0 && vx > 0.2);

    // 4. Crossing Check:
    // Pedestrian has significant lateral speed (absVx > 0.6 m/s) heading toward center
    // and is relatively close to lane (offset < 4.0m)
    if (isHeadingTowardCenter && absVx >= 0.65) {
      if (absOffset < 3.5) {
        return {
          intention: 'CROSSING',
          confidence: Math.min(0.96, 0.75 + (absVx / 2.5) * 0.2),
          intentionRisk: 90,
        };
      } else {
        return {
          intention: 'APPROACHING_ROAD',
          confidence: 0.84,
          intentionRisk: 65,
        };
      }
    }

    // 5. Approaching road from further sidewalk/curb
    if (isHeadingTowardCenter && absVx > 0.3) {
      return {
        intention: 'APPROACHING_ROAD',
        confidence: 0.78,
        intentionRisk: 55,
      };
    }

    // 6. Walking parallel to road (longitudinal movement along road curb, low lateral movement)
    if (absVx < 0.4 && Math.abs(approachRate) > 0.3) {
      return {
        intention: 'WALKING_PARALLEL',
        confidence: 0.86,
        intentionRisk: 25,
      };
    }

    // Default general walking
    return {
      intention: 'WALKING_PARALLEL',
      confidence: 0.70,
      intentionRisk: 30,
    };
  }
}
