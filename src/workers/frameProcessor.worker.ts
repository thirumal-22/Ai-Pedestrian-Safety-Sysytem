/**
 * WebWorker for Asynchronous Frame Encoding and WebSocket Telemetry Pipeline.
 * 
 * Offloads heavy canvas operations, JPEG compression, network serialization,
 * and WebSocket streaming off the main UI thread, guaranteeing that 60 FPS
 * HUD rendering, AR overlays, and user interactions remain completely unblocked.
 */

interface InitMessage {
  type: 'init';
  wsUrl: string;
  config?: {
    confidenceThreshold?: number;
    vehicleSpeed?: number;
    modelVariant?: string;
  };
}

interface FrameMessage {
  type: 'process_frame';
  bitmap: ImageBitmap;
  frameSeq: number;
  timestamp: number;
  targetWidth: number;
  targetHeight: number;
  vehicleSpeed: number;
  confidenceThreshold: number;
  modelVariant?: string;
}

interface ConfigUpdateMessage {
  type: 'update_config';
  config: any;
}

interface CloseMessage {
  type: 'close';
}

type WorkerInMessage = InitMessage | FrameMessage | ConfigUpdateMessage | CloseMessage;

// Internal worker state
let socket: WebSocket | null = null;
let currentWsUrl = '';
let currentConfig: any = {};
let isConnecting = false;
let reconnectTimer: any = null;
let heartbeatTimer: any = null;

// Offscreen canvas for frame downsampling & JPEG compression
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

// Track pending frames for Round-Trip Time (RTT) calculation
const pendingFrameTimes = new Map<number, number>();

function connectWebSocket(url: string) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isConnecting = true;
  postMessageToMain({ type: 'ws_status', status: 'connecting', url });

  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      isConnecting = false;
      postMessageToMain({ type: 'ws_status', status: 'connected', url });

      // Send initial config
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'init',
            config: currentConfig,
            timestamp: Date.now(),
          })
        );
      }

      // Start ping heartbeat
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 8000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'inference_result') {
          const sentTime = pendingFrameTimes.get(data.frameSeq) || data.clientTimestamp || Date.now();
          pendingFrameTimes.delete(data.frameSeq);
          const roundTripMs = Math.max(1, Math.round(Date.now() - sentTime));

          postMessageToMain({
            type: 'detections',
            frameSeq: data.frameSeq,
            detections: data.detections || [],
            serverInferenceMs: data.serverInferenceMs || 0,
            roundTripMs,
            clientTimestamp: data.clientTimestamp,
            backendStatus: data.backendStatus || 'operational',
            activeTracks: data.activeTracks || 0,
          });
        } else if (data.type === 'ready') {
          postMessageToMain({ type: 'backend_ready', info: data });
        }
      } catch (err: any) {
        console.warn('[Worker] Message parse error:', err.message);
      }
    };

    socket.onerror = (err) => {
      console.warn('[Worker] WebSocket error occurred');
      postMessageToMain({ type: 'ws_status', status: 'error' });
    };

    socket.onclose = () => {
      isConnecting = false;
      postMessageToMain({ type: 'ws_status', status: 'disconnected' });

      if (heartbeatTimer) clearInterval(heartbeatTimer);

      // Auto-reconnect after 2 seconds
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (currentWsUrl) {
          connectWebSocket(currentWsUrl);
        }
      }, 2000);
    };
  } catch (err) {
    isConnecting = false;
    postMessageToMain({ type: 'ws_status', status: 'error' });
  }
}

function postMessageToMain(msg: any) {
  (self as any).postMessage(msg);
}

// Handle incoming messages from the Main UI thread
self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const data = e.data;
  if (!data) return;

  switch (data.type) {
    case 'init': {
      currentWsUrl = data.wsUrl;
      currentConfig = data.config || {};
      connectWebSocket(currentWsUrl);
      break;
    }

    case 'update_config': {
      currentConfig = { ...currentConfig, ...data.config };
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'update_config', config: currentConfig }));
      }
      break;
    }

    case 'process_frame': {
      const {
        bitmap,
        frameSeq,
        timestamp,
        targetWidth = 640,
        targetHeight = 360,
        vehicleSpeed = 35,
        confidenceThreshold = 0.35,
        modelVariant,
      } = data;

      try {
        // Enforce backpressure: if socket is busy or bufferedAmount > 384KB, skip frame to prevent network lag
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          bitmap.close();
          postMessageToMain({
            type: 'frame_skipped',
            frameSeq,
            reason: 'socket_not_open',
          });
          return;
        }

        if (socket.bufferedAmount > 384 * 1024) {
          bitmap.close();
          postMessageToMain({
            type: 'frame_skipped',
            frameSeq,
            reason: 'backpressure',
          });
          return;
        }

        // Initialize or resize offscreen canvas if needed
        if (!offscreenCanvas || offscreenCanvas.width !== targetWidth || offscreenCanvas.height !== targetHeight) {
          offscreenCanvas = new OffscreenCanvas(targetWidth, targetHeight);
          offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
        }

        if (!offscreenCtx) {
          bitmap.close();
          return;
        }

        // Draw transferred ImageBitmap onto offscreen canvas
        offscreenCtx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

        // Immediately close the transferred bitmap to release GPU memory on both threads
        bitmap.close();

        // Convert offscreen canvas to compressed JPEG Blob
        const blob = await offscreenCanvas.convertToBlob({
          type: 'image/jpeg',
          quality: 0.72,
        });

        // Convert blob to base64 DataURL
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;

          pendingFrameTimes.set(frameSeq, timestamp);

          // Clean old pending frame timestamps
          if (pendingFrameTimes.size > 60) {
            const firstKey = pendingFrameTimes.keys().next().value;
            if (firstKey !== undefined) pendingFrameTimes.delete(firstKey);
          }

          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: 'frame',
                frameSeq,
                timestamp,
                width: targetWidth,
                height: targetHeight,
                image: base64Data,
                vehicleSpeed,
                confidenceThreshold,
                modelVariant: modelVariant || currentConfig.modelVariant || 'YOLOv8n',
              })
            );
          }
        };

        reader.readAsDataURL(blob);
      } catch (err: any) {
        console.warn('[Worker] Frame processing exception:', err);
        try {
          bitmap.close();
        } catch (_) {}
      }
      break;
    }

    case 'close': {
      if (socket) {
        socket.close();
        socket = null;
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      break;
    }
  }
};
