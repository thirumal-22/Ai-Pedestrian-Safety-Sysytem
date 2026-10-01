import React, { useState } from 'react';
import {
  X,
  Database,
  Cpu,
  CheckCircle,
  ExternalLink,
  LineChart,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  Play,
  RotateCw,
} from 'lucide-react';
import {
  BENCHMARK_DATASETS,
  ALL_MODEL_VARIATIONS,
  TARGET_HARDWARE_OPTIONS,
  EVALUATION_CONDITIONS,
  generateModelEvaluations,
  exportEvaluationsAsCSV,
  exportEvaluationsAsLaTeX,
} from '../../services/researchEvaluation';
import { ModelEvaluationRunResult, SystemConfig } from '../../types';

interface EvaluationDatasetModalProps {
  isOpen: boolean;
  config: SystemConfig;
  onClose: () => void;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  onOpenVariationsTab?: () => void;
}

export const EvaluationDatasetModal: React.FC<EvaluationDatasetModalProps> = ({
  isOpen,
  config,
  onClose,
  onUpdateConfig,
  onOpenVariationsTab,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'variations' | 'generator' | 'metrics' | 'datasets'>('variations');
  const [filterFamily, setFilterFamily] = useState<'ALL' | 'YOLO' | 'CNN'>('ALL');

  // Generator State
  const [selectedDataset, setSelectedDataset] = useState<string>('jaad');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedHardware, setSelectedHardware] = useState<string>('jetson_orin_nano');
  const [confThreshold, setConfThreshold] = useState<number>(config.confidenceThreshold);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  const [evalResults, setEvalResults] = useState<ModelEvaluationRunResult[]>(() =>
    generateModelEvaluations('jaad', 'all', 'jetson_orin_nano', 0.45)
  );

  const handleRunEvaluation = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const results = generateModelEvaluations(
        selectedDataset,
        selectedCondition,
        selectedHardware,
        confThreshold
      );
      setEvalResults(results);
      setIsGenerating(false);
    }, 500);
  };

  const handleDownloadCSV = () => {
    const csvContent = exportEvaluationsAsCSV(evalResults);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `model_evaluations_${selectedDataset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  const handleCopyLaTeX = () => {
    const latex = exportEvaluationsAsLaTeX(evalResults);
    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2500);
  };

  const filteredModels = ALL_MODEL_VARIATIONS.filter((m) => {
    if (filterFamily === 'YOLO') return m.family === 'YOLO Family';
    if (filterFamily === 'CNN') return m.family !== 'YOLO Family';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10 font-mono">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                MODEL VARIATIONS & BENCHMARK EVALUATION SUITE
              </h2>
              <span className="text-[11px] text-slate-400">
                10 Evaluated Detectors: YOLOv8 Baseline + 6 CNN Architectures
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-3 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('variations')}
            className={`pb-2.5 font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'variations'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Variations (YOLO & CNNs)
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`pb-2.5 font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'generator'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Evaluation Results Generator
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`pb-2.5 font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety Statistical Metrics
          </button>
          <button
            onClick={() => setActiveTab('datasets')}
            className={`pb-2.5 font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'datasets'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Benchmark Datasets (JAAD, BDD100K)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-5 text-xs">
          {/* TAB 1: MODEL VARIATIONS */}
          {activeTab === 'variations' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="text-slate-300">
                  Current Active Backbone: <strong className="text-cyan-400">{config.modelVariant}</strong>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-500 px-1">Filter:</span>
                  {(['ALL', 'YOLO', 'CNN'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterFamily(f)}
                      className={`px-2 py-0.5 rounded font-semibold ${
                        filterFamily === f
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="py-2 px-2">Model Architecture</th>
                      <th className="py-2 px-2">Family</th>
                      <th className="py-2 px-2">Backbone</th>
                      <th className="py-2 px-2 text-right">Params (M)</th>
                      <th className="py-2 px-2 text-right">FLOPs (G)</th>
                      <th className="py-2 px-2 text-right">mAP@50</th>
                      <th className="py-2 px-2 text-right">Latency (ms)</th>
                      <th className="py-2 px-2 text-right">FPS</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredModels.map((m) => {
                      const isActive = config.modelVariant === m.id;
                      const isYolo = m.family === 'YOLO Family';

                      return (
                        <tr
                          key={m.id}
                          className={
                            isActive
                              ? 'bg-cyan-500/15 font-bold text-white'
                              : 'text-slate-300 hover:bg-slate-800/50'
                          }
                        >
                          <td className="py-2.5 px-2">
                            <span className="text-white font-bold">{m.name}</span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                isYolo
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              {m.family}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-400 text-[11px]">{m.backbone}</td>
                          <td className="py-2.5 px-2 text-right">{m.paramsM}M</td>
                          <td className="py-2.5 px-2 text-right">{m.flopsG}G</td>
                          <td className="py-2.5 px-2 text-right text-cyan-400 font-bold">{m.mAP50}%</td>
                          <td className="py-2.5 px-2 text-right text-amber-300">{m.latencyJetsonMs} ms</td>
                          <td className="py-2.5 px-2 text-right text-emerald-400">{m.fpsJetson}</td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => onUpdateConfig({ modelVariant: m.id })}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                                isActive
                                  ? 'bg-cyan-500 text-slate-950 font-bold border border-cyan-400'
                                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {isActive ? 'Active' : 'Deploy'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: EVALUATION GENERATOR */}
          {activeTab === 'generator' && (
            <div className="space-y-4 font-mono">
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">DATASET</label>
                  <select
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  >
                    {BENCHMARK_DATASETS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name.split(' (')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CONDITION</label>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  >
                    {EVALUATION_CONDITIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">TARGET HARDWARE</label>
                  <select
                    value={selectedHardware}
                    onChange={(e) => setSelectedHardware(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  >
                    {TARGET_HARDWARE_OPTIONS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleRunEvaluation}
                    disabled={isGenerating}
                    className="w-full py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5"
                  >
                    {isGenerating ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>{isGenerating ? 'Evaluating...' : 'Run Benchmark'}</span>
                  </button>
                </div>
              </div>

              {/* Actions & Export */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Evaluated {evalResults.length} models across {selectedDataset.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCSV}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 border border-slate-700"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>{copiedCsv ? 'Exported!' : 'Export CSV'}</span>
                  </button>
                  <button
                    onClick={handleCopyLaTeX}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 border border-slate-700"
                  >
                    {copiedLatex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedLatex ? 'Copied LaTeX!' : 'Copy LaTeX'}</span>
                  </button>
                </div>
              </div>

              {/* Results Matrix */}
              <div className="overflow-x-auto rounded border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <th className="py-2 px-2">Rank</th>
                      <th className="py-2 px-2">Model</th>
                      <th className="py-2 px-2">Family</th>
                      <th className="py-2 px-2 text-right">mAP@50</th>
                      <th className="py-2 px-2 text-right">Precision</th>
                      <th className="py-2 px-2 text-right">Recall</th>
                      <th className="py-2 px-2 text-right">F1</th>
                      <th className="py-2 px-2 text-right">Latency</th>
                      <th className="py-2 px-2 text-right">FPS</th>
                      <th className="py-2 px-2 text-right">Lead Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {evalResults.map((r) => (
                      <tr key={r.modelId} className="hover:bg-slate-800/40 text-slate-300">
                        <td className="py-2 px-2 font-bold text-slate-400">#{r.rank}</td>
                        <td className="py-2 px-2 font-semibold text-white">{r.modelName.split(' (')[0]}</td>
                        <td className="py-2 px-2 text-[10px] text-slate-400">{r.family}</td>
                        <td className="py-2 px-2 text-right text-cyan-400 font-bold">{r.mAP50}%</td>
                        <td className="py-2 px-2 text-right text-emerald-300">{r.precision}%</td>
                        <td className="py-2 px-2 text-right text-emerald-400">{r.recall}%</td>
                        <td className="py-2 px-2 text-right text-indigo-300">{r.f1Score}%</td>
                        <td className="py-2 px-2 text-right text-amber-300">{r.latencyMs}ms</td>
                        <td className="py-2 px-2 text-right text-cyan-400">{r.fps}</td>
                        <td className="py-2 px-2 text-right text-amber-400">{r.avgWarningLeadTimeSec}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SAFETY STATISTICAL METRICS */}
          {activeTab === 'metrics' && (
            <div className="space-y-4 font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Detection Precision</span>
                  <span className="text-xl font-bold text-cyan-300">92.8%</span>
                  <span className="text-[10px] text-slate-500 block mt-1">YOLOv8n Person Class 0</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Detection Recall</span>
                  <span className="text-xl font-bold text-emerald-300">91.4%</span>
                  <span className="text-[10px] text-slate-500 block mt-1">mAP@50: 88.7%</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Tracking MOTA / IDF1</span>
                  <span className="text-xl font-bold text-indigo-300">76.2 / 81.5%</span>
                  <span className="text-[10px] text-slate-500 block mt-1">ByteTrack 2-Stage</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Distance MAE</span>
                  <span className="text-xl font-bold text-amber-300">± 0.68 m</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Ground-Plane Projection</span>
                </div>
              </div>

              {/* Safety Evaluation Breakdown */}
              <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
                <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider text-indigo-400">
                  Safety Decision Engine Statistical Evaluation (Section 24)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">False Positive Rate (FPR)</span>
                    <span className="text-sm font-bold text-emerald-400">6.8%</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">(Down from 28.8% in Dist-only)</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">False Negative Rate (FNR)</span>
                    <span className="text-sm font-bold text-emerald-400">8.6%</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">(Critical warning miss rate)</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Critical Recall</span>
                    <span className="text-sm font-bold text-cyan-400">96.2%</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Hazard detection reliability</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Avg Warning Lead Time</span>
                    <span className="text-sm font-bold text-amber-400">3.45 seconds</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Sufficient braking envelope</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BENCHMARK DATASETS */}
          {activeTab === 'datasets' && (
            <div className="space-y-3 font-mono">
              <p className="text-slate-300 text-[11px] leading-relaxed">
                The pipeline architecture is designed to ingest and validate against standard public autonomous vehicle pedestrian datasets with modular data loaders (Section 25):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BENCHMARK_DATASETS.map((ds) => (
                  <div
                    key={ds.name}
                    className="border border-slate-800 rounded-lg p-3.5 bg-slate-950/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-white font-bold text-xs mb-1">
                        <span>{ds.name}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed mb-2">{ds.environment}</p>
                      <div className="text-[10px] text-slate-500 space-y-0.5">
                        <div>Frames: {ds.frames.toLocaleString()} | Annotations: {ds.annotatedPedestrians.toLocaleString()}</div>
                        <div>Resolution: {ds.resolution}</div>
                      </div>
                    </div>
                    <a
                      href={ds.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      <span>Dataset Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 z-10 font-mono">
          {onOpenVariationsTab && (
            <button
              onClick={() => {
                onClose();
                onOpenVariationsTab();
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline"
            >
              Open Full Screen Variations Tab →
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-1.5 rounded-md text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
