import json
import argparse
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support

BASE_DIR = Path(__file__).resolve().parent
SAVED_MODELS_DIR = BASE_DIR / "saved_models"
SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

def find_test_dir() -> Path:
    if (BASE_DIR / "dataset" / "test").exists():
        return BASE_DIR / "dataset" / "test"
    if (BASE_DIR / "dataset" / "processed" / "test").exists():
        return BASE_DIR / "dataset" / "processed" / "test"
    if (BASE_DIR / "dataset" / "val").exists():
        return BASE_DIR / "dataset" / "val"
    return None

def plot_and_save_confusion_matrix(cm, class_names, out_path: Path):
    plt.figure(figsize=(8, 6))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title('TruthLens Micro-Expression Confusion Matrix', fontsize=13, fontweight='bold')
    plt.colorbar()
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=45, ha='right')
    plt.yticks(tick_marks, class_names)

    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     ha="center", va="center",
                     color="white" if cm[i, j] > thresh else "black")

    plt.ylabel('Ground Truth Label', fontweight='semibold')
    plt.xlabel('Predicted Label', fontweight='semibold')
    plt.tight_layout()
    plt.savefig(str(out_path), dpi=200)
    plt.close()
    print(f"[TruthLens] Saved confusion matrix heatmap to: {out_path}")

def evaluate(max_samples_per_class: int = 150):
    weights_path = SAVED_MODELS_DIR / "micro_expression_mobilenet.pt"
    test_dir = find_test_dir()
    classes_path = SAVED_MODELS_DIR / "classes.json"

    if not weights_path.exists():
        print(f"[TruthLens] No checkpoint found at {weights_path}. Please run `python ml/train.py` first.")
        return

    if not test_dir or not test_dir.exists():
        print(f"[TruthLens] Test dataset folder not found. Please ensure `ml/dataset/test/` exists.")
        return

    try:
        import torch
        from torchvision import datasets, transforms, models

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        test_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        test_dataset = datasets.ImageFolder(str(test_dir), transform=test_transform)
        classes = test_dataset.classes

        # Subsample for fast evaluation if max_samples_per_class provided
        if max_samples_per_class:
            indices = []
            counts = {i: 0 for i in range(len(classes))}
            for idx, (_, target) in enumerate(test_dataset.samples):
                if counts[target] < max_samples_per_class:
                    indices.append(idx)
                    counts[target] += 1
            eval_dataset = torch.utils.data.Subset(test_dataset, indices)
        else:
            eval_dataset = test_dataset

        test_loader = torch.utils.data.DataLoader(eval_dataset, batch_size=32, shuffle=False)

        model = models.mobilenet_v2(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = torch.nn.Linear(in_features, len(classes))
        model.load_state_dict(torch.load(weights_path, map_location=device))
        model.to(device)
        model.eval()

        all_preds, all_targets = [], []
        print(f"[TruthLens] Evaluating model on {len(eval_dataset)} test samples across {len(classes)} classes...")
        with torch.no_grad():
            for inputs, targets in test_loader:
                inputs = inputs.to(device)
                outputs = model(inputs)
                _, preds = outputs.max(1)
                all_preds.extend(preds.cpu().numpy())
                all_targets.extend(targets.numpy())

        acc = float(accuracy_score(all_targets, all_preds)) * 100.0
        prec, rec, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average='weighted', zero_division=0)
        cm = confusion_matrix(all_targets, all_preds)

        # Map emotions to 3-state Deception indicators for TruthLens assessment
        # Truthful control: happy, neutral
        # Suspicious cognitive strain: surprise, sad, fear
        # Deceptive emotional leakage: angry, disgust, contempt
        emotion_to_deception = {
            "happy": 0, "neutral": 0,
            "surprise": 1, "sad": 1, "fear": 1,
            "angry": 2, "disgust": 2, "contempt": 2
        }
        mapped_targets = [emotion_to_deception.get(classes[t].lower(), 0) for t in all_targets]
        mapped_preds = [emotion_to_deception.get(classes[p].lower(), 0) for p in all_preds]
        deception_cm = confusion_matrix(mapped_targets, mapped_preds, labels=[0, 1, 2])

        results = {
            "model_trained": True,
            "model_name": "MobileNetV2-MicroFACS-Trained",
            "backbone": f"MobileNetV2 PyTorch ({len(classes)}-Class Micro-Expression)",
            "classes": classes,
            "accuracy": round(acc, 1),
            "precision": round(float(prec) * 100.0, 1),
            "recall": round(float(rec) * 100.0, 1),
            "f1_score": round(float(f1) * 100.0, 1),
            "confusion_matrix": deception_cm.tolist(),
            "emotion_confusion_matrix": cm.tolist(),
            "class_distribution": {
                "truthful": int(sum(1 for m in mapped_targets if m == 0)),
                "suspicious": int(sum(1 for m in mapped_targets if m == 1)),
                "likely_deceptive": int(sum(1 for m in mapped_targets if m == 2)),
                **{cls: int(sum(1 for t in all_targets if t == i)) for i, cls in enumerate(classes)}
            },
            "notice": None
        }

        with open(SAVED_MODELS_DIR / "evaluation_metrics.json", "w") as f:
            json.dump(results, f, indent=2)

        plot_and_save_confusion_matrix(cm, classes, SAVED_MODELS_DIR / "confusion_matrix.png")
        print(f"[TruthLens] Evaluation Complete!")
        print(f"  Accuracy:  {acc:.1f}%")
        print(f"  Precision: {prec*100:.1f}%")
        print(f"  Recall:    {rec*100:.1f}%")
        print(f"  F1 Score:  {f1*100:.1f}%")
        print(f"Metrics saved to: {SAVED_MODELS_DIR / 'evaluation_metrics.json'}")

    except Exception as e:
        print(f"[TruthLens] Evaluation error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Evaluate TruthLens MobileNetV2 Classifier")
    parser.add_argument("--samples", type=int, default=150, help="Max test samples per class (default 150). Use 0 for full test set.")
    parser.add_argument("--full", action="store_true", help="Evaluate full test set")
    args = parser.parse_args()

    max_samples = None if args.full or args.samples == 0 else args.samples
    evaluate(max_samples_per_class=max_samples)

if __name__ == "__main__":
    main()
