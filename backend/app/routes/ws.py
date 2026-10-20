import json
import base64
import time
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.face_detector import face_detector
from ..services.landmark_extractor import landmark_extractor
from ..services.deception_scorer import deception_scorer
from ..services.live_tracker import LiveSessionTracker

router = APIRouter(tags=["Real-time Live WebSocket"])

@router.websocket("/ws/live")
async def live_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[TruthLens WS] Client connected to /ws/live")
    
    # Per-connection session tracker for baseline calibration & EMA smoothing
    tracker = LiveSessionTracker(calibration_duration_sec=5.0, ema_alpha=0.3)
    
    frame_counter = 0
    last_emotions = None
    last_fps_time = time.time()
    fps_frames = 0
    calculated_fps = 0.0

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                msg = json.loads(text_data)
            except Exception:
                continue

            msg_type = msg.get("type", "frame")
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "timestamp": time.time()}))
                continue

            if msg_type == "reset":
                tracker.reset()
                print("[TruthLens WS] Session tracker reset requested.")
                continue

            t0 = time.perf_counter()

            base64_data = msg.get("data", "")
            if not base64_data:
                continue

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            try:
                img_bytes = base64.b64decode(base64_data)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception as e:
                print(f"[TruthLens WS] Frame decode error: {e}")
                await websocket.send_text(json.dumps({"error": "Invalid base64 frame encoding"}))
                continue

            if frame is None or frame.size == 0:
                print("[TruthLens WS] Decoded frame is empty!")
                continue

            # FPS calculation
            fps_frames += 1
            now = time.time()
            if now - last_fps_time >= 1.0:
                calculated_fps = round(fps_frames / (now - last_fps_time), 1)
                fps_frames = 0
                last_fps_time = now

            timestamp_str = msg.get("timestamp", "00:00")

            # 1. MediaPipe FaceMesh (multi-tier detection)
            det_result = face_detector.process_frame(frame)

            if not det_result:
                proc_ms = round((time.perf_counter() - t0) * 1000, 1)
                print(f"[TruthLens WS] Frame {frame.shape}: No face detected ({proc_ms}ms)")
                payload = {
                    "face_detected": False,
                    "confidence": 0.0,
                    "bbox": None,
                    "landmarks": [],
                    "landmarks_count": 0,
                    "deception_score": 15.0,
                    "raw_score": 15.0,
                    "label": "No Face Detected",
                    "dominant_emotion": "Neutral",
                    "emotions": {
                        "happy": 5.0, "sad": 2.0, "angry": 2.0, "fear": 2.0,
                        "surprise": 4.0, "disgust": 1.0, "contempt": 1.0, "neutral": 83.0
                    },
                    "cues": [],
                    "fps": calculated_fps,
                    "processing_ms": proc_ms,
                    "calibrating": tracker.is_calibrating,
                    "calibration_progress": tracker.calibration_progress,
                    "ear": 0.0,
                    "model_trained": deception_scorer.model_trained
                }
                await websocket.send_text(json.dumps(payload))
                continue

            # 2. Extract Action Units on EVERY frame
            au_features = landmark_extractor.extract_features(
                det_result["landmarks"], det_result["image_shape"]
            )

            # 3. Emotion CNN executed on every 3rd frame only to conserve CPU/latency
            frame_counter += 1
            if frame_counter % 3 == 0 or last_emotions is None:
                bbox_px = det_result["bbox"]
                face_crop = frame[
                    max(0, bbox_px["y"]):min(frame.shape[0], bbox_px["y"] + bbox_px["height"]),
                    max(0, bbox_px["x"]):min(frame.shape[1], bbox_px["x"] + bbox_px["width"])
                ]
                last_emotions = deception_scorer.predict_emotions(face_crop, au_features)

            emotions = last_emotions

            # 4. Calibration & Relative Baseline Scoring with EMA smoothing
            scoring = tracker.process_frame(au_features, emotions, timestamp_str)

            proc_ms = round((time.perf_counter() - t0) * 1000, 1)

            payload = {
                "face_detected": True,
                "confidence": 98.6,
                "bbox": det_result["bbox_norm"],
                "bbox_px": det_result["bbox"],
                "landmarks": det_result["landmarks_norm"],
                "landmarks_count": len(det_result["landmarks_norm"]),
                "pose": det_result["pose"],
                "deception_score": scoring["score"],
                "raw_score": scoring["raw_score"],
                "label": scoring["label"],
                "dominant_emotion": max(emotions.items(), key=lambda x: x[1])[0].capitalize(),
                "emotions": emotions,
                "cues": scoring["cues"],
                "calibrating": scoring["is_calibrating"],
                "calibration_progress": scoring["calibration_progress"],
                "baseline": scoring.get("baseline", {}),
                "ear": au_features.get("eye_aspect_ratio", 0.28),
                "fps": calculated_fps,
                "processing_ms": proc_ms,
                "model_trained": deception_scorer.model_trained
            }

            if frame_counter % 15 == 0:
                print(f"[TruthLens WS] Frame {frame_counter}: Face tracked, score={scoring['score']}% ({scoring['label']}) in {proc_ms}ms")

            await websocket.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        print("[TruthLens WS] Client disconnected cleanly.")
    except Exception as e:
        print(f"[TruthLens WS] Exception in loop: {e}")
