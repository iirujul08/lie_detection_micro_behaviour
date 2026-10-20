from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class CueAlert(BaseModel):
    time: str
    text: str
    severity: str = "amber"  # "emerald", "amber", "red"
    desc: Optional[str] = None

class EmotionSpectrum(BaseModel):
    happy: float = 0.0
    sad: float = 0.0
    angry: float = 0.0
    fear: float = 0.0
    surprise: float = 0.0
    disgust: float = 0.0
    contempt: float = 0.0
    neutral: float = 100.0

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class HeadPose(BaseModel):
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0

class FrameTelemetry(BaseModel):
    face_detected: bool
    confidence: float = 0.0
    bounding_box: Optional[BoundingBox] = None
    pose: HeadPose = Field(default_factory=HeadPose)
    landmarks_count: int = 0
    deception_score: float = 0.0
    label: str = "Truthful"
    dominant_emotion: str = "Neutral"
    emotions: Dict[str, float] = Field(default_factory=dict)
    cues: List[CueAlert] = Field(default_factory=list)
    model_trained: bool = False

class ImageAnalysisResponse(BaseModel):
    success: bool
    filename: str
    telemetry: FrameTelemetry

class VideoFramePoint(BaseModel):
    frame_index: int
    timestamp: str
    score: float
    cues: List[str] = Field(default_factory=list)
    dominant_emotion: str = "Neutral"

class VideoAnalysisResponse(BaseModel):
    success: bool
    filename: str
    duration_sec: float
    fps: float
    frames_processed: int
    avg_score: float
    peak_score: float
    peak_frame: int
    final_label: str
    timeline: List[VideoFramePoint]
    top_cues: List[CueAlert]
    model_trained: bool

class SessionCreate(BaseModel):
    id: Optional[str] = None
    date: str
    source: str
    sourceType: str
    duration: str = "00:00"
    durationSec: int = 0
    avgScore: float
    peakScore: float
    label: str
    cues: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[float] = Field(default_factory=list)

class SessionResponse(BaseModel):
    id: str
    date: str
    source: str
    sourceType: str
    duration: str
    durationSec: int
    avgScore: float
    peakScore: float
    label: str
    cues: List[Dict[str, Any]]
    timeline: List[float]

class HealthResponse(BaseModel):
    status: str
    version: str
    model_trained: bool
    database_connected: bool
    uptime_sec: float

class ModelInfoResponse(BaseModel):
    model_trained: bool
    model_name: str
    backbone: str
    classes: List[str]
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: List[List[int]]
    emotion_confusion_matrix: Optional[List[List[int]]] = None
    class_distribution: Dict[str, int]
    notice: Optional[str] = None
