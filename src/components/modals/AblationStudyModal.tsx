import React, { useState } from 'react';
import { X, Activity, Sliders, BarChart3, CheckCircle2, Award } from 'lucide-react';
import { SystemConfig } from '../../types';
import { COMPARATIVE_METHODS } from '../../services/researchEvaluation';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface AblationStudyModalProps {
  isOpen: boolean;
  config: SystemConfig;
  onClose: () => void;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
}

export const AblationStudyModal: React.FC<AblationStudyModalProps> = ({
  isOpen,
  config,
  onClose,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  const [ablation, setAblation] = useState(config.ablation);
  const [weights, setWeights] = useState(config.weights);

  const handleApply = () => {
    onUpdateConfig({ ablation, weights });
    onClose();
  };

  const chartData = COMPARATIVE_METHODS.map((m) => ({
    name: m.modelName.replace('Method ', 'M').replace('Proposed: ', ''),
    Precision: Math.round(m.precision * 100),
    Recall: Math.round(m.recall * 100),
    F1: Math.round(m.f1Score * 100),
    'Lead Time (s)': Number((m.avgWarningLeadTimeSec * 20).toFixed(0)), // scaled for visualization
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              RESEARCH METHODOLOGY: WHY PD-TCR? & ABLATION STUDY
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-6 text-xs">
          {/* Theoretical Justification Section */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <Award className="w-4 h-4" />
              <h3 className="text-xs uppercase tracking-wider">
                Why PD-TCR? (Pedestrian Distance–Trajectory–Collision Risk)
              </h3>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] mb-3">
              Traditional ADAS systems generate frequent false alarms by relying solely on monocular distance thresholds, causing "warning fatigue". A pedestrian standing safely on a curb 8 meters away triggers a false alarm under naive distance-only logic.
            </p>
            <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-300">
              <strong className="text-white block mb-1">PD-TCR Risk Fusion Formulation:</strong>
              <code className="text-cyan-200">
                RiskScore = Wd·R_dist + Wt·R_traj + Wc·R_zone + Wv·R_vel + Wtcc·R_ttc + Wi·R_int
              </code>
              <div className="text-[10px] text-slate-400 mt-2">
                Unifies 6 key physical measurements: <strong>Detection Confidence</strong>, <strong>Ground-Plane Distance</strong>, <strong>Lateral Trajectory Heading</strong>, <strong>Dynamic Trapezoidal Collision Corridor</strong>, <strong>Relative Closing Velocity & TTC</strong>, and <strong>Multi-frame Crossing Intention</strong>.
              </div>
            </div>
          </div>

          {/* Section 2: Real-time Component Ablation Switches */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
            <h3 className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider text-cyan-400">
              Component Ablation Switches (Live Testing)
            </h3>
            <p className="text-slate-400 text-[11px] mb-3">
              Toggle risk components on/off to observe how the active system handles ambiguous scenarios:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ablation.enableDistance}
                  onChange={(e) => setAblation({ ...ablation, enableDistance: e.target.checked })}
                  className="rounded accent-cyan-400"
                />
                <div>
                  <span className="font-bold text-white block">Distance Risk (Wd)</span>
                  <span className="text-[10px] text-slate-400">Proximity metric penalty</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ablation.enableTrajectory}
                  onChange={(e) => setAblation({ ...ablation, enableTrajectory: e.target.checked })}
                  className="rounded accent-cyan-400"
                />
                <div>
                  <span className="font-bold text-white block">Trajectory Risk (Wt, Wv)</span>
                  <span className="text-[10px] text-slate-400">Motion angle & lateral speed</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ablation.enableTTC}
                  onChange={(e) => setAblation({ ...ablation, enableTTC: e.target.checked })}
                  className="rounded accent-cyan-400"
                />
                <div>
                  <span className="font-bold text-white block">Time-to-Collision (Wtcc)</span>
                  <span className="text-[10px] text-slate-400">D / V_relative closing time</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ablation.enableCollisionZone}
                  onChange={(e) =>
                    setAblation({ ...ablation, enableCollisionZone: e.target.checked })}
                  className="rounded accent-cyan-400"
                />
                <div>
                  <span className="font-bold text-white block">Collision Zone (Wc)</span>
                  <span className="text-[10px] text-slate-400">Perspective path occupancy</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ablation.enableIntention}
                  onChange={(e) => setAblation({ ...ablation, enableIntention: e.target.checked })}
                  className="rounded accent-cyan-400"
                />
                <div>
                  <span className="font-bold text-white block">Crossing Intention (Wi)</span>
                  <span className="text-[10px] text-slate-400">Predicted road entry behavior</span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Configurable PD-TCR Weights */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
            <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider text-cyan-400">
              PD-TCR Configurable Weights (Experimental Tuning)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wd (Distance): {weights.Wd}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wd}
                  onChange={(e) => setWeights({ ...weights, Wd: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wt (Trajectory): {weights.Wt}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wt}
                  onChange={(e) => setWeights({ ...weights, Wt: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wc (Zone): {weights.Wc}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wc}
                  onChange={(e) => setWeights({ ...weights, Wc: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wv (Velocity): {weights.Wv}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wv}
                  onChange={(e) => setWeights({ ...weights, Wv: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wtcc (TTC): {weights.Wtcc}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wtcc}
                  onChange={(e) => setWeights({ ...weights, Wtcc: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Wi (Intention): {weights.Wi}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={weights.Wi}
                  onChange={(e) => setWeights({ ...weights, Wi: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Comparative Experiment Benchmark Table */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
            <h3 className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider text-cyan-400">
              Comparative Benchmark Results (JAAD & BDD100K Test Sets)
            </h3>
            <div className="overflow-x-auto my-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2 px-2">Method</th>
                    <th className="py-2 px-2">Precision</th>
                    <th className="py-2 px-2">Recall</th>
                    <th className="py-2 px-2">F1-Score</th>
                    <th className="py-2 px-2">False Pos. (FPR)</th>
                    <th className="py-2 px-2">False Neg. (FNR)</th>
                    <th className="py-2 px-2">Avg Lead Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {COMPARATIVE_METHODS.map((m, idx) => (
                    <tr
                      key={m.modelName}
                      className={idx === 3 ? 'bg-cyan-500/10 font-bold text-cyan-200' : 'text-slate-300'}
                    >
                      <td className="py-2 px-2 flex items-center gap-1.5">
                        {idx === 3 && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                        {m.modelName}
                      </td>
                      <td className="py-2 px-2">{(m.precision * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2">{(m.recall * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 font-semibold">{(m.f1Score * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-red-400">{(m.falsePositiveRate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-amber-400">{(m.falseNegativeRate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-emerald-400">{m.avgWarningLeadTimeSec.toFixed(2)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recharts Comparative Bar Graph */}
            <div className="w-full h-52 mt-4 pt-2 border-t border-slate-800/80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Precision" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recall" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="F1" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 rounded-md text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            Apply Ablation & Weights
          </button>
        </div>
      </div>
    </div>
  );
};
