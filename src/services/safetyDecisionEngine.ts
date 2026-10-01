import {
  CollisionZonePolygon,
  RiskLevel,
  SystemConfig,
  TrackedPedestrian,
} from '../types';
import { RISK_COLORS } from './config';

export interface SystemSafetyDecision {
  primaryHazard: TrackedPedestrian | null;
  overallRiskLevel: RiskLevel;
  overallRiskScore: number;
  totalPedestrians: number;
  crossingPedestrians: number;
  inCollisionZoneCount: number;
  leadTTC: number;
  explainableHeadline: string;
  explainableDetail: string;
}

export class SafetyDecisionEngine {
  /**
   * Aggregates multi-pedestrian tracks into an authoritative system safety decision
   */
  public static evaluate(pedestrians: TrackedPedestrian[]): SystemSafetyDecision {
    if (!pedestrians || pedestrians.length === 0) {
      return {
        primaryHazard: null,
        overallRiskLevel: 'LOW',
        overallRiskScore: 0,
        totalPedestrians: 0,
        crossingPedestrians: 0,
        inCollisionZoneCount: 0,
        leadTTC: Infinity,
        explainableHeadline: 'SYSTEM MONITORING ACTIVE — PATH CLEAR',
        explainableDetail: 'No pedestrians detected in camera field of view. Vehicle trajectory unobstructed.',
      };
    }

    // Pedestrians are already sorted by riskScore descending
    const primary = pedestrians[0];
    const overallRiskScore = primary.riskScore;
    const overallRiskLevel = primary.riskLevel;

    const crossingCount = pedestrians.filter(
      (p) => p.intention === 'CROSSING' || p.intention === 'APPROACHING_ROAD' || p.intention === 'IN_VEHICLE_PATH'
    ).length;

    const inZoneCount = pedestrians.filter((p) => p.inCollisionZone).length;

    // Minimum valid TTC among pedestrians closing in
    const validTTCs = pedestrians.map((p) => p.ttc).filter((ttc) => ttc !== Infinity && ttc > 0);
    const leadTTC = validTTCs.length > 0 ? Math.min(...validTTCs) : Infinity;

    // Explainable headlines
    let headline = '';
    if (overallRiskLevel === 'CRITICAL') {
      headline = `CRITICAL COLLISION WARNING — PEDESTRIAN #${primary.id}`;
    } else if (overallRiskLevel === 'HIGH') {
      headline = `HIGH PEDESTRIAN RISK — PEDESTRIAN #${primary.id}`;
    } else if (overallRiskLevel === 'MEDIUM') {
      headline = `CAUTION: PEDESTRIAN NEAR PATH — #${primary.id}`;
    } else {
      headline = `PATH CLEAR — ${pedestrians.length} PEDESTRIAN(S) MONITORED`;
    }

    return {
      primaryHazard: primary,
      overallRiskLevel,
      overallRiskScore,
      totalPedestrians: pedestrians.length,
      crossingPedestrians: crossingCount,
      inCollisionZoneCount: inZoneCount,
      leadTTC,
      explainableHeadline: headline,
      explainableDetail: primary.explainableReason,
    };
  }

  /**
   * Renders the ADAS augmented reality overlays on top of the dashcam frame
   */
  public static renderADASOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    pedestrians: TrackedPedestrian[],
    zonePolygon: CollisionZonePolygon,
    config: SystemConfig,
    safetyDecision: SystemSafetyDecision,
    showCollisionZone: boolean = true
  ) {
    // 1. Draw Dynamic Projected Vehicle Path / Collision Zone
    if (showCollisionZone) {
      this.drawCollisionZone(ctx, zonePolygon, safetyDecision.overallRiskLevel);
    }

    // 2. Draw Each Tracked Pedestrian with ADAS HUD
    pedestrians.forEach((ped) => {
      this.drawPedestrianHUD(ctx, ped, config);
    });

    // 3. Draw Vehicle Hood ADAS Center Reticle
    this.drawVehicleHUD(ctx, width, height, config);
  }

  public static drawCollisionZone(
    ctx: CanvasRenderingContext2D,
    zone: CollisionZonePolygon,
    riskLevel: RiskLevel
  ) {
    const pts = zone.points;
    if (pts.length < 4) return;

    ctx.save();
    const isCritical = riskLevel === 'CRITICAL';
    const isHigh = riskLevel === 'HIGH';
    const isMedium = riskLevel === 'MEDIUM';
    const isAlert = isCritical || isHigh;

    const hoodBottom = pts[0][1];
    const topY = pts[1][1];

    // 1. Dynamic Semi-Transparent Vertical Gradient
    const gradient = ctx.createLinearGradient(0, hoodBottom, 0, topY);
    if (isCritical) {
      gradient.addColorStop(0.0, 'rgba(239, 68, 68, 0.42)');
      gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.22)');
      gradient.addColorStop(1.0, 'rgba(239, 68, 68, 0.06)');
    } else if (isHigh) {
      gradient.addColorStop(0.0, 'rgba(249, 115, 22, 0.35)');
      gradient.addColorStop(0.5, 'rgba(249, 115, 22, 0.18)');
      gradient.addColorStop(1.0, 'rgba(249, 115, 22, 0.05)');
    } else if (isMedium) {
      gradient.addColorStop(0.0, 'rgba(245, 158, 11, 0.28)');
      gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.14)');
      gradient.addColorStop(1.0, 'rgba(245, 158, 11, 0.04)');
    } else {
      gradient.addColorStop(0.0, 'rgba(56, 189, 248, 0.26)');
      gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.13)');
      gradient.addColorStop(1.0, 'rgba(56, 189, 248, 0.03)');
    }

    // Fill Semi-Transparent Trapezoid
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]); // hood left
    ctx.lineTo(pts[1][0], pts[1][1]); // far left
    ctx.lineTo(pts[2][0], pts[2][1]); // far right
    ctx.lineTo(pts[3][0], pts[3][1]); // hood right
    ctx.closePath();
    ctx.fill();

    // 2. Depth Interval Cross-Sections (e.g. 10m, 20m, 30m, 40m distance rungs)
    if (zone.depthIntervals && zone.depthIntervals.length > 0) {
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);

      zone.depthIntervals.forEach((interval) => {
        const intervalStroke = isAlert ? 'rgba(239, 68, 68, 0.55)' : 'rgba(56, 189, 248, 0.40)';
        ctx.strokeStyle = intervalStroke;
        ctx.beginPath();
        ctx.moveTo(interval.leftX, interval.y);
        ctx.lineTo(interval.rightX, interval.y);
        ctx.stroke();

        // Distance Tag at right edge of interval rung
        ctx.save();
        ctx.setLineDash([]);
        ctx.font = '10px monospace';
        ctx.fillStyle = isAlert ? '#fca5a5' : '#7dd3fc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${interval.distanceMeters}m`, interval.rightX + 6, interval.y);
        ctx.restore();
      });
    }

    // 3. Central Projected Travel Trajectory Ray (Dashed centerline)
    const hoodCenterX = (pts[0][0] + pts[3][0]) / 2;
    const farCenterX = (pts[1][0] + pts[2][0]) / 2;
    ctx.strokeStyle = isAlert ? 'rgba(239, 68, 68, 0.65)' : 'rgba(56, 189, 248, 0.50)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(hoodCenterX, hoodBottom);
    ctx.lineTo(farCenterX, topY);
    ctx.stroke();

    // 4. Outer Perspective Boundary Rays (Left and Right corridor edges with glow)
    const edgeColor = isAlert ? '#ef4444' : '#38bdf8';
    ctx.shadowColor = edgeColor;
    ctx.shadowBlur = isAlert ? 10 : 6;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = isAlert ? 3 : 2;
    ctx.setLineDash([14, 8]);

    // Left ray
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.stroke();

    // Right ray
    ctx.beginPath();
    ctx.moveTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.stroke();

    // 5. Far Lookahead Boundary Bracket
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.strokeStyle = isAlert ? 'rgba(239, 68, 68, 0.85)' : 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.stroke();

    // 6. Lookahead HUD Label on Top Edge
    ctx.font = '10px monospace';
    ctx.fillStyle = isAlert ? '#f87171' : '#38bdf8';
    ctx.textAlign = 'center';
    const label = `COLLISION CORRIDOR · LOOKAHEAD: ${zone.lookaheadMeters || 45}m`;
    ctx.fillText(label, farCenterX, topY - 7);

    ctx.restore();
  }

  private static drawPedestrianHUD(
    ctx: CanvasRenderingContext2D,
    ped: TrackedPedestrian,
    config: SystemConfig
  ) {
    const { bbox, id, estimatedDistance, ttc, riskLevel, riskScore, intention, directionSymbol } = ped;
    const color = RISK_COLORS[riskLevel].hex;

    ctx.save();

    // 1. Draw Trajectory History Trail
    if (ped.history.length > 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ped.history.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Ground Contact Point (Foot Contact Marker)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ped.footPoint[0], ped.footPoint[1], 4, 0, Math.PI * 2);
    ctx.fill();

    // Ground plane ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ped.footPoint[0], ped.footPoint[1], bbox.w * 0.45, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. ADAS Corner Bracket Bounding Box
    const x = bbox.x;
    const y = bbox.y;
    const w = bbox.w;
    const h = bbox.h;
    const corner = Math.min(14, w * 0.28);

    ctx.strokeStyle = color;
    ctx.lineWidth = riskLevel === 'CRITICAL' ? 3 : 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + corner, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + corner);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - corner);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + corner, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - corner);
    ctx.stroke();

    // Pulsing halo for CRITICAL risk
    if (riskLevel === 'CRITICAL') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(x, y, w, h);
    }

    // 4. Trajectory Direction Arrow
    if (ped.metricVelocity.speed > 0.3) {
      const arrowStartX = x + w / 2;
      const arrowStartY = y + h * 0.6;
      const arrowLen = Math.min(45, ped.metricVelocity.speed * 20);
      const arrowEndX = arrowStartX + (ped.metricVelocity.vx / (ped.metricVelocity.speed || 1)) * arrowLen;
      const arrowEndY = arrowStartY + (ped.approachRate / (ped.metricVelocity.speed || 1)) * arrowLen;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(arrowStartX, arrowStartY);
      ctx.lineTo(arrowEndX, arrowEndY);
      ctx.stroke();

      // Arrow head
      const headlen = 8;
      const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
      ctx.beginPath();
      ctx.moveTo(arrowEndX, arrowEndY);
      ctx.lineTo(arrowEndX - headlen * Math.cos(angle - Math.PI / 6), arrowEndY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(arrowEndX - headlen * Math.cos(angle + Math.PI / 6), arrowEndY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 5. ADAS Floating Information Badge
    const tagH = 44;
    const tagW = Math.max(140, w + 30);
    const tagX = Math.max(8, x + w / 2 - tagW / 2);
    const tagY = Math.max(8, y - tagH - 6);

    // Badge Background
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, [4]);
    ctx.fill();
    ctx.stroke();

    // Text Row 1: ID & Intention
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = color;
    ctx.fillText(`ID #${id}  ${directionSymbol}  ${riskScore}/100`, tagX + 8, tagY + 16);

    // Text Row 2: Distance & TTC
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#e2e8f0';
    const ttcStr = ttc === Infinity ? 'TTC >10s' : `TTC ${ttc.toFixed(1)}s`;
    ctx.fillText(`D: ${estimatedDistance.toFixed(1)}m  |  ${ttcStr}`, tagX + 8, tagY + 34);

    ctx.restore();
  }

  private static drawVehicleHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: SystemConfig
  ) {
    ctx.save();
    // Center reticle
    const cx = width / 2;
    const cy = height * 0.46;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();

    // Bottom Speed HUD
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(width / 2 - 80, height - 38, 160, 26, [13]);
    ctx.fill();

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`VEHICLE: ${config.vehicleSpeed} km/h (${config.speedSource.toUpperCase()})`, width / 2, height - 21);

    ctx.restore();
  }
}
