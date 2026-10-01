import React from 'react';
import { AlertTriangle, ShieldCheck, Zap, Compass, Crosshair, ArrowRight } from 'lucide-react';
import { SystemSafetyDecision } from '../../services/safetyDecisionEngine';
import { RISK_COLORS } from '../../services/config';

interface ExplainableAlertCardProps {
  decision: SystemSafetyDecision;
}

export const ExplainableAlertCard: React.FC<ExplainableAlertCardProps> = ({ decision }) => {
  const { primaryHazard, overallRiskLevel, overallRiskScore, explainableHeadline, explainableDetail } = decision;
  const isAlert = overallRiskLevel === 'CRITICAL' || overallRiskLevel === 'HIGH';
  const colorScheme = RISK_COLORS[overallRiskLevel];

  return (
    <div
      id="explainable-alert-card"
      className={`rounded-xl border transition-all duration-300 p-4 ${colorScheme.bg} ${colorScheme.border} ${
        overallRiskLevel === 'CRITICAL' ? 'animate-pulse ring-2 ring-red-500/50' : ''
      }`}
    >
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${isAlert ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'}`}>
            {isAlert ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-slate-400">
              EXPLAINABLE ADAS ALERT
            </span>
            <h2 className={`text-sm md:text-base font-bold font-mono ${colorScheme.text}`}>
              {explainableHeadline}
            </h2>
          </div>
        </div>

        {/* Risk Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${colorScheme.badge}`}>
            {overallRiskLevel} RISK ({overallRiskScore}/100)
          </span>
        </div>
      </div>

      {/* Structured Telemetry Indicators */}
      {primaryHazard ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 my-3 py-1">
          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Target ID</span>
            <span className="text-sm font-bold font-mono text-white">#{primaryHazard.id}</span>
          </div>

          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Est. Distance</span>
            <span className="text-sm font-bold font-mono text-cyan-300">
              {primaryHazard.estimatedDistance.toFixed(1)} m
            </span>
          </div>

          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Est. TTC</span>
            <span className={`text-sm font-bold font-mono ${
              primaryHazard.ttc <= 2.0 ? 'text-red-400' : primaryHazard.ttc <= 4.0 ? 'text-amber-400' : 'text-slate-300'
            }`}>
              {primaryHazard.ttc === Infinity ? '> 10.0 s' : `${primaryHazard.ttc.toFixed(1)} s`}
            </span>
          </div>

          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Movement</span>
            <span className="text-xs font-semibold font-mono text-indigo-300 truncate block">
              {primaryHazard.intention.replace('_', ' ')}
            </span>
          </div>

          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Collision Zone</span>
            <span className={`text-xs font-bold font-mono ${
              primaryHazard.inCollisionZone ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {primaryHazard.inCollisionZone ? 'INSIDE (YES)' : 'CLEAR (NO)'}
            </span>
          </div>

          <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Closing Speed</span>
            <span className="text-sm font-bold font-mono text-white">
              {primaryHazard.approachRate.toFixed(1)} m/s
            </span>
          </div>
        </div>
      ) : (
        <div className="py-2 text-xs text-slate-400 font-mono">
          Radar and optical sensors scanning vehicle collision corridor.
        </div>
      )}

      {/* Plain Language Explainability Statement */}
      <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 flex items-start gap-2">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed font-mono">
          <span className="text-slate-400 font-semibold">Reasoning: </span>
          {explainableDetail}
        </div>
      </div>
    </div>
  );
};
