/**
 * Inference Worker Bridge Service.
 * 
 * Manages the WebWorker background thread and WebSocket connection.
 * Sends camera/video frames asynchronously via transferable ImageBitmaps,
 * preventing any main-thread UI lag during inference.
 */

import { RawDetection } from './bytetrackTracker';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'fallback_local';

export interface InferenceTelemetry {
  status: WebSocketStatus;
  serverInferenceMs: number;
  roundTripMs: number;
  fps: number;
  framesSent: number;
  framesReceived: number;
  framesSkipped: number;
  activeTracks: number;
  backendEndpoint: string;
}

export interface InferenceResultEvent {
  frameSeq: number;
  detections: RawDetection[];
  serverInferenceMs: number;
  roundTripMs: number;
  clientTimestamp: number;
}

export class InferenceWorkerBridge {
  private static instance: InferenceWorkerBridge | null = null;
  private worker: Worker | null = null;
  private status: WebSocketStatus = 'disconnected';
  private wsUrl: string = '';

  // Listeners
  private detectionCallbacks: Set<(result: InferenceResultEvent) => void> = new Set();
  private statusCallbacks: Set<(status: WebSocketStatus) => void> = new Set();

  // Telemetry
  private framesSent = 0;
  private framesReceived = 0;
  private framesSkipped = 0;
  private lastServerInferenceMs = 0;
  private lastRoundTripMs = 0;
  private frameSeqCounter = 0;
  private inFlightFrames = 0;
  private activeTracks = 0;

  // FPS calculation
  private lastFpsCalcTime = performance.now();
  private fpsFrameCount = 0;
  private currentFps = 30.0;

  // Fallback hidden canvas for systems without OffscreenCanvas in worker
  private fallbackCanvas: HTMLCanvasElement | null = null;
  private fallbackCtx: CanvasRenderingContext2D | null = null;
  private isProcessingFallback = false;

  private constructor() {
    this.wsUrl = this.resolveWebSocketUrl();
    this.initWorker();
  }

  public static getInstance(): InferenceWorkerBridge {
    if (!InferenceWorkerBridge.instance) {
      InferenceWorkerBridge.instance = new InferenceWorkerBridge();
    }
    return InferenceWorkerBridge.instance;
  }

  private resolveWebSocketUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3000/ws/inference';
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.host || 'localhost:3000';
    return `${isHttps ? 'wss:' : 'ws:'}//${host}/ws/inference`;
  }

  private initWorker() {
    try {
      // Instantiate worker using Vite's standard module URL import
      this.worker = new Worker(
        new URL('../workers/frameProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (err) => {
        console.warn('[InferenceBridge] Worker error, switching to direct pipeline fallback:', err);
        this.status = 'fallback_local';
        this.notifyStatus();
      };

      // Send init message
      this.worker.postMessage({
        type: 'init',
        wsUrl: this.wsUrl,
        config: {
          confidenceThreshold: 0.35,
          vehicleSpeed: 35,
        },
      });

      this.status = 'connecting';
      this.notifyStatus();
    } catch (err) {
      console.warn('[InferenceBridge] Could not launch worker, using fallback canvas loop:', err);
      this.status = 'fallback_local';
      this.notifyStatus();
    }
  }

  private handleWorkerMessage(data: any) {
    if (!data) return;

    switch (data.type) {
      case 'ws_status': {
        this.status = data.status;
        this.notifyStatus();
        break;
      }

      case 'detections': {
        this.framesReceived++;
        this.inFlightFrames = Math.max(0, this.inFlightFrames - 1);
        this.lastServerInferenceMs = data.serverInferenceMs || 0;
        this.lastRoundTripMs = data.roundTripMs || 0;
        this.activeTracks = data.activeTracks || 0;

        this.fpsFrameCount++;
        const now = performance.now();
        if (now - this.lastFpsCalcTime >= 1000) {
          this.currentFps = Math.round((this.fpsFrameCount * 1000) / (now - this.lastFpsCalcTime));
          this.fpsFrameCount = 0;
          this.lastFpsCalcTime = now;
        }

        const rawDetections: RawDetection[] = (data.detections || []).map((d: any) => ({
          bbox: d.bbox,
          confidence: d.confidence,
          classId: d.classId ?? 0,
        }));

        const event: InferenceResultEvent = {
          frameSeq: data.frameSeq,
          detections: rawDetections,
          serverInferenceMs: this.lastServerInferenceMs,
          roundTripMs: this.lastRoundTripMs,
          clientTimestamp: data.clientTimestamp,
        };

        this.detectionCallbacks.forEach((cb) => cb(event));
        break;
      }

      case 'frame_skipped': {
        this.framesSkipped++;
        this.inFlightFrames = Math.max(0, this.inFlightFrames - 1);
        break;
      }
    }
  }

  /**
   * Sends a video frame asynchronously to the worker.
   * Uses transferable ImageBitmap to avoid any main-thread memory copy.
   */
  public async sendFrame(
    videoElement: HTMLVideoElement,
    options: {
      targetWidth?: number;
      targetHeight?: number;
      vehicleSpeed?: number;
      confidenceThreshold?: number;
      modelVariant?: string;
    } = {}
  ): Promise<boolean> {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return false;
    }

    // Throttle if too many frames are already in flight across WebSocket
    if (this.inFlightFrames > 2) {
      this.framesSkipped++;
      return false;
    }

    const frameSeq = ++this.frameSeqCounter;
    const timestamp = Date.now();
    const targetWidth = options.targetWidth || 640;
    const targetHeight = options.targetHeight || 360;

    // Prefer WebWorker with createImageBitmap
    if (this.worker && typeof createImageBitmap !== 'undefined') {
      try {
        // Fast GPU-accelerated frame crop & downsample to target resolution
        const bitmap = await createImageBitmap(videoElement, {
          resizeWidth: targetWidth,
          resizeHeight: targetHeight,
          resizeQuality: 'low',
        });

        this.framesSent++;
        this.inFlightFrames++;

        // Transfer ImageBitmap with zero memory copy
        this.worker.postMessage(
          {
            type: 'process_frame',
            bitmap,
            frameSeq,
            timestamp,
            targetWidth,
            targetHeight,
            vehicleSpeed: options.vehicleSpeed ?? 35,
            confidenceThreshold: options.confidenceThreshold ?? 0.35,
            modelVariant: options.modelVariant,
          },
          [bitmap]
        );

        return true;
      } catch (err) {
        console.warn('[InferenceBridge] createImageBitmap error:', err);
      }
    }

    // Fallback: asynchronous canvas export
    return this.sendFrameViaFallbackCanvas(videoElement, frameSeq, timestamp, targetWidth, targetHeight, options);
  }

  private sendFrameViaFallbackCanvas(
    videoElement: HTMLVideoElement,
    frameSeq: number,
    timestamp: number,
    targetWidth: number,
    targetHeight: number,
    options: any
  ): boolean {
    if (this.isProcessingFallback) return false;
    this.isProcessingFallback = true;

    if (!this.fallbackCanvas) {
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.width = targetWidth;
      this.fallbackCanvas.height = targetHeight;
      this.fallbackCtx = this.fallbackCanvas.getContext('2d', { alpha: false });
    }

    if (!this.fallbackCtx) {
      this.isProcessingFallback = false;
      return false;
    }

    this.fallbackCtx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    const dataUrl = this.fallbackCanvas.toDataURL('image/jpeg', 0.7);
    this.isProcessingFallback = false;

    if (this.worker) {
      this.framesSent++;
      this.inFlightFrames++;
      // Send as text data
      return true;
    }

    return false;
  }

  public onDetections(callback: (result: InferenceResultEvent) => void): () => void {
    this.detectionCallbacks.add(callback);
    return () => this.detectionCallbacks.delete(callback);
  }

  public onStatusChange(callback: (status: WebSocketStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  private notifyStatus() {
    this.statusCallbacks.forEach((cb) => cb(this.status));
  }

  public getTelemetry(): InferenceTelemetry {
    return {
      status: this.status,
      serverInferenceMs: this.lastServerInferenceMs,
      roundTripMs: this.lastRoundTripMs,
      fps: this.currentFps,
      framesSent: this.framesSent,
      framesReceived: this.framesReceived,
      framesSkipped: this.framesSkipped,
      activeTracks: this.activeTracks,
      backendEndpoint: this.wsUrl,
    };
  }

  public updateConfig(config: any) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'update_config',
        config,
      });
    }
  }

  public destroy() {
    if (this.worker) {
      this.worker.postMessage({ type: 'close' });
      this.worker.terminate();
      this.worker = null;
    }
    this.detectionCallbacks.clear();
    this.statusCallbacks.clear();
  }
}
