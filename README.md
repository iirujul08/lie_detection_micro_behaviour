# TruthLens — Full-Stack Facial-Expression & Micro-Expression Lie Detector

**TruthLens** is an end-to-end, production-ready forensic AI platform designed to detect and decompose involuntary facial micro-expressions, Action Unit (FACS) activations, and cognitive load markers in real time.

Built with **FastAPI**, **MediaPipe Face Mesh**, **PyTorch / MobileNetV2**, **SQLite (SQLAlchemy)**, **React**, **Vite**, **Tailwind CSS**, and **Recharts**.

---

## 🏛️ System Architecture

```
truthlens/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint, CORS & Lifespan
│   │   ├── config.py         # Settings & paths
│   │   ├── db/               # SQLite database & SQLAlchemy ORM
│   │   │   ├── database.py
│   │   │   └── models.py
│   │   ├── models/           # Pydantic request/response schemas
│   │   │   └── schemas.py
│   │   ├── routes/           # REST & WebSocket route handlers
│   │   │   ├── analyze.py    # POST /api/analyze/image & /video
│   │   │   ├── sessions.py   # GET, POST, DELETE /api/sessions
│   │   │   ├── health.py     # GET /api/health & /api/model-info
│   │   │   └── ws.py         # WS /ws/live real-time frames
│   │   └── services/         # Core Biometric & AI engines
│   │       ├── face_detector.py      # MediaPipe 468 landmark & head pose
│   │       ├── landmark_extractor.py # FACS Action Unit index extractor
│   │       ├── deception_scorer.py   # Hybrid CNN + landmark scoring
│   │       └── video_analyzer.py     # Video batch frame processor
├── ml/                       # Machine Learning Pipeline
│   ├── dataset/              # Raw & processed image dataset
│   │   └── README.md
│   ├── saved_models/         # Trained checkpoints & evaluation plots
│   ├── download_dataset.py   # Kaggle download / directory initializer
│   ├── preprocess.py         # Face crop, align, 224x224, augment, split
│   ├── train.py              # MobileNetV2 transfer learning with early stopping
│   └── evaluate.py           # Accuracy, F1, confusion matrix generator
├── frontend/                 # React + Vite + Tailwind CSS + Recharts
│   ├── src/
│   │   ├── api/client.js     # Axios API client
│   │   ├── hooks/            # useCamera.js, useWebSocket.js
│   │   ├── components/       # Navbar, Footer, Gauge, Toasts, Banners
│   │   └── pages/            # Home, Live, Upload, History, Metrics, About
├── tests/                    # Pytest test suite
│   └── test_api.py
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── run_dev.bat               # Single-command launcher for Windows
└── run_dev.sh                # Single-command launcher for Linux/macOS
```

---

## 🚀 Quick Start (One-Click Launch)

### On Windows
Double-click `run_dev.bat` or run in terminal:
```cmd
run_dev.bat
```

### On Linux / macOS
```bash
chmod +x run_dev.sh
./run_dev.sh
```

The script will launch:
- **FastAPI Backend**: `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)
- **React Frontend**: `http://localhost:5173`

---

## 🛠️ Manual Installation & Setup

### 1. Backend Setup
1. Open terminal and navigate to the project root:
   ```bash
   cd d:\college\miniproject\sem5miniproject\project
   ```
2. Create and activate a Python virtual environment (recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI backend server:
   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### 2. Frontend Setup
1. In another terminal, navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open your browser at:
   ```
   http://localhost:5173
   ```

---

## 🧪 Running Automated Tests

Run the backend Pytest suite:
```bash
pytest -v
```
All 5 comprehensive API integration tests verify:
- Root health & metadata (`GET /`)
- System health & DB connection (`GET /api/health`)
- Model information & confusion matrix (`GET /api/model-info`)
- Session CRUD operations (`GET`, `POST`, `DELETE /api/sessions`)
- Single-image biometric decomposition (`POST /api/analyze/image`)

---

## 🧠 Machine Learning Pipeline & Training

### 1. Dataset Acquisition
Public universal micro-expression interrogation datasets are limited due to privacy and legal restrictions. TruthLens is built to train on micro-expression image benchmarks (e.g., CASME II, SAMM, or FER2013).

Run the automated download helper:
```bash
python ml/download_dataset.py
```
- If Kaggle credentials exist (`~/.kaggle/kaggle.json`), it downloads the benchmark dataset.
- Otherwise, it initializes the class directories:
  ```
  ml/dataset/raw/
  ├── happy/
  ├── sad/
  ├── angry/
  ├── fear/
  ├── surprise/
  ├── disgust/
  ├── contempt/
  └── neutral/
  ```
- **Quick Test Sample**: To generate sample data for quick pipeline testing without downloading external datasets:
  ```bash
  python ml/download_dataset.py --generate-sample-data
  ```

### 2. Preprocessing & Alignment
Extracts face crops, aligns horizontal eye axes, resizes to `224x224`, applies augmentations (flips, rotations, brightness shifts), and splits into `train/` (70%), `val/` (15%), and `test/` (15%):
```bash
python ml/preprocess.py
```

### 3. Model Training
Fine-tunes a MobileNetV2 convolutional neural network with AdamW optimizer, learning rate decay, and early stopping checkpointing:
```bash
python ml/train.py --epochs 20 --batch-size 32 --lr 0.0001
```
The best checkpoint is automatically saved to `ml/saved_models/micro_expression_mobilenet.pt`.

### 4. Evaluation & Heatmap Plotting
Evaluates model weights on the test set, computing Accuracy, Precision, Recall, F1 score, and generating `confusion_matrix.png` and `evaluation_metrics.json`:
```bash
python ml/evaluate.py
```

> **Note**: If no trained weights exist yet, TruthLens runs seamlessly using the MediaPipe Action Unit heuristic scorer and clearly displays the **"Model Not Trained"** banner on the Metrics page.

---

## 🔌 API Reference & Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check, uptime, and database connection status |
| `GET` | `/api/model-info` | Validation accuracy, F1, confusion matrix, and training state |
| `POST`| `/api/analyze/image` | Accepts image file (`JPG, PNG, WEBP`), returns Action Units & score |
| `POST`| `/api/analyze/video` | Accepts video file (`MP4, AVI, MOV, WEBM`), returns per-frame timeline |
| `WS`  | `/ws/live` | WebSocket receiving webcam frames (base64) & streaming live telemetry |
| `GET` | `/api/sessions` | Retrieves archived session history |
| `POST`| `/api/sessions` | Creates and persists a session record |
| `GET` | `/api/sessions/{id}` | Retrieves detailed telemetry and cues for a session |
| `DELETE`| `/api/sessions/{id}` | Deletes a session record |

---

## ⚖️ Ethics, Privacy & Limitations Notice
- **Probabilistic Indicator**: Facial micro-expression analysis provides probabilistic biometric indicators, not definitive proof of deception.
- **High-Stakes Decisions**: Must **not** be used for legal, hiring, judicial, or other high-stakes decisions.
- **Informed Consent**: The frontend requires explicit user consent via checkbox before camera streams initialize.
- **Ephemeral Processing**: No raw video feeds or webcam frames are stored on any server unless the user explicitly saves a session.
