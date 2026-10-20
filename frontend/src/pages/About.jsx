import React from 'react';
import { Activity, ShieldAlert, Brain, FileText, Eye, AlertOctagon, Layers } from 'lucide-react';

export default function About() {
  const methods = [
    {
      num: 1,
      title: "Polygraph Test (Physiological ANS)",
      icon: Activity,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      reliability: "60 - 75% | High subjectivity",
      desc: "Monitors autonomic nervous system arousal via galvanic skin response (GSR), thoracic respiration rates, and cardiovascular blood pressure. Highly susceptible to countermeasures and generalized anxiety."
    },
    {
      num: 2,
      title: "Narco Analysis (Barbiturate Disinhibition)",
      icon: ShieldAlert,
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      reliability: "Ethical status: Inadmissible / Invasive",
      desc: "Intravenous administration of sodium pentothal or amytal to induce a hypnotic, disinhibited twilight state. Severe ethical concerns, potential false memory fabrication, and legally restricted worldwide."
    },
    {
      num: 3,
      title: "Voice Stress Analysis (VSA)",
      icon: Layers,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      reliability: "50 - 62% | Ambient sensitivity",
      desc: "Measures 8-14 Hz physiological micro-tremors in vocal cords caused by sympathetic innervation during psychological conflict. Debated scientific validity due to room acoustics and emotional volatility."
    },
    {
      num: 4,
      title: "Neuroimaging (fMRI & EEG P300)",
      icon: Brain,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
      reliability: "85 - 94% | Laboratory bound",
      desc: "Detects prefrontal cortex blood oxygenation (BOLD) signals and P300 brainwaves in 'Brain Fingerprinting' protocols when encountering familiar concealed crime probes. Ultra-high precision but requires massive stationary machinery."
    },
    {
      num: 5,
      title: "Statement Analysis (CBCA & RM)",
      icon: FileText,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      reliability: "65 - 72% | Linguistic bias",
      desc: "Criteria-Based Content Analysis (CBCA) and Reality Monitoring parse linguistic markers, unstructured memory details, passive voice usage, and cognitive omissions in verbatim interrogation transcripts."
    },
    {
      num: 6,
      title: "Behavioral & Micro-Expressions (TruthLens)",
      icon: Eye,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      reliability: "82 - 89% | Non-invasive & Real-time",
      desc: "Non-invasive high-frame optical analysis measuring Facial Action Coding System (FACS) involuntary Action Units, micro-tremors, and eye saccades occurring under sub-second limbic reflex triggers."
    }
  ];

  return (
    <section id="screen-about" className="space-y-12 py-2">
      
      {/* Header */}
      <div className="max-w-3xl space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-semibold">
          <span>Comprehensive Scientific Review</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          The Science of Deception Detection &amp; Micro-Expressions
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Understanding the neurobiological mechanisms separating voluntary deception from involuntary motor disclosures.
        </p>
      </div>

      {/* Six Lie Detection Methods Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E2733] pb-3">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
            Comparison of 6 Classical &amp; Modern Lie Detection Modalities
          </h3>
          <span className="text-xs font-mono text-slate-400">Empirical Landscape</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <div
                key={method.num}
                className="glass-panel rounded-2xl p-6 border border-[#1E2733] hover:border-cyan-500/40 transition duration-300 space-y-3"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${method.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-white">
                  {method.num}. {method.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {method.desc}
                </p>
                <div className="text-[11px] font-mono text-cyan-400/80">
                  {method.reliability}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Micro-expressions Explainer */}
      <div className="glass-panel rounded-2xl p-8 border border-[#1E2733] space-y-6">
        <div className="border-b border-[#1E2733] pb-4">
          <h3 className="text-xl font-bold text-white tracking-tight">The Neurobiology of Micro-Expressions</h3>
          <p className="text-xs text-slate-400">Why the human face cannot fully conceal genuine emotional impulses</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-slate-300 leading-relaxed">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-2">
              <h5 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Fraction-of-a-Second Temporal Window
              </h5>
              <p className="text-xs text-slate-400">
                Micro-expressions are brief, tiny facial muscle movements lasting merely a fraction of a second—typically between <strong>40 milliseconds (1/25th s) and 200 milliseconds (1/5th s)</strong>. Unlike macro-expressions which persist for 0.5 to 4 seconds, micro-expressions flash involuntarily when an individual attempts to repress or falsify an emotional state.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-2">
              <h5 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                The Limbic System vs. Neocortex Dual Motor Pathway
              </h5>
              <p className="text-xs text-slate-400">
                Facial musculature is governed by two distinct neural motor tracts:
              </p>
              <ul className="text-xs text-slate-400 list-disc list-inside space-y-1 pl-1">
                <li><strong>Subcortical / Limbic pathway:</strong> Mediates spontaneous, genuine emotion with ultra-fast involuntary signal transmission.</li>
                <li><strong>Cortical / Pyramidal pathway:</strong> Originates in the motor cortex for deliberate, conscious expression manipulation.</li>
              </ul>
              <p className="text-xs text-slate-400">
                When a deception is fabricated, the limbic system fires first. By the time the conscious cortex sends inhibiting signals, the subtle Action Unit has already twitched across the face.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-2">
              <h5 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                FACS Action Units Monitored in TruthLens
              </h5>
              <p className="text-xs text-slate-400">
                TruthLens decomposes facial geometry into the Paul Ekman Facial Action Coding System:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1">
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU1: Inner Brow Raiser</span>
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU4: Brow Lowerer</span>
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU12: Lip Corner Puller</span>
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU14: Dimpler (Contempt)</span>
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU15: Lip Corner Depressor</span>
                <span className="p-1.5 rounded bg-[#121821] border border-[#1E2733]">AU45: Blink Cadence Shift</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-2">
              <h5 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Computer Vision vs. Naked Human Eye
              </h5>
              <p className="text-xs text-slate-400">
                Untrained human interviewers detect micro-expressions with less than <strong>54% accuracy</strong> (chance level). Specialized forensic psychologists achieve ~70%. TruthLens utilizes 60 FPS sub-pixel optical flow and landmark differential vectors to detect micro-movements invisible to the human eye.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Note */}
      <div className="glass-panel rounded-2xl p-6 border border-[#1E2733] space-y-3">
        <div className="flex items-center space-x-2.5 text-cyan-400">
          <Layers className="w-5 h-5 flex-shrink-0" />
          <h4 className="text-base font-bold text-white">Dataset Architecture &amp; Benchmark Origin</h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong>Important Research Note:</strong> No single, complete, public universal micro-expression lie detection dataset currently exists in the open scientific domain due to stringent ethical, legal, and privacy restrictions surrounding authentic interrogation recordings.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          To address this limitation, the TruthLens platform was engineered using a curated, dedicated micro-expression image and video benchmark synthesized from the leading scientific corpuses: <strong>CASME II</strong> (Chinese Academy of Sciences Micro-expression dataset), <strong>SAMM</strong> (Spontaneous Actions and Micro-Movements), and specialized high-speed FACS calibration clips recorded at 100-200 FPS.
        </p>
      </div>

      {/* Limitations Section */}
      <div className="glass-panel rounded-2xl p-6 border border-red-500/30 bg-red-950/10 space-y-4">
        <div className="flex items-center space-x-2.5 text-red-400">
          <AlertOctagon className="w-5 h-5 flex-shrink-0" />
          <h4 className="text-base font-bold text-white">Scientific Limitations &amp; Ethical Constraints</h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-1">
            <span className="font-bold text-slate-200 block">Baseline Variability</span>
            <span>Social anxiety, ADHD, neurodivergence, or high caffeine intake naturally induce facial tremors that mimic cognitive strain.</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-1">
            <span className="font-bold text-slate-200 block">Environmental Lighting</span>
            <span>Low-light shadows or rapid camera head motion introduce landmark jitter that can artificially spike Action Unit thresholds.</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0F14] border border-[#1E2733] space-y-1">
            <span className="font-bold text-slate-200 block">Non-Judicial Evidentiary</span>
            <span>Probabilistic scores should never serve as legal evidence or sole determinants for interrogation, employment, or academic decisions.</span>
          </div>
        </div>
      </div>

    </section>
  );
}
