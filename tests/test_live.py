import pytest
import time
import numpy as np
from backend.app.services.live_tracker import LiveSessionTracker
from backend.app.services.landmark_extractor import landmark_extractor

def test_live_session_tracker_calibration():
    tracker = LiveSessionTracker(calibration_duration_sec=0.2, ema_alpha=0.35)
    
    # Simulate neutral baseline frames during calibration
    au_neutral = {
        "eye_aspect_ratio": 0.28,
        "gaze_ratio": 0.50,
        "raw_inner_brow": 0.35,
        "raw_brow_dist": 0.22,
        "raw_lip_aperture": 0.04,
        "raw_mouth_width": 0.45,
        "mouth_asymmetry": 0.03
    }
    emotions_neutral = {
        "happy": 4.0, "sad": 2.0, "angry": 2.0, "fear": 2.0,
        "surprise": 3.0, "disgust": 2.0, "contempt": 3.0, "neutral": 82.0
    }

    # First frame -> calibrating
    res = tracker.process_frame(au_neutral, emotions_neutral)
    assert res["is_calibrating"] is True
    assert res["score"] == 15.0
    assert "Calibrating" in res["label"]

    # Sleep past calibration duration
    time.sleep(0.25)

    # Post-calibration frame -> Truthful resting score
    res2 = tracker.process_frame(au_neutral, emotions_neutral)
    assert res2["is_calibrating"] is False
    assert res2["calibration_progress"] == 100
    assert res2["label"] == "Truthful"
    assert res2["score"] <= 25.0

def test_live_session_tracker_lip_press_cue():
    tracker = LiveSessionTracker(calibration_duration_sec=0.1, ema_alpha=0.35)
    au_neutral = {
        "eye_aspect_ratio": 0.28,
        "gaze_ratio": 0.50,
        "raw_inner_brow": 0.35,
        "raw_brow_dist": 0.22,
        "raw_lip_aperture": 0.04,
        "raw_mouth_width": 0.45,
        "mouth_asymmetry": 0.03
    }
    emotions = {"neutral": 80.0, "fear": 2.0, "contempt": 2.0, "disgust": 2.0, "angry": 2.0, "happy": 4.0, "sad": 2.0, "surprise": 3.0}

    # Calibrate
    tracker.process_frame(au_neutral, emotions)
    time.sleep(0.15)
    tracker.process_frame(au_neutral, emotions)

    # Trigger lip press (aperture drops by 50% relative to baseline 0.04 -> 0.015)
    au_lip_press = dict(au_neutral, raw_lip_aperture=0.015)
    res = tracker.process_frame(au_lip_press, emotions)
    cue_texts = [c["text"] for c in res["cues"]]
    assert any("Lip Compression" in t for t in cue_texts)

def test_live_session_tracker_cluster_deception():
    tracker = LiveSessionTracker(calibration_duration_sec=0.1, ema_alpha=0.35)
    au_neutral = {
        "eye_aspect_ratio": 0.28,
        "gaze_ratio": 0.50,
        "raw_inner_brow": 0.35,
        "raw_brow_dist": 0.22,
        "raw_lip_aperture": 0.04,
        "raw_mouth_width": 0.45,
        "mouth_asymmetry": 0.03
    }
    emotions = {"neutral": 75.0, "fear": 5.0, "contempt": 5.0, "disgust": 5.0, "angry": 5.0, "happy": 2.0, "sad": 2.0, "surprise": 1.0}

    tracker.process_frame(au_neutral, emotions)
    time.sleep(0.15)
    tracker.process_frame(au_neutral, emotions)

    # Co-occurring cluster: Gaze aversion + Lip compression + Brow furrow
    au_cluster = dict(
        au_neutral,
        gaze_ratio=0.75,          # looking away
        raw_lip_aperture=0.012,   # pressing lips
        raw_inner_brow=0.26       # furrowing brows
    )
    # Feed multiple frames of cluster to let EMA climb
    for _ in range(8):
        res = tracker.process_frame(au_cluster, emotions)

    assert len(res["cues"]) >= 3
    assert res["score"] >= 60.0
    assert res["label"] in ["Suspicious", "Likely Deceptive"]
