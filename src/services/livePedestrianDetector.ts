import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { RawDetection } from './bytetrackTracker';

export type DetectorStatus = 'uninitialized' | 'loading' | 'ready' | 'error' | 'fallback';

export interface DetectionResult {
  detections: RawDetection[];
  inferenceTimeMs: number;
  engine: 'coco-ssd' | 'motion-contour' | 'hybrid';
}

/**
 * LivePedestrianDetector
 * Runs real-time AI object detection (TensorFlow.js COCO-SSD / MobileNet)
 * on live video streams (webcam, uploaded files, live dashcam feeds).
 * Detects 'person' class, extracts bounding boxes, and falls back gracefully
 * to adaptive vision contour detection if WebGL/model is initializing.
 */
export class LivePedestrianDetector {
  private static instance: LivePedestrianDetector | null = null;
  private model: cocoSsd.ObjectDetection | null = null;
  private status: DetectorStatus = 'uninitialized';
  private loadingPromise: Promise<void> | null = null;
  private lastInferenceTimeMs: number = 0;
  private isDetecting: boolean = false;

  // Background subtraction & motion memory for hybrid/fallback detector
  private prevFrameData: Uint8ClampedArray | null = null;
  private prevWidth: number = 0;
  private prevHeight: number = 0;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  private constructor() {
    this.initOffscreen();
  }

  public static getInstance(): LivePedestrianDetector {
    if (!LivePedestrianDetector.instance) {
      LivePedestrianDetector.instance = new LivePedestrianDetector();
    }
    return LivePedestrianDetector.instance;
  }

  private initOffscreen() {
    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 320;
      this.offscreenCanvas.height = 180;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Pre-load the COCO-SSD model
   */
  public async loadModel(): Promise<void> {
    if (this.status === 'ready' && this.model) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.status = 'loading';
    this.loadingPromise = (async () => {
      try {
        // Load with lite base model (mobilenet_v2) for high FPS
        this.model = await cocoSsd.load({
          base: 'mobilenet_v2',
        });
        this.status = 'ready';
      } catch (err) {
        console.warn('COCO-SSD model load failed or offline, using fallback vision detector:', err);
        this.status = 'fallback';
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  public getStatus(): DetectorStatus {
    return this.status;
  }

  public getLastInferenceTime(): number {
    return this.lastInferenceTimeMs;
  }

  /**
   * Detect pedestrians on HTMLVideoElement or HTMLCanvasElement
   */
  public async detect(
    source: HTMLVideoElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    confidenceThreshold: number = 0.40
  ): Promise<DetectionResult> {
    const startTime = performance.now();

    // If model is ready, run TensorFlow COCO-SSD
    if (this.status === 'ready' && this.model && !this.isDetecting) {
      try {
        this.isDetecting = true;
        const predictions = await this.model.detect(source, 10, confidenceThreshold);
        const inferenceTime = performance.now() - startTime;
        this.lastInferenceTimeMs = Math.round(inferenceTime);

        // Source dimensions
        let srcW = targetWidth;
        let srcH = targetHeight;
        if ('videoWidth' in source && source.videoWidth > 0) {
          srcW = source.videoWidth;
          srcH = source.videoHeight;
        } else if ('width' in source) {
          srcW = source.width;
          srcH = source.height;
        }

        const scaleX = targetWidth / (srcW || 1);
        const scaleY = targetHeight / (srcH || 1);

        const personDetections: RawDetection[] = [];

        for (const pred of predictions) {
          if (pred.class === 'person' && pred.score >= confidenceThreshold) {
            const [x, y, w, h] = pred.bbox;

            // Constrain and rescale to display canvas
            const scaledX = Math.max(0, Math.min(targetWidth - 10, x * scaleX));
            const scaledY = Math.max(0, Math.min(targetHeight - 10, y * scaleY));
            const scaledW = Math.max(15, Math.min(targetWidth, w * scaleX));
            const scaledH = Math.max(25, Math.min(targetHeight, h * scaleY));

            personDetections.push({
              bbox: {
                x: scaledX,
                y: scaledY,
                w: scaledW,
                h: scaledH,
              },
              confidence: Math.round(pred.score * 100) / 100,
              classId: 0,
            });
          }
        }

        this.isDetecting = false;
        return {
          detections: personDetections,
          inferenceTimeMs: this.lastInferenceTimeMs,
          engine: 'coco-ssd',
        };
      } catch (err) {
        this.isDetecting = false;
        console.warn('Detection inference error:', err);
      }
    }

    // If model is loading or in fallback mode, trigger model load if not started
    if (this.status === 'uninitialized') {
      this.loadModel().catch(() => {});
    }

    // Execute real-time fast optical silhouette/motion pedestrian detector
    const fallbackDetections = this.detectVisualSilhouette(source, targetWidth, targetHeight, confidenceThreshold);
    const totalTime = performance.now() - startTime;
    this.lastInferenceTimeMs = Math.round(totalTime);

    return {
      detections: fallbackDetections,
      inferenceTimeMs: this.lastInferenceTimeMs,
      engine: 'motion-contour',
    };
  }

  /**
   * High-speed vision-based motion and human aspect ratio detector
   * Acts as zero-delay immediate detector while TensorFlow model downloads or if WebGL is unavailable
   */
  private detectVisualSilhouette(
    source: HTMLVideoElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    minConfidence: number
  ): RawDetection[] {
    if (!this.offscreenCanvas || !this.offscreenCtx) {
      return [];
    }

    const sw = this.offscreenCanvas.width;
    const sh = this.offscreenCanvas.height;

    try {
      this.offscreenCtx.drawImage(source, 0, 0, sw, sh);
      const imgData = this.offscreenCtx.getImageData(0, 0, sw, sh);
      const pixels = imgData.data;

      if (!this.prevFrameData || this.prevWidth !== sw || this.prevHeight !== sh) {
        this.prevFrameData = new Uint8ClampedArray(pixels);
        this.prevWidth = sw;
        this.prevHeight = sh;
        return [];
      }

      // Compute frame difference grid
      const gridCols = 32;
      const gridRows = 24;
      const cellW = sw / gridCols;
      const cellH = sh / gridRows;
      const diffGrid: number[][] = Array.from({ length: gridRows }, () => new Array(gridCols).fill(0));

      let motionSum = 0;
      for (let y = 0; y < sh; y += 2) {
        const row = Math.floor(y / cellH);
        for (let x = 0; x < sw; x += 2) {
          const col = Math.floor(x / cellW);
          const idx = (y * sw + x) * 4;
          const dr = Math.abs(pixels[idx] - this.prevFrameData[idx]);
          const dg = Math.abs(pixels[idx + 1] - this.prevFrameData[idx + 1]);
          const db = Math.abs(pixels[idx + 2] - this.prevFrameData[idx + 2]);
          const diff = (dr + dg + db) / 3;

          if (diff > 25) {
            diffGrid[row][col] += 1;
            motionSum++;
          }
        }
      }

      // Copy current frame as previous for next step
      this.prevFrameData.set(pixels);

      // Find connected vertical clusters matching human aspect ratios (H/W between 1.6 and 3.8)
      const detections: RawDetection[] = [];
      const visited: boolean[][] = Array.from({ length: gridRows }, () => new Array(gridCols).fill(false));

      for (let r = 2; r < gridRows - 1; r++) {
        for (let c = 1; c < gridCols - 1; c++) {
          if (!visited[r][c] && diffGrid[r][c] > 5) {
            // BFS cluster search
            let minR = r;
            let maxR = r;
            let minC = c;
            let maxC = c;
            let count = 0;
            const queue: [number, number][] = [[r, c]];
            visited[r][c] = true;

            while (queue.length > 0) {
              const [currR, currC] = queue.shift()!;
              count++;
              minR = Math.min(minR, currR);
              maxR = Math.max(maxR, currR);
              minC = Math.min(minC, currC);
              maxC = Math.max(maxC, currC);

              const neighbors: [number, number][] = [
                [currR - 1, currC],
                [currR + 1, currC],
                [currR, currC - 1],
                [currR, currC + 1],
              ];

              for (const [nr, nc] of neighbors) {
                if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && !visited[nr][nc]) {
                  if (diffGrid[nr][nc] > 4) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc]);
                  }
                }
              }
            }

            // Human proportion filtering:
            // Pedestrians in dashcam perspective are predominantly vertical
            const clusterHeight = (maxR - minR + 1) * cellH;
            const clusterWidth = (maxC - minC + 1) * cellW;
            const aspect = clusterHeight / Math.max(1, clusterWidth);

            if (clusterHeight >= 20 && count >= 6 && aspect >= 1.3 && aspect <= 4.2) {
              const scaleX = targetWidth / sw;
              const scaleY = targetHeight / sh;

              const x = Math.max(0, minC * cellW * scaleX);
              const y = Math.max(0, minR * cellH * scaleY);
              const w = Math.min(targetWidth - x, clusterWidth * scaleX);
              const h = Math.min(targetHeight - y, clusterHeight * scaleY);

              const confidence = Math.min(0.85, 0.45 + (count / 25) * 0.35);

              if (confidence >= minConfidence) {
                detections.push({
                  bbox: { x, y, w, h },
                  confidence: Math.round(confidence * 100) / 100,
                  classId: 0,
                });
              }
            }
          }
        }
      }

      return detections.slice(0, 5); // Return top candidates
    } catch {
      return [];
    }
  }
}
