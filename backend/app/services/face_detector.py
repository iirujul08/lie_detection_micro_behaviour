import cv2
import numpy as np
import mediapipe as mp
from typing import Optional, Dict, Any, Tuple

class FaceDetector:
    def __init__(self, max_num_faces: int = 1, min_detection_confidence: float = 0.5, min_tracking_confidence: float = 0.5):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=max_num_faces,
            refine_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )

    def process_frame(self, image_bgr: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Process a BGR image frame and return landmark points, bounding box, and pose.
        """
        if image_bgr is None or image_bgr.size == 0:
            return None

        h, w = image_bgr.shape[:2]
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(image_rgb)

        if not results.multi_face_landmarks:
            return None

        # Take first detected face
        face_landmarks = results.multi_face_landmarks[0]
        landmarks_list = []
        xs, ys = [], []

        for lm in face_landmarks.landmark:
            px, py, pz = int(lm.x * w), int(lm.y * h), lm.z
            landmarks_list.append((px, py, pz))
            xs.append(px)
            ys.append(py)

        # Bounding box
        min_x, max_x = max(0, min(xs)), min(w, max(xs))
        min_y, max_y = max(0, min(ys)), min(h, max(ys))
        bbox = {
            "x": int(min_x),
            "y": int(min_y),
            "width": int(max_x - min_x),
            "height": int(max_y - min_y)
        }

        # Estimate head pose (pitch, yaw, roll) using key 3D landmarks
        pose = self._estimate_head_pose(landmarks_list, w, h)

        return {
            "landmarks": landmarks_list,
            "raw_landmarks": face_landmarks,
            "bbox": bbox,
            "pose": pose,
            "image_shape": (h, w)
        }

    def _estimate_head_pose(self, landmarks, w, h) -> Dict[str, float]:
        """
        Approximate head pose using standard PnP points.
        Nose tip (1), Chin (152), Left eye outer (33), Right eye outer (263),
        Left mouth corner (61), Right mouth corner (291).
        """
        try:
            image_points = np.array([
                landmarks[1][:2],    # Nose tip
                landmarks[152][:2],  # Chin
                landmarks[33][:2],   # Left eye outer corner
                landmarks[263][:2],  # Right eye outer corner
                landmarks[61][:2],   # Left mouth corner
                landmarks[291][:2]   # Right mouth corner
            ], dtype="double")

            model_points = np.array([
                (0.0, 0.0, 0.0),             # Nose tip
                (0.0, -330.0, -65.0),        # Chin
                (-225.0, 170.0, -135.0),     # Left eye outer corner
                (225.0, 170.0, -135.0),      # Right eye outer corner
                (-150.0, -150.0, -125.0),    # Left mouth corner
                (150.0, -150.0, -125.0)      # Right mouth corner
            ])

            focal_length = w
            center = (w / 2, h / 2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype="double")

            dist_coeffs = np.zeros((4, 1))
            success, rot_vec, trans_vec = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
            )

            if success:
                rot_mat, _ = cv2.Rodrigues(rot_vec)
                angles, _, _, _, _, _ = cv2.RQDecomp3x3(rot_mat)
                pitch, yaw, roll = angles[0], angles[1], angles[2]
                return {
                    "pitch": round(float(pitch), 1),
                    "yaw": round(float(yaw), 1),
                    "roll": round(float(roll), 1)
                }
        except Exception:
            pass

        return {"pitch": 0.0, "yaw": 0.0, "roll": 0.0}

# Global singleton detector
face_detector = FaceDetector()
