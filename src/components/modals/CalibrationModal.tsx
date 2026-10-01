import React, { useState } from 'react';
import { X, Sliders, Check, RotateCcw, Info } from 'lucide-react';
import { SystemConfig } from '../../types';
import { DEFAULT_CONFIG } from '../../services/config';

interface CalibrationModalProps {
  isOpen: boolean;
  config: SystemConfig;
  onClose: () => void;
  onSave: (newConfig: Partial<SystemConfig>) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  config,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [form, setForm] = useState<SystemConfig>(JSON.parse(JSON.stringify(config)));

  const handleResetDefaults = () => {
    setForm(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono text-white tracking-wide uppercase">
              CAMERA CALIBRATION & VEHICLE DYNAMICS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs font-mono">
          {/* Disclaimer Note */}
          <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-lg p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-cyan-200 leading-relaxed text-[11px]">
              Accurate camera extrinsic (height, pitch) and intrinsic (focal length, FOV) calibration
              enables metric ground-plane projection. Monocular distance is an estimate and not an
              asymmetric radar/LiDAR ground truth.
            </p>
          </div>

          {/* Section 1: Monocular Distance Method */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
            <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider text-cyan-400">
              1. Distance Estimation Algorithm Selection
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  form.distanceMethod === 'ground_plane'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="distMethod"
                  checked={form.distanceMethod === 'ground_plane'}
                  onChange={() => setForm({ ...form, distanceMethod: 'ground_plane' })}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold block text-slate-200">Method 2: Ground-Plane Projection (Recommended)</span>
                  <span className="text-[10px] text-slate-400 leading-normal block mt-1">
                    Projects bounding-box contact point (x_center, y_bottom) onto calibrated road plane using camera mounting height and pitch angle.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  form.distanceMethod === 'bbox_height'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="distMethod"
                  checked={form.distanceMethod === 'bbox_height'}
                  onChange={() => setForm({ ...form, distanceMethod: 'bbox_height' })}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold block text-slate-200">Method 1: Bounding-Box Height</span>
                  <span className="text-[10px] text-slate-400 leading-normal block mt-1">
                    Estimates distance using focal length and ISO standard pedestrian height (D = f * H / h_px). Simple baseline.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Camera Calibration Parameters */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
            <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider text-cyan-400">
              2. Camera Extrinsics & Intrinsics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Focal Length (f_x, f_y) [px]: {form.calibration.focalLength}
                </label>
                <input
                  type="range"
                  min="600"
                  max="2000"
                  step="10"
                  value={form.calibration.focalLength}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: { ...form.calibration, focalLength: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Camera Mounting Height [m]: {form.calibration.cameraHeight.toFixed(2)} m
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={form.calibration.cameraHeight}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: { ...form.calibration, cameraHeight: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Camera Pitch Angle [deg]: {form.calibration.cameraPitch.toFixed(1)}°
                </label>
                <input
                  type="range"
                  min="-5.0"
                  max="10.0"
                  step="0.5"
                  value={form.calibration.cameraPitch}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: { ...form.calibration, cameraPitch: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Pedestrian Reference Height [m]: {form.calibration.pedestrianHeight.toFixed(2)} m
                </label>
                <input
                  type="range"
                  min="1.4"
                  max="2.0"
                  step="0.05"
                  value={form.calibration.pedestrianHeight}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: {
                        ...form.calibration,
                        pedestrianHeight: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Horizontal FOV [deg]: {form.calibration.hfov}°
                </label>
                <input
                  type="range"
                  min="50"
                  max="120"
                  step="1"
                  value={form.calibration.hfov}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: { ...form.calibration, hfov: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Vertical FOV [deg]: {form.calibration.vfov}°
                </label>
                <input
                  type="range"
                  min="30"
                  max="80"
                  step="1"
                  value={form.calibration.vfov}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calibration: { ...form.calibration, vfov: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Vehicle Speed & Dynamics */}
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
            <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider text-cyan-400">
              3. Vehicle Speed & Dynamics (Section 22)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Vehicle Speed: {form.vehicleSpeed} km/h ({(form.vehicleSpeed / 3.6).toFixed(1)} m/s)
                </label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={form.vehicleSpeed}
                  onChange={(e) => setForm({ ...form, vehicleSpeed: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Speed Source Mode</label>
                <select
                  value={form.speedSource}
                  onChange={(e) => setForm({ ...form, speedSource: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 font-mono text-xs"
                >
                  <option value="manual">Mode 1: Manual Input (Current)</option>
                  <option value="simulated_can">Mode 2: Vehicle CAN Bus / OBD-II Stream</option>
                  <option value="gps">Mode 2: High-Precision GPS Velocity</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Standard Lane Width: {form.laneWidth.toFixed(1)} m
                </label>
                <input
                  type="range"
                  min="2.8"
                  max="4.5"
                  step="0.1"
                  value={form.laneWidth}
                  onChange={(e) => setForm({ ...form, laneWidth: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Projected Corridor Lookahead: {form.lookaheadDistance} m
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="5"
                  value={form.lookaheadDistance}
                  onChange={(e) => setForm({ ...form, lookaheadDistance: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 z-10">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-mono font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Parameters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
