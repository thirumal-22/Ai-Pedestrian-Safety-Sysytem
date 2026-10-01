import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  TrendingUp,
  Activity,
  ShieldCheck,
  Gauge,
  BarChart3,
  Sliders,
  Play,
  RotateCw,
  Zap,
  Info,
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowLeftRight,
  Scale,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ALL_MODEL_VARIATIONS,
  BENCHMARK_DATASETS,
  EVALUATION_CONDITIONS,
  TARGET_HARDWARE_OPTIONS,
  generateModelEvaluations,
  exportEvaluationsAsCSV,
  exportEvaluationsAsLaTeX,
} from '../../services/researchEvaluation';
import {
  CNNModelVariation,
  ModelEvaluationRunResult,
  SupportedModelArchitecture,
  SystemConfig,
} from '../../types';
import { ModelComparisonView } from './ModelComparisonView';

interface ModelVariationsPanelProps {
  config: SystemConfig;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  onSwitchToMonitor?: () => void;
}

export const ModelVariationsPanel: React.FC<ModelVariationsPanelProps> = ({
  config,
  onUpdateConfig,
  onSwitchToMonitor,
}) => {
  // Generation parameters
  const [selectedDataset, setSelectedDataset] = useState<string>('jaad');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedHardware, setSelectedHardware] = useState<string>('jetson_orin_nano');
  const [confThreshold, setConfThreshold] = useState<number>(config.confidenceThreshold);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(100);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);
  const [filterFamily, setFilterFamily] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof ModelEvaluationRunResult>('rank');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedCardModel, setSelectedCardModel] = useState<CNNModelVariation | null>(null);

  // Evaluation Results state (initialized with baseline evaluation)
  const [evaluationResults, setEvaluationResults] = useState<ModelEvaluationRunResult[]>(() =>
    generateModelEvaluations('jaad', 'all', 'jetson_orin_nano', 0.45)
  );

  // Model Comparison State (Compare Selected feature)
  const [modelAId, setModelAId] = useState<SupportedModelArchitecture>(
    config.modelVariant || 'YOLOv8n'
  );
  const [modelBId, setModelBId] = useState<SupportedModelArchitecture>(
    config.modelVariant === 'Faster R-CNN (ResNet-50)' ? 'SSD-MobileNetV2' : 'Faster R-CNN (ResNet-50)'
  );
  const [showComparisonView, setShowComparisonView] = useState<boolean>(true);

  // Helper to choose a model for comparison
  const handleSelectModelForComparison = (modelId: SupportedModelArchitecture) => {
    if (modelAId === modelId) {
      // already A, do nothing
    } else if (modelBId === modelId) {
      // already B, do nothing
    } else {
      // replace B with new model
      setModelBId(modelId);
    }
    setShowComparisonView(true);
    setTimeout(() => {
      const el = document.getElementById('model-comparison-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  // Helper to toggle checkbox in evaluation table
  const handleToggleCompareCheckbox = (modelId: SupportedModelArchitecture) => {
    if (modelAId === modelId) {
      // If clicking A, switch to another model as A if available
      return;
    }
    if (modelBId === modelId) {
      return;
    }
    setModelBId(modelId);
    setShowComparisonView(true);
  };

  // Active Model details
  const activeModelDetails = useMemo(() => {
    return ALL_MODEL_VARIATIONS.find((m) => m.id === config.modelVariant) || ALL_MODEL_VARIATIONS[0];
  }, [config.modelVariant]);

  // Run dynamic generation of model evaluations
  const handleRunEvaluation = () => {
    setIsGenerating(true);
    setGenerationProgress(10);

    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 25;
      });
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      const newResults = generateModelEvaluations(
        selectedDataset,
        selectedCondition,
        selectedHardware,
        confThreshold
      );
      setEvaluationResults(newResults);
      setGenerationProgress(100);
      setIsGenerating(false);
    }, 700);
  };

  // Export CSV
  const handleDownloadCSV = () => {
    const csvContent = exportEvaluationsAsCSV(evaluationResults);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `model_evaluations_${selectedDataset}_${selectedCondition}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  // Copy LaTeX
  const handleCopyLaTeX = () => {
    const latex = exportEvaluationsAsLaTeX(evaluationResults);
    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2500);
  };

  // Sorted and filtered evaluation results
  const filteredEvaluations = useMemo(() => {
    let list = [...evaluationResults];
    if (filterFamily !== 'ALL') {
      list = list.filter((item) => {
        if (filterFamily === 'YOLO') return item.family.includes('YOLO');
        if (filterFamily === 'CNN') return !item.family.includes('YOLO');
        return item.family === filterFamily;
      });
    }

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return list;
  }, [evaluationResults, filterFamily, sortField, sortAsc]);

  const handleHeaderSort = (field: keyof ModelEvaluationRunResult) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for metrics
    }
  };

  return (
    <div className="flex flex-col gap-5 text-slate-100 font-sans">
      {/* 1. Active Backbone & Variation Quick-Switch Banner */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                ACTIVE INFERENCE BACKBONE
              </span>
              <span className="text-xs font-mono text-slate-400">
                {activeModelDetails.family}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{activeModelDetails.name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ONLINE
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {activeModelDetails.description} Connected to WebSocket streaming backend and local fallback detector.
            </p>
          </div>

          {/* Quick Metrics of Active Model */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-lg text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">mAP@50</span>
              <span className="text-lg font-bold text-cyan-400">{activeModelDetails.mAP50}%</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-lg text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Edge Latency</span>
              <span className="text-lg font-bold text-emerald-400">{activeModelDetails.latencyJetsonMs} ms</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-lg text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Throughput</span>
              <span className="text-lg font-bold text-amber-400">{activeModelDetails.fpsJetson} FPS</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-lg text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Parameters</span>
              <span className="text-lg font-bold text-purple-400">{activeModelDetails.paramsM}M</span>
            </div>

            <button
              onClick={() => {
                setShowComparisonView(true);
                setTimeout(() => {
                  const el = document.getElementById('model-comparison-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold font-mono border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-white transition-all shadow-md shadow-indigo-500/10"
              title="Compare two selected model checkpoints side-by-side"
            >
              <Scale className="w-4 h-4 text-cyan-400" />
              <span>Compare Selected</span>
            </button>

            {onSwitchToMonitor && (
              <button
                onClick={onSwitchToMonitor}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-lg shadow-cyan-500/20"
              >
                <span>Live Dashcam View</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Instant Model Selection Ribbon */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Select & Switch Detection Model (YOLO + CNN Architectures)</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              10 Evaluated Variants Available
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {ALL_MODEL_VARIATIONS.map((model) => {
              const isActive = config.modelVariant === model.id;
              const isYolo = model.family === 'YOLO Family';
              return (
                <button
                  key={model.id}
                  onClick={() => onUpdateConfig({ modelVariant: model.id })}
                  className={`p-2.5 rounded-lg border text-left transition-all relative overflow-hidden group ${
                    isActive
                      ? 'bg-cyan-500/15 border-cyan-400 text-white ring-1 ring-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span
                      className={`px-1.5 py-0.2 rounded font-semibold ${
                        isYolo
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {isYolo ? 'YOLO' : 'CNN'}
                    </span>
                    <span className="text-slate-400">{model.latencyJetsonMs}ms</span>
                  </div>

                  <div className="font-bold text-xs truncate text-white" title={model.name}>
                    {model.name.split(' (')[0]}
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                    <span>{model.paramsM}M par</span>
                    <span className="text-cyan-400 font-semibold">{model.mAP50}% mAP</span>
                  </div>

                  {isActive && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Interactive Model Evaluation Generator Control Center */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase">
                MODEL EVALUATION & BENCHMARK GENERATION SUITE
              </h3>
              <p className="text-xs text-slate-400">
                Execute cross-model statistical evaluations across autonomous driving datasets & hardware targets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Download CSV table with all model metrics"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{copiedCsv ? 'Exported!' : 'Export CSV'}</span>
            </button>

            <button
              onClick={handleCopyLaTeX}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Copy LaTeX table code for research papers"
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedLatex ? 'Copied LaTeX!' : 'Copy LaTeX'}</span>
            </button>
          </div>
        </div>

        {/* Generator Filters & Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-xs">
          {/* Dataset Selector */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              BENCHMARK DATASET
            </label>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {BENCHMARK_DATASETS.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name.split(' (')[0]} ({ds.frames.toLocaleString()} frames)
                </option>
              ))}
            </select>
          </div>

          {/* Environmental Condition */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              ENVIRONMENTAL CONDITION
            </label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {EVALUATION_CONDITIONS.map((cond) => (
                <option key={cond.id} value={cond.id}>
                  {cond.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hardware Target */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              TARGET HARDWARE PLATFORM
            </label>
            <select
              value={selectedHardware}
              onChange={(e) => setSelectedHardware(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {TARGET_HARDWARE_OPTIONS.map((hw) => (
                <option key={hw.id} value={hw.id}>
                  {hw.name} ({hw.powerWatt}W)
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Threshold & Generate Button */}
          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-mono text-slate-400">CONFIDENCE THRESHOLD</label>
              <span className="text-cyan-400 font-mono font-bold text-xs">{confThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={confThreshold}
              onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 mb-2"
            />
            <button
              id="btn-run-evaluation"
              onClick={handleRunEvaluation}
              disabled={isGenerating}
              className={`w-full py-2 px-3 rounded-md text-xs font-bold font-mono uppercase flex items-center justify-center gap-1.5 transition-all ${
                isGenerating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Evaluating Models ({generationProgress}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Generate All Evaluations</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 3. Comprehensive Evaluation Results Matrix Table */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Comparative Benchmark Matrix (YOLO vs CNN Backbones)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated on {BENCHMARK_DATASETS.find((d) => d.id === selectedDataset)?.name} · Filter: {selectedCondition} · Target: {TARGET_HARDWARE_OPTIONS.find((h) => h.id === selectedHardware)?.name}
            </p>
          </div>

          {/* Architecture Family Filter */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-[10px] text-slate-500 px-1.5 uppercase flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {(['ALL', 'YOLO', 'CNN'] as const).map((fam) => (
              <button
                key={fam}
                onClick={() => setFilterFamily(fam)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  filterFamily === fam
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Compare Selected Trigger Bar */}
        <div className="bg-slate-950/80 border border-indigo-500/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-indigo-950/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-indigo-300 uppercase flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-cyan-400" />
              <span>Selected for Comparison:</span>
            </span>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => {
                  setShowComparisonView(true);
                  const el = document.getElementById('model-comparison-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1.5 transition-colors"
                title="Checkpoint A (Baseline)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>A: {modelAId.split(' (')[0]}</span>
              </button>
              <span className="text-slate-500 font-bold">vs</span>
              <button
                onClick={() => {
                  setShowComparisonView(true);
                  const el = document.getElementById('model-comparison-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold flex items-center gap-1.5 transition-colors"
                title="Checkpoint B (Candidate)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>B: {modelBId.split(' (')[0]}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowComparisonView(true);
                setTimeout(() => {
                  const el = document.getElementById('model-comparison-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-300" />
              <span>Compare Selected (Side-by-Side)</span>
            </button>
          </div>
        </div>

        {/* Interactive Data Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <th className="py-3 px-2 text-center w-12" title="Select two checkpoints to compare">
                  Compare
                </th>
                <th
                  onClick={() => handleHeaderSort('rank')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  Rank {sortField === 'rank' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('modelName')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  Model Architecture {sortField === 'modelName' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('family')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  Family {sortField === 'family' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('mAP50')}
                  className="py-3 px-3 cursor-pointer hover:text-cyan-300 text-right"
                >
                  mAP@50 {sortField === 'mAP50' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('precision')}
                  className="py-3 px-3 cursor-pointer hover:text-cyan-300 text-right"
                >
                  Precision {sortField === 'precision' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('recall')}
                  className="py-3 px-3 cursor-pointer hover:text-emerald-300 text-right"
                >
                  Recall {sortField === 'recall' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('f1Score')}
                  className="py-3 px-3 cursor-pointer hover:text-indigo-300 text-right"
                >
                  F1-Score {sortField === 'f1Score' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('latencyMs')}
                  className="py-3 px-3 cursor-pointer hover:text-amber-300 text-right"
                >
                  Latency {sortField === 'latencyMs' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('fps')}
                  className="py-3 px-3 cursor-pointer hover:text-emerald-300 text-right"
                >
                  FPS {sortField === 'fps' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('avgWarningLeadTimeSec')}
                  className="py-3 px-3 cursor-pointer hover:text-amber-300 text-right"
                >
                  Lead Time {sortField === 'avgWarningLeadTimeSec' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleHeaderSort('fpr')}
                  className="py-3 px-3 cursor-pointer hover:text-rose-300 text-right"
                >
                  FPR {sortField === 'fpr' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredEvaluations.map((result) => {
                const isCurrentActive = config.modelVariant === result.modelId;
                const isCompareA = modelAId === result.modelId;
                const isCompareB = modelBId === result.modelId;
                const modelDef = ALL_MODEL_VARIATIONS.find((m) => m.id === result.modelId);

                return (
                  <tr
                    key={result.modelId}
                    className={`transition-colors ${
                      isCurrentActive
                        ? 'bg-cyan-500/10 font-bold text-white'
                        : isCompareA
                        ? 'bg-cyan-950/20 text-slate-200'
                        : isCompareB
                        ? 'bg-purple-950/20 text-slate-200'
                        : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Compare Selection Checkbox/Badge */}
                    <td className="py-2.5 px-2 text-center">
                      {isCompareA ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          title="Candidate A (Selected for comparison)"
                        >
                          A
                        </span>
                      ) : isCompareB ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          title="Candidate B (Selected for comparison)"
                        >
                          B
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleCompareCheckbox(result.modelId)}
                          className="text-slate-600 hover:text-slate-300 p-0.5 rounded transition-colors"
                          title="Click to select this checkpoint for side-by-side comparison"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                          result.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : result.rank <= 3
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        {result.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">
                          {result.modelName.split(' (')[0]}
                        </span>
                        {isCurrentActive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 uppercase">
                            ACTIVE
                          </span>
                        )}
                        {isCompareA && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            CMP-A
                          </span>
                        )}
                        {isCompareB && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            CMP-B
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {modelDef ? `${modelDef.paramsM}M params · ${modelDef.flopsG}G FLOPs` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {result.family}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {result.mAP50.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">
                      {result.precision.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      {result.recall.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300 font-semibold">
                      {result.f1Score.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                      {result.latencyMs.toFixed(1)} ms
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-cyan-400">
                      {result.fps.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400">
                      {result.avgWarningLeadTimeSec.toFixed(2)}s
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-300">
                      {result.fpr.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleSelectModelForComparison(result.modelId)}
                          className="px-2 py-1 rounded text-[10px] font-mono border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:text-white hover:bg-indigo-500/30 transition-all flex items-center gap-1"
                          title="Compare this model in Side-by-Side matrix"
                        >
                          <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
                          <span>Compare</span>
                        </button>
                        <button
                          onClick={() => onUpdateConfig({ modelVariant: result.modelId })}
                          className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                            isCurrentActive
                              ? 'bg-cyan-500 text-slate-950 font-bold border border-cyan-400'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {isCurrentActive ? 'Active' : 'Deploy'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Side-by-Side Model Comparison (Compare Selected Feature) */}
      <section id="model-comparison-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-cyan-400 border border-indigo-500/40">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Side-by-Side Model Comparison</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Highlighting Differences
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Detailed comparison table contrasting architecture, latency, mAP, and ADAS warning capabilities.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowComparisonView(!showComparisonView)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>{showComparisonView ? 'Collapse Comparison' : 'Expand Comparison'}</span>
            {showComparisonView ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showComparisonView && (
          <ModelComparisonView
            modelAId={modelAId}
            modelBId={modelBId}
            onSelectModelA={setModelAId}
            onSelectModelB={setModelBId}
            evaluationResults={evaluationResults}
            activeModelId={config.modelVariant}
            onDeployModel={(id) => onUpdateConfig({ modelVariant: id })}
          />
        )}
      </section>

      {/* 4. Deep-Dive Model Architecture Cards (YOLO Baseline vs CNN Backbones) */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Architectural Specifications & Operational Trade-Offs</span>
            </h3>
            <p className="text-xs text-slate-400">
              Compare structural mechanics, receptive fields, and sensor-to-actuator safety trade-offs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_MODEL_VARIATIONS.map((model) => {
            const isActive = config.modelVariant === model.id;
            const isYolo = model.family === 'YOLO Family';

            return (
              <div
                key={model.id}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                  isActive
                    ? 'bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        isYolo
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {model.family}
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400 font-bold">
                      {model.mAP50}% mAP@50
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1">{model.name}</h4>
                  <div className="text-[11px] font-mono text-slate-400 mb-2">
                    Backbone: {model.backbone}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {model.description}
                  </p>

                  {/* Core Hardware Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 text-center mb-3">
                    <div>
                      <span className="text-[9px] uppercase font-mono text-slate-500 block">Params</span>
                      <span className="text-xs font-bold text-white font-mono">{model.paramsM}M</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono text-slate-500 block">Latency</span>
                      <span className="text-xs font-bold text-amber-400 font-mono">{model.latencyJetsonMs}ms</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono text-slate-500 block">Edge FPS</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">{model.fpsJetson}</span>
                    </div>
                  </div>

                  {/* Pros & Cons Tags */}
                  <div className="space-y-1.5 text-[11px] font-mono mb-3">
                    <div className="text-emerald-400/90 flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{model.pros[0]}</span>
                    </div>
                    <div className="text-slate-400 flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">⚠</span>
                      <span>{model.cons[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-mono text-slate-500">
                    Occlusion: <span className="text-slate-300 font-semibold">{model.occlusionResistance}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSelectModelForComparison(model.id)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-mono font-medium border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:text-white hover:bg-indigo-500/30 transition-all flex items-center gap-1"
                      title="Compare this checkpoint side-by-side"
                    >
                      <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
                      <span>Compare</span>
                    </button>
                    <button
                      onClick={() => onUpdateConfig({ modelVariant: model.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {isActive ? 'Active Pipeline' : 'Switch to Model'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Trade-off Visualization: Accuracy (mAP@50) vs Latency (ms) Pareto Frontier */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Safety Pareto Frontier: Detection Accuracy vs Hardware Latency</span>
            </h3>
            <p className="text-xs text-slate-400">
              Optimal deployment targets balance early warning lead time against false positive rate.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> YOLO Family
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> CNN Architectures
            </span>
          </div>
        </div>

        {/* Visual Trade-Off Horizontal Bar Chart */}
        <div className="space-y-3 font-mono text-xs">
          {evaluationResults.map((r) => {
            const isYolo = r.family.includes('YOLO');
            const isActive = config.modelVariant === r.modelId;
            const latencyPct = Math.min(100, (r.latencyMs / 120) * 100);
            const mapPct = Math.min(100, ((r.mAP50 - 70) / 30) * 100);

            return (
              <div
                key={r.modelId}
                className={`p-2.5 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{r.modelName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {r.family}
                    </span>
                    {isActive && (
                      <span className="text-[9px] font-bold text-cyan-400 uppercase">● ACTIVE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-cyan-400 font-bold">mAP: {r.mAP50}%</span>
                    <span className="text-amber-400">Latency: {r.latencyMs}ms</span>
                    <span className="text-emerald-400">FPS: {r.fps}</span>
                    <span className="text-slate-400">Lead Time: {r.avgWarningLeadTimeSec}s</span>
                  </div>
                </div>

                {/* Accuracy vs Latency Comparison Double Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <div className="flex justify-between text-slate-500 mb-0.5">
                      <span>Detection Accuracy (mAP@50)</span>
                      <span className="text-cyan-400">{r.mAP50}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isYolo ? 'bg-gradient-to-r from-sky-500 to-cyan-400' : 'bg-gradient-to-r from-purple-500 to-indigo-400'
                        }`}
                        style={{ width: `${mapPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-500 mb-0.5">
                      <span>Latency (Edge Inference)</span>
                      <span className="text-amber-400">{r.latencyMs} ms ({r.fps} FPS)</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                        style={{ width: `${latencyPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
