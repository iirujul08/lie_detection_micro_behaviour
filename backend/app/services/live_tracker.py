import time
import math
import numpy as np
from typing import Dict, Any, List, Optional
from ..models.schemas import CueAlert

class LiveSessionTracker:
    """
    Stateful forensic tracker for live WebSocket lie detection sessions.
    Aggressive Forensic Mode:
    - 5-second personal baseline calibration
    - Relative deviation detection against personal baseline
    - Multi-cue forensic clustering with aggressive multipliers (3+ cues → 2.2x)
    - Sustained-cue compounding bonus (up to +60% per sustained cue)
    - Fast EMA smoothing (alpha=0.55) so score climbs rapidly
    """
    def __init__(self, calibration_duration_sec: float = 5.0, ema_alpha: float = 0.55):
        self.calibration_duration = calibration_duration_sec
        self.ema_alpha = ema_alpha

        # Session state
        self.first_face_time: Optional[float] = None
        self.is_calibrating: bool = True
        self.calibration_progress: int = 0
        self.frame_count: int = 0

        # Calibration buffers
        self.calib_ears: List[float] = []
        self.calib_gaze_ratios: List[float] = []
        self.calib_inner_brows: List[float] = []
        self.calib_brow_dists: List[float] = []
        self.calib_lip_apertures: List[float] = []
        self.calib_mouth_widths: List[float] = []
        self.calib_mouth_asyms: List[float] = []
        self.calib_blink_times: List[float] = []

        # Established Baselines (computed after 5s)
        self.baseline_ear: float = 0.28
        self.baseline_gaze_ratio: float = 0.50
        self.baseline_inner_brow: float = 0.35
        self.baseline_brow_dist: float = 0.22
        self.baseline_lip_aperture: float = 0.04
        self.baseline_mouth_width: float = 0.45
        self.baseline_mouth_asym: float = 0.04
        self.baseline_blink_rate: float = 16.0  # blinks per minute

        # Tracking state
        self.blink_timestamps: List[float] = []
        self.was_blinking: bool = False
        self.smoothed_score: float = 15.0

        # Sustained-cue tracking: maps cue-key -> consecutive active frame count
        self.sustained_cue_counts: Dict[str, int] = {
            "blink":      0,
            "gaze":       0,
            "lip_press":  0,
            "brow_lower": 0,
            "brow_raise": 0,
            "asym":       0,
        }

    def reset(self):
        """Reset session calibration and history."""
        self.first_face_time = None
        self.is_calibrating = True
        self.calibration_progress = 0
        self.frame_count = 0
        self.calib_ears.clear()
        self.calib_gaze_ratios.clear()
        self.calib_inner_brows.clear()
        self.calib_brow_dists.clear()
        self.calib_lip_apertures.clear()
        self.calib_mouth_widths.clear()
        self.calib_mouth_asyms.clear()
        self.calib_blink_times.clear()
        self.blink_timestamps.clear()
        self.was_blinking = False
        self.smoothed_score = 15.0
        for k in self.sustained_cue_counts:
            self.sustained_cue_counts[k] = 0

    def _sustained_bonus(self, key: str, active: bool, base_weight: float) -> float:
        """
        If cue is active, increment the sustained counter and return a compounding bonus.
        Bonus grows linearly up to +60% of base_weight after 10 consecutive frames.
        """
        if active:
            self.sustained_cue_counts[key] = min(self.sustained_cue_counts[key] + 1, 10)
        else:
            self.sustained_cue_counts[key] = 0
            return 0.0
        frames = self.sustained_cue_counts[key]
        bonus_frac = min(0.60, (frames - 1) * 0.07)
        return base_weight * bonus_frac

    def process_frame(
        self,
        au_features: Dict[str, Any],
        emotions: Dict[str, float],
        timestamp_str: str = "00:00"
    ) -> Dict[str, Any]:
        now = time.time()
        self.frame_count += 1

        if self.first_face_time is None:
            self.first_face_time = now

        elapsed = now - self.first_face_time

        # Extract raw physical measurements
        ear = au_features.get("eye_aspect_ratio", 0.28)
        gaze_ratio = au_features.get("gaze_ratio", 0.50)
        inner_brow = au_features.get("raw_inner_brow", 0.35)
        brow_dist = au_features.get("raw_brow_dist", 0.22)
        lip_apt = au_features.get("raw_lip_aperture", 0.04)
        mouth_w = au_features.get("raw_mouth_width", 0.45)
        mouth_asym = au_features.get("mouth_asymmetry", 0.04)

        # -------------------------------------------------------------
        # 1. Calibration Phase (First 5 seconds)
        # -------------------------------------------------------------
        if elapsed < self.calibration_duration:
            self.is_calibrating = True
            self.calibration_progress = min(100, int((elapsed / self.calibration_duration) * 100))

            self.calib_ears.append(ear)
            self.calib_gaze_ratios.append(gaze_ratio)
            self.calib_inner_brows.append(inner_brow)
            self.calib_brow_dists.append(brow_dist)
            self.calib_lip_apertures.append(lip_apt)
            self.calib_mouth_widths.append(mouth_w)
            self.calib_mouth_asyms.append(mouth_asym)

            # Record blinks
            is_blink = ear < 0.17
            if is_blink and not self.was_blinking:
                self.calib_blink_times.append(now)
            self.was_blinking = is_blink

            self.smoothed_score = 15.0
            return {
                "score": 15.0,
                "raw_score": 15.0,
                "label": "Calibrating...",
                "is_calibrating": True,
                "calibration_progress": self.calibration_progress,
                "cues": [
                    {
                        "time": timestamp_str,
                        "text": "Calibrating baseline biometrics...",
                        "severity": "cyan",
                        "desc": "Please look straight ahead with a relaxed, neutral expression"
                    }
                ],
                "baseline": {
                    "ear": round(float(np.median(self.calib_ears)) if self.calib_ears else ear, 3),
                    "gaze_ratio": round(float(np.median(self.calib_gaze_ratios)) if self.calib_gaze_ratios else gaze_ratio, 2)
                }
            }

        # Finalize calibration once
        if self.is_calibrating:
            self.is_calibrating = False
            self.calibration_progress = 100
            if self.calib_ears:
                self.baseline_ear = float(np.median(self.calib_ears))
            if self.calib_gaze_ratios:
                self.baseline_gaze_ratio = float(np.median(self.calib_gaze_ratios))
            if self.calib_inner_brows:
                self.baseline_inner_brow = float(np.median(self.calib_inner_brows))
            if self.calib_brow_dists:
                self.baseline_brow_dist = float(np.median(self.calib_brow_dists))
            if self.calib_lip_apertures:
                self.baseline_lip_aperture = float(np.median(self.calib_lip_apertures))
            if self.calib_mouth_widths:
                self.baseline_mouth_width = float(np.median(self.calib_mouth_widths))
            if self.calib_mouth_asyms:
                self.baseline_mouth_asym = float(np.median(self.calib_mouth_asyms))

            calib_blinks_count = len(self.calib_blink_times)
            self.baseline_blink_rate = max(10.0, (calib_blinks_count / self.calibration_duration) * 60.0)

        # -------------------------------------------------------------
        # 2. Aggressive Forensic Scoring Engine (Cluster + Sustained Model)
        # -------------------------------------------------------------
        cues: List[Dict[str, Any]] = []
        cue_weight = 0.0

        # Baseline resting deception score
        base_score = 10.0

        # ── A. Eye Blink Acceleration ─────────────────────────────────
        is_blink = ear < max(0.15, self.baseline_ear * 0.65)
        if is_blink and not self.was_blinking:
            self.blink_timestamps.append(now)
        self.was_blinking = is_blink

        self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= 8.0]
        recent_blink_rate = (len(self.blink_timestamps) / 8.0) * 60.0

        blink_base = 14.0
        blink_active = recent_blink_rate > max(24.0, self.baseline_blink_rate * 1.6)
        if blink_active:
            cue_weight += blink_base + self._sustained_bonus("blink", True, blink_base)
            cues.append({
                "time": timestamp_str,
                "text": f"Blink Acceleration ({int(recent_blink_rate)}/min)",
                "severity": "amber",
                "desc": "Elevated rapid blink frequency indicating autonomic cognitive stress"
            })
        else:
            self._sustained_bonus("blink", False, blink_base)

        # ── B. Saccadic Gaze Aversion ─────────────────────────────────
        gaze_offset = abs(gaze_ratio - self.baseline_gaze_ratio)
        gaze_base = 18.0
        gaze_active = gaze_offset > 0.10  # Lowered threshold (was 0.14)
        if gaze_active:
            scaled = min(gaze_base * 1.5, gaze_base + gaze_offset * 60.0)
            cue_weight += scaled + self._sustained_bonus("gaze", True, gaze_base)
            cues.append({
                "time": timestamp_str,
                "text": "Saccadic Gaze Aversion",
                "severity": "amber",
                "desc": "Ocular displacement away from central focal axis during cognition"
            })
        else:
            self._sustained_bonus("gaze", False, gaze_base)

        # ── C. AU24: Lip Compression / Press ─────────────────────────
        lip_base = 20.0
        lip_active = (
            self.baseline_lip_aperture > 0.010
            and lip_apt < (self.baseline_lip_aperture * 0.70)  # Loosened from 0.62
        )
        if lip_active:
            ratio = max(0.0, 1.0 - lip_apt / max(0.001, self.baseline_lip_aperture))
            scaled = min(lip_base * 1.6, lip_base + ratio * 18.0)
            cue_weight += scaled + self._sustained_bonus("lip_press", True, lip_base)
            cues.append({
                "time": timestamp_str,
                "text": "Lip Compression & Press (AU24)",
                "severity": "red",
                "desc": "Verbal hesitation marker and cognitive concealment tension"
            })
        else:
            self._sustained_bonus("lip_press", False, lip_base)

        # ── D. AU4: Brow Lowerer & Furrow ────────────────────────────
        brow_lower_base = 18.0
        brow_lower_active = inner_brow < (self.baseline_inner_brow * 0.88)  # Loosened from 0.84
        if brow_lower_active:
            depth = max(0.0, self.baseline_inner_brow - inner_brow) / max(0.001, self.baseline_inner_brow)
            scaled = min(brow_lower_base * 1.5, brow_lower_base + depth * 20.0)
            cue_weight += scaled + self._sustained_bonus("brow_lower", True, brow_lower_base)
            cues.append({
                "time": timestamp_str,
                "text": "Brow Lowerer & Furrow (AU4)",
                "severity": "red",
                "desc": "Acute cognitive load and suppressed disagreement tension"
            })
        else:
            self._sustained_bonus("brow_lower", False, brow_lower_base)

        # ── E. AU1+2: Brow Raise ─────────────────────────────────────
        brow_raise_base = 12.0
        brow_raise_active = brow_dist > (self.baseline_brow_dist * 1.18)  # Loosened from 1.22
        if brow_raise_active:
            cue_weight += brow_raise_base + self._sustained_bonus("brow_raise", True, brow_raise_base)
            cues.append({
                "time": timestamp_str,
                "text": "Eyebrow Raise (AU1+2)",
                "severity": "amber",
                "desc": "Exaggerated surprise marker or cognitive retrieval query"
            })
        else:
            self._sustained_bonus("brow_raise", False, brow_raise_base)

        # ── F. AU14: Unilateral Micro-Contempt ───────────────────────
        asym_base = 20.0
        asym_active = mouth_asym > max(0.09, self.baseline_mouth_asym * 2.0)  # Loosened from 0.11 / 2.2
        if asym_active:
            depth = max(0.0, mouth_asym - self.baseline_mouth_asym) * 80.0
            scaled = min(asym_base * 1.6, asym_base + depth)
            cue_weight += scaled + self._sustained_bonus("asym", True, asym_base)
            cues.append({
                "time": timestamp_str,
                "text": "Unilateral Lip Asymmetry (AU14)",
                "severity": "red",
                "desc": "Micro-contempt or asymmetric emotional masking"
            })
        else:
            self._sustained_bonus("asym", False, asym_base)

        # ── G. Aggressive Co-Occurrence Synergy Multiplier ───────────
        # 3+ cues → 2.2x | 2 cues → 1.65x | 1 cue → 0.85x (slight damp only)
        active_cue_count = len(cues)
        if active_cue_count >= 3:
            cue_weight *= 2.2
        elif active_cue_count == 2:
            cue_weight *= 1.65
        elif active_cue_count == 1:
            cue_weight *= 0.85

        raw_score = base_score + cue_weight

        # ── H. Emotional Concordance vs Tension ──────────────────────
        is_smiling = mouth_w > (self.baseline_mouth_width * 1.08) and mouth_asym < 0.08
        if is_smiling:
            raw_score = max(8.0, raw_score - 12.0)
            cues.append({
                "time": timestamp_str,
                "text": "Bilateral Concordant Smile (AU12)",
                "severity": "emerald",
                "desc": "Authentic relaxed expression concordant with truthfulness"
            })
        elif emotions.get("neutral", 0.0) > 75.0 and active_cue_count == 0:
            raw_score = max(8.0, raw_score - 5.0)

        # FACS tension emotion contribution (raised weights)
        facs_tension = (
            (emotions.get("contempt", 0.0) * 0.22) +
            (emotions.get("fear",    0.0) * 0.22) +
            (emotions.get("angry",   0.0) * 0.18)
        )
        raw_score += facs_tension

        # Clamp raw score between 6.0 and 99.0
        clamped_raw = max(6.0, min(99.0, raw_score))

        # -------------------------------------------------------------
        # 3. Fast EMA Smoothing (alpha=0.55 → rises in ~4-5 frames)
        # -------------------------------------------------------------
        self.smoothed_score = (self.ema_alpha * clamped_raw) + ((1.0 - self.ema_alpha) * self.smoothed_score)
        final_score = round(float(self.smoothed_score), 1)

        # Categorical Forensic Assessment Label
        if final_score >= 65.0:
            label = "Likely Deceptive"
        elif final_score >= 38.0:
            label = "Suspicious"
        else:
            label = "Truthful"

        return {
            "score": final_score,
            "raw_score": round(clamped_raw, 1),
            "label": label,
            "is_calibrating": False,
            "calibration_progress": 100,
            "cues": cues,
            "baseline": {
                "ear": round(self.baseline_ear, 3),
                "gaze_ratio": round(self.baseline_gaze_ratio, 2),
                "lip_aperture": round(self.baseline_lip_aperture, 3),
                "inner_brow": round(self.baseline_inner_brow, 3),
                "blink_rate": round(self.baseline_blink_rate, 1)
            }
        }
