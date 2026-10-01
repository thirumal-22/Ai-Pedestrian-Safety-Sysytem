/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { Header } from './components/dashboard/Header';
import { VideoPlayerPanel } from './components/dashboard/VideoPlayerPanel';
import { RiskGaugePanel } from './components/dashboard/RiskGaugePanel';
import { ExplainableAlertCard } from './components/dashboard/ExplainableAlertCard';
import { PedestrianTable } from './components/dashboard/PedestrianTable';
import { RiskTimelineCharts, TimelineDataPoint } from './components/dashboard/RiskTimelineCharts';
import { ModelVariationsPanel } from './components/dashboard/ModelVariationsPanel';

import { CalibrationModal } from './components/modals/CalibrationModal';
import { AblationStudyModal } from './components/modals/AblationStudyModal';
import { EvaluationDatasetModal } from './components/modals/EvaluationDatasetModal';
import { TelemetryLogModal } from './components/modals/TelemetryLogModal';
import { HelpDocumentationModal } from './components/modals/HelpDocumentationModal';

import { DEFAULT_CONFIG } from './services/config';
import { AudioAlertSystem } from './services/audioAlert';
import { SystemSafetyDecision } from './services/safetyDecisionEngine';
import { PipelineMetrics, SystemConfig, TelemetryLog, TrackedPedestrian } from './types';

export default function App() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [pedestrians, setPedestrians] = useState<TrackedPedestrian[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    fps: 30.0,
    inferenceTimeMs: 12,
    trackingCount: 0,
    avgConfidence: 92.4,
    processedFrames: 0,
  });

  const [decision, setDecision] = useState<SystemSafetyDecision>({
    overallRiskScore: 12,
    overallRiskLevel: 'LOW',
    primaryHazard: null,
    totalPedestrians: 0,
    crossingPedestrians: 0,
    inCollisionZoneCount: 0,
    leadTTC: Infinity,
    explainableHeadline: 'ALL PATHWAYS CLEAR · SAFE TRAJECTORY',
    explainableDetail: 'No pedestrians currently occupying or projecting into vehicle travel corridor.',
  });

  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);

  // Modals and View state
  const [currentView, setCurrentView] = useState<'monitor' | 'variations'>('monitor');
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isAblationOpen, setIsAblationOpen] = useState<boolean>(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Audio system ref
  const audioSystemRef = useRef<AudioAlertSystem>(new AudioAlertSystem());
  const lastLogTimeRef = useRef<number>(0);
  const lastAudioRiskRef = useRef<string>('LOW');

  // Update Config
  const handleUpdateConfig = useCallback((newConfig: Partial<SystemConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...newConfig,
      weights: newConfig.weights ? { ...prev.weights, ...newConfig.weights } : prev.weights,
      ablation: newConfig.ablation ? { ...prev.ablation, ...newConfig.ablation } : prev.ablation,
      calibration: newConfig.calibration ? { ...prev.calibration, ...newConfig.calibration } : prev.calibration,
    }));
  }, []);

  // Frame telemetry update callback
  const handlePedestriansUpdate = useCallback(
    (
      newPedestrians: TrackedPedestrian[],
      newDecision: SystemSafetyDecision,
      newMetrics: PipelineMetrics
    ) => {
      setPedestrians(newPedestrians);
      setDecision(newDecision);
      setMetrics(newMetrics);

      const now = Date.now();
      const timeStr = new Date(now).toTimeString().split(' ')[0].slice(3); // mm:ss

      // Audio Alert Triggering (auditory warning beeps during active hazard)
      if (config.soundEnabled) {
        if (newDecision.overallRiskLevel === 'CRITICAL') {
          audioSystemRef.current.playAlert('CRITICAL');
          lastAudioRiskRef.current = 'CRITICAL';
        } else if (newDecision.overallRiskLevel === 'HIGH') {
          audioSystemRef.current.playAlert('HIGH');
          lastAudioRiskRef.current = 'HIGH';
        } else {
          lastAudioRiskRef.current = newDecision.overallRiskLevel;
        }
      }

      // Append to Timeline Chart data (throttled to ~1 per 500ms)
      setTimelineData((prev) => {
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.timeStr === timeStr) {
          return prev;
        }

        const distanceVal = newDecision.primaryHazard
          ? Number(newDecision.primaryHazard.estimatedDistance.toFixed(1))
          : 35.0;

        const ttcVal =
          newDecision.leadTTC !== Infinity
            ? Number(Math.min(10, newDecision.leadTTC).toFixed(1))
            : 10.0;

        const newPoint: TimelineDataPoint = {
          timeStr,
          riskScore: newDecision.overallRiskScore,
          distance: distanceVal,
          ttc: ttcVal,
        };

        const updated = [...prev, newPoint];
        if (updated.length > 60) updated.shift();
        return updated;
      });

      // Log important events (when hazard present or high/critical risk)
      if (now - lastLogTimeRef.current >= 1200 && newDecision.primaryHazard) {
        lastLogTimeRef.current = now;
        const hazard = newDecision.primaryHazard;
        const newLog: TelemetryLog = {
          id: `log-${now}-${hazard.id}`,
          timestamp: new Date(now).toISOString().replace('T', ' ').slice(0, 19),
          pedestrianId: hazard.id,
          distance: hazard.estimatedDistance,
          velocity: hazard.metricVelocity.speed,
          ttc: hazard.ttc,
          intention: hazard.intention,
          riskScore: hazard.riskScore,
          riskLevel: hazard.riskLevel,
          reason: hazard.explainableReason,
        };

        setLogs((prev) => {
          const next = [...prev, newLog];
          if (next.length > 500) next.shift();
          return next;
        });
      }
    },
    [config.soundEnabled]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] antialiased selection:bg-cyan-500 selection:text-black">
      {/* Top Application Header */}
      <Header
        overallRiskLevel={decision.overallRiskLevel}
        metrics={metrics}
        config={config}
        currentView={currentView}
        onSelectView={setCurrentView}
        onUpdateConfig={handleUpdateConfig}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenAblation={() => setIsAblationOpen(true)}
        onOpenEvaluation={() => setIsEvaluationOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col gap-4">
        {currentView === 'variations' ? (
          <ModelVariationsPanel
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onSwitchToMonitor={() => setCurrentView('monitor')}
          />
        ) : (
          <>
            {/* Top Warning & Explainability Banner */}
            <ExplainableAlertCard decision={decision} />

            {/* Central Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left / Primary Column (7 cols): Dashcam Video & AR HUD */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <VideoPlayerPanel
                  config={config}
                  onPedestriansUpdate={handlePedestriansUpdate}
                  onUpdateConfig={handleUpdateConfig}
                />

                {/* Real-Time Telemetry Plots (Section 18) */}
                <RiskTimelineCharts data={timelineData} />
              </div>

              {/* Right / Secondary Column (5 cols): Risk Gauges, PD-TCR Factors & Pedestrian Table */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <RiskGaugePanel decision={decision} config={config} />

                <PedestrianTable pedestrians={pedestrians} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Persistent Academic Disclaimer Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-2.5 px-4 text-center text-slate-500 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
        <span>
          Autonomous Vehicle Pedestrian Safety Research Lab · PD-TCR v2.4
        </span>
        <span className="text-amber-500/80 font-semibold">
          ⚠ Research Prototype: Not a certified automotive safety system
        </span>
        <span>
          Ultralytics YOLOv8n · ByteTrack · Ground-Plane Monocular Projection
        </span>
      </footer>

      {/* Interactive Research & Settings Modals */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        config={config}
        onClose={() => setIsCalibrationOpen(false)}
        onSave={handleUpdateConfig}
      />

      <AblationStudyModal
        isOpen={isAblationOpen}
        config={config}
        onClose={() => setIsAblationOpen(false)}
        onUpdateConfig={handleUpdateConfig}
      />

      <EvaluationDatasetModal
        isOpen={isEvaluationOpen}
        config={config}
        onClose={() => setIsEvaluationOpen(false)}
        onUpdateConfig={handleUpdateConfig}
        onOpenVariationsTab={() => {
          setIsEvaluationOpen(false);
          setCurrentView('variations');
        }}
      />

      <TelemetryLogModal
        isOpen={isLogsOpen}
        logs={logs}
        onClearLogs={() => setLogs([])}
        onClose={() => setIsLogsOpen(false)}
      />

      <HelpDocumentationModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
