import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    PROJECT_NAME: str = "TruthLens AI"
    VERSION: str = "2.4.0"
    API_V1_PREFIX: str = "/api"
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "*"
    ]
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/truthlens.db")
    
    # Storage
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    SAVED_MODELS_DIR: Path = BASE_DIR / "ml" / "saved_models"
    MODEL_WEIGHTS_PATH: Path = BASE_DIR / "ml" / "saved_models" / "micro_expression_mobilenet.pt"
    METRICS_JSON_PATH: Path = BASE_DIR / "ml" / "saved_models" / "evaluation_metrics.json"

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
