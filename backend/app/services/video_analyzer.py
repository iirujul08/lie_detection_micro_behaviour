import os
import cv2
import numpy as np
from typing import Dict, Any, List
from .face_detector import face_detector
from .landmark_extractor import landmark_extractor
from .deception_scorer import deception_scorer
from ..models.schemas import CueAlert, VideoFramePoint

class VideoAnalyzer:
    def __init__(self, target_sample_fps: int = 12):
        self.target_sample_fps = target_sample_fps

    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        duration_sec = total_frames / orig_fps if total_frames > 0 else 0.0

        # Step rate to achieve ~10-15 fps sample rate
        sample_step = max(1, int(orig_fps / self.target_sample_fps))

        frame_idx = 0
        timeline: List[VideoFramePoint] = []
        all_cues: List[CueAlert] = []
        all_scores: List[float] = []

        peak_score = 0.0
        peak_frame_idx = 0
        peak_frame_img = None

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_step == 0:
                elapsed_sec = frame_idx / orig_fps
                mins = int(elapsed_sec // 60)
                secs = int(elapsed_sec % 60)
                millis = int((elapsed_sec - int(elapsed_sec)) * 100)
                timestamp_str = f"{mins:02d}:{secs:02d}.{millis:02d}"

                # Run face mesh detection
                det_result = face_detector.process_frame(frame)
                if det_result:
                    au_features = landmark_extractor.extract_features(
                        det_result["landmarks"], det_result["image_shape"]
                    )
                    
                    # Crop face for CNN
                    bbox = det_result["bbox"]
                    face_crop = frame[
                        max(0, bbox["y"]):min(frame.shape[0], bbox["y"] + bbox["height"]),
                        max(0, bbox["x"]):min(frame.shape[1], bbox["x"] + bbox["width"])
                    ]

                    emotions = deception_scorer.predict_emotions(face_crop, au_features)
                    scoring = deception_scorer.score_frame(au_features, emotions, timestamp_str)

                    score = scoring["score"]
                    all_scores.append(score)
                    if score > peak_score:
                        peak_score = score
                        peak_frame_idx = frame_idx
                        peak_frame_img = frame.copy()

                    cue_texts = [c.text for c in scoring["cues"]]
                    all_cues.extend(scoring["cues"])

                    timeline.append(VideoFramePoint(
                        frame_index=frame_idx,
                        timestamp=timestamp_str,
                        score=score,
                        cues=cue_texts,
                        dominant_emotion=scoring["dominant_emotion"]
                    ))
                else:
                    # No face detected in this sampled frame, preserve baseline
                    timeline.append(VideoFramePoint(
                        frame_index=frame_idx,
                        timestamp=timestamp_str,
                        score=15.0,
                        cues=["No face detected"],
                        dominant_emotion="Neutral"
                    ))
                    all_scores.append(15.0)

            frame_idx += 1

        cap.release()

        avg_score = round(float(np.mean(all_scores)), 1) if all_scores else 20.0
        peak_score = round(float(peak_score), 1)

        if avg_score >= 70.0:
            final_label = "Likely Deceptive"
        elif avg_score >= 40.0:
            final_label = "Suspicious"
        else:
            final_label = "Truthful"

        # Deduplicate top cues
        seen_texts = set()
        top_cues: List[CueAlert] = []
        for cue in sorted(all_cues, key=lambda c: (c.severity == "red", c.severity == "amber"), reverse=True):
            if cue.text not in seen_texts:
                seen_texts.add(cue.text)
                top_cues.append(cue)
            if len(top_cues) >= 6:
                break

        return {
            "duration_sec": round(duration_sec, 2),
            "fps": round(orig_fps, 1),
            "frames_processed": len(timeline),
            "avg_score": avg_score,
            "peak_score": peak_score,
            "peak_frame": peak_frame_idx,
            "final_label": final_label,
            "timeline": timeline,
            "top_cues": top_cues,
            "model_trained": deception_scorer.model_trained
        }

video_analyzer = VideoAnalyzer()
