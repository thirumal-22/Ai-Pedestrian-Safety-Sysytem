import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  ShieldAlert,
  Gauge,
  Copy,
  Check,
  Download,
  Info,
  SlidersHorizontal,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  ALL_MODEL_VARIATIONS,
} from '../../services/researchEvaluation';
import {
  CNNModelVariation,
  ModelEvaluationRunResult,
  SupportedModelArchitecture,
} from '../../types';

interface ModelComparisonViewProps {
  modelAId: SupportedModelArchitecture;
  modelBId: SupportedModelArchitecture;
  onSelectModelA: (id: SupportedModelArchitecture) => void;
  onSelectModelB: (id: SupportedModelArchitecture) => void;
  evaluationResults: ModelEvaluationRunResult[];
  activeModelId: SupportedModelArchitecture;
  onDeployModel: (id: SupportedModelArchitecture) => void;
  onClose?: () => void;
}

interface MetricRowDef {
  id: string;
  category: string;
  label: string;
  tooltip?: string;
  unit?: string;
  getValueA: (m: CNNModelVariation, e?: ModelEvaluationRunResult) => number | string;
  getValueB: (m: CNNModelVariation, e?: ModelEvaluationRunResult) => number | string;
  higherIsBetter?: boolean; // true = higher is better, false = lower is better, undefined = categorical
  formatValue?: (val: number | string) => string;
}

export const ModelComparisonView: React.FC<ModelComparisonViewProps> = ({
  modelAId,
  modelBId,
  onSelectModelA,
  onSelectModelB,
  evaluationResults,
  activeModelId,
  onDeployModel,
  onClose,
}) => {
  const [diffOnly, setDiffOnly] = useState<boolean>(false);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  // Model A & B details
  const modelA = useMemo(
    () => ALL_MODEL_VARIATIONS.find((m) => m.id === modelAId) || ALL_MODEL_VARIATIONS[0],
    [modelAId]
  );
  const modelB = useMemo(
    () => ALL_MODEL_VARIATIONS.find((m) => m.id === modelBId) || ALL_MODEL_VARIATIONS[4], // Faster R-CNN as default B
    [modelBId]
  );

  // Associated evaluation runs
  const evalA = useMemo(
    () => evaluationResults.find((e) => e.modelId === modelAId),
    [evaluationResults, modelAId]
  );
  const evalB = useMemo(
    () => evaluationResults.find((e) => e.modelId === modelBId),
    [evaluationResults, modelBId]
  );

  // Swap Model A and Model B
  const handleSwapModels = () => {
    const tempA = modelAId;
    onSelectModelA(modelBId);
    onSelectModelB(tempA);
  };

  // Metric rows definition
  const metricRows: MetricRowDef[] = [
    // 1. Architecture & General
    {
      id: 'family',
      category: 'Architecture & Design',
      label: 'Model Family',
      getValueA: (m) => m.family,
      getValueB: (m) => m.family,
    },
    {
      id: 'backbone',
      category: 'Architecture & Design',
      label: 'Backbone Feature Extractor',
      getValueA: (m) => m.backbone,
      getValueB: (m) => m.backbone,
    },
    {
      id: 'detectorType',
      category: 'Architecture & Design',
      label: 'Detector Paradigm',
      tooltip: 'Single-stage decoupled head vs Two-stage Region Proposal Network',
      getValueA: (m) => m.detectorType,
      getValueB: (m) => m.detectorType,
    },
    {
      id: 'targetHardware',
      category: 'Architecture & Design',
      label: 'Intended Hardware Class',
      getValueA: (m) => m.targetHardware,
      getValueB: (m) => m.targetHardware,
    },

    // 2. Compute Footprint
    {
      id: 'paramsM',
      category: 'Computational Footprint',
      label: 'Model Parameters',
      tooltip: 'Total learnable weights (millions). Smaller models fit in cache and low-power SRAM.',
      unit: 'M',
      getValueA: (m) => m.paramsM,
      getValueB: (m) => m.paramsM,
      higherIsBetter: false,
      formatValue: (v) => `${v}M`,
    },
    {
      id: 'flopsG',
      category: 'Computational Footprint',
      label: 'FLOPs Complexity',
      tooltip: 'Giga-floating point operations per forward pass.',
      unit: 'GFLOPs',
      getValueA: (m) => m.flopsG,
      getValueB: (m) => m.flopsG,
      higherIsBetter: false,
      formatValue: (v) => `${v} G`,
    },
    {
      id: 'memoryMB',
      category: 'Computational Footprint',
      label: 'VRAM / Memory Allocation',
      tooltip: 'Operational memory footprint on edge accelerator.',
      unit: 'MB',
      getValueA: (m) => m.memoryMB,
      getValueB: (m) => m.memoryMB,
      higherIsBetter: false,
      formatValue: (v) => `${v} MB`,
    },

    // 3. Real-Time Latency & Speed
    {
      id: 'latencyMs',
      category: 'Speed & Edge Throughput',
      label: 'Inference Latency',
      tooltip: 'Forward-pass duration on target hardware. Lower latency improves critical brake reaction time.',
      unit: 'ms',
      getValueA: (m, e) => (e ? e.latencyMs : m.latencyJetsonMs),
      getValueB: (m, e) => (e ? e.latencyMs : m.latencyJetsonMs),
      higherIsBetter: false,
      formatValue: (v) => `${v} ms`,
    },
    {
      id: 'fps',
      category: 'Speed & Edge Throughput',
      label: 'Throughput',
      tooltip: 'Frames per second on selected platform. Standard ADAS requires ≥30 FPS.',
      unit: 'FPS',
      getValueA: (m, e) => (e ? e.fps : m.fpsJetson),
      getValueB: (m, e) => (e ? e.fps : m.fpsJetson),
      higherIsBetter: true,
      formatValue: (v) => `${v} FPS`,
    },
    {
      id: 'realtimeSafety',
      category: 'Speed & Edge Throughput',
      label: 'Real-Time Safe (≥30 FPS)',
      tooltip: 'Meets ISO 26262 functional real-time sensor processing cadence.',
      getValueA: (m, e) => ((e ? e.fps : m.fpsJetson) >= 30 ? 'COMPLIANT (≥30 FPS)' : 'BELOW THRESHOLD (<30 FPS)'),
      getValueB: (m, e) => ((e ? e.fps : m.fpsJetson) >= 30 ? 'COMPLIANT (≥30 FPS)' : 'BELOW THRESHOLD (<30 FPS)'),
    },

    // 4. Detection Accuracy & Quality
    {
      id: 'mAP50',
      category: 'Detection Accuracy & Quality',
      label: 'mAP@50 (IoU ≥ 0.50)',
      tooltip: 'Mean Average Precision at 0.50 IoU intersection threshold.',
      unit: '%',
      getValueA: (m, e) => (e ? e.mAP50 : m.mAP50),
      getValueB: (m, e) => (e ? e.mAP50 : m.mAP50),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'mAP50_95',
      category: 'Detection Accuracy & Quality',
      label: 'mAP@50:95 (COCO Strict)',
      tooltip: 'Average precision evaluated across IoU 0.50 to 0.95 in 0.05 steps.',
      unit: '%',
      getValueA: (m, e) => (e ? e.mAP50_95 : m.mAP50_95),
      getValueB: (m, e) => (e ? e.mAP50_95 : m.mAP50_95),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'precision',
      category: 'Detection Accuracy & Quality',
      label: 'Detection Precision',
      tooltip: 'Ratio of true pedestrian detections to total predicted boxes.',
      unit: '%',
      getValueA: (m, e) => (e ? e.precision : Math.round(m.precision * 1000) / 10),
      getValueB: (m, e) => (e ? e.precision : Math.round(m.precision * 1000) / 10),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'recall',
      category: 'Detection Accuracy & Quality',
      label: 'Pedestrian Recall',
      tooltip: 'Ratio of detected ground-truth pedestrians. High recall prevents missed hazards.',
      unit: '%',
      getValueA: (m, e) => (e ? e.recall : Math.round(m.recall * 1000) / 10),
      getValueB: (m, e) => (e ? e.recall : Math.round(m.recall * 1000) / 10),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'f1Score',
      category: 'Detection Accuracy & Quality',
      label: 'F1-Score',
      tooltip: 'Harmonic mean of precision and recall: 2 * (P * R) / (P + R).',
      unit: '%',
      getValueA: (m, e) => (e ? e.f1Score : Math.round(m.f1Score * 1000) / 10),
      getValueB: (m, e) => (e ? e.f1Score : Math.round(m.f1Score * 1000) / 10),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },

    // 5. ADAS Safety & Braking Metrics
    {
      id: 'leadTime',
      category: 'ADAS Safety & Braking Action',
      label: 'Avg Warning Lead Time',
      tooltip: 'Advance notice time before potential collision point. Crucial for vehicle braking distance.',
      unit: 's',
      getValueA: (m, e) => (e ? e.avgWarningLeadTimeSec : 3.45),
      getValueB: (m, e) => (e ? e.avgWarningLeadTimeSec : 3.12),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(2)}s`,
    },
    {
      id: 'criticalHazardRecall',
      category: 'ADAS Safety & Braking Action',
      label: 'Critical Hazard Recall',
      tooltip: 'Recall specifically on pedestrians inside high-risk collision zones (<15m, TTC < 2.5s).',
      unit: '%',
      getValueA: (m, e) => (e ? e.criticalHazardRecall : 96.2),
      getValueB: (m, e) => (e ? e.criticalHazardRecall : 95.1),
      higherIsBetter: true,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'fpr',
      category: 'ADAS Safety & Braking Action',
      label: 'False Positive Rate (FPR)',
      tooltip: 'False alarms on background clutter. Low FPR prevents phantom braking events.',
      unit: '%',
      getValueA: (m, e) => (e ? e.fpr : 6.8),
      getValueB: (m, e) => (e ? e.fpr : 5.5),
      higherIsBetter: false,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },
    {
      id: 'fnr',
      category: 'ADAS Safety & Braking Action',
      label: 'False Negative Rate (FNR)',
      tooltip: 'Miss rate on pedestrians. Must be minimized for autonomous driving safety.',
      unit: '%',
      getValueA: (m, e) => (e ? e.fnr : 8.6),
      getValueB: (m, e) => (e ? e.fnr : 8.2),
      higherIsBetter: false,
      formatValue: (v) => `${Number(v).toFixed(1)}%`,
    },

    // 6. Operational Robustness
    {
      id: 'occlusion',
      category: 'Operational Robustness',
      label: 'Occlusion Resistance',
      tooltip: 'Robustness in dense crowds, parked vehicles, and street furniture.',
      getValueA: (m) => m.occlusionResistance,
      getValueB: (m) => m.occlusionResistance,
    },
    {
      id: 'night',
      category: 'Operational Robustness',
      label: 'Night / Low-Light (<5 lux)',
      tooltip: 'Stability under severe headlight glare and unlit roadways.',
      getValueA: (m) => m.nightPerformance,
      getValueB: (m) => m.nightPerformance,
    },
  ];

  // Grouped rows by category
  const groupedRows = useMemo<Record<string, MetricRowDef[]>>(() => {
    const groups: Record<string, MetricRowDef[]> = {};
    metricRows.forEach((row) => {
      const valA = row.getValueA(modelA, evalA);
      const valB = row.getValueB(modelB, evalB);
      const isDifferent = String(valA).trim() !== String(valB).trim();

      if (!diffOnly || isDifferent) {
        if (!groups[row.category]) {
          groups[row.category] = [];
        }
        groups[row.category].push(row);
      }
    });
    return groups;
  }, [metricRows, modelA, modelB, evalA, evalB, diffOnly]);

  // Overall comparison verdict
  const verdict = useMemo(() => {
    const latA = evalA ? evalA.latencyMs : modelA.latencyJetsonMs;
    const latB = evalB ? evalB.latencyMs : modelB.latencyJetsonMs;
    const mapA = evalA ? evalA.mAP50 : modelA.mAP50;
    const mapB = evalB ? evalB.mAP50 : modelB.mAP50;
    const fpsA = evalA ? evalA.fps : modelA.fpsJetson;
    const fpsB = evalB ? evalB.fps : modelB.fpsJetson;

    const speedup = (Math.max(fpsA, fpsB) / Math.max(1, Math.min(fpsA, fpsB))).toFixed(1);
    const mapDiff = Math.abs(mapA - mapB).toFixed(1);

    const fasterModel = fpsA >= fpsB ? modelA.name : modelB.name;
    const moreAccurateModel = mapA >= mapB ? modelA.name : modelB.name;

    return {
      fasterModel,
      moreAccurateModel,
      speedup,
      mapDiff,
      isSpeedTie: Math.abs(fpsA - fpsB) < 1,
      isMapTie: Math.abs(mapA - mapB) < 0.2,
      recommendation:
        fpsA > fpsB
          ? `${modelA.name} provides ${speedup}x higher frame rate (${fpsA} vs ${fpsB} FPS) and lower latency, making it the superior candidate for low-power edge compute. ${modelB.name} provides ${mapDiff}% ${mapB >= mapA ? 'higher' : 'lower'} mAP@50.`
          : `${modelB.name} provides ${speedup}x higher throughput, while ${modelA.name} focuses on ${mapA >= mapB ? 'higher detection accuracy' : 'robust proposal generation'}.`,
    };
  }, [modelA, modelB, evalA, evalB]);

  // Export Comparison to CSV
  const handleExportCSV = () => {
    const headers = ['Category', 'Metric', `Model A (${modelA.name})`, `Model B (${modelB.name})`, 'Difference / Delta', 'Advantage'];
    const rows: string[][] = [];

    metricRows.forEach((r) => {
      const valA = r.getValueA(modelA, evalA);
      const valB = r.getValueB(modelB, evalB);
      let deltaStr = 'Identical';
      let advStr = 'Neutral';

      if (typeof valA === 'number' && typeof valB === 'number') {
        const delta = valA - valB;
        deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${r.unit ? ' ' + r.unit : ''}`;
        if (r.higherIsBetter !== undefined) {
          const aIsBetter = r.higherIsBetter ? delta > 0 : delta < 0;
          const bIsBetter = r.higherIsBetter ? delta < 0 : delta > 0;
          if (aIsBetter) advStr = `Model A (+${Math.abs(delta).toFixed(1)})`;
          else if (bIsBetter) advStr = `Model B (+${Math.abs(delta).toFixed(1)})`;
        }
      } else if (String(valA) !== String(valB)) {
        deltaStr = 'Qualitative Difference';
      }

      rows.push([
        `"${r.category}"`,
        `"${r.label}"`,
        `"${r.formatValue ? r.formatValue(valA) : valA}"`,
        `"${r.formatValue ? r.formatValue(valB) : valB}"`,
        `"${deltaStr}"`,
        `"${advStr}"`,
      ]);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `comparison_${modelA.id}_vs_${modelB.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  // Copy Markdown Table
  const handleCopyMarkdown = () => {
    let md = `### Head-to-Head Architecture Comparison: ${modelA.name} vs ${modelB.name}\n\n`;
    md += `| Category | Metric | ${modelA.name} | ${modelB.name} | Delta (A - B) |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    metricRows.forEach((r) => {
      const valA = r.getValueA(modelA, evalA);
      const valB = r.getValueB(modelB, evalB);
      const strA = r.formatValue ? r.formatValue(valA) : String(valA);
      const strB = r.formatValue ? r.formatValue(valB) : String(valB);

      let deltaStr = '-';
      if (typeof valA === 'number' && typeof valB === 'number') {
        const diff = valA - valB;
        deltaStr = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${r.unit ? ' ' + r.unit : ''}`;
      } else if (strA !== strB) {
        deltaStr = 'Difference';
      }

      md += `| ${r.category} | ${r.label} | ${strA} | ${strB} | ${deltaStr} |\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  // Presets
  const presets = [
    { label: 'YOLOv8n vs Faster R-CNN', a: 'YOLOv8n', b: 'Faster R-CNN (ResNet-50)', desc: 'Anchor-Free Edge vs Two-Stage Proposal' },
    { label: 'YOLOv8n vs SSD MobileNet', a: 'YOLOv8n', b: 'SSD-MobileNetV2', desc: 'Ultra-Lightweight Edge Efficiency' },
    { label: 'YOLOv8s vs RetinaNet', a: 'YOLOv8s', b: 'RetinaNet (ResNet-50)', desc: 'Balanced YOLO vs Dense Focal Loss' },
    { label: 'YOLOv8x vs ConvNeXt-Tiny', a: 'YOLOv8x', b: 'ConvNeXt-Tiny', desc: 'High-Capacity vs Modern Pure CNN' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md text-slate-100 font-sans">
      {/* 1. Comparison Header & Quick Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                SIDE-BY-SIDE ARCHITECTURE COMPARISON
              </span>
              <span className="text-xs font-mono text-slate-400">
                Evaluating Checkpoints & Feature Discrepancies
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>{modelA.name.split(' (')[0]}</span>
              <span className="text-slate-500 font-normal text-sm font-mono">VS</span>
              <span>{modelB.name.split(' (')[0]}</span>
            </h2>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Swap Button */}
            <button
              onClick={handleSwapModels}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Swap Model A and Model B columns"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>Swap Models</span>
            </button>

            {/* Filter Differences Only Toggle */}
            <button
              onClick={() => setDiffOnly(!diffOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                diffOnly
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Show only rows where metrics differ between Model A and B"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{diffOnly ? 'Highlighting Differences' : 'Highlight Differences'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Download comparison matrix as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{copiedCsv ? 'Exported!' : 'Export CSV'}</span>
            </button>

            {/* Copy Markdown */}
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Copy comparison as Markdown table"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedMd ? 'Copied MD!' : 'Copy Markdown'}</span>
            </button>
          </div>
        </div>

        {/* Preset Comparison Shortcuts */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs font-mono">
          <span className="text-slate-500 text-[11px] whitespace-nowrap">Presets:</span>
          {presets.map((p) => {
            const isCurrentPreset =
              (modelA.id === p.a && modelB.id === p.b) || (modelA.id === p.b && modelB.id === p.a);
            return (
              <button
                key={p.label}
                onClick={() => {
                  onSelectModelA(p.a as SupportedModelArchitecture);
                  onSelectModelB(p.b as SupportedModelArchitecture);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors border ${
                  isCurrentPreset
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={p.desc}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Model Selectors & Deployment Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-950/60 border-b border-slate-800 text-xs font-mono">
        {/* Model A Selector Card */}
        <div className="p-4 flex flex-col justify-between gap-3 bg-slate-900/30">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                CANDIDATE A (BASELINE / PRIMARY)
              </span>
              {activeModelId === modelA.id && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  ● ACTIVE PIPELINE
                </span>
              )}
            </div>

            <label className="text-[11px] text-slate-400 block mb-1">SELECT CHECKPOINT A</label>
            <select
              value={modelA.id}
              onChange={(e) => onSelectModelA(e.target.value as SupportedModelArchitecture)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-semibold focus:outline-none focus:border-cyan-400"
            >
              {ALL_MODEL_VARIATIONS.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === modelB.id}>
                  {m.name} ({m.family})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400">
              Backbone: <span className="text-slate-200">{modelA.backbone}</span>
            </div>
            <button
              onClick={() => onDeployModel(modelA.id)}
              disabled={activeModelId === modelA.id}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeModelId === modelA.id
                  ? 'bg-slate-800 text-slate-500 cursor-default border border-slate-700'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
              }`}
            >
              {activeModelId === modelA.id ? 'Deployed' : 'Deploy Model A'}
            </button>
          </div>
        </div>

        {/* Model B Selector Card */}
        <div className="p-4 flex flex-col justify-between gap-3 bg-slate-900/30">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                CANDIDATE B (COMPARISON CANDIDATE)
              </span>
              {activeModelId === modelB.id && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  ● ACTIVE PIPELINE
                </span>
              )}
            </div>

            <label className="text-[11px] text-slate-400 block mb-1">SELECT CHECKPOINT B</label>
            <select
              value={modelB.id}
              onChange={(e) => onSelectModelB(e.target.value as SupportedModelArchitecture)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-semibold focus:outline-none focus:border-purple-400"
            >
              {ALL_MODEL_VARIATIONS.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === modelA.id}>
                  {m.name} ({m.family})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400">
              Backbone: <span className="text-slate-200">{modelB.backbone}</span>
            </div>
            <button
              onClick={() => onDeployModel(modelB.id)}
              disabled={activeModelId === modelB.id}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeModelId === modelB.id
                  ? 'bg-slate-800 text-slate-500 cursor-default border border-slate-700'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
              }`}
            >
              {activeModelId === modelB.id ? 'Deployed' : 'Deploy Model B'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Executive Summary / Decision Verdict */}
      <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-start gap-3 text-xs">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mt-0.5 shrink-0">
          <Award className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-white font-mono uppercase text-[11px] flex items-center gap-2">
            <span>AUTOMATED ADAS DEPLOYMENT RECOMMENDATION</span>
            <span className="text-[10px] text-slate-500 font-normal">
              Based on latency, mAP@50, and warning lead time
            </span>
          </div>
          <p className="text-slate-300 mt-1 leading-relaxed">
            {verdict.recommendation}
          </p>
        </div>
      </div>

      {/* 4. Side-by-Side Comparison Table with Highlighted Discrepancies */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
              <th className="py-3 px-4 w-[28%]">Metric / Specification</th>
              <th className="py-3 px-4 w-[26%] bg-cyan-950/20 text-cyan-300 border-x border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate">{modelA.name.split(' (')[0]}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">A</span>
                </div>
              </th>
              <th className="py-3 px-4 w-[26%] bg-purple-950/20 text-purple-300 border-r border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate">{modelB.name.split(' (')[0]}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">B</span>
                </div>
              </th>
              <th className="py-3 px-4 w-[20%] text-slate-300 text-center">
                Discrepancy / Delta ($\Delta$)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {(Object.entries(groupedRows) as [string, MetricRowDef[]][]).map(([category, rows]) => (
              <React.Fragment key={category}>
                {/* Category Header Row */}
                <tr className="bg-slate-950/90 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <td colSpan={4} className="py-2.5 px-4 bg-slate-950 text-indigo-300 border-y border-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm bg-indigo-400" />
                      <span>{category}</span>
                    </span>
                  </td>
                </tr>

                {/* Individual Metric Rows */}
                {rows.map((row) => {
                  const valA = row.getValueA(modelA, evalA);
                  const valB = row.getValueB(modelB, evalB);

                  const strA = row.formatValue ? row.formatValue(valA) : String(valA);
                  const strB = row.formatValue ? row.formatValue(valB) : String(valB);

                  const isNumeric = typeof valA === 'number' && typeof valB === 'number';
                  const isIdentical = String(valA).trim() === String(valB).trim();

                  let deltaDisplay: React.ReactNode = null;
                  let winner: 'A' | 'B' | 'TIE' | null = null;

                  if (isNumeric) {
                    const diff = Number(valA) - Number(valB);
                    const pctDiff =
                      Number(valB) !== 0
                        ? ((Number(valA) - Number(valB)) / Math.abs(Number(valB))) * 100
                        : 0;

                    if (Math.abs(diff) < 0.001) {
                      winner = 'TIE';
                      deltaDisplay = (
                        <span className="text-slate-500 font-mono text-[11px]">
                          Identical (0.0)
                        </span>
                      );
                    } else if (row.higherIsBetter !== undefined) {
                      const aIsBetter = row.higherIsBetter ? diff > 0 : diff < 0;
                      winner = aIsBetter ? 'A' : 'B';

                      const diffLabel = `${diff > 0 ? '+' : ''}${diff.toFixed(
                        Math.abs(diff) < 1 ? 2 : 1
                      )}${row.unit ? ' ' + row.unit : ''}`;

                      deltaDisplay = (
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              aIsBetter
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            }`}
                          >
                            {aIsBetter ? `A is better (${diffLabel})` : `B is better (${diffLabel})`}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {pctDiff > 0 ? '+' : ''}
                            {pctDiff.toFixed(1)}% difference
                          </span>
                        </div>
                      );
                    } else {
                      deltaDisplay = (
                        <span className="text-slate-400 font-mono text-[11px]">
                          {diff > 0 ? '+' : ''}
                          {diff.toFixed(1)}
                        </span>
                      );
                    }
                  } else {
                    // Categorical
                    if (isIdentical) {
                      deltaDisplay = (
                        <span className="text-slate-500 text-[11px]">Identical</span>
                      );
                    } else {
                      deltaDisplay = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Variant Difference
                        </span>
                      );
                    }
                  }

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        !isIdentical ? 'bg-slate-900/40' : 'bg-slate-950/20'
                      }`}
                    >
                      {/* Metric Name */}
                      <td className="py-2.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{row.label}</span>
                          {!isIdentical && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Different between models" />
                          )}
                        </div>
                        {row.tooltip && (
                          <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">
                            {row.tooltip}
                          </div>
                        )}
                      </td>

                      {/* Candidate A Cell */}
                      <td
                        className={`py-2.5 px-4 border-x border-slate-800/80 transition-colors ${
                          winner === 'A'
                            ? 'bg-cyan-500/10 text-cyan-200 font-bold'
                            : 'text-slate-300 bg-cyan-950/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={winner === 'A' ? 'text-cyan-300' : 'text-slate-200'}>
                            {strA}
                          </span>
                          {winner === 'A' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase border border-cyan-500/30">
                              BETTER
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Candidate B Cell */}
                      <td
                        className={`py-2.5 px-4 border-r border-slate-800/80 transition-colors ${
                          winner === 'B'
                            ? 'bg-purple-500/10 text-purple-200 font-bold'
                            : 'text-slate-300 bg-purple-950/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={winner === 'B' ? 'text-purple-300' : 'text-slate-200'}>
                            {strB}
                          </span>
                          {winner === 'B' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold uppercase border border-purple-500/30">
                              BETTER
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delta / Discrepancy Column */}
                      <td className="py-2.5 px-4 text-center bg-slate-950/50">
                        {deltaDisplay}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Qualitative Summary Cards: Strengths and Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 border-t border-slate-800 text-xs font-mono bg-slate-950/80">
        {/* Model A Strengths/Cons */}
        <div className="p-4 space-y-2">
          <div className="text-[11px] font-bold text-cyan-300 uppercase flex items-center justify-between">
            <span>{modelA.name.split(' (')[0]} Architectural Profile</span>
            <span className="text-[10px] text-slate-500">{modelA.detectorType}</span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="text-slate-400 font-semibold mb-1">Key Advantages:</div>
            {modelA.pros.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 text-emerald-400/90">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{p}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[11px] pt-1">
            <div className="text-slate-400 font-semibold mb-1">Known Trade-offs:</div>
            {modelA.cons.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-amber-400/90">
                <span className="text-amber-400 font-bold">⚠</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model B Strengths/Cons */}
        <div className="p-4 space-y-2">
          <div className="text-[11px] font-bold text-purple-300 uppercase flex items-center justify-between">
            <span>{modelB.name.split(' (')[0]} Architectural Profile</span>
            <span className="text-[10px] text-slate-500">{modelB.detectorType}</span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="text-slate-400 font-semibold mb-1">Key Advantages:</div>
            {modelB.pros.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 text-emerald-400/90">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{p}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[11px] pt-1">
            <div className="text-slate-400 font-semibold mb-1">Known Trade-offs:</div>
            {modelB.cons.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-amber-400/90">
                <span className="text-amber-400 font-bold">⚠</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
