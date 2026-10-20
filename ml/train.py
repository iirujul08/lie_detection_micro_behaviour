import os
import json
import argparse
import time
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms, models

BASE_DIR = Path(__file__).resolve().parent
SAVED_MODELS_DIR = BASE_DIR / "saved_models"
SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

def find_dataset_dir() -> Path:
    """Finds the dataset directory with train and test/val splits."""
    if (BASE_DIR / "dataset" / "train").exists():
        return BASE_DIR / "dataset"
    if (BASE_DIR / "dataset" / "processed" / "train").exists():
        return BASE_DIR / "dataset" / "processed"
    if (BASE_DIR / "dataset" / "raw").exists():
        return BASE_DIR / "dataset" / "raw"
    raise FileNotFoundError("Could not find dataset with train/ folder. Please place train/ in ml/dataset/")

def get_data_loaders(data_dir: Path, batch_size: int = 32, max_samples_per_class: int = None):
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_path = data_dir / "train"
    val_path = data_dir / "val" if (data_dir / "val").exists() else (data_dir / "test")

    if not train_path.exists():
        raise FileNotFoundError(f"Training path {train_path} does not exist.")

    train_dataset = datasets.ImageFolder(str(train_path), transform=train_transform)
    classes = train_dataset.classes

    # Save classes.json for backend reference
    with open(SAVED_MODELS_DIR / "classes.json", "w") as f:
        json.dump(classes, f, indent=2)

    val_dataset = datasets.ImageFolder(str(val_path), transform=val_transform) if val_path.exists() else None

    # Subsample if max_samples_per_class is specified (for fast training on CPU)
    if max_samples_per_class:
        train_indices = []
        class_counts = {i: 0 for i in range(len(classes))}
        for idx, (_, target) in enumerate(train_dataset.samples):
            if class_counts[target] < max_samples_per_class:
                train_indices.append(idx)
                class_counts[target] += 1
        train_dataset = Subset(train_dataset, train_indices)

        if val_dataset:
            val_indices = []
            val_counts = {i: 0 for i in range(len(classes))}
            max_val = max(50, max_samples_per_class // 4)
            for idx, (_, target) in enumerate(val_dataset.samples):
                if val_counts[target] < max_val:
                    val_indices.append(idx)
                    val_counts[target] += 1
            val_dataset = Subset(val_dataset, val_indices)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0) if val_dataset else None

    return train_loader, val_loader, classes

def build_model(num_classes: int, freeze_backbone: bool = True):
    # Transfer learning using MobileNetV2
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    
    if freeze_backbone:
        for param in model.features.parameters():
            param.requires_grad = False

    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, num_classes)
    )
    return model

def train_model(epochs: int = 10, batch_size: int = 32, lr: float = 1e-3, patience: int = 4, max_samples_per_class: int = 500, freeze_backbone: bool = True):
    print("=" * 65)
    print("  TRUTHLENS ML: TRAINING MOBILENET-V2 MICRO-EXPRESSION BACKBONE")
    print("=" * 65)

    data_dir = find_dataset_dir()
    print(f"[Dataset] Loading data from: {data_dir}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Device] Using {device} for training.")

    train_loader, val_loader, classes = get_data_loaders(
        data_dir, batch_size=batch_size, max_samples_per_class=max_samples_per_class
    )
    print(f"[Dataset] Detected classes ({len(classes)}): {classes}")
    print(f"[Dataset] Training batches: {len(train_loader)}")

    model = build_model(num_classes=len(classes), freeze_backbone=freeze_backbone).to(device)
    
    # Trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"[Model] Trainable parameters: {trainable_params:,} / {total_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr, weight_decay=1e-3)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=2)

    best_val_loss = float("inf")
    patience_counter = 0
    save_path = SAVED_MODELS_DIR / "micro_expression_mobilenet.pt"

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        
        # --- Training Phase ---
        model.train()
        train_loss, train_correct, total_train = 0.0, 0, 0
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * inputs.size(0)
            _, preds = outputs.max(1)
            train_correct += (preds == targets).sum().item()
            total_train += inputs.size(0)

        epoch_train_loss = train_loss / total_train
        epoch_train_acc = (train_correct / total_train) * 100.0

        # --- Validation Phase ---
        epoch_val_loss = epoch_train_loss
        epoch_val_acc = epoch_train_acc

        if val_loader:
            model.eval()
            val_loss, val_correct, total_val = 0.0, 0, 0
            with torch.no_grad():
                for inputs, targets in val_loader:
                    inputs, targets = inputs.to(device), targets.to(device)
                    outputs = model(inputs)
                    loss = criterion(outputs, targets)
                    val_loss += loss.item() * inputs.size(0)
                    _, preds = outputs.max(1)
                    val_correct += (preds == targets).sum().item()
                    total_val += inputs.size(0)

            epoch_val_loss = val_loss / total_val
            epoch_val_acc = (val_correct / total_val) * 100.0
            scheduler.step(epoch_val_loss)

        elapsed = time.time() - epoch_start
        print(f"Epoch [{epoch:02d}/{epochs:02d}] ({elapsed:.1f}s) - "
              f"Train Loss: {epoch_train_loss:.4f}, Acc: {epoch_train_acc:.1f}% | "
              f"Val Loss: {epoch_val_loss:.4f}, Acc: {epoch_val_acc:.1f}%")

        # Checkpointing
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            patience_counter = 0
            torch.save(model.state_dict(), str(save_path))
            print(f"  --> Best checkpoint saved to {save_path} (Val Loss: {best_val_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"[Early Stopping] Triggered after {epoch} epochs without validation improvement.")
                break

    print("\n[TruthLens ML] Training completed successfully!")
    print(f"Best model weights saved at: {save_path}")

def main():
    parser = argparse.ArgumentParser(description="Train TruthLens MobileNetV2 Emotion/Micro-Expression Classifier")
    parser.add_argument("--epochs", type=int, default=8, help="Number of training epochs (default 8)")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size (default 32)")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default 1e-3)")
    parser.add_argument("--patience", type=int, default=4, help="Early stopping patience (default 4)")
    parser.add_argument("--samples", type=int, default=400, help="Max samples per class for fast training (default 400). Use 0 for full dataset.")
    parser.add_argument("--full", action="store_true", help="Train on the full dataset without subsampling")
    args = parser.parse_args()

    max_samples = None if args.full or args.samples == 0 else args.samples
    train_model(
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        patience=args.patience,
        max_samples_per_class=max_samples,
        freeze_backbone=True
    )

if __name__ == "__main__":
    main()
