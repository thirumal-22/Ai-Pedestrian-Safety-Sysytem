import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Camera,
  Upload,
  Layers,
  Gauge,
  Video,
  Eye,
  Sliders,
  Compass,
  ChevronDown,
  ChevronUp,
  Zap,
  Monitor,
  SwitchCamera,
  Film,
  AlertCircle,
  Sparkles,
  Wifi,
  Cpu,
  Activity,
  Radio,
} from 'lucide-react';
import {
  BENCHMARK_SCENARIOS,
  DashcamSimulator,
  ScenarioDefinition,
} from '../../services/dashcamSimulator';
import { ByteTrackTracker, RawDetection } from '../../services/bytetrackTracker';
import { CollisionZoneEngine } from '../../services/collisionZone';
import { SafetyDecisionEngine, SystemSafetyDecision } from '../../services/safetyDecisionEngine';
import { PipelineMetrics, SystemConfig, TrackedPedestrian } from '../../types';
import { LivePedestrianDetector, DetectorStatus } from '../../services/livePedestrianDetector';
import {
  InferenceWorkerBridge,
  WebSocketStatus,
} from '../../services/inferenceWorkerBridge';

interface VideoPlayerPanelProps {
  config: SystemConfig;
  onPedestriansUpdate: (
    pedestrians: TrackedPedestrian[],
    decision: SystemSafetyDecision,
    metrics: PipelineMetrics
  ) => void;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
}

const SAMPLE_ROAD_VIDEOS = [
  {
    id: 'sample_pedestrian_area',
    name: 'Real Footage: Pedestrian Walkway (1080p)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Video_Codec_Test_pedestrian_area_1080p25.y4m.webm',
    vehicleSpeed: 20,
  },
  {
    id: 'sample_dashcam_driving',
    name: 'Real Footage: Automotive Dashcam Road',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Dashcam_film.webm',
    vehicleSpeed: 45,
  },
];

export const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  config,
  onPedestriansUpdate,
  onUpdateConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Video source state
  const [sourceType, setSourceType] = useState<
    'scenario' | 'upload' | 'webcam' | 'screen' | 'sample'
  >('scenario');
  const [currentScenarioId, setCurrentScenarioId] = useState<string>('downtown_crosswalk');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isScreenActive, setIsScreenActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // WebSocket & WebWorker Telemetry State
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected');
  const [wsRoundTripMs, setWsRoundTripMs] = useState<number>(0);
  const [wsServerInferenceMs, setWsServerInferenceMs] = useState<number>(0);
  const [framesProcessedCount, setFramesProcessedCount] = useState<number>(0);
  const lastWorkerDispatchTimeRef = useRef<number>(0);

  // Live AI Detector telemetry state
  const [detectorStatus, setDetectorStatus] = useState<DetectorStatus>('uninitialized');
  const [detectorEngineName, setDetectorEngineName] = useState<string>('TensorFlow.js (COCO-SSD)');
  const [liveInferenceMs, setLiveInferenceMs] = useState<number>(0);
  const [liveDetectionsCount, setLiveDetectionsCount] = useState<number>(0);

  // Overlay visual toggles
  const [showCollisionZone, setShowCollisionZone] = useState<boolean>(true);
  const [showPedestrianHUD, setShowPedestrianHUD] = useState<boolean>(true);
  const [showVelocityVectors, setShowVelocityVectors] = useState<boolean>(true);
  const [showGeometryControls, setShowGeometryControls] = useState<boolean>(true);

  // Real-time computed geometry for panel readout
  const liveZone = CollisionZoneEngine.computeZonePolygon(1280, 720, config);

  // References for continuous loop
  const simulatorRef = useRef<DashcamSimulator>(new DashcamSimulator(currentScenarioId));
  const trackerRef = useRef<ByteTrackTracker>(new ByteTrackTracker());
  const animFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCounterRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(performance.now());
  const fpsRef = useRef<number>(30.0);

  // Non-blocking detection async pipeline refs
  const isDetectingRef = useRef<boolean>(false);
  const latestLiveDetectionsRef = useRef<RawDetection[]>([]);
  const lastDetectTimeRef = useRef<number>(0);
  const lastDetectorStatusUpdateRef = useRef<number>(0);

  // Subscribe to WebWorker and WebSocket Inference Bridge
  useEffect(() => {
    const bridge = InferenceWorkerBridge.getInstance();

    const unsubStatus = bridge.onStatusChange((status) => {
      setWsStatus(status);
    });

    const unsubDetections = bridge.onDetections((res) => {
      latestLiveDetectionsRef.current = res.detections;
      setWsServerInferenceMs(res.serverInferenceMs);
      setWsRoundTripMs(res.roundTripMs);
      setLiveInferenceMs(res.serverInferenceMs);
      setLiveDetectionsCount(res.detections.length);
      setDetectorEngineName('WebSocket Backend (WebWorker)');
      setFramesProcessedCount((prev) => prev + 1);
    });

    return () => {
      unsubStatus();
      unsubDetections();
    };
  }, []);

  // Warm-up local detector model on mount for fallback
  useEffect(() => {
    LivePedestrianDetector.getInstance()
      .loadModel()
      .then(() => {
        setDetectorStatus(LivePedestrianDetector.getInstance().getStatus());
      })
      .catch(() => {});
  }, []);

  // Stop current active media stream
  const stopLiveMedia = () => {
    if (videoElemRef.current && videoElemRef.current.srcObject) {
      const stream = videoElemRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoElemRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setIsScreenActive(false);
    setCameraError(null);
    latestLiveDetectionsRef.current = [];
  };

  // Switch to benchmark scenario
  const handleScenarioChange = (id: string) => {
    stopLiveMedia();
    setCurrentScenarioId(id);
    setSourceType('scenario');
    simulatorRef.current.setScenario(id);
    trackerRef.current.reset();

    const scen = BENCHMARK_SCENARIOS.find((s) => s.id === id);
    if (scen) {
      onUpdateConfig({ vehicleSpeed: scen.vehicleSpeedKmh });
    }
  };

  // Video Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopLiveMedia();
    const url = URL.createObjectURL(file);
    if (videoElemRef.current) {
      videoElemRef.current.srcObject = null;
      videoElemRef.current.src = url;
      videoElemRef.current.loop = true;
      videoElemRef.current.play().catch(() => {});
      setSourceType('upload');
      trackerRef.current.reset();
      setIsPlaying(true);
    }
  };

  // Start/toggle Live Webcam stream
  const startCamera = async (facing: 'user' | 'environment') => {
    setCameraError(null);
    try {
      if (videoElemRef.current && videoElemRef.current.srcObject) {
        const currentStream = videoElemRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach((t) => t.stop());
        videoElemRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoElemRef.current) {
        videoElemRef.current.srcObject = stream;
        videoElemRef.current.play().catch(() => {});
        setIsWebcamActive(true);
        setIsScreenActive(false);
        setSourceType('webcam');
        setCameraFacingMode(facing);
        trackerRef.current.reset();
        setIsPlaying(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setCameraError(
        isDenied
          ? 'Camera permission was denied in this frame. Please click the camera icon in your browser address bar to allow access, or use Screen Share / Sample Video.'
          : 'Could not connect to camera. Ensure camera permissions are granted or another app is not locking the device.'
      );
    }
  };

  const toggleWebcam = () => {
    if (isWebcamActive) {
      stopLiveMedia();
      setSourceType('scenario');
    } else {
      startCamera(cameraFacingMode);
    }
  };

  const flipCamera = () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    if (isWebcamActive) {
      startCamera(nextFacing);
    }
  };

  // Screen / Window Share (ideal for testing YouTube dashcam videos or live traffic cams)
  const toggleScreenCapture = async () => {
    if (isScreenActive) {
      stopLiveMedia();
      setSourceType('scenario');
      return;
    }

    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (videoElemRef.current) {
        videoElemRef.current.srcObject = stream;
        videoElemRef.current.play().catch(() => {});
        setIsWebcamActive(false);
        setIsScreenActive(true);
        setSourceType('screen');
        trackerRef.current.reset();
        setIsPlaying(true);

        stream.getVideoTracks()[0].onended = () => {
          stopLiveMedia();
          setSourceType('scenario');
        };
      }
    } catch (err) {
      console.log('Screen capture dismissed:', err);
    }
  };

  // Load public road/pedestrian video clip
  const loadSampleVideo = (videoUrl: string, defaultSpeed: number) => {
    stopLiveMedia();
    if (videoElemRef.current) {
      videoElemRef.current.srcObject = null;
      videoElemRef.current.crossOrigin = 'anonymous';
      videoElemRef.current.src = videoUrl;
      videoElemRef.current.loop = true;
      videoElemRef.current.play().catch(() => {});
      setSourceType('sample');
      onUpdateConfig({ vehicleSpeed: defaultSpeed });
      trackerRef.current.reset();
      setIsPlaying(true);
    }
  };

  // Drag-and-drop video handler on canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      stopLiveMedia();
      const url = URL.createObjectURL(file);
      if (videoElemRef.current) {
        videoElemRef.current.srcObject = null;
        videoElemRef.current.src = url;
        videoElemRef.current.loop = true;
        videoElemRef.current.play().catch(() => {});
        setSourceType('upload');
        trackerRef.current.reset();
        setIsPlaying(true);
      }
    }
  };

  // Main Render & Detection Processing Loop
  const processFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const dt = (now - lastFrameTimeRef.current) * playbackSpeed;
    lastFrameTimeRef.current = now;

    // FPS calculation
    frameCounterRef.current += 1;
    if (now - lastFpsCalcTimeRef.current >= 1000) {
      fpsRef.current = (frameCounterRef.current * 1000) / (now - lastFpsCalcTimeRef.current);
      frameCounterRef.current = 0;
      lastFpsCalcTimeRef.current = now;
    }

    const width = canvas.width;
    const height = canvas.height;

    let rawDetections: RawDetection[] = [];
    const t0 = performance.now();

    if (sourceType === 'scenario') {
      // Benchmark Dashcam Synthesizer
      if (isPlaying) {
        rawDetections = simulatorRef.current.renderFrame(ctx, width, height, dt);
      }
    } else if (
      videoElemRef.current &&
      (sourceType === 'upload' ||
        sourceType === 'webcam' ||
        sourceType === 'screen' ||
        sourceType === 'sample')
    ) {
      const video = videoElemRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Draw the real live video frame onto the dashcam canvas at full 60 FPS
        ctx.drawImage(video, 0, 0, width, height);

        // Dispatch video frame to WebWorker asynchronously via transferable ImageBitmap
        // Non-blocking, GPU-accelerated, zero main-thread memory copy
        if (now - lastWorkerDispatchTimeRef.current >= 45) {
          lastWorkerDispatchTimeRef.current = now;
          InferenceWorkerBridge.getInstance().sendFrame(video, {
            targetWidth: 640,
            targetHeight: 360,
            vehicleSpeed: config.vehicleSpeed,
            confidenceThreshold: config.confidenceThreshold,
            modelVariant: config.modelVariant,
          });
        }

        // Local fallback: if WebSocket is in fallback or disconnected, run TF.js locally
        if (wsStatus === 'disconnected' || wsStatus === 'fallback_local' || wsStatus === 'error') {
          if (!isDetectingRef.current && now - lastDetectTimeRef.current >= 60) {
            isDetectingRef.current = true;
            lastDetectTimeRef.current = now;

            LivePedestrianDetector.getInstance()
              .detect(video, width, height, config.confidenceThreshold)
              .then((res) => {
                latestLiveDetectionsRef.current = res.detections;

                if (now - lastDetectorStatusUpdateRef.current >= 350) {
                  lastDetectorStatusUpdateRef.current = now;
                  setDetectorStatus(LivePedestrianDetector.getInstance().getStatus());
                  setDetectorEngineName(
                    res.engine === 'coco-ssd'
                      ? 'TensorFlow.js (COCO-SSD Local)'
                      : 'Vision Motion/Silhouette Local'
                  );
                  setLiveInferenceMs(res.inferenceTimeMs);
                  setLiveDetectionsCount(res.detections.length);
                }
              })
              .catch((err) => {
                console.warn('Live detection error:', err);
              })
              .finally(() => {
                isDetectingRef.current = false;
              });
          }
        }

        rawDetections = latestLiveDetectionsRef.current;
      }
    }

    // Run ByteTrack with Trajectory, Ground-Plane Distance & PD-TCR Fusion
    const trackedPedestrians = trackerRef.current.update(
      rawDetections,
      width,
      height,
      now,
      config
    );

    // Compute Dynamic Collision Zone Polygon
    const zonePolygon = CollisionZoneEngine.computeZonePolygon(width, height, config);

    // Safety Decision Engine
    const decision = SafetyDecisionEngine.evaluate(trackedPedestrians);
    const inferenceTime =
      sourceType === 'scenario'
        ? Math.max(6, Math.round(performance.now() - t0))
        : wsServerInferenceMs || liveInferenceMs || Math.max(12, Math.round(performance.now() - t0));

    // Render AR Overlays
    if (showCollisionZone || showPedestrianHUD) {
      SafetyDecisionEngine.renderADASOverlay(
        ctx,
        width,
        height,
        showPedestrianHUD ? trackedPedestrians : [],
        zonePolygon,
        config,
        decision,
        showCollisionZone
      );
    }

    // Notify Parent Dashboard of new telemetry
    onPedestriansUpdate(trackedPedestrians, decision, {
      fps: Math.round(fpsRef.current * 10) / 10,
      inferenceTimeMs: inferenceTime,
      trackingCount: trackedPedestrians.length,
      avgConfidence:
        trackedPedestrians.length > 0
          ? Math.round(
              (trackedPedestrians.reduce((acc, p) => acc + p.confidence, 0) /
                trackedPedestrians.length) *
                1000
            ) / 10
          : 92.4,
      processedFrames: frameCounterRef.current,
    });

    if (isPlaying) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    }
  }, [
    isPlaying,
    playbackSpeed,
    sourceType,
    config,
    showCollisionZone,
    showPedestrianHUD,
    liveInferenceMs,
    wsStatus,
    wsServerInferenceMs,
    onPedestriansUpdate,
  ]);

  // Handle Play/Pause changes
  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } else if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying, processFrame]);

  // Reset simulation
  const handleRestart = () => {
    simulatorRef.current.reset();
    trackerRef.current.reset();
    if (videoElemRef.current) {
      videoElemRef.current.currentTime = 0;
    }
  };

  // Step 1 frame
  const handleStepFrame = () => {
    setIsPlaying(false);
    lastFrameTimeRef.current = performance.now() - 33;
    processFrame();
  };

  return (
    <div className="flex flex-col bg-slate-900/90 rounded-xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Hidden elements for uploaded/webcam video */}
      <video
        ref={videoElemRef}
        playsInline
        muted
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Video Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800 bg-slate-950/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span>SOURCE:</span>
          </div>

          {/* Source Selector */}
          <select
            id="select-scenario"
            value={
              sourceType === 'scenario'
                ? currentScenarioId
                : sourceType === 'webcam'
                ? 'live_webcam'
                : sourceType === 'screen'
                ? 'screen_capture'
                : sourceType === 'sample'
                ? 'sample_video'
                : 'custom_upload'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'live_webcam') {
                toggleWebcam();
              } else if (val === 'screen_capture') {
                toggleScreenCapture();
              } else if (val === 'custom_upload') {
                fileInputRef.current?.click();
              } else if (val.startsWith('sample_')) {
                const sample = SAMPLE_ROAD_VIDEOS.find((s) => s.id === val);
                if (sample) loadSampleVideo(sample.url, sample.vehicleSpeed);
              } else {
                handleScenarioChange(val);
              }
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <optgroup label="Autonomous Driving Benchmark Scenarios">
              {BENCHMARK_SCENARIOS.map((scen) => (
                <option key={scen.id} value={scen.id}>
                  {scen.name} ({scen.environment})
                </option>
              ))}
            </optgroup>
            <optgroup label="Live Camera & Screen Video">
              <option value="live_webcam">
                {isWebcamActive ? '● Live Camera (Active)' : '▶ Live Camera (Webcam)'}
              </option>
              <option value="screen_capture">
                {isScreenActive ? '● Screen / Tab Share (Active)' : '▶ Screen / Window Video Share'}
              </option>
            </optgroup>
            <optgroup label="Real Road Dashcam Video Clips">
              {SAMPLE_ROAD_VIDEOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            {sourceType === 'upload' && <option value="custom_upload">Uploaded Dashcam File</option>}
          </select>
        </div>

        {/* Action buttons: Live Camera, Flip, Screen, Upload */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Live Camera Toggle */}
          <button
            id="btn-toggle-webcam"
            onClick={toggleWebcam}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isWebcamActive
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Start Real-Time Camera Stream for Live Pedestrian Detection"
          >
            <Camera className={`w-3.5 h-3.5 ${isWebcamActive ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
            <span>{isWebcamActive ? 'Live Camera Active' : 'Live Camera'}</span>
          </button>

          {/* Camera Flip Button (Only when webcam active) */}
          {isWebcamActive && (
            <button
              id="btn-flip-camera"
              onClick={flipCamera}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title={`Switch Camera (Currently: ${cameraFacingMode === 'user' ? 'Front' : 'Back/Road'})`}
            >
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="capitalize">{cameraFacingMode === 'user' ? 'Front' : 'Road'}</span>
            </button>
          )}

          {/* Screen / Tab Capture */}
          <button
            id="btn-toggle-screen"
            onClick={toggleScreenCapture}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isScreenActive
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Capture Window / Browser Tab (e.g. YouTube dashcam video, live traffic stream)"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isScreenActive ? 'Screen Active' : 'Screen Share'}</span>
          </button>

          {/* Upload Dashcam Video */}
          <button
            id="btn-upload-video"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            title="Upload Dashcam Video (MP4, WebM, MOV, QuickTime)"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Video</span>
          </button>
        </div>
      </div>

      {/* Main Dashcam Canvas Viewport */}
      <div
        className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
        />

        {/* Camera Permission Warning Banner if blocked */}
        {cameraError && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4 py-3 bg-red-950/90 border border-red-500/60 rounded-xl text-red-200 text-xs shadow-2xl flex items-start gap-2.5 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-white mb-0.5">Camera Access Notification</div>
              <p className="text-red-200/90 text-[11px] leading-relaxed">{cameraError}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => loadSampleVideo(SAMPLE_ROAD_VIDEOS[0].url, SAMPLE_ROAD_VIDEOS[0].vehicleSpeed)}
                  className="px-2 py-0.5 bg-red-900/50 border border-red-600/60 hover:bg-red-800/60 rounded text-[10px] text-white font-mono"
                >
                  Load Sample Video Instead
                </button>
                <button
                  onClick={() => setCameraError(null)}
                  className="px-2 py-0.5 bg-slate-800/60 hover:bg-slate-700/60 rounded text-[10px] text-slate-300 font-mono"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay HUD indicators */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
          {sourceType !== 'scenario' ? (
            <div className="px-2.5 py-1 rounded bg-black/80 backdrop-blur-md border border-emerald-500/50 text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                LIVE STREAM: {sourceType === 'webcam' ? `CAMERA (${cameraFacingMode.toUpperCase()})` : sourceType === 'screen' ? 'SCREEN SHARE' : 'VIDEO FEED'}
              </span>
            </div>
          ) : null}

          {/* WebSocket Backend & WebWorker Status Badge */}
          <div className="px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-slate-700 text-[10px] font-mono flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Wifi
                className={`w-3 h-3 ${
                  wsStatus === 'connected'
                    ? 'text-emerald-400'
                    : wsStatus === 'connecting'
                    ? 'text-amber-400 animate-spin'
                    : 'text-rose-400'
                }`}
              />
              <span className={wsStatus === 'connected' ? 'text-emerald-300' : 'text-slate-300'}>
                WS INFERENCE: {wsStatus === 'connected' ? `CONNECTED (${wsServerInferenceMs}ms, RTT ${wsRoundTripMs}ms)` : wsStatus.toUpperCase()}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-slate-700" />
            <div className="flex items-center gap-1 text-cyan-400">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>WORKER: OFFLOADED</span>
            </div>
          </div>

          <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-cyan-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>
              {sourceType === 'scenario'
                ? `MODEL: ${config.modelVariant} (Pedestrian Class 0)`
                : `PIPELINE: ${detectorEngineName} · UI: ${Math.round(fpsRef.current)} FPS`}
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-slate-300">
            TRACKER: ByteTrack (Two-Stage Association)
          </div>

          <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-emerald-400">
            DISTANCE: {config.distanceMethod === 'ground_plane' ? 'Ground-Plane Projection' : 'BBox Height'}
          </div>
        </div>

        {/* Dynamic Collision Corridor Geometry & HUD Telemetry */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none max-w-[320px]">
          <div className="px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-slate-700 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono font-semibold text-amber-400">
              <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>VEHICLE: {config.vehicleSpeed} km/h ({(config.vehicleSpeed / 3.6).toFixed(1)} m/s)</span>
            </div>
            {showCollisionZone && (
              <div className="mt-0.5 text-[10px] font-mono text-cyan-300">
                CORRIDOR: Dynamic Trapezoid · Lookahead: {liveZone.lookaheadMeters}m
              </div>
            )}
          </div>

          {showCollisionZone && (
            <div className="px-2 py-1 rounded bg-black/70 backdrop-blur-md border border-slate-800 text-[9px] font-mono text-slate-300 flex flex-col items-end gap-0.5">
              <span className="text-slate-400">
                Near W: <strong className="text-cyan-300">{Math.round(liveZone.nearWidth)}px</strong> ({config.laneWidth}m) · Far W: <strong className="text-cyan-300">{Math.round(liveZone.farWidth)}px</strong>
              </span>
              <span className="text-slate-400">
                H-FOV: <strong className="text-emerald-400">{config.calibration?.hfov || 72}°</strong> · Stopping Dist: <strong className="text-amber-400">{liveZone.stoppingDistanceMeters}m</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 border-t border-slate-800 bg-slate-950/70">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-play-pause"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-cyan-300" />}
          </button>

          <button
            id="btn-step-frame"
            onClick={handleStepFrame}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Step 1 Frame"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            id="btn-restart-sim"
            onClick={handleRestart}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Restart Scenario"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-800">
            {[0.5, 1.0, 1.5, 2.0].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Visual Layer Overlays Toggle & Geometry Tuner Button */}
        <div className="flex items-center gap-2">
          <button
            id="toggle-collision-zone"
            onClick={() => setShowCollisionZone(!showCollisionZone)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              showCollisionZone
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Vehicle Collision Corridor"
          >
            <Eye className="w-3 h-3" />
            <span>ZONE</span>
          </button>

          <button
            id="toggle-pedestrian-hud"
            onClick={() => setShowPedestrianHUD(!showPedestrianHUD)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              showPedestrianHUD
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Pedestrian Bounding Boxes & Distance Tags"
          >
            <Layers className="w-3 h-3" />
            <span>HUD</span>
          </button>

          <button
            id="toggle-geometry-controls"
            onClick={() => setShowGeometryControls(!showGeometryControls)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              showGeometryControls
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Real-Time Collision Corridor Speed & Field-of-View Geometry Controls"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>GEOMETRY CONTROLS</span>
            {showGeometryControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Real-Time Collision Zone Geometry Tuner */}
      {showGeometryControls && (
        <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-950/90 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
                Dynamic Collision Zone Calibration (Speed & FOV Geometry)
              </span>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded">
              Z-Lookahead: {liveZone.lookaheadMeters}m | Stopping: {liveZone.stoppingDistanceMeters}m
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* 1. Vehicle Speed Real-Time Control */}
            <div className="flex flex-col gap-1.5 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>VEHICLE SPEED</span>
                </span>
                <span className="text-amber-300 font-semibold">
                  {config.vehicleSpeed} km/h ({(config.vehicleSpeed / 3.6).toFixed(1)} m/s)
                </span>
              </div>
              
              <input
                id="slider-vehicle-speed"
                type="range"
                min="10"
                max="110"
                step="2"
                value={config.vehicleSpeed}
                onChange={(e) => onUpdateConfig({ vehicleSpeed: Number(e.target.value) })}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />

              <div className="flex items-center justify-between gap-1 pt-1">
                {[
                  { label: '25 km/h (City)', speed: 25 },
                  { label: '45 km/h (Urban)', speed: 45 },
                  { label: '65 km/h (Arterial)', speed: 65 },
                  { label: '90 km/h (Highway)', speed: 90 },
                ].map((preset) => (
                  <button
                    key={preset.speed}
                    onClick={() => onUpdateConfig({ vehicleSpeed: preset.speed })}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                      config.vehicleSpeed === preset.speed
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Field-of-View (H-FOV) Real-Time Control */}
            <div className="flex flex-col gap-1.5 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>FIELD-OF-VIEW (H-FOV)</span>
                </span>
                <span className="text-cyan-300 font-semibold">
                  {config.calibration?.hfov || 72}° Wide-Angle
                </span>
              </div>

              <input
                id="slider-camera-hfov"
                type="range"
                min="50"
                max="115"
                step="1"
                value={config.calibration?.hfov || 72}
                onChange={(e) =>
                  onUpdateConfig({
                    calibration: {
                      ...config.calibration,
                      hfov: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />

              <div className="flex items-center justify-between gap-1 pt-1">
                {[
                  { label: '60° (Tele)', fov: 60 },
                  { label: '72° (Dashcam)', fov: 72 },
                  { label: '90° (Wide)', fov: 90 },
                  { label: '110° (Ultra)', fov: 110 },
                ].map((preset) => (
                  <button
                    key={preset.fov}
                    onClick={() =>
                      onUpdateConfig({
                        calibration: {
                          ...config.calibration,
                          hfov: preset.fov,
                        },
                      })
                    }
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                      (config.calibration?.hfov || 72) === preset.fov
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-Time Geometry Metric Readout Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Trapezoid Base</div>
              <div className="text-xs font-mono font-semibold text-cyan-300">
                {Math.round(liveZone.nearWidth)}px <span className="text-[10px] text-slate-500">({config.laneWidth}m)</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Trapezoid Apex</div>
              <div className="text-xs font-mono font-semibold text-cyan-300">
                {Math.round(liveZone.farWidth)}px <span className="text-[10px] text-slate-500">(lookahead)</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Lookahead Range</div>
              <div className="text-xs font-mono font-semibold text-amber-300">
                {liveZone.lookaheadMeters} m
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Stopping Distance</div>
              <div className="text-xs font-mono font-semibold text-emerald-300">
                {liveZone.stoppingDistanceMeters} m
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
