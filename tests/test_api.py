import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, seed_default_sessions

def test_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "TruthLens" in data["service"]

def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert data["database_connected"] is True
        assert "version" in data

def test_model_info():
    with TestClient(app) as client:
        response = client.get("/api/model-info")
        assert response.status_code == 200
        data = response.json()
        assert "accuracy" in data
        assert "confusion_matrix" in data
        assert "classes" in data
        assert len(data["classes"]) >= 7

def test_sessions_crud():
    with TestClient(app) as client:
        seed_default_sessions()
        
        # 1. Get all sessions
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 1

        # 2. Create new test session
        new_sess = {
            "id": "SES-TEST-001",
            "date": "2026-10-20 12:00",
            "source": "Live Stream",
            "sourceType": "live",
            "duration": "01:10",
            "durationSec": 70,
            "avgScore": 28.5,
            "peakScore": 39.0,
            "label": "Truthful",
            "cues": [{"time": "00:15", "text": "AU12 genuine smile", "severity": "emerald"}],
            "timeline": [20, 24, 28, 22, 25]
        }
        create_resp = client.post("/api/sessions", json=new_sess)
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["id"] == "SES-TEST-001"
        assert created["avgScore"] == 28.5

        # 3. Retrieve single session
        get_resp = client.get("/api/sessions/SES-TEST-001")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == "SES-TEST-001"

        # 4. Delete session
        del_resp = client.delete("/api/sessions/SES-TEST-001")
        assert del_resp.status_code == 200

        # 5. Verify deleted
        get_deleted = client.get("/api/sessions/SES-TEST-001")
        assert get_deleted.status_code == 404

def test_analyze_image():
    with TestClient(app) as client:
        # Create synthetic test image
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        cv2.circle(img, (150, 150), 90, (200, 210, 220), -1) # face
        cv2.circle(img, (120, 130), 10, (30, 30, 40), -1)   # eye
        cv2.circle(img, (180, 130), 10, (30, 30, 40), -1)   # eye
        cv2.ellipse(img, (150, 185), (30, 15), 0, 0, 180, (20, 20, 150), 3) # mouth

        success, encoded_img = cv2.imencode(".jpg", img)
        assert success

        file_bytes = io.BytesIO(encoded_img.tobytes())
        files = {"file": ("test_face.jpg", file_bytes, "image/jpeg")}

        resp = client.post("/api/analyze/image", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "telemetry" in data
        assert "deception_score" in data["telemetry"]
        assert "emotions" in data["telemetry"]
        assert "label" in data["telemetry"]
