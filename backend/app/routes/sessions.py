import json
import random
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db.models import SessionRecord
from ..models.schemas import SessionCreate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["Session History"])

@router.get("", response_model=List[SessionResponse])
def get_all_sessions(db: Session = Depends(get_db)):
    records = db.query(SessionRecord).order_by(SessionRecord.created_at.desc()).all()
    return [SessionResponse(**r.to_dict()) for r in records]

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return SessionResponse(**record.to_dict())

@router.post("", response_model=SessionResponse, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    session_id = payload.id or f"SES-{random.randint(10000, 99999)}"
    
    # Check if exists
    existing = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if existing:
        session_id = f"SES-{random.randint(10000, 99999)}"

    record = SessionRecord(
        id=session_id,
        date=payload.date,
        source=payload.source,
        source_type=payload.sourceType,
        duration=payload.duration,
        duration_sec=payload.durationSec,
        avg_score=payload.avgScore,
        peak_score=payload.peakScore,
        label=payload.label,
        cues_json=json.dumps(payload.cues),
        timeline_json=json.dumps(payload.timeline)
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return SessionResponse(**record.to_dict())

@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    db.delete(record)
    db.commit()
    return {"success": True, "message": f"Session '{session_id}' deleted successfully."}
