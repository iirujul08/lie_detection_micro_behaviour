import math
import numpy as np
from typing import Dict, Any, List

class LandmarkFeatureExtractor:
    """
    Extracts FACS Action Units and micro-facial movements from 468 MediaPipe FaceMesh landmarks.
    """

    @staticmethod
    def _dist(p1, p2) -> float:
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    def extract_features(self, landmarks: List[tuple], image_shape: tuple) -> Dict[str, Any]:
        h, w = image_shape
        lm = landmarks
        
        # Inter-pupillary or eye-corner distance for scale normalization
        # Left eye outer corner: 33, Right eye outer corner: 263
        eye_width = max(1.0, self._dist(lm[33], lm[263]))

        # 1. Eye Aspect Ratio (EAR) for both eyes (AU45 blink)
        # Left eye: top (159), bottom (145), inner (133), outer (33)
        left_ear = self._dist(lm[159], lm[145]) / max(1.0, self._dist(lm[33], lm[133]))
        # Right eye: top (386), bottom (374), inner (362), outer (263)
        right_ear = self._dist(lm[386], lm[374]) / max(1.0, self._dist(lm[263], lm[362]))
        avg_ear = (left_ear + right_ear) / 2.0
        is_blinking = avg_ear < 0.18

        # 2. Gaze Direction & Gaze Aversion (Iris landmarks: Left 468, Right 473)
        gaze_aversion = False
        gaze_ratio = 0.5
        if len(lm) >= 474:
            left_iris = lm[468]
            eye_left_inner = lm[133]
            eye_left_outer = lm[33]
            eye_span = max(1.0, self._dist(eye_left_outer, eye_left_inner))
            iris_to_outer = self._dist(left_iris, eye_left_outer)
            gaze_ratio = iris_to_outer / eye_span
            # If eyes shifted significantly left (<0.32) or right (>0.68)
            if gaze_ratio < 0.32 or gaze_ratio > 0.68:
                gaze_aversion = True

        # 3. AU4: Brow Lowerer / Furrow (Distance between inner brows 55 and 285)
        inner_brow_dist = self._dist(lm[55], lm[285]) / eye_width
        # Normal relaxed inner brow ratio is ~0.35 - 0.42. Below 0.30 indicates furrow
        brow_furrow_intensity = max(0.0, min(1.0, (0.35 - inner_brow_dist) / 0.12))

        # 4. AU1 + AU2: Eyebrow Raise (Distance from brow to eye center)
        left_brow_raise = self._dist(lm[70], lm[159]) / eye_width
        right_brow_raise = self._dist(lm[300], lm[386]) / eye_width
        avg_brow_raise = (left_brow_raise + right_brow_raise) / 2.0
        brow_raise_intensity = max(0.0, min(1.0, (avg_brow_raise - 0.22) / 0.10))

        # 5. AU12 vs AU14: Lip Corner Puller vs Asymmetry (Dimpler / Contempt)
        # Mouth left (61), right (291), upper (13), lower (14)
        mouth_width = self._dist(lm[61], lm[291]) / eye_width
        mouth_corner_height_diff = abs(lm[61][1] - lm[291][1]) / eye_width
        asymmetry_intensity = max(0.0, min(1.0, mouth_corner_height_diff / 0.08))

        # 6. AU15: Lip Corner Depressor (Downturned mouth)
        # Compare mouth corners Y to lower lip center Y
        mouth_center_y = (lm[13][1] + lm[14][1]) / 2.0
        left_depressed = lm[61][1] > mouth_center_y + (0.015 * h)
        right_depressed = lm[291][1] > mouth_center_y + (0.015 * h)
        lip_depressor_intensity = 1.0 if (left_depressed and right_depressed) else (0.5 if (left_depressed or right_depressed) else 0.0)

        # 7. AU24: Lip Press / Tightener (Distance between upper lip 13 and lower lip 14)
        lip_aperture = self._dist(lm[13], lm[14]) / eye_width
        lip_press_intensity = max(0.0, min(1.0, (0.07 - lip_aperture) / 0.05))

        # 8. AU9: Nose Wrinkle (Disgust trigger)
        # Distance between nose bridge (168) and nose tip (1)
        nose_compress = self._dist(lm[168], lm[1]) / eye_width
        nose_wrinkle_intensity = max(0.0, min(1.0, (0.28 - nose_compress) / 0.08))

        return {
            "eye_aspect_ratio": round(avg_ear, 3),
            "is_blinking": is_blinking,
            "gaze_aversion": gaze_aversion,
            "gaze_ratio": round(gaze_ratio, 2),
            "brow_furrow": round(brow_furrow_intensity, 2),
            "brow_raise": round(brow_raise_intensity, 2),
            "mouth_asymmetry": round(asymmetry_intensity, 2),
            "lip_depressor": round(lip_depressor_intensity, 2),
            "lip_press": round(lip_press_intensity, 2),
            "nose_wrinkle": round(nose_wrinkle_intensity, 2),
            "mouth_width": round(mouth_width, 2)
        }

landmark_extractor = LandmarkFeatureExtractor()
