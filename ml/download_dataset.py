import os
import sys
import argparse
from pathlib import Path
import numpy as np
import cv2

CLASSES = ["happy", "sad", "angry", "fear", "surprise", "disgust", "contempt", "neutral"]
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"
RAW_DIR = DATASET_DIR / "raw"

def check_kaggle_credentials() -> bool:
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.exists():
        return True
    if os.getenv("KAGGLE_USERNAME") and os.getenv("KAGGLE_KEY"):
        return True
    return False

def init_raw_directories():
    for cls in CLASSES:
        (RAW_DIR / cls).mkdir(parents=True, exist_ok=True)
    print(f"[TruthLens] Initialized class directories in: {RAW_DIR}")

def try_kaggle_download():
    print("[TruthLens] Checking Kaggle credentials...")
    if check_kaggle_credentials():
        try:
            import kaggle
            print("[TruthLens] Kaggle credentials found! Downloading benchmark micro-expression dataset...")
            # Attempt downloading FER2013 / micro-expression benchmark
            kaggle.api.dataset_download_files(
                "msambare/fer2013",
                path=str(RAW_DIR),
                unzip=True
            )
            print("[TruthLens] Kaggle download complete!")
            return True
        except Exception as e:
            print(f"[TruthLens] Kaggle download failed: {e}")
    else:
        print("[TruthLens] No Kaggle credentials found (~/.kaggle/kaggle.json or KAGGLE_USERNAME/KAGGLE_KEY).")
    return False

def print_manual_instructions():
    print("\n" + "=" * 70)
    print("  TRUTHLENS DATASET SETUP INSTRUCTIONS")
    print("=" * 70)
    print("Because no single universal micro-expression dataset exists in public")
    print("repositories without strict license agreements (e.g. CASME II, SAMM),")
    print("please download or export your facial expression dataset and drop the")
    print("images into the respective class directories:\n")
    for cls in CLASSES:
        print(f"  -> {RAW_DIR / cls}/")
    print("\nRecommended Public Micro-Expression & FACS Datasets:")
    print("  1. CASME II (Chinese Academy of Sciences Micro-Expression):")
    print("     http://casme.psych.ac.cn/casme/e2")
    print("  2. SAMM (Spontaneous Actions and Micro-Movements):")
    print("     https://www.mmu.ac.uk/research/research-centres/maths-computing/research-groups/cognitive-computing-and-creative-technologies/samm")
    print("  3. Kaggle Facial Expression Datasets (e.g. FER2013, RAF-DB):")
    print("     https://www.kaggle.com/datasets/msambare/fer2013")
    print("\nTip: To generate a quick synthetic sample set to test training immediately, run:")
    print("  python ml/download_dataset.py --generate-sample-data")
    print("=" * 70 + "\n")

def generate_sample_data(num_per_class: int = 15):
    """
    Generates synthetic facial benchmark crops for smoke-testing the training pipeline.
    """
    print(f"[TruthLens] Generating {num_per_class} sample test images per class in {RAW_DIR}...")
    for cls_idx, cls in enumerate(CLASSES):
        cls_dir = RAW_DIR / cls
        cls_dir.mkdir(parents=True, exist_ok=True)
        for i in range(num_per_class):
            img_path = cls_dir / f"sample_{cls}_{i+1:03d}.jpg"
            if not img_path.exists():
                # Create a 224x224 synthetic facial likeness
                img = np.zeros((224, 224, 3), dtype=np.uint8)
                # Face oval
                cv2.ellipse(img, (112, 112), (75, 95), 0, 0, 360, (180, 200, 220), -1)
                # Eyes
                eye_y = 95
                cv2.circle(img, (85, eye_y), 10, (50, 50, 60), -1)
                cv2.circle(img, (139, eye_y), 10, (50, 50, 60), -1)
                # Mouth shape based on class
                if cls == "happy":
                    cv2.ellipse(img, (112, 145), (28, 14), 0, 0, 180, (40, 40, 150), 3)
                elif cls in ("sad", "fear", "contempt"):
                    cv2.ellipse(img, (112, 160), (24, 12), 0, 180, 360, (40, 40, 150), 3)
                else:
                    cv2.line(img, (90, 150), (134, 150), (40, 40, 150), 3)
                # Add light noise for texture
                noise = np.random.randint(-15, 15, (224, 224, 3), dtype=np.int16)
                img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
                cv2.imwrite(str(img_path), img)

    print("[TruthLens] Sample test dataset generated successfully!")

def main():
    parser = argparse.ArgumentParser(description="TruthLens Dataset Downloader & Directory Initializer")
    parser.add_argument("--generate-sample-data", action="store_true", help="Generate synthetic test faces for quick training verification")
    args = parser.parse_args()

    init_raw_directories()

    if args.generate_sample_data:
        generate_sample_data()
        return

    success = try_kaggle_download()
    if not success:
        print_manual_instructions()

if __name__ == "__main__":
    main()
