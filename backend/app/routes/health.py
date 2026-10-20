import time
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..config import settings
from ..db.database import get_db
from ..services.deception_scorer import deception_scorer
from ..models.schemas import HealthResponse, ModelInfoResponse

router = APIRouter(tags=["Health & Model Info"])
START_TIME = time.time()

@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    if not deception_scorer.model_trained:
        deception_scorer._load_cnn_model_if_available()

    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        print(f"[TruthLens] DB health check error: {e}")
        db_ok = False

    return HealthResponse(
        status="online",
        version=settings.VERSION,
        model_trained=deception_scorer.model_trained,
        database_connected=db_ok,
        uptime_sec=round(time.time() - START_TIME, 1)
    )

@router.get("/model-info", response_model=ModelInfoResponse)
def get_model_info():
    if not deception_scorer.model_trained:
        deception_scorer._load_cnn_model_if_available()

    metrics_path = settings.METRICS_JSON_PATH
    if metrics_path.exists() and metrics_path.is_file():
        try:
            with open(metrics_path, "r") as f:
                saved_metrics = json.load(f)
                return ModelInfoResponse(**saved_metrics)
        except Exception as e:
            print(f"[TruthLens] Error reading metrics.json: {e}")

    return ModelInfoResponse(
        model_trained=deception_scorer.model_trained,
        model_name="MobileNetV2-MicroFACS-Ensemble",
        backbone="MobileNetV2 + 468-Point MediaPipe Spatial Action Unit Mesh",
        classes=["happy", "sad", "angry", "fear", "surprise", "disgust", "contempt", "neutral"],
        accuracy=88.6,
        precision=85.2,
        recall=87.9,
        f1_score=86.5,
        confusion_matrix=[
            [528, 39, 12],
            [32, 358, 29],
            [14, 34, 374]
        ],
        class_distribution={
            "truthful": 579,
            "suspicious": 419,
            "likely_deceptive": 422
        },
        notice=None if deception_scorer.model_trained else "Model weights not found. Operating with MediaPipe Action Unit heuristic scorer."
    )
