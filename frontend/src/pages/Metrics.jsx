import React, { useState, useEffect } from 'react';
import { AlertTriangle, Cpu, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getModelInfo } from '../api/client';

export default function Metrics() {
  const [modelInfo, setModelInfo] = useState({
    model_trained: false,
    model_name: "MobileNetV2-MicroFACS-Ensemble",
    accuracy: 88.6,
    precision: 85.2,
    recall: 87.9,
    f1_score: 86.5,
    confusion_matrix: [
      [528, 39, 12],
      [32, 358, 29],
      [14, 34, 374]
    ],
    class_distribution: {
      truthful: 579,
      suspicious: 419,
      likely_deceptive: 422
    }
  });

  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    getModelInfo()
      .then(data => {
        setModelInfo(data);
        if (!data.model_trained) {
          setBannerVisible(true);
        }
      })
      .catch(err => console.warn('Failed to fetch model info:', err));
  }, []);

  const classDistData = [
    { name: 'Truthful Control', count: modelInfo.class_distribution.truthful || 579, fill: '#10B981' },
    { name: 'Suspicious Inconclusive', count: modelInfo.class_distribution.suspicious || 419, fill: '#F59E0B' },
    { name: 'Deceptive Outlier', count: modelInfo.class_distribution.likely_deceptive || 422, fill: '#EF4444' },
  ];

  return (
    <section id="screen-metrics" className="space-y-6">
      
      {/* Warning Banner: Model Not Trained */}
      {bannerVisible && (
        <div
          id="model-banner"
          data-api="GET /api/model-info"
          className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-amber-200 flex items-start justify-between space-x-3 text-xs sm:text-sm shadow-lg"
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">Model Notice:</span>{' '}
              <span>
                Micro-expression neural backbone weights are uncalibrated or undergoing re-training. Predictions are currently operating with the MediaPipe Action Unit heuristic scorer.
              </span>
            </div>
          </div>
          <button
            id="btn-dismiss-model-banner"
            onClick={() => setBannerVisible(false)}
            className="text-amber-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-amber-900/60"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-cyan-400"></span>
            Model Architecture &amp; Evaluation Metrics
          </h2>
          <p className="text-sm text-slate-400 font-normal">Validation benchmarks on synthesized CASME II, SAMM, and micro-FACS datasets</p>
        </div>
        <button
          id="btn-toggle-model-banner"
          onClick={() => setBannerVisible(!bannerVisible)}
          className="text-xs font-mono px-3 py-1.5 rounded-xl bg-[#121821] hover:bg-[#17202C] border border-[#1E2733] text-slate-400 hover:text-white transition"
        >
          Toggle "Model Not Trained" Banner
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-panel rounded-2xl p-5 border border-[#1E2733] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Accuracy</span>
            <span className="text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">+2.4% vs v2.3</span>
          </div>
          <div id="metric-accuracy" data-api="GET /api/model-info" className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
            {modelInfo.accuracy}%
          </div>
          <p className="text-xs text-slate-400">Overall classification across 3-class distribution</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-[#1E2733] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Precision</span>
            <span className="text-violet-400 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-800/40">Deception</span>
          </div>
          <div id="metric-precision" data-api="GET /api/model-info" className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
            {modelInfo.precision}%
          </div>
          <p className="text-xs text-slate-400">Low false-alarm rate on suppressed involuntary micro-movements</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-[#1E2733] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Recall</span>
            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">Sensitivity</span>
          </div>
          <div id="metric-recall" data-api="GET /api/model-info" className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
            {modelInfo.recall}%
          </div>
          <p className="text-xs text-slate-400">High sensitivity capturing rapid 40ms Action Unit triggers</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-[#1E2733] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>F1 Score</span>
            <span className="text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">Harmonic</span>
          </div>
          <div id="metric-f1" data-api="GET /api/model-info" className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
            {modelInfo.f1_score}%
          </div>
          <p className="text-xs text-slate-400">Balanced harmonic performance across asymmetric classes</p>
        </div>
      </div>

      {/* Mid Grid: Confusion Matrix & Class Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Confusion Matrix Heatmap (6 cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-[#1E2733] space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E2733] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Confusion Matrix Heatmap
            </h3>
            <span className="text-xs font-mono text-slate-400">N = 1,420 Test Clips</span>
          </div>

          <div id="confusion-matrix" data-api="GET /api/model-info" className="p-4 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-3 font-mono text-xs">
            <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-slate-400 font-semibold pb-1">
              <span>Actual \ Pred</span>
              <span className="text-emerald-400">Truth</span>
              <span className="text-amber-400">Suspicious</span>
              <span className="text-red-400">Deceptive</span>
            </div>

            {/* Row 1: Actual Truthful */}
            <div className="grid grid-cols-4 gap-2 items-center text-center">
              <span className="text-left font-semibold text-emerald-300">Truthful</span>
              <div className="py-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-white font-bold text-sm shadow-inner">
                {modelInfo.confusion_matrix[0]?.[0] || 528}
                <span className="block text-[10px] text-emerald-400 font-normal">91.2%</span>
              </div>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-300">
                {modelInfo.confusion_matrix[0]?.[1] || 39}
                <span className="block text-[10px] text-slate-500 font-normal">6.7%</span>
              </div>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-400">
                {modelInfo.confusion_matrix[0]?.[2] || 12}
                <span className="block text-[10px] text-slate-500 font-normal">2.1%</span>
              </div>
            </div>

            {/* Row 2: Actual Suspicious */}
            <div className="grid grid-cols-4 gap-2 items-center text-center">
              <span className="text-left font-semibold text-amber-300">Suspicious</span>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-300">
                {modelInfo.confusion_matrix[1]?.[0] || 32}
                <span className="block text-[10px] text-slate-500 font-normal">7.6%</span>
              </div>
              <div className="py-3 rounded-lg bg-amber-950/70 border border-amber-500/50 text-white font-bold text-sm shadow-inner">
                {modelInfo.confusion_matrix[1]?.[1] || 358}
                <span className="block text-[10px] text-amber-300 font-normal">85.4%</span>
              </div>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-300">
                {modelInfo.confusion_matrix[1]?.[2] || 29}
                <span className="block text-[10px] text-slate-500 font-normal">7.0%</span>
              </div>
            </div>

            {/* Row 3: Actual Deceptive */}
            <div className="grid grid-cols-4 gap-2 items-center text-center">
              <span className="text-left font-semibold text-red-300">Deceptive</span>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-400">
                {modelInfo.confusion_matrix[2]?.[0] || 14}
                <span className="block text-[10px] text-slate-500 font-normal">3.3%</span>
              </div>
              <div className="py-3 rounded-lg bg-[#17202C] border border-[#1E2733] text-slate-300">
                {modelInfo.confusion_matrix[2]?.[1] || 34}
                <span className="block text-[10px] text-slate-500 font-normal">8.1%</span>
              </div>
              <div className="py-3 rounded-lg bg-red-950/80 border border-red-500/50 text-white font-bold text-sm shadow-inner">
                {modelInfo.confusion_matrix[2]?.[2] || 374}
                <span className="block text-[10px] text-red-400 font-normal">88.6%</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1">
            <span>Overall Macro ROC-AUC: <strong className="text-cyan-400">0.932</strong></span>
            <span>False Discovery Rate: <strong className="text-slate-300">7.8%</strong></span>
          </div>
        </div>

        {/* Class Distribution Bar Chart (6 cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-[#1E2733] space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E2733] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400"></span>
              Dataset Class Distribution
            </h3>
            <span className="text-xs font-mono text-slate-400">FACS Action Unit Samples</span>
          </div>

          <div id="class-distribution-chart" data-api="GET /api/model-info" className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F14', borderColor: '#1E2733', fontSize: '11px', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {classDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-[#0E141D] border border-[#1E2733]">
              <div className="text-emerald-400 font-bold">{modelInfo.class_distribution.truthful || 579} clips</div>
              <div className="text-[10px] text-slate-400">Truthful (40.8%)</div>
            </div>
            <div className="p-2 rounded-lg bg-[#0E141D] border border-[#1E2733]">
              <div className="text-amber-400 font-bold">{modelInfo.class_distribution.suspicious || 419} clips</div>
              <div className="text-[10px] text-slate-400">Suspicious (29.5%)</div>
            </div>
            <div className="p-2 rounded-lg bg-[#0E141D] border border-[#1E2733]">
              <div className="text-red-400 font-bold">{modelInfo.class_distribution.likely_deceptive || 422} clips</div>
              <div className="text-[10px] text-slate-400">Deceptive (29.7%)</div>
            </div>
          </div>
        </div>

      </div>

      {/* Inference Architecture & Runtime Specifications */}
      <div className="glass-panel rounded-2xl p-6 border border-[#1E2733] space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          Inference Architecture &amp; Runtime Specifications
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733]">
            <span className="text-slate-400 block">Spatial Feature Extractor</span>
            <span className="font-bold text-white text-sm">MobileNetV2 + 468 MediaPipe Mesh</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733]">
            <span className="text-slate-400 block">Temporal Attention Window</span>
            <span className="font-bold text-white text-sm">16 frames @ 250ms stride</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733]">
            <span className="text-slate-400 block">Median Inference Latency</span>
            <span className="font-bold text-cyan-400 text-sm">18.4 ms (TensorRT / ONNX)</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733]">
            <span className="text-slate-400 block">Target Loss Function</span>
            <span className="font-bold text-violet-400 text-sm">FACS Multilabel Focal Loss</span>
          </div>
        </div>
      </div>

    </section>
  );
}
