import os
import json
import random
import shutil
from pathlib import Path
import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "dataset" / "raw"
PROCESSED_DIR = BASE_DIR / "dataset" / "processed"
CLASSES = ["happy", "sad", "angry", "fear", "surprise", "disgust", "contempt", "neutral"]

# Haar cascade for fallback face detection
HAAR_FACE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def crop_and_align_face(image_bgr: np.ndarray, target_size: int = 224) -> np.ndarray:
    """
    Detects face bounding box, centers and resizes to target_size x target_size.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    faces = HAAR_FACE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60))

    if len(faces) > 0:
        # Choose largest detected face
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        # Add 10% margin
        margin_x = int(w * 0.1)
        margin_y = int(h * 0.1)
        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(image_bgr.shape[1], x + w + margin_x)
        y2 = min(image_bgr.shape[0], y + h + margin_y)
        cropped = image_bgr[y1:y2, x1:x2]
    else:
        # If no face detected, central crop
        h, w = image_bgr.shape[:2]
        min_dim = min(h, w)
        cy, cx = h // 2, w // 2
        cropped = image_bgr[cy - min_dim//2 : cy + min_dim//2, cx - min_dim//2 : cx + min_dim//2]

    return cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)

def augment_image(image_bgr: np.ndarray) -> list[np.ndarray]:
    """
    Applies data augmentations: horizontal flip, brightness adjustment, small rotation (+-8 deg).
    """
    augmented = [image_bgr]

    # 1. Horizontal flip
    flipped = cv2.flip(image_bgr, 1)
    augmented.append(flipped)

    # 2. Brightness variation
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * random.uniform(0.85, 1.15), 0, 255)
    bright_adj = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    augmented.append(bright_adj)

    # 3. Small rotation
    angle = random.choice([-8, 8])
    center = (112, 112)
    rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image_bgr, rot_mat, (224, 224), borderMode=cv2.BORDER_REFLECT)
    augmented.append(rotated)

    return augmented

def preprocess_dataset(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, augment=True):
    print("[TruthLens Preprocessing] Starting dataset ingestion...")
    
    # Initialize output folders
    for split in ["train", "val", "test"]:
        for cls in CLASSES:
            (PROCESSED_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    class_counts = {}

    for cls in CLASSES:
        cls_raw_dir = RAW_DIR / cls
        if not cls_raw_dir.exists():
            continue

        images = [f for f in cls_raw_dir.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]]
        random.shuffle(images)
        n = len(images)
        class_counts[cls] = n

        if n == 0:
            print(f"  [Warning] Class '{cls}' has 0 raw images. Skipping.")
            continue

        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        splits_map = {
            "train": images[:n_train],
            "val": images[n_train:n_train + n_val],
            "test": images[n_train + n_val:]
        }

        for split_name, img_files in splits_map.items():
            out_cls_dir = PROCESSED_DIR / split_name / cls
            for idx, img_path in enumerate(img_files):
                img = cv2.imread(str(img_path))
                if img is None:
                    continue

                processed = crop_and_align_face(img, target_size=224)
                base_name = f"{cls}_{idx:04d}.jpg"
                cv2.imwrite(str(out_cls_dir / base_name), processed)

                # Apply augmentations on training set only
                if split_name == "train" and augment:
                    aug_images = augment_image(processed)
                    for a_idx, aug_img in enumerate(aug_images[1:]):
                        aug_name = f"{cls}_{idx:04d}_aug{a_idx+1}.jpg"
                        cv2.imwrite(str(out_cls_dir / aug_name), aug_img)

        print(f"  Processed '{cls}': {n} raw images -> splits: {len(splits_map['train'])} train, {len(splits_map['val'])} val, {len(splits_map['test'])} test.")

    # Save class indices
    with open(PROCESSED_DIR / "class_indices.json", "w") as f:
        json.dump({cls: i for i, cls in enumerate(CLASSES)}, f, indent=2)

    print("\n[TruthLens Preprocessing] Dataset preprocessing completed successfully!")
    print(f"Processed output directory: {PROCESSED_DIR}")

if __name__ == "__main__":
    preprocess_dataset()
