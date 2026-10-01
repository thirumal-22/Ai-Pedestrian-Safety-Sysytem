import { BoundingBox } from '../types';
import { RawDetection } from './bytetrackTracker';

export interface ScenarioDefinition {
  id: string;
  name: string;
  environment: 'Urban Day' | 'Suburban' | 'Night / Rain' | 'Arterial Road';
  description?: string;
  vehicleSpeedKmh: number;
  expectedHazard: string;
  pedestrians: {
    baseX: number; // 0 to 1 relative to frame width
    baseY: number; // 0 to 1 relative to frame height
    destX: number;
    destY: number;
    startTimeSec: number;
    durationSec: number;
    height: number;
    color: string;
    label: string;
  }[];
}

export const BENCHMARK_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'downtown_crosswalk',
    name: 'Downtown Crosswalk — Jaywalker Hazard',
    environment: 'Urban Day',
    vehicleSpeedKmh: 35,
    expectedHazard: 'Pedestrian steps off right curb directly into vehicle path',
    pedestrians: [
      {
        baseX: 0.76,
        baseY: 0.58,
        destX: 0.38,
        destY: 0.88,
        startTimeSec: 1.0,
        durationSec: 9.0,
        height: 110,
        color: '#f97316',
        label: 'Jaywalker',
      },
      {
        baseX: 0.22,
        baseY: 0.54,
        destX: 0.16,
        destY: 0.62,
        startTimeSec: 0.0,
        durationSec: 14.0,
        height: 85,
        color: '#38bdf8',
        label: 'Sidewalk Walker',
      },
    ],
  },
  {
    id: 'suburban_sudden_turn',
    name: 'Suburban Street — Parallel Walking to Sudden Crossing',
    environment: 'Suburban',
    vehicleSpeedKmh: 30,
    expectedHazard: 'Pedestrian walking parallel suddenly pivots toward roadway',
    pedestrians: [
      {
        baseX: 0.72,
        baseY: 0.52,
        destX: 0.44,
        destY: 0.82,
        startTimeSec: 2.5,
        durationSec: 8.0,
        height: 95,
        color: '#ec4899',
        label: 'Pivoting Pedestrian',
      },
      {
        baseX: 0.85,
        baseY: 0.50,
        destX: 0.90,
        destY: 0.58,
        startTimeSec: 0.0,
        durationSec: 12.0,
        height: 75,
        color: '#10b981',
        label: 'Distant Jogger',
      },
    ],
  },
  {
    id: 'night_low_light',
    name: 'Night Dashcam — Low Contrast Pedestrian Hazard',
    environment: 'Night / Rain',
    vehicleSpeedKmh: 40,
    expectedHazard: 'Dark clothing pedestrian crossing headlight fringe boundary',
    pedestrians: [
      {
        baseX: 0.28,
        baseY: 0.55,
        destX: 0.58,
        destY: 0.84,
        startTimeSec: 1.5,
        durationSec: 8.5,
        height: 100,
        color: '#94a3b8',
        label: 'Night Crosser',
      },
    ],
  },
  {
    id: 'fast_arterial',
    name: 'Arterial Road — High Speed Distant Crossing',
    environment: 'Arterial Road',
    vehicleSpeedKmh: 55,
    expectedHazard: 'High vehicle approach velocity compressing TTC at longer distance',
    pedestrians: [
      {
        baseX: 0.65,
        baseY: 0.49,
        destX: 0.48,
        destY: 0.74,
        startTimeSec: 0.5,
        durationSec: 7.0,
        height: 68,
        color: '#eab308',
        label: 'Mid-block Crosser',
      },
      {
        baseX: 0.32,
        baseY: 0.50,
        destX: 0.30,
        destY: 0.54,
        startTimeSec: 0.0,
        durationSec: 15.0,
        height: 65,
        color: '#a855f7',
        label: 'Bus Stop Waiting',
      },
    ],
  },
];

/**
 * High-performance Dashcam Video Synthesizer & Canvas Renderer
 * Renders realistic dashcam video frames with road perspective, asphalt texture,
 * road markings, dynamic lighting, walking pedestrian silhouettes, and extracts
 * synchronized bounding box detections with realistic detector noise.
 */
export class DashcamSimulator {
  private scenario: ScenarioDefinition;
  private startTime: number;
  private currentTimeSec: number = 0;
  private roadOffset: number = 0;

  constructor(scenarioId: string = 'downtown_crosswalk') {
    this.scenario =
      BENCHMARK_SCENARIOS.find((s) => s.id === scenarioId) || BENCHMARK_SCENARIOS[0];
    this.startTime = Date.now();
  }

  public setScenario(scenarioId: string) {
    this.scenario =
      BENCHMARK_SCENARIOS.find((s) => s.id === scenarioId) || BENCHMARK_SCENARIOS[0];
    this.reset();
  }

  public reset() {
    this.currentTimeSec = 0;
    this.roadOffset = 0;
    this.startTime = Date.now();
  }

  /**
   * Advances simulation clock and draws realistic dashcam perspective frame
   */
  public renderFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaTimeMs: number
  ): RawDetection[] {
    this.currentTimeSec += deltaTimeMs / 1000;
    const isNight = this.scenario.environment === 'Night / Rain';

    // Road speed motion offset
    const speedFactor = this.scenario.vehicleSpeedKmh / 30.0;
    this.roadOffset = (this.roadOffset + deltaTimeMs * 0.4 * speedFactor) % 80;

    const horizonY = height * 0.46;

    // 1. Sky & Background
    if (isNight) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, '#040711');
      skyGrad.addColorStop(1, '#0c1322');
      ctx.fillStyle = skyGrad;
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, '#4a6fa5');
      skyGrad.addColorStop(0.7, '#8aa9c8');
      skyGrad.addColorStop(1, '#c5d8e8');
      ctx.fillStyle = skyGrad;
    }
    ctx.fillRect(0, 0, width, horizonY);

    // Distant city skyline / buildings
    ctx.fillStyle = isNight ? '#0b101d' : '#6b7f96';
    for (let x = 0; x < width; x += 45) {
      const bHeight = 25 + Math.sin(x * 0.08) * 18 + Math.cos(x * 0.03) * 12;
      ctx.fillRect(x, horizonY - bHeight, 42, bHeight);
    }

    // 2. Road & Sidewalks Ground
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    if (isNight) {
      groundGrad.addColorStop(0, '#090d16');
      groundGrad.addColorStop(1, '#111827');
    } else {
      groundGrad.addColorStop(0, '#2d333b');
      groundGrad.addColorStop(1, '#1f242b');
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // Sidewalk left & right
    ctx.fillStyle = isNight ? '#161c28' : '#57606e';
    // Left sidewalk polygon
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width * 0.28, horizonY);
    ctx.lineTo(width * 0.05, height);
    ctx.lineTo(0, height);
    ctx.fill();

    // Right sidewalk polygon
    ctx.beginPath();
    ctx.moveTo(width, horizonY);
    ctx.lineTo(width * 0.72, horizonY);
    ctx.lineTo(width * 0.95, height);
    ctx.lineTo(width, height);
    ctx.fill();

    // Curb lines
    ctx.strokeStyle = isNight ? '#222d42' : '#8892a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.28, horizonY);
    ctx.lineTo(width * 0.05, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width * 0.72, horizonY);
    ctx.lineTo(width * 0.95, height);
    ctx.stroke();

    // Perspective Dashcam Road Lane Markings
    ctx.strokeStyle = isNight ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = 3;

    // Solid white edge lines
    ctx.beginPath();
    ctx.moveTo(width * 0.32, horizonY);
    ctx.lineTo(width * 0.15, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width * 0.68, horizonY);
    ctx.lineTo(width * 0.85, height);
    ctx.stroke();

    // Dashed center lane divider
    ctx.strokeStyle = '#facc15'; // yellow center line
    ctx.lineWidth = 4;
    ctx.setLineDash([24, 28]);
    ctx.lineDashOffset = -this.roadOffset;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, horizonY);
    ctx.lineTo(width * 0.5, height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // 3. Headlight Cone (if night)
    if (isNight) {
      const coneGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.88,
        30,
        width * 0.5,
        height * 0.65,
        width * 0.45
      );
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
      coneGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.08)');
      coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(width * 0.25, height);
      ctx.lineTo(width * 0.42, horizonY + 20);
      ctx.lineTo(width * 0.58, horizonY + 20);
      ctx.lineTo(width * 0.75, height);
      ctx.fill();
    }

    // 4. Vehicle Hood Reflection at Bottom of Dashcam
    const hoodGrad = ctx.createLinearGradient(0, height - 32, 0, height);
    hoodGrad.addColorStop(0, '#090b10');
    hoodGrad.addColorStop(1, '#020408');
    ctx.fillStyle = hoodGrad;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, height);
    ctx.quadraticCurveTo(width * 0.5, height - 24, width * 0.82, height);
    ctx.fill();

    // 5. Pedestrian Simulation & YOLO Detection Generation
    const detections: RawDetection[] = [];
    const t = this.currentTimeSec;

    this.scenario.pedestrians.forEach((ped, idx) => {
      // Loop time within duration
      const totalDur = ped.durationSec;
      const elapsed = (t + idx * 2.8) % totalDur;
      const progress = Math.min(1.0, Math.max(0.0, elapsed / totalDur));

      // Interpolate position
      const curX = (ped.baseX + (ped.destX - ped.baseX) * progress) * width;
      const curY = (ped.baseY + (ped.destY - ped.baseY) * progress) * height;

      // Scale height based on perspective (further pedestrians are smaller)
      const perspectiveScale = 0.35 + (curY - horizonY) / (height - horizonY) * 0.95;
      const pedH = Math.max(38, ped.height * perspectiveScale);
      const pedW = pedH * 0.44;

      const pedLeft = curX - pedW / 2;
      const pedTop = curY - pedH;

      // Draw pedestrian silhouette
      this.drawPedestrian(ctx, pedLeft, pedTop, pedW, pedH, ped.color, elapsed, isNight);

      // Add realistic YOLOv8n detector noise (subtle bounding box jitter and confidence)
      const jitterX = (Math.sin(t * 8 + idx) * 1.5);
      const jitterY = (Math.cos(t * 7 + idx) * 1.5);
      const jitterW = (Math.sin(t * 5 + idx) * 1.2);
      const jitterH = (Math.cos(t * 6 + idx) * 1.8);

      // Confidence depends on size and lighting
      const baseConf = isNight ? 0.78 : 0.91;
      const sizeBonus = Math.min(0.08, (pedH / height) * 0.15);
      const conf = Math.max(0.48, Math.min(0.98, baseConf + sizeBonus + Math.sin(t * 3 + idx) * 0.03));

      detections.push({
        bbox: {
          x: pedLeft + jitterX,
          y: pedTop + jitterY,
          w: pedW + jitterW,
          h: pedH + jitterH,
        },
        confidence: Math.round(conf * 100) / 100,
        classId: 0, // person
      });
    });

    return detections;
  }

  private drawPedestrian(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    accentColor: string,
    time: number,
    isNight: boolean
  ) {
    ctx.save();

    // Walking animation leg swing
    const legPhase = Math.sin(time * 7) * (w * 0.35);

    // Pedestrian shadow on asphalt
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h, w * 0.6, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body silhouette
    const headRadius = w * 0.22;
    const headCenterX = x + w / 2;
    const headCenterY = y + headRadius + 2;

    // Head
    ctx.fillStyle = isNight ? '#475569' : '#1e293b';
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Torso / Jacket
    ctx.fillStyle = isNight ? '#334155' : accentColor;
    const torsoTop = headCenterY + headRadius + 2;
    const torsoH = h * 0.42;
    ctx.beginPath();
    ctx.roundRect(x + w * 0.15, torsoTop, w * 0.7, torsoH, [4, 4, 2, 2]);
    ctx.fill();

    // Legs
    ctx.fillStyle = isNight ? '#1e293b' : '#0f172a';
    const legTop = torsoTop + torsoH;
    const legH = h - (legTop - y);

    // Left leg
    ctx.beginPath();
    ctx.moveTo(x + w * 0.28, legTop);
    ctx.lineTo(x + w * 0.28 - legPhase, legTop + legH);
    ctx.lineTo(x + w * 0.45 - legPhase, legTop + legH);
    ctx.lineTo(x + w * 0.45, legTop);
    ctx.fill();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, legTop);
    ctx.lineTo(x + w * 0.55 + legPhase, legTop + legH);
    ctx.lineTo(x + w * 0.72 + legPhase, legTop + legH);
    ctx.lineTo(x + w * 0.72, legTop);
    ctx.fill();

    ctx.restore();
  }
}
