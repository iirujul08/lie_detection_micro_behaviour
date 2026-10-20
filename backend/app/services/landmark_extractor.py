import math
import numpy as np
from typing import Dict, Any, List

class LandmarkFeatureExtractor:
    """
    Extracts FACS Action Units and micro-facial movements from MediaPipe FaceMesh landmarks.
    Features:
    - Head roll compensation to prevent head tilts from triggering false asymmetry/contempt
    - Dual-iris gaze tracking (AU61/62 saccadic gaze)
    - Normalized Action Unit metrics for baseline-relative scoring
    """

    @staticmethod
    def _dist(p1, p2) -> float:
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    def extract_features(self, landmarks: List[tuple], image_shape: tuple) -> Dict[str, Any]:
        h, w = image_shape
        lm = landmarks

        # 1. Inter-ocular distance for scale normalization
        # Left eye outer (33), Right eye outer (263)
        eye_width = max(1.0, self._dist(lm[33], lm[263]))

        # 2. Estimate head roll angle (in radians)
        dx = lm[263][0] - lm[33][0]
        dy = lm[263][1] - lm[33][1]
        roll_rad = math.atan2(dy, dx)
        cos_r = math.cos(-roll_rad)
        sin_r = math.sin(-roll_rad)

        def rotate_pt(pt):
            # Rotate point to horizontal eye axis
            cx, cy = lm[1][0], lm[1][1] # nose tip as center
            rx = pt[0] - cx
            ry = pt[1] - cy
            nx = (rx * cos_r - ry * sin_r) + cx
            ny = (rx * sin_r + ry * cos_r) + cy
            return (nx, ny)

        # 3. Eye Aspect Ratio (EAR) for AU45 blink detection
        left_eye_h = self._dist(lm[159], lm[145])
        left_eye_w = max(1.0, self._dist(lm[33], lm[133]))
        left_ear = left_eye_h / left_eye_w

        right_eye_h = self._dist(lm[386], lm[374])
        right_eye_w = max(1.0, self._dist(lm[263], lm[362]))
        right_ear = right_eye_h / right_eye_w

        avg_ear = (left_ear + right_ear) / 2.0
        is_blinking = avg_ear < 0.17

        # 4. Dual-Iris Gaze Ratio (Iris: Left 468, Right 473)
        gaze_ratio = 0.50
        if len(lm) >= 474:
            # Left eye iris ratio
            iris_l = lm[468]
            eye_l_out = lm[33]
            eye_l_in = lm[133]
            left_ratio = self._dist(iris_l, eye_l_out) / max(1.0, self._dist(eye_l_out, eye_l_in))

            # Right eye iris ratio
            iris_r = lm[473]
            eye_r_in = lm[362]
            eye_r_out = lm[263]
            right_ratio = self._dist(iris_r, eye_r_in) / max(1.0, self._dist(eye_r_in, eye_r_out))

            gaze_ratio = (left_ratio + right_ratio) / 2.0

        # 5. AU4: Inner Brow Distance (Brow Lowerer & Furrow)
        # Distance between inner brow corners (55, 285) normalized by eye_width
        raw_inner_brow = self._dist(lm[55], lm[285]) / eye_width

        # 6. AU1+2: Brow Raise (Distance from brow to eye center)
        # Left brow (70) to eye (159), Right brow (300) to eye (386)
        raw_brow_dist = ((self._dist(lm[70], lm[159]) + self._dist(lm[300], lm[386])) / 2.0) / eye_width

        # 7. AU24: Lip Aperture (Distance between inner upper lip 13 and lower lip 14)
        raw_lip_aperture = self._dist(lm[13], lm[14]) / eye_width

        # 8. AU12: Mouth Width (Smile / Zygomatic contraction)
        raw_mouth_width = self._dist(lm[61], lm[291]) / eye_width

        # 9. AU14: Roll-Compensated Mouth Corner Asymmetry (Unilateral Dimpler / Contempt)
        rot_mouth_l = rotate_pt(lm[61])
        rot_mouth_r = rotate_pt(lm[291])
        mouth_vert_diff = abs(rot_mouth_l[1] - rot_mouth_r[1]) / eye_width

        # 10. AU15: Lip Corner Depressor (Downturned mouth)
        rot_center_lip = rotate_pt(lm[14])
        left_drop = (rot_mouth_l[1] - rot_center_lip[1]) / eye_width
        right_drop = (rot_mouth_r[1] - rot_center_lip[1]) / eye_width
        avg_lip_drop = max(0.0, (left_drop + right_drop) / 2.0)

        # 11. AU9: Nose Wrinkle (Disgust compression)
        nose_len = self._dist(lm[168], lm[1]) / eye_width

        return {
            "eye_aspect_ratio": round(float(avg_ear), 3),
            "is_blinking": is_blinking,
            "gaze_ratio": round(float(gaze_ratio), 3),
            "raw_inner_brow": round(float(raw_inner_brow), 3),
            "raw_brow_dist": round(float(raw_brow_dist), 3),
            "raw_lip_aperture": round(float(raw_lip_aperture), 3),
            "raw_mouth_width": round(float(raw_mouth_width), 3),
            "mouth_asymmetry": round(float(mouth_vert_diff), 3),
            "lip_depressor": round(float(avg_lip_drop), 3),
            "nose_compress": round(float(nose_len), 3),
            "eye_width": round(float(eye_width), 1),
            "roll_deg": round(float(math.degrees(roll_rad)), 1)
        }

landmark_extractor = LandmarkFeatureExtractor()
