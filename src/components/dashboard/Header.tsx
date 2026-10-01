import React from 'react';
import {
  Activity,
  Sliders,
  BarChart3,
  FileText,
  Volume2,
  VolumeX,
  ShieldAlert,
  HelpCircle,
  Database,
  Cpu,
  Video,
  Layers,
} from 'lucide-react';
import { PipelineMetrics, RiskLevel, SystemConfig } from '../../types';
import { RISK_COLORS } from '../../services/config';

interface HeaderProps {
  overallRiskLevel: RiskLevel;
  metrics: PipelineMetrics;
  config: SystemConfig;
  currentView: 'monitor' | 'variations';
  onSelectView: (view: 'monitor' | 'variations') => void;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  onOpenCalibration: () => void;
  onOpenAblation: () => void;
  onOpenEvaluation: () => void;
  onOpenLogs: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  overallRiskLevel,
  metrics,
  config,
  currentView,
  onSelectView,
  onUpdateConfig,
  onOpenCalibration,
  onOpenAblation,
  onOpenEvaluation,
  onOpenLogs,
  onOpenHelp,
}) => {
  const isAlert = overallRiskLevel === 'CRITICAL' || overallRiskLevel === 'HIGH';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
      {/* Brand & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
              AI PEDESTRIAN SAFETY SYSTEM
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-medium border bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
              PD-TCR v2.4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-Time ADAS Monitoring & Crossing Intention Prediction
          </p>
        </div>

        {/* System Active Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-slate-800">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isAlert ? 'bg-red-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isAlert ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-mono font-semibold text-slate-300">
            SYSTEM ACTIVE
          </span>
          <span className="text-xs font-mono text-slate-500">
            ({metrics.fps.toFixed(1)} FPS · {metrics.inferenceTimeMs}ms)
          </span>
        </div>
      </div>

      {/* Main View Switcher: Live Monitor vs Model Variations Tab */}
      <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-800 shadow-inner">
        <button
          id="tab-view-monitor"
          onClick={() => onSelectView('monitor')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${
            currentView === 'monitor'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Live Monitor</span>
        </button>

        <button
          id="tab-view-variations"
          onClick={() => onSelectView('variations')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all relative ${
            currentView === 'variations'
              ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-indigo-500/20'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Model Variations</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            YOLO + CNNs
          </span>
        </button>
      </div>

      {/* Quick Action Navigation & Controls */}
      <div className="flex items-center gap-2">
        {/* Audio Mute/Unmute Toggle */}
        <button
          id="btn-toggle-audio"
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium border transition-colors ${
            config.soundEnabled
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-cyan-500/50'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
          title={config.soundEnabled ? 'Acoustic Alerts Enabled' : 'Acoustic Alerts Muted'}
        >
          {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">{config.soundEnabled ? 'ALERTS ON' : 'MUTED'}</span>
        </button>

        {/* Camera Calibration */}
        <button
          id="btn-nav-calibration"
          onClick={onOpenCalibration}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Calibration</span>
        </button>

        {/* Research & Ablation Study */}
        <button
          id="btn-nav-ablation"
          onClick={onOpenAblation}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Why PD-TCR?</span>
        </button>

        {/* Model Evaluation & Datasets */}
        <button
          id="btn-nav-evaluation"
          onClick={onOpenEvaluation}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>Datasets & Eval</span>
        </button>

        {/* Telemetry Event Logs */}
        <button
          id="btn-nav-logs"
          onClick={onOpenLogs}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Logs</span>
        </button>

        {/* Documentation / Info */}
        <button
          id="btn-nav-help"
          onClick={onOpenHelp}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="System Architecture & Documentation"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
