import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export interface TimelineDataPoint {
  timeStr: string;
  riskScore: number;
  distance: number;
  ttc: number;
}

interface RiskTimelineChartsProps {
  data: TimelineDataPoint[];
}

export const RiskTimelineCharts: React.FC<RiskTimelineChartsProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'risk' | 'distance' | 'ttc'>('all');

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800/80 p-4 shadow-xl flex flex-col">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 mb-3 gap-2">
        <div>
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            REAL-TIME TELEMETRY TIMELINE (PAST 60s)
          </h3>
          <p className="text-[11px] text-slate-400 font-mono">
            Temporal dynamics: Risk Score, Metric Distance, and TTC progression
          </p>
        </div>

        {/* Chart view selector tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
              activeTab === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400'
            }`}
          >
            All Signals
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
              activeTab === 'risk' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400'
            }`}
          >
            Risk Score
          </button>
          <button
            onClick={() => setActiveTab('distance')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
              activeTab === 'distance' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400'
            }`}
          >
            Distance (m)
          </button>
          <button
            onClick={() => setActiveTab('ttc')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
              activeTab === 'ttc' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400'
            }`}
          >
            TTC (s)
          </button>
        </div>
      </div>

      <div className="w-full h-56 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="timeStr"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              fontFamily="monospace"
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              domain={[0, 100]}
              tickLine={false}
              fontFamily="monospace"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#090d16',
                borderColor: '#334155',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '11px',
                fontFamily: 'monospace',
                paddingTop: '6px',
              }}
            />

            {(activeTab === 'all' || activeTab === 'risk') && (
              <Line
                type="monotone"
                dataKey="riskScore"
                name="Risk Score (0-100)"
                stroke="#ef4444"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(activeTab === 'all' || activeTab === 'distance') && (
              <Line
                type="monotone"
                dataKey="distance"
                name="Distance (m)"
                stroke="#38bdf8"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(activeTab === 'all' || activeTab === 'ttc') && (
              <Line
                type="monotone"
                dataKey="ttc"
                name="TTC (s)"
                stroke="#f59e0b"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
