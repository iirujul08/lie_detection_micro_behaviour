import pytest
import time
import numpy as np
from backend.app.services.live_tracker import LiveSessionTracker
from backend.app.services.landmark_extractor import landmark_extractor

def test_live_session_tracker_calibration():
    tracker = LiveSessionTracker(calibration_duration_sec=1.0, ema_alpha=0.3)
    
    # Simulate neutral baseline frames during calibration
    au_neutral = {
        "eye_aspect_ratio": 0.28,
        "lip_press": 0.05,
        "gaze_ratio": 0.50,
        "brow_raise": 0.10,
        "brow_furrow": 0.10,
        "mouth_asymmetry": 0.05
    }
    emotions_neutral = {
        "happy": 5.0, "sad": 2.0, "angry": 1.0, "fear": 1.0,
        "surprise": 2.0, "disgust": 1.0, "contempt": 1.0, "neutral": 87.0
    }

    # First frame -> calibrating
    res = tracker.process_frame(au_neutral, emotions_neutral)
    assert res["is_calibrating"] is True
    assert res["score"] == 15.0
    assert "Calibrating" in res["label"]

    # Sleep past calibration duration
    time.sleep(1.05)

    # Post-calibration frame
    res2 = tracker.process_frame(au_neutral, emotions_neutral)
    assert res2["is_calibrating"] is False
    assert res2["calibration_progress"] == 100
    assert res2["label"] == "Truthful"
    assert res2["score"] < 30.0

def test_live_session_tracker_lip_press_cue():
    tracker = LiveSessionTracker(calibration_duration_sec=0.1, ema_alpha=0.3)
    au_neutral = {"eye_aspect_ratio": 0.28, "lip_press": 0.02, "gaze_ratio": 0.50, "brow_raise": 0.0, "brow_furrow": 0.0}
    emotions = {"neutral": 80.0, "fear": 2.0, "contempt": 2.0, "disgust": 2.0, "angry": 2.0, "happy": 5.0, "sad": 4.0, "surprise": 3.0}

    # Calibrate
    tracker.process_frame(au_neutral, emotions)
    time.sleep(0.15)
    tracker.process_frame(au_neutral, emotions)

    # Trigger lip press cue
    au_lip_press = {"eye_aspect_ratio": 0.28, "lip_press": 0.75, "gaze_ratio": 0.50, "brow_raise": 0.0, "brow_furrow": 0.0}
    res = tracker.process_frame(au_lip_press, emotions)
    cue_texts = [c["text"] for c in res["cues"]]
    assert any("Lip Press" in t for t in cue_texts)

def test_live_session_tracker_gaze_aversion_cue():
    tracker = LiveSessionTracker(calibration_duration_sec=0.1, ema_alpha=0.3)
    au_neutral = {"eye_aspect_ratio": 0.28, "lip_press": 0.02, "gaze_ratio": 0.50, "brow_raise": 0.0, "brow_furrow": 0.0}
    emotions = {"neutral": 80.0, "fear": 2.0, "contempt": 2.0, "disgust": 2.0, "angry": 2.0, "happy": 5.0, "sad": 4.0, "surprise": 3.0}

    tracker.process_frame(au_neutral, emotions)
    time.sleep(0.15)
    tracker.process_frame(au_neutral, emotions)

    # Gaze averted to side
    au_gaze = {"eye_aspect_ratio": 0.28, "lip_press": 0.02, "gaze_ratio": 0.82, "brow_raise": 0.0, "brow_furrow": 0.0}
    res = tracker.process_frame(au_gaze, emotions)
    cue_texts = [c["text"] for c in res["cues"]]
    assert any("Gaze Aversion" in t for t in cue_texts)
