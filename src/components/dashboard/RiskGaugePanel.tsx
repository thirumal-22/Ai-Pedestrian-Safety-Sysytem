import React from 'react';
import { SystemSafetyDecision } from '../../services/safetyDecisionEngine';
import { RISK_COLORS } from '../../services/config';
import { SystemConfig } from '../../types';

interface RiskGaugePanelProps {
  decision: SystemSafetyDecision;
  config: SystemConfig;
}

export const RiskGaugePanel: React.FC<RiskGaugePanelProps> = ({ decision, config }) => {
  const { primaryHazard, overallRiskLevel, overallRiskScore, totalPedestrians, crossingPedestrians, inCollisionZoneCount, leadTTC } = decision;
  const colorScheme = RISK_COLORS[overallRiskLevel];

  // Circle radius and circumference for SVG gauge
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallRiskScore / 100) * circumference;

  const factors = primaryHazard?.pdTcrFactors || {
    distanceRisk: 0,
    trajectoryRisk: 0,
    collisionZoneRisk: 0,
    relativeVelocityRisk: 0,
    ttcRisk: 0,
    intentionRisk: 0,
  };

  return (
    <div className="flex flex-col bg-slate-900/90 rounded-xl border border-slate-800/80 p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <h3 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
          PD-TCR RISK ENGINE
        </h3>
        <span className="text-[11px] font-mono text-cyan-400">
          NORMALIZED 0–100
        </span>
      </div>

      {/* Main Radial Risk Meter */}
      <div className="flex flex-col items-center justify-center my-1 relative">
        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            className="text-slate-800"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={colorScheme.hex}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            fill="transparent"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
            CURRENT RISK
          </span>
          <span className={`text-3xl font-mono font-black tracking-tight ${colorScheme.text}`}>
            {overallRiskScore}
          </span>
          <span className={`text-xs font-mono font-bold uppercase tracking-wider ${colorScheme.text}`}>
            {overallRiskLevel}
          </span>
        </div>
      </div>

      {/* Primary Key Metrics Grid (Section 16 in prompt) */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs font-mono">
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
          <span className="text-slate-400 block text-[10px]">DISTANCE</span>
          <span className="text-white font-bold text-sm">
            {primaryHazard ? `${primaryHazard.estimatedDistance.toFixed(1)} m` : '-- m'}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
          <span className="text-slate-400 block text-[10px]">ESTIMATED TTC</span>
          <span className={`font-bold text-sm ${
            leadTTC <= 2.0 ? 'text-red-400' : leadTTC <= 3.8 ? 'text-amber-400' : 'text-slate-200'
          }`}>
            {leadTTC === Infinity ? '> 10.0 s' : `${leadTTC.toFixed(1)} s`}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
          <span className="text-slate-400 block text-[10px]">PEDESTRIANS</span>
          <span className="text-white font-bold text-sm">
            {totalPedestrians} active
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
          <span className="text-slate-400 block text-[10px]">CROSSING INTENTION</span>
          <span className={`font-bold text-sm ${crossingPedestrians > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {crossingPedestrians > 0 ? 'YES (DETECTED)' : 'NO'}
          </span>
        </div>
      </div>

      <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60 mt-2 text-xs font-mono flex items-center justify-between">
        <span className="text-slate-400 text-[10px]">COLLISION ZONE OCCUPANCY</span>
        <span className={`font-bold text-xs ${inCollisionZoneCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {inCollisionZoneCount > 0 ? 'YES (IN PATH)' : 'CLEAR'}
        </span>
      </div>

      {/* PD-TCR Factor Weights & Contribution Bars */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span>PD-TCR FUSION BREAKDOWN</span>
          <span>WEIGHTED %</span>
        </div>

        <div className="space-y-1.5 text-[10px] font-mono">
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Distance (Wd: {config.weights.Wd})</span>
              <span>{factors.distanceRisk}/100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${factors.distanceRisk}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Trajectory (Wt: {config.weights.Wt})</span>
              <span>{factors.trajectoryRisk}/100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${factors.trajectoryRisk}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Collision Zone (Wc: {config.weights.Wc})</span>
              <span>{factors.collisionZoneRisk}/100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${factors.collisionZoneRisk}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Time-to-Collision (Wtcc: {config.weights.Wtcc})</span>
              <span>{factors.ttcRisk}/100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-red-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${factors.ttcRisk}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Crossing Intention (Wi: {config.weights.Wi})</span>
              <span>{factors.intentionRisk}/100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${factors.intentionRisk}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
