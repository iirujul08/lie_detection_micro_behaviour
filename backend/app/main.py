import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db.database import init_db, SessionLocal
from .db.models import SessionRecord
from .routes import health, analyze, sessions, ws

# Pre-populate database with realistic forensic sessions on first boot
def seed_default_sessions():
    db = SessionLocal()
    try:
        count = db.query(SessionRecord).count()
        if count == 0:
            defaults = [
                {
                    "id": "SES-98241",
                    "date": "2026-10-19 21:42",
                    "source": "Live Stream",
                    "source_type": "live",
                    "duration": "02:15",
                    "duration_sec": 135,
                    "avg_score": 24.2,
                    "peak_score": 38.5,
                    "label": "Truthful",
                    "cues": [
                        {"time": "00:24", "text": "AU1+2 Symmetric brow raise (Authentic surprise)", "severity": "emerald"},
                        {"time": "01:08", "text": "AU12 Bilateral zygomatic contraction (Genuine smile)", "severity": "emerald"},
                        {"time": "01:52", "text": "Consistent direct eye contact sustained", "severity": "emerald"}
                    ],
                    "timeline": [18, 20, 22, 25, 21, 38, 28, 24, 20, 19, 22, 25, 23, 21]
                },
                {
                    "id": "SES-98104",
                    "date": "2026-10-19 18:30",
                    "source": "Uploaded Video",
                    "source_type": "video",
                    "duration": "04:12",
                    "duration_sec": 252,
                    "avg_score": 78.6,
                    "peak_score": 94.2,
                    "label": "Likely Deceptive",
                    "cues": [
                        {"time": "00:41", "text": "AU4 Brow furrow coupled with AU15 lip depressor", "severity": "red"},
                        {"time": "01:15", "text": "Asymmetric lip corner curl (AU14 Micro-contempt)", "severity": "red"},
                        {"time": "02:03", "text": "Gaze aversion right-up with vocal swallowing pause", "severity": "amber"},
                        {"time": "03:22", "text": "Blink rate acceleration (+180% above baseline)", "severity": "red"}
                    ],
                    "timeline": [35, 42, 58, 72, 88, 94, 85, 78, 82, 89, 76, 70, 75, 84]
                },
                {
                    "id": "SES-97982",
                    "date": "2026-10-18 14:10",
                    "source": "Uploaded Video",
                    "source_type": "video",
                    "duration": "01:45",
                    "duration_sec": 105,
                    "avg_score": 56.4,
                    "peak_score": 71.0,
                    "label": "Suspicious",
                    "cues": [
                        {"time": "00:18", "text": "AU14 Unilateral dimpler activation", "severity": "amber"},
                        {"time": "00:54", "text": "Lip compression (AU24) during direct inquiry", "severity": "amber"},
                        {"time": "01:22", "text": "Rapid eye saccades with dilated pupils", "severity": "amber"}
                    ],
                    "timeline": [40, 45, 52, 60, 68, 71, 62, 55, 50, 58, 62, 54]
                },
                {
                    "id": "SES-97650",
                    "date": "2026-10-17 11:25",
                    "source": "Uploaded Image",
                    "source_type": "image",
                    "duration": "00:01",
                    "duration_sec": 1,
                    "avg_score": 21.0,
                    "peak_score": 21.0,
                    "label": "Truthful",
                    "cues": [
                        {"time": "00:00", "text": "Relaxed orbicularis oculi, absence of muscle tension", "severity": "emerald"},
                        {"time": "00:00", "text": "Symmetric frontal facial orientation", "severity": "emerald"}
                    ],
                    "timeline": [21, 21, 21]
                }
            ]

            for s in defaults:
                rec = SessionRecord(
                    id=s["id"],
                    date=s["date"],
                    source=s["source"],
                    source_type=s["source_type"],
                    duration=s["duration"],
                    duration_sec=s["duration_sec"],
                    avg_score=s["avg_score"],
                    peak_score=s["peak_score"],
                    label=s["label"],
                    cues_json=json.dumps(s["cues"]),
                    timeline_json=json.dumps(s["timeline"])
                )
                db.add(rec)
            db.commit()
            print(f"[TruthLens] Initialized database with {len(defaults)} benchmark sessions.")
    except Exception as e:
        print(f"[TruthLens] Database seeding warning: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    seed_default_sessions()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Facial-Expression and Micro-Expression Based Lie Detection API",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(analyze.router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws.router)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs": "/docs",
        "endpoints": {
            "health": "/api/health",
            "model_info": "/api/model-info",
            "analyze_image": "POST /api/analyze/image",
            "analyze_video": "POST /api/analyze/video",
            "sessions": "/api/sessions",
            "websocket_live": "WS /ws/live"
        }
    }
