import React, { useState } from 'react';
import { TrackedPedestrian } from '../../types';
import { RISK_COLORS } from '../../services/config';
import { User, Eye, Crosshair } from 'lucide-react';

interface PedestrianTableProps {
  pedestrians: TrackedPedestrian[];
  onSelectPedestrian?: (pedestrian: TrackedPedestrian) => void;
}

export const PedestrianTable: React.FC<PedestrianTableProps> = ({
  pedestrians,
  onSelectPedestrian,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800/80 p-4 shadow-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            ACTIVE PEDESTRIAN TRACKING TABLE
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {pedestrians.length} TARGET(S) LOCKED
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider bg-slate-950/50">
              <th className="py-2 px-3 font-semibold">ID</th>
              <th className="py-2 px-3 font-semibold">Distance</th>
              <th className="py-2 px-3 font-semibold">Speed</th>
              <th className="py-2 px-3 font-semibold">Dir</th>
              <th className="py-2 px-3 font-semibold">TTC</th>
              <th className="py-2 px-3 font-semibold">Zone</th>
              <th className="py-2 px-3 font-semibold">Intention</th>
              <th className="py-2 px-3 font-semibold text-right">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {pedestrians.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 font-mono text-xs">
                  No pedestrians detected in current field of view.
                </td>
              </tr>
            ) : (
              pedestrians.map((ped) => {
                const colorScheme = RISK_COLORS[ped.riskLevel];
                const isSelected = selectedId === ped.id;

                return (
                  <tr
                    key={ped.id}
                    onClick={() => {
                      setSelectedId(ped.id);
                      if (onSelectPedestrian) onSelectPedestrian(ped);
                    }}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-800/70 border-l-2 border-cyan-400' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorScheme.hex }} />
                      #{ped.id}
                    </td>

                    <td className="py-2.5 px-3 text-cyan-300 font-semibold">
                      {ped.estimatedDistance.toFixed(1)}m
                      <span className="text-[10px] text-slate-500 ml-1">
                        ({ped.lateralOffset >= 0 ? `+${ped.lateralOffset.toFixed(1)}` : ped.lateralOffset.toFixed(1)}m)
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-200">
                      {ped.metricVelocity.speed.toFixed(1)} m/s
                    </td>

                    <td className="py-2.5 px-3 text-cyan-400 font-bold text-sm">
                      {ped.directionSymbol}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${
                        ped.ttc <= 2.0 ? 'text-red-400' : ped.ttc <= 3.8 ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {ped.ttc === Infinity ? '>10s' : `${ped.ttc.toFixed(1)}s`}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        ped.collisionZoneStatus === 'INSIDE'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : ped.collisionZoneStatus === 'APPROACHING'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {ped.collisionZoneStatus}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="text-slate-300">
                        {ped.intention.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorScheme.badge}`}>
                        {ped.riskLevel} ({ped.riskScore})
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
