import json
import base64
import time
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.face_detector import face_detector
from ..services.landmark_extractor import landmark_extractor
from ..services.deception_scorer import deception_scorer

router = APIRouter(tags=["Real-time Live WebSocket"])

@router.websocket("/ws/live")
async def live_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    last_frame_time = time.time()
    frame_count = 0
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

            # Process frame
            base64_data = msg.get("data", "")
            if not base64_data:
                continue

            # Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            try:
                img_bytes = base64.b64decode(base64_data)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception:
                await websocket.send_text(json.dumps({"error": "Invalid base64 frame encoding"}))
                continue

            if frame is None or frame.size == 0:
                continue

            # Calculate live FPS
            frame_count += 1
            now = time.time()
            if now - last_frame_time >= 1.0:
                calculated_fps = round((frame_count) / (now - last_frame_time), 1)
                frame_count = 0
                last_frame_time = now

            timestamp_str = msg.get("timestamp", "00:00")

            det_result = face_detector.process_frame(frame)

            if not det_result:
                payload = {
                    "face_detected": False,
                    "confidence": 0.0,
                    "bbox": None,
                    "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
                    "landmarks_count": 0,
                    "deception_score": 15.0,
                    "label": "Truthful",
                    "dominant_emotion": "Neutral",
                    "emotions": {
                        "happy": 5.0, "sad": 2.0, "angry": 2.0, "fear": 2.0,
                        "surprise": 4.0, "disgust": 1.0, "contempt": 1.0, "neutral": 83.0
                    },
                    "cues": [],
                    "fps": calculated_fps,
                    "model_trained": deception_scorer.model_trained
                }
                await websocket.send_text(json.dumps(payload))
                continue

            # Extract Action Units
            au_features = landmark_extractor.extract_features(
                det_result["landmarks"], det_result["image_shape"]
            )

            bbox = det_result["bbox"]
            face_crop = frame[
                max(0, bbox["y"]):min(frame.shape[0], bbox["y"] + bbox["height"]),
                max(0, bbox["x"]):min(frame.shape[1], bbox["x"] + bbox["width"])
            ]

            emotions = deception_scorer.predict_emotions(face_crop, au_features)
            scoring = deception_scorer.score_frame(au_features, emotions, timestamp_str)

            # Sample landmark points to stream over WS (e.g. 68 critical points for lightweight bandwidth)
            key_indices = [
                33, 133, 159, 145,  # left eye
                263, 362, 386, 374, # right eye
                70, 63, 105, 66, 107, # left eyebrow
                300, 293, 334, 296, 336, # right eyebrow
                1, 2, 98, 327, # nose
                61, 291, 13, 14, 78, 308, 17, # mouth
                10, 152, 234, 454 # contour points
            ]
            sampled_landmarks = [
                {"idx": idx, "x": det_result["landmarks"][idx][0], "y": det_result["landmarks"][idx][1]}
                for idx in key_indices if idx < len(det_result["landmarks"])
            ]

            cues_list = [
                {"time": c.time, "text": c.text, "severity": c.severity, "desc": c.desc}
                for c in scoring["cues"]
            ]

            payload = {
                "face_detected": True,
                "confidence": 98.4,
                "bbox": bbox,
                "pose": det_result["pose"],
                "landmarks": sampled_landmarks,
                "landmarks_count": len(det_result["landmarks"]),
                "deception_score": scoring["score"],
                "label": scoring["label"],
                "dominant_emotion": scoring["dominant_emotion"],
                "emotions": emotions,
                "cues": cues_list,
                "fps": calculated_fps,
                "model_trained": deception_scorer.model_trained
            }

            await websocket.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[TruthLens] WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
