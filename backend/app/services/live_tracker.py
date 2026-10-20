import time
import math
import numpy as np
from typing import Dict, Any, List, Optional
from ..models.schemas import CueAlert

class LiveSessionTracker:
    """
    Stateful real-time tracker for a live WebSocket video session.
    Handles:
    - 5-second baseline calibration (EAR, brow position, lip distance, gaze)
    - Relative cue thresholding against calibrated neutral baseline
    - Exponential moving average (EMA, alpha=0.3) score smoothing
    """
    def __init__(self, calibration_duration_sec: float = 5.0, ema_alpha: float = 0.3):
        self.calibration_duration = calibration_duration_sec
        self.ema_alpha = ema_alpha

        # Session state
        self.first_face_time: Optional[float] = None
        self.is_calibrating: bool = True
        self.calibration_progress: int = 0
        self.frame_count: int = 0

        # Baseline calibration buffers
        self.calib_ears: List[float] = []
        self.calib_brow_dists: List[float] = []
        self.calib_inner_brows: List[float] = []
        self.calib_lip_dists: List[float] = []
        self.calib_gaze_ratios: List[float] = []
        self.calib_blink_times: List[float] = []

        # Established Baselines (computed after calibration)
        self.baseline_ear: float = 0.28
        self.baseline_brow_dist: float = 0.24
        self.baseline_inner_brow: float = 0.36
        self.baseline_lip_dist: float = 0.05
        self.baseline_gaze_ratio: float = 0.50
        self.baseline_blink_rate: float = 16.0  # blinks per minute

        # Live tracking variables
        self.blink_timestamps: List[float] = []
        self.was_blinking: bool = False
        self.smoothed_score: float = 18.0
        self.last_cues: List[CueAlert] = []

    def reset(self):
        """Reset session calibration and history."""
        self.first_face_time = None
        self.is_calibrating = True
        self.calibration_progress = 0
        self.frame_count = 0
        self.calib_ears.clear()
        self.calib_brow_dists.clear()
        self.calib_inner_brows.clear()
        self.calib_lip_dists.clear()
        self.calib_gaze_ratios.clear()
        self.calib_blink_times.clear()
        self.blink_timestamps.clear()
        self.was_blinking = False
        self.smoothed_score = 18.0
        self.last_cues.clear()

    def process_frame(
        self,
        au_features: Dict[str, Any],
        emotions: Dict[str, float],
        timestamp_str: str = "00:00"
    ) -> Dict[str, Any]:
        """
        Process single frame Action Units and return relative cues and smoothed deception score.
        """
        now = time.time()
        self.frame_count += 1

        if self.first_face_time is None:
            self.first_face_time = now

        elapsed = now - self.first_face_time
        ear = au_features.get("eye_aspect_ratio", 0.28)
        lip_aperture = au_features.get("lip_press", 0.0) # aperture / proxy
        gaze_ratio = au_features.get("gaze_ratio", 0.50)
        brow_raise = au_features.get("brow_raise", 0.0)
        brow_furrow = au_features.get("brow_furrow", 0.0)

        # -------------------------------------------------------------
        # 1. Calibration Phase (First 5 seconds)
        # -------------------------------------------------------------
        if elapsed < self.calibration_duration:
            self.is_calibrating = True
            self.calibration_progress = min(100, int((elapsed / self.calibration_duration) * 100))

            self.calib_ears.append(ear)
            self.calib_gaze_ratios.append(gaze_ratio)
            self.calib_brow_dists.append(brow_raise)
            self.calib_inner_brows.append(brow_furrow)
            self.calib_lip_dists.append(lip_aperture)

            # Detect blinks during calibration
            is_blink = ear < 0.18
            if is_blink and not self.was_blinking:
                self.calib_blink_times.append(now)
            self.was_blinking = is_blink

            # Constant resting score during calibration
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
                        "desc": "Please look straight ahead and maintain a relaxed, neutral expression"
                    }
                ],
                "baseline": {
                    "ear": round(np.mean(self.calib_ears) if self.calib_ears else ear, 3),
                    "gaze_ratio": round(np.mean(self.calib_gaze_ratios) if self.calib_gaze_ratios else gaze_ratio, 2)
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
            if self.calib_brow_dists:
                self.baseline_brow_dist = float(np.median(self.calib_brow_dists))
            if self.calib_inner_brows:
                self.baseline_inner_brow = float(np.median(self.calib_inner_brows))
            if self.calib_lip_dists:
                self.baseline_lip_dist = float(np.median(self.calib_lip_dists))
            
            calib_blinks_count = len(self.calib_blink_times)
            self.baseline_blink_rate = max(10.0, (calib_blinks_count / self.calibration_duration) * 60.0)

        # -------------------------------------------------------------
        # 2. Score cues relative to calibrated baseline
        # -------------------------------------------------------------
        cues: List[Dict[str, Any]] = []
        raw_score = 12.0  # Resting baseline score

        # A. Eye Blink & Blink Rate tracking
        is_blink = ear < max(0.16, self.baseline_ear * 0.68)
        if is_blink and not self.was_blinking:
            self.blink_timestamps.append(now)
        self.was_blinking = is_blink

        # Rolling 10s blink rate
        self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= 10.0]
        recent_blink_rate = len(self.blink_timestamps) * 6.0  # extrapolate to /min

        if recent_blink_rate > max(28.0, self.baseline_blink_rate * 1.75):
            raw_score += 15.0
            cues.append({
                "time": timestamp_str,
                "text": f"Blink Rate Surge ({int(recent_blink_rate)}/min)",
                "severity": "amber",
                "desc": "Elevated blink frequency indicating cognitive stress or suppression"
            })

        # B. Gaze Aversion via iris offset
        gaze_offset = abs(gaze_ratio - self.baseline_gaze_ratio)
        if gaze_offset > 0.16 or au_features.get("gaze_aversion", False):
            raw_score += 16.0
            cues.append({
                "time": timestamp_str,
                "text": "Gaze Aversion & Saccadic Shift",
                "severity": "amber",
                "desc": "Involuntary ocular diversion away from calibrated central axis"
            })

        # C. Lip Press / Compression (AU24)
        # lip_press intensity or aperture drop
        if au_features.get("lip_press", 0.0) > 0.38:
            added = 18.0 * au_features["lip_press"]
            raw_score += added
            cues.append({
                "time": timestamp_str,
                "text": "Lip Press & Aperture Narrowing (AU24)",
                "severity": "red",
                "desc": "Verbal concealment tension and active hesitation marker"
            })

        # D. Eyebrow Raise (AU1+AU2)
        if brow_raise > 0.35:
            added = 14.0 * brow_raise
            raw_score += added
            cues.append({
                "time": timestamp_str,
                "text": "Eyebrow Raise (AU1+AU2)",
                "severity": "amber",
                "desc": "Cognitive retrieval marker or simulated surprise"
            })

        # E. Brow Furrow / Lowerer (AU4)
        if brow_furrow > 0.40:
            added = 16.0 * brow_furrow
            raw_score += added
            cues.append({
                "time": timestamp_str,
                "text": "Brow Lowerer & Furrow (AU4)",
                "severity": "red",
                "desc": "Severe cognitive load or suppressed negative reaction"
            })

        # F. Mouth Asymmetry / Contempt (AU14)
        if au_features.get("mouth_asymmetry", 0.0) > 0.38:
            added = 15.0 * au_features["mouth_asymmetry"]
            raw_score += added
            cues.append({
                "time": timestamp_str,
                "text": "Unilateral Dimpler & Asymmetry (AU14)",
                "severity": "red",
                "desc": "Micro-contempt or asymmetric emotional masking"
            })

        # G. Emotional Tension contributions
        tension = (
            (emotions.get("fear", 0.0) * 0.22) +
            (emotions.get("contempt", 0.0) * 0.22) +
            (emotions.get("disgust", 0.0) * 0.18) +
            (emotions.get("angry", 0.0) * 0.15)
        )
        raw_score += tension

        # Truthful indicators reduce score
        if emotions.get("neutral", 0.0) > 65.0 and len(cues) == 0:
            raw_score = max(6.0, raw_score - 8.0)
        elif emotions.get("happy", 0.0) > 40.0 and au_features.get("mouth_asymmetry", 0.0) < 0.20:
            raw_score = max(8.0, raw_score - 10.0)
            cues.append({
                "time": timestamp_str,
                "text": "Symmetric Zygomatic Smile (AU12)",
                "severity": "emerald",
                "desc": "Authentic bilateral facial relaxation concordant with truthfulness"
            })

        # Clamp raw score
        clamped_raw = max(5.0, min(98.5, raw_score))

        # -------------------------------------------------------------
        # 3. Exponential Moving Average (EMA, alpha=0.3)
        # -------------------------------------------------------------
        self.smoothed_score = (self.ema_alpha * clamped_raw) + ((1.0 - self.ema_alpha) * self.smoothed_score)
        final_score = round(float(self.smoothed_score), 1)

        # Label classification
        if final_score >= 70.0:
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
                "blink_rate": round(self.baseline_blink_rate, 1)
            }
        }
