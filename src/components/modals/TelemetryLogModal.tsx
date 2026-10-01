import React, { useState } from 'react';
import { X, FileText, Download, Trash2, Filter } from 'lucide-react';
import { RiskLevel, TelemetryLog } from '../../types';
import { RISK_COLORS } from '../../services/config';

interface TelemetryLogModalProps {
  isOpen: boolean;
  logs: TelemetryLog[];
  onClearLogs: () => void;
  onClose: () => void;
}

export const TelemetryLogModal: React.FC<TelemetryLogModalProps> = ({
  isOpen,
  logs,
  onClearLogs,
  onClose,
}) => {
  if (!isOpen) return null;

  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'ALL') return true;
    return log.riskLevel === filterLevel;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'PedestrianID', 'Distance(m)', 'Velocity(m/s)', 'TTC(s)', 'Intention', 'RiskScore', 'RiskLevel', 'Reason'];
    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      l.pedestrianId,
      l.distance.toFixed(1),
      l.velocity.toFixed(1),
      l.ttc === Infinity ? 'Infinity' : l.ttc.toFixed(1),
      `"${l.intention}"`,
      l.riskScore,
      `"${l.riskLevel}"`,
      `"${l.reason.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedestrian_safety_telemetry_${Date.now()}.csv`;
    link.click();
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedestrian_safety_telemetry_${Date.now()}.json`;
    link.click();
  };

  // Export to SQLite SQL script
  const handleExportSQL = () => {
    if (logs.length === 0) return;
    const schema = `-- Pedestrian Safety System SQLite Log Schema
CREATE TABLE IF NOT EXISTS pedestrian_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  pedestrian_id INTEGER NOT NULL,
  distance REAL NOT NULL,
  velocity REAL NOT NULL,
  ttc REAL,
  intention TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  warning_reason TEXT NOT NULL
);

`;
    const inserts = logs
      .map(
        (l) =>
          `INSERT INTO pedestrian_telemetry (timestamp, pedestrian_id, distance, velocity, ttc, intention, risk_score, risk_level, warning_reason) VALUES ('${l.timestamp}', ${l.pedestrianId}, ${l.distance.toFixed(1)}, ${l.velocity.toFixed(1)}, ${l.ttc === Infinity ? 'NULL' : l.ttc.toFixed(1)}, '${l.intention}', ${l.riskScore}, '${l.riskLevel}', '${l.reason.replace(/'/g, "''")}');`
      )
      .join('\n');

    const blob = new Blob([schema + inserts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedestrian_safety_telemetry_${Date.now()}.sql`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              ADAS EVENT & TELEMETRY LOGS (SECTION 33)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/40 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Filter Level:</span>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              <option value="ALL">ALL LEVELS ({logs.length})</option>
              <option value="CRITICAL">CRITICAL ONLY</option>
              <option value="HIGH">HIGH ONLY</option>
              <option value="MEDIUM">MEDIUM ONLY</option>
              <option value="LOW">LOW ONLY</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <Download className="w-3 h-3 text-amber-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={handleExportSQL}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span>SQLite</span>
            </button>

            <button
              onClick={onClearLogs}
              className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ml-2"
              title="Clear Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="p-4 flex-1 overflow-x-auto text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No telemetry events logged yet. Events are logged continuously as pedestrians enter the frame.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 px-2">Timestamp</th>
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">Distance</th>
                  <th className="py-2 px-2">Velocity</th>
                  <th className="py-2 px-2">TTC</th>
                  <th className="py-2 px-2">Intention</th>
                  <th className="py-2 px-2">Risk</th>
                  <th className="py-2 px-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.slice(-100).reverse().map((l) => {
                  const colorScheme = RISK_COLORS[l.riskLevel];
                  return (
                    <tr key={l.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-2 text-slate-400">{l.timestamp}</td>
                      <td className="py-2 px-2 font-bold text-white">#{l.pedestrianId}</td>
                      <td className="py-2 px-2 text-cyan-300">{l.distance.toFixed(1)}m</td>
                      <td className="py-2 px-2 text-slate-300">{l.velocity.toFixed(1)}m/s</td>
                      <td className="py-2 px-2">{l.ttc === Infinity ? '>10s' : `${l.ttc.toFixed(1)}s`}</td>
                      <td className="py-2 px-2 text-slate-300">{l.intention}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colorScheme.badge}`}>
                          {l.riskLevel} ({l.riskScore})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-400 text-[11px] max-w-xs truncate" title={l.reason}>
                        {l.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 z-10 text-xs text-slate-400">
          <span>Displaying {filteredLogs.length} events</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
