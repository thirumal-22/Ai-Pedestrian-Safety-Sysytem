import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { ServerInferenceEngine, FrameInferenceRequest } from './src/server/inferenceEngine';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  const engine = new ServerInferenceEngine();

  // API status routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ADAS Pedestrian Safety Backend & WebSocket Inference Server',
      port: PORT,
      timestamp: Date.now(),
      wsEndpoint: '/ws/inference',
    });
  });

  app.get('/api/inference/metrics', (req, res) => {
    res.json({
      activeEngines: 1,
      modelArchitecture: 'YOLOv8 + ByteTrack + PD-TCR Risk Fusion',
      supportedInputTypes: ['webcam', 'dashcam_video', 'screen_share'],
      websocketPath: '/ws/inference',
      timestamp: Date.now(),
    });
  });

  // WebSocket Server for real-time camera/video frame streaming
  const wss = new WebSocketServer({
    server,
    path: '/ws/inference',
  });

  console.log('WebSocket Inference Server initialized on /ws/inference');

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WebSocket] Client connected from ${clientIp}`);

    let clientConfig = {
      confidenceThreshold: 0.35,
      vehicleSpeed: 35,
      modelVariant: 'YOLOv8n',
    };

    // Send initial handshake
    ws.send(
      JSON.stringify({
        type: 'ready',
        status: 'connected',
        server: 'ADAS-PDTCR-Inference-Engine-v2',
        supportedFormats: ['json_base64', 'raw_binary_jpeg'],
        timestamp: Date.now(),
      })
    );

    ws.on('message', (data: any, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Binary message handling
          const result = engine.processFrame({
            frameSeq: Date.now() % 100000,
            timestamp: Date.now(),
            width: 640,
            height: 360,
            confidenceThreshold: clientConfig.confidenceThreshold,
            vehicleSpeed: clientConfig.vehicleSpeed,
          });
          ws.send(JSON.stringify(result));
          return;
        }

        const text = data.toString('utf-8');
        const message = JSON.parse(text);

        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now(), clientTimestamp: message.timestamp }));
          return;
        }

        if (message.type === 'init' || message.type === 'update_config') {
          if (message.config) {
            clientConfig = { ...clientConfig, ...message.config };
          }
          ws.send(
            JSON.stringify({
              type: 'config_ack',
              config: clientConfig,
              timestamp: Date.now(),
            })
          );
          return;
        }

        if (message.type === 'frame') {
          const req: FrameInferenceRequest = {
            frameSeq: message.frameSeq || 0,
            timestamp: message.timestamp || Date.now(),
            width: message.width || 640,
            height: message.height || 360,
            image: message.image,
            vehicleSpeed: message.vehicleSpeed ?? clientConfig.vehicleSpeed,
            confidenceThreshold: message.confidenceThreshold ?? clientConfig.confidenceThreshold,
            modelVariant: message.modelVariant ?? clientConfig.modelVariant,
          };

          const result = engine.processFrame(req);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(result));
          }
        }
      } catch (err: any) {
        console.error('[WebSocket] Message processing error:', err.message);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Failed to process frame inference payload',
            })
          );
        }
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientIp}`);
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Client socket error:`, err);
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ADAS Pedestrian Safety Platform listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
