import React from 'react';
import { X, BookOpen, AlertCircle, ShieldAlert, Cpu, Layers } from 'lucide-react';

interface HelpDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDocumentationModal: React.FC<HelpDocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              ACADEMIC RESEARCH & SYSTEM SPECIFICATION
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
        <div className="p-6 space-y-6 text-xs text-slate-300 leading-relaxed">
          {/* Section 30: Mandatory Safety Limitation Banner */}
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-300 font-bold uppercase text-xs mb-1">
                Mandatory Safety Limitation & Disclaimer
              </h3>
              <p className="text-red-200/90 text-[11px] leading-relaxed">
                "This system is an academic research prototype and must not be used as a certified
                automotive safety system." Monocular distance estimation from a single dash camera
                is an approximation subject to optical distortion and pitch variation. The system
                does not claim autonomous emergency braking (AEB) capability.
              </p>
            </div>
          </div>

          {/* Theoretical Architecture */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-3">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              1. End-to-End ADAS Processing Pipeline
            </h3>
            <div className="p-3 bg-slate-900 rounded border border-slate-800 text-[11px] text-cyan-200 leading-normal">
              Dashcam Video Frame → YOLOv8n Pedestrian Detection (COCO Class 0) → ByteTrack Multi-Object Tracker → Ground-Plane Metric Distance Estimation → Motion & Trajectory Smoothing → Dynamic Perspective Collision Corridor → Time-to-Collision (TTC) → PD-TCR Risk Fusion → Safety Decision Engine → AR Dashboard Overlay
            </div>
          </div>

          {/* Mathematical Formulations */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-3">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              2. Core Mathematical Formulations
            </h3>
            <div className="space-y-2 text-[11px]">
              <div>
                <strong className="text-white">A. Monocular Ground-Plane Distance:</strong>
                <div className="text-slate-400 bg-slate-900 p-2 rounded mt-1 font-mono">
                  Z = H_cam / tan(arctan((y_bottom - y_0)/f_y) + θ_pitch)
                </div>
              </div>
              <div>
                <strong className="text-white">B. Time-to-Collision (TTC):</strong>
                <div className="text-slate-400 bg-slate-900 p-2 rounded mt-1 font-mono">
                  TTC = D / V_relative (where V_relative = closing speed in m/s; Infinity if diverging)
                </div>
              </div>
              <div>
                <strong className="text-white">C. PD-TCR Risk Score:</strong>
                <div className="text-slate-400 bg-slate-900 p-2 rounded mt-1 font-mono">
                  RiskScore = Wd·R_dist + Wt·R_traj + Wc·R_zone + Wv·R_vel + Wtcc·R_ttc + Wi·R_int
                </div>
              </div>
            </div>
          </div>

          {/* Research Utility */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              3. Academic Project & Demonstration Context
            </h3>
            <p className="text-[11px] text-slate-300">
              Suitable for B.Tech / M.Tech final-year research thesis, computer vision publications,
              autonomous vehicle perception demos, and edge-device (NVIDIA Jetson, Raspberry Pi 5)
              deployment experiments.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
