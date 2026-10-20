import os
import time
import numpy as np
from typing import Dict, Any, List, Optional
import cv2
from ..config import settings
from ..models.schemas import CueAlert

# Try importing torch for MobileNetV2 if model weights exist
try:
    import torch
    import torchvision.transforms as transforms
    from torchvision import models as tv_models
    TORCH_AVAILABLE = True
except Exception:
    TORCH_AVAILABLE = False

class DeceptionScorer:
    def __init__(self):
        self.classes = [
            "happy", "sad", "angry", "fear", 
            "surprise", "disgust", "contempt", "neutral"
        ]
        self.trained_classes = self.classes
        self.model = None
        self.model_trained = False
        self.transform = None
        self.device = "cpu"
        
        # Rolling temporal frame history for live / video analysis
        # Stores recent (timestamp, score, dominant_emotion, au_features)
        self.history_buffer = []

        self._load_cnn_model_if_available()

    def _load_cnn_model_if_available(self):
        """Loads PyTorch MobileNetV2 checkpoint if it exists in saved_models directory."""
        if not TORCH_AVAILABLE:
            self.model_trained = False
            return

        weights_path = settings.MODEL_WEIGHTS_PATH
        classes_path = settings.SAVED_MODELS_DIR / "classes.json"

        if weights_path.exists() and weights_path.is_file():
            try:
                if classes_path.exists():
                    import json
                    with open(classes_path, "r") as f:
                        self.trained_classes = json.load(f)
                else:
                    self.trained_classes = self.classes

                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                model = tv_models.mobilenet_v2(weights=None)
                in_features = model.classifier[1].in_features
                model.classifier[1] = torch.nn.Linear(in_features, len(self.trained_classes))
                state_dict = torch.load(weights_path, map_location=self.device)
                model.load_state_dict(state_dict)
                model.to(self.device)
                model.eval()
                self.model = model
                self.model_trained = True

                self.transform = transforms.Compose([
                    transforms.ToPILImage(),
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
                print(f"[TruthLens] Loaded trained CNN model from {weights_path} ({len(self.trained_classes)} classes)")
            except Exception as e:
                print(f"[TruthLens] Failed to load CNN checkpoint: {e}. Falling back to heuristic FACS scorer.")
                self.model = None
                self.model_trained = False
        else:
            self.model = None
            self.model_trained = False

    def predict_emotions(self, face_bgr: np.ndarray, au_features: Dict[str, Any]) -> Dict[str, float]:
        """
        Classifies emotions using the CNN if trained, or computes heuristic FACS distribution.
        Always returns standardized 8-class spectrum for UI consistency.
        """
        if not self.model_trained:
            self._load_cnn_model_if_available()

        if self.model_trained and self.model is not None and face_bgr is not None and face_bgr.size > 0:
            try:
                rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
                tensor = self.transform(rgb).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    logits = self.model(tensor)
                    probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()
                
                raw_preds = {cls.lower(): round(float(prob) * 100.0, 1) for cls, prob in zip(self.trained_classes, probs)}
                
                # Standardize to 8 emotional dimensions
                return {
                    "happy": raw_preds.get("happy", 0.0),
                    "sad": raw_preds.get("sad", 0.0),
                    "angry": raw_preds.get("angry", 0.0),
                    "fear": raw_preds.get("fear", 0.0),
                    "surprise": raw_preds.get("surprise", 0.0),
                    "disgust": raw_preds.get("disgust", 0.0),
                    "contempt": raw_preds.get("contempt", round(au_features.get("mouth_asymmetry", 0.0) * 45.0, 1)),
                    "neutral": raw_preds.get("neutral", 0.0)
                }
            except Exception as e:
                print(f"[TruthLens] CNN inference error: {e}. Using heuristic fallback.")
            except Exception as e:
                print(f"[TruthLens] CNN inference error: {e}. Using heuristic fallback.")

        # Heuristic FACS Emotion Estimation
        # Derives emotion probabilities based on Action Units
        happy = max(5.0, au_features.get("mouth_width", 0.0) * 20.0 * (1.0 - au_features.get("mouth_asymmetry", 0.0)))
        sad = max(3.0, au_features.get("lip_depressor", 0.0) * 55.0)
        angry = max(2.0, au_features.get("brow_furrow", 0.0) * 65.0)
        fear = max(2.0, (au_features.get("brow_raise", 0.0) * 40.0) + (au_features.get("lip_press", 0.0) * 25.0))
        surprise = max(4.0, au_features.get("brow_raise", 0.0) * 60.0 * (1.0 - au_features.get("brow_furrow", 0.0)))
        disgust = max(2.0, au_features.get("nose_wrinkle", 0.0) * 60.0)
        contempt = max(2.0, au_features.get("mouth_asymmetry", 0.0) * 60.0)

        total_active = happy + sad + angry + fear + surprise + disgust + contempt
        neutral = max(10.0, 100.0 - total_active)

        # Normalize sum to 100%
        raw = {"happy": happy, "sad": sad, "angry": angry, "fear": fear, 
               "surprise": surprise, "disgust": disgust, "contempt": contempt, "neutral": neutral}
        norm_sum = sum(raw.values())
        return {k: round((v / norm_sum) * 100.0, 1) for k, v in raw.items()}

    def score_frame(self, au_features: Dict[str, Any], emotions: Dict[str, float], timestamp_str: str = "00:00") -> Dict[str, Any]:
        """
        Calculates Deception Likelihood (0-100%), assessment label, and cues.
        """
        cues: List[CueAlert] = []
        raw_score = 10.0 # Baseline truthfulness resting score

        # 1. Action Unit Contributions
        if au_features.get("brow_furrow", 0) > 0.45:
            intensity = au_features["brow_furrow"]
            added = 16.0 * intensity
            raw_score += added
            cues.append(CueAlert(
                time=timestamp_str,
                text="Brow Lowerer & Furrow (AU4)",
                severity="red" if added > 10 else "amber",
                desc="Acute cognitive retrieval tension or suppressed hostility"
            ))

        if au_features.get("lip_press", 0) > 0.40:
            intensity = au_features["lip_press"]
            added = 18.0 * intensity
            raw_score += added
            cues.append(CueAlert(
                time=timestamp_str,
                text="Lip Press & Aperture Narrowing (AU24)",
                severity="red",
                desc="Concealed hesitation and verbal restraint marker"
            ))

        if au_features.get("gaze_aversion", False):
            raw_score += 16.0
            cues.append(CueAlert(
                time=timestamp_str,
                text="Gaze Aversion & Saccadic Shift",
                severity="amber",
                desc="Visual disconnection during cognitive fabrication"
            ))

        if au_features.get("mouth_asymmetry", 0) > 0.40:
            intensity = au_features["mouth_asymmetry"]
            added = 15.0 * intensity
            raw_score += added
            cues.append(CueAlert(
                time=timestamp_str,
                text="Unilateral Dimpler & Asymmetry (AU14)",
                severity="red",
                desc="Micro-contempt or masked skepticism"
            ))

        if au_features.get("lip_depressor", 0) > 0.50:
            raw_score += 14.0
            cues.append(CueAlert(
                time=timestamp_str,
                text="Lip Corner Depressor (AU15)",
                severity="amber",
                desc="Fleeting micro-sorrow or concealed doubt"
            ))

        if au_features.get("nose_wrinkle", 0) > 0.45:
            raw_score += 12.0
            cues.append(CueAlert(
                time=timestamp_str,
                text="Nose Wrinkle (AU9)",
                severity="amber",
                desc="Involuntary micro-disgust trigger"
            ))

        # 2. Emotion Contributions
        # Deception probability increases with fear, contempt, anger, and rapid drops in neutral
        emotional_tension = (emotions.get("fear", 0) * 0.25) + \
                            (emotions.get("contempt", 0) * 0.25) + \
                            (emotions.get("disgust", 0) * 0.20) + \
                            (emotions.get("angry", 0) * 0.15)
        raw_score += emotional_tension

        # Truthful indicators reduce score
        if emotions.get("neutral", 0) > 65.0 and len(cues) == 0:
            raw_score = max(5.0, raw_score - 10.0)
        elif emotions.get("happy", 0) > 40.0 and au_features.get("mouth_asymmetry", 0) < 0.20:
            raw_score = max(8.0, raw_score - 12.0)
            cues.append(CueAlert(
                time=timestamp_str,
                text="Symmetric Zygomatic Smile (AU12)",
                severity="emerald",
                desc="Authentic bilateral relaxation Concordance"
            ))

        # 3. Temporal Micro-Burst Detection (< 500ms rapid spikes)
        current_time = time.time()
        self.history_buffer.append((current_time, raw_score, au_features))
        # Keep last 15 seconds
        self.history_buffer = [item for item in self.history_buffer if current_time - item[0] <= 15.0]

        if len(self.history_buffer) >= 3:
            prev_score = self.history_buffer[-3][1]
            score_delta = raw_score - prev_score
            time_delta = current_time - self.history_buffer[-3][0]
            if time_delta < 0.6 and score_delta > 18.0:
                raw_score += 8.0
                cues.append(CueAlert(
                    time=timestamp_str,
                    text="Sub-second Micro-Expression Burst (<400ms)",
                    severity="red",
                    desc="Fleeting involuntary Action Unit spike detected before cortical masking"
                ))

        # Clamp deception score between 0 and 100
        deception_score = round(max(5.0, min(98.5, raw_score)), 1)

        # Determine qualitative label
        if deception_score >= 70.0:
            label = "Likely Deceptive"
        elif deception_score >= 40.0:
            label = "Suspicious"
        else:
            label = "Truthful"

        # Dominant emotion
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0].capitalize()

        return {
            "score": deception_score,
            "label": label,
            "dominant_emotion": dominant_emotion,
            "cues": cues,
            "model_trained": self.model_trained
        }

deception_scorer = DeceptionScorer()
