from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Text, DateTime
from .database import Base

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    date = Column(String(64), nullable=False)
    source = Column(String(64), nullable=False)           # "Live Stream", "Uploaded Video", "Uploaded Image"
    source_type = Column(String(32), nullable=False)      # "live", "video", "image"
    duration = Column(String(32), default="00:00")
    duration_sec = Column(Integer, default=0)
    avg_score = Column(Float, nullable=False, default=0.0)
    peak_score = Column(Float, nullable=False, default=0.0)
    label = Column(String(32), nullable=False, default="Truthful")  # "Truthful", "Suspicious", "Likely Deceptive"
    cues_json = Column(Text, default="[]")                 # JSON list of cue objects
    timeline_json = Column(Text, default="[]")             # JSON list of scores
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "date": self.date,
            "source": self.source,
            "sourceType": self.source_type,
            "duration": self.duration,
            "durationSec": self.duration_sec,
            "avgScore": round(self.avg_score, 1),
            "peakScore": round(self.peak_score, 1),
            "label": self.label,
            "cues": json.loads(self.cues_json) if self.cues_json else [],
            "timeline": json.loads(self.timeline_json) if self.timeline_json else []
        }
