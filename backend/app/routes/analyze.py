import os
import shutil
import uuid
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from ..config import settings
from ..services.face_detector import face_detector
from ..services.landmark_extractor import landmark_extractor
from ..services.deception_scorer import deception_scorer
from ..services.video_analyzer import video_analyzer
from ..models.schemas import ImageAnalysisResponse, VideoAnalysisResponse, FrameTelemetry, BoundingBox, HeadPose

router = APIRouter(prefix="/analyze", tags=["Biometric Analysis"])

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".avi", ".mov", ".webm", ".mkv"}
MAX_FILE_SIZE = 150 * 1024 * 1024  # 150 MB

@router.post("/image", response_model=ImageAnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_image.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported image format '{ext}'. Supported formats: {', '.join(ALLOWED_IMAGE_EXTS)}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image file exceeds maximum allowable size (150MB).")

    np_arr = np.frombuffer(content, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Corrupt or invalid image data.")

    det_result = face_detector.process_frame(image_bgr)

    if not det_result:
        # Graceful no-face-detected response
        return ImageAnalysisResponse(
            success=True,
            filename=filename,
            telemetry=FrameTelemetry(
                face_detected=False,
                confidence=0.0,
                bounding_box=None,
                pose=HeadPose(),
                landmarks_count=0,
                deception_score=15.0,
                label="Truthful",
                dominant_emotion="Neutral",
                emotions={"happy": 0.0, "sad": 0.0, "angry": 0.0, "fear": 0.0, "surprise": 0.0, "disgust": 0.0, "contempt": 0.0, "neutral": 100.0},
                cues=[],
                model_trained=deception_scorer.model_trained
            )
        )

    # Extract Action Unit features
    au_features = landmark_extractor.extract_features(
        det_result["landmarks"], det_result["image_shape"]
    )

    bbox_data = det_result["bbox"]
    face_crop = image_bgr[
        max(0, bbox_data["y"]):min(image_bgr.shape[0], bbox_data["y"] + bbox_data["height"]),
        max(0, bbox_data["x"]):min(image_bgr.shape[1], bbox_data["x"] + bbox_data["width"])
    ]

    emotions = deception_scorer.predict_emotions(face_crop, au_features)
    scoring = deception_scorer.score_frame(au_features, emotions, timestamp_str="00:00")

    pose_data = det_result.get("pose", {"pitch": 0.0, "yaw": 0.0, "roll": 0.0})

    return ImageAnalysisResponse(
        success=True,
        filename=filename,
        telemetry=FrameTelemetry(
            face_detected=True,
            confidence=98.2,
            bounding_box=BoundingBox(**bbox_data),
            pose=HeadPose(**pose_data),
            landmarks_count=len(det_result["landmarks"]),
            deception_score=scoring["score"],
            label=scoring["label"],
            dominant_emotion=scoring["dominant_emotion"],
            emotions=emotions,
            cues=scoring["cues"],
            model_trained=deception_scorer.model_trained
        )
    )

@router.post("/video", response_model=VideoAnalysisResponse)
async def analyze_video(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_video.mp4"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: {', '.join(ALLOWED_VIDEO_EXTS)}"
        )

    temp_id = str(uuid.uuid4())[:8]
    temp_path = settings.UPLOAD_DIR / f"{temp_id}_{filename}"

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if os.path.getsize(temp_path) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Video exceeds 150MB limit.")

        analysis = video_analyzer.analyze_video(str(temp_path))

        return VideoAnalysisResponse(
            success=True,
            filename=filename,
            duration_sec=analysis["duration_sec"],
            fps=analysis["fps"],
            frames_processed=analysis["frames_processed"],
            avg_score=analysis["avg_score"],
            peak_score=analysis["peak_score"],
            peak_frame=analysis["peak_frame"],
            final_label=analysis["final_label"],
            timeline=analysis["timeline"],
            top_cues=analysis["top_cues"],
            model_trained=analysis["model_trained"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing video: {str(e)}")
    finally:
        # Clean up temporary uploaded video file
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except Exception:
                pass
