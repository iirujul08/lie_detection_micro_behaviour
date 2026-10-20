import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function DisclaimerBanner({ id = "disclaimer-live", context = "Live" }) {
  return (
    <div
      id={id}
      className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200/90 flex items-start space-x-3 text-xs sm:text-sm"
    >
      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-amber-300">
          {context === 'Live' ? 'Ethical & Forensic Disclaimer:' : 'Analysis Disclaimer:'}
        </span>{' '}
        <span>
          Facial analysis gives probabilistic indicators, not proof of lying. Do not use for legal, hiring, or other high-stakes decisions. Cultural and neurological variations directly impact baseline expressions.
        </span>
      </div>
    </div>
  );
}
