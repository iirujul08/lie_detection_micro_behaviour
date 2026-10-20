import time
import math
import numpy as np
from typing import Dict, Any, List, Optional
from ..models.schemas import CueAlert

class LiveSessionTracker:
    """
    Stateful forensic tracker for live WebSocket lie detection sessions.
    Implements Balanced Forensic Mode:
    - 5-second personal baseline calibration (EAR, gaze, brow furrow, brow raise, lip aperture)
    - Relative deviation detection against personal baseline
    - Multi-cue forensic clustering (isolated cues stay Truthful; co-occurring cue clusters raise to Suspicious / Likely Deceptive)
    - Responsive Exponential Moving Average (EMA alpha=0.35) score smoothing
    """
    def __init__(self, calibration_duration_sec: float = 5.0, ema_alpha: float = 0.35):
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
        # 2. Balanced Forensic Scoring Engine (Cluster Multi-Cue Model)
        # -------------------------------------------------------------
        cues: List[Dict[str, Any]] = []
        cue_weight = 0.0

        # Baseline resting deception score
        base_score = 12.0

        # A. Eye Blink & Acceleration Detection
        is_blink = ear < max(0.15, self.baseline_ear * 0.65)
        if is_blink and not self.was_blinking:
            self.blink_timestamps.append(now)
        self.was_blinking = is_blink

        # Rolling 8s blink rate
        self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= 8.0]
        recent_blink_rate = (len(self.blink_timestamps) / 8.0) * 60.0

        if recent_blink_rate > max(28.0, self.baseline_blink_rate * 1.85):
            cue_weight += 12.0
            cues.append({
                "time": timestamp_str,
                "text": f"Blink Acceleration ({int(recent_blink_rate)}/min)",
                "severity": "amber",
                "desc": "Elevated rapid blink frequency indicating autonomic cognitive stress"
            })

        # B. Saccadic Gaze Aversion (Ocular diversion from calibrated center)
        gaze_offset = abs(gaze_ratio - self.baseline_gaze_ratio)
        if gaze_offset > 0.14:
            cue_weight += 14.0
            cues.append({
                "time": timestamp_str,
                "text": "Saccadic Gaze Aversion",
                "severity": "amber",
                "desc": "Ocular displacement away from central focal axis during cognition"
            })

        # C. AU24: Lip Compression / Press (Tightening relative to baseline aperture)
        if self.baseline_lip_aperture > 0.015 and lip_apt < (self.baseline_lip_aperture * 0.62):
            cue_weight += 16.0
            cues.append({
                "time": timestamp_str,
                "text": "Lip Compression & Press (AU24)",
                "severity": "red",
                "desc": "Verbal hesitation marker and cognitive concealment tension"
            })

        # D. AU4: Brow Lowerer & Furrow (Inner brow knit relative to baseline)
        if inner_brow < (self.baseline_inner_brow * 0.84):
            cue_weight += 16.0
            cues.append({
                "time": timestamp_str,
                "text": "Brow Lowerer & Furrow (AU4)",
                "severity": "red",
                "desc": "Acute cognitive load and suppressed disagreement tension"
            })

        # E. AU1+2: Brow Raise (Height above baseline)
        if brow_dist > (self.baseline_brow_dist * 1.22):
            cue_weight += 10.0
            cues.append({
                "time": timestamp_str,
                "text": "Eyebrow Raise (AU1+2)",
                "severity": "amber",
                "desc": "Exaggerated surprise marker or cognitive retrieval query"
            })

        # F. AU14: Unilateral Dimpler / Micro-Contempt (Roll-compensated asymmetry)
        if mouth_asym > max(0.11, self.baseline_mouth_asym * 2.2):
            cue_weight += 16.0
            cues.append({
                "time": timestamp_str,
                "text": "Unilateral Lip Asymmetry (AU14)",
                "severity": "red",
                "desc": "Micro-contempt or asymmetric emotional masking"
            })

        # G. Forensic Co-Occurrence Synergy Multiplier:
        # In validated forensic behavioral analysis, isolated cues do not prove deceit.
        # True deceit manifests as CONGRUENT CLUSTERS of simultaneous cues.
        active_cue_count = len(cues)
        if active_cue_count >= 3:
            # 3+ co-occurring cues -> high synergy multiplier
            cue_weight *= 1.45
        elif active_cue_count == 2:
            # 2 co-occurring cues -> moderate synergy multiplier
            cue_weight *= 1.15
        elif active_cue_count == 1:
            # Single isolated cue -> damp to prevent false alarms
            cue_weight *= 0.70

        raw_score = base_score + cue_weight

        # H. Emotional Concordance vs Tension
        # Genuine bilateral smile decreases deception likelihood
        is_smiling = mouth_w > (self.baseline_mouth_width * 1.08) and mouth_asym < 0.08
        if is_smiling:
            raw_score = max(8.0, raw_score - 14.0)
            cues.append({
                "time": timestamp_str,
                "text": "Bilateral Concordant Smile (AU12)",
                "severity": "emerald",
                "desc": "Authentic relaxed expression concordant with truthfulness"
            })
        elif emotions.get("neutral", 0.0) > 75.0 and active_cue_count == 0:
            raw_score = max(8.0, raw_score - 5.0)

        # Subtle contribution from verified FACS negative micro-expressions
        facs_tension = (
            (emotions.get("contempt", 0.0) * 0.15) +
            (emotions.get("fear", 0.0) * 0.15) +
            (emotions.get("angry", 0.0) * 0.12)
        )
        raw_score += facs_tension

        # Clamp raw score between 5.0 and 96.0
        clamped_raw = max(6.0, min(96.0, raw_score))

        # -------------------------------------------------------------
        # 3. Exponential Moving Average Smoothing (alpha=0.35)
        # -------------------------------------------------------------
        self.smoothed_score = (self.ema_alpha * clamped_raw) + ((1.0 - self.ema_alpha) * self.smoothed_score)
        final_score = round(float(self.smoothed_score), 1)

        # Categorical Forensic Assessment Label
        if final_score >= 68.0:
            label = "Likely Deceptive"
        elif final_score >= 40.0:
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
