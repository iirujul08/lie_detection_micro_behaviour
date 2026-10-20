# TruthLens Micro-Expression Dataset Guide

## Overview
Micro-expressions are sub-second involuntary facial disclosures lasting between 40ms and 200ms. In public research, complete universal interrogation datasets are scarce due to privacy and legal restrictions.

TruthLens is designed to train on micro-expression image benchmarks (such as **CASME II**, **SAMM**, **MEGC**, or high-resolution FACS cropped datasets like **RAF-DB** or **FER+**).

---

## Folder Organization

Place your raw image data in `ml/dataset/raw/` organized by emotion/Action Unit class:

```
ml/dataset/
├── raw/
│   ├── happy/
│   ├── sad/
│   ├── angry/
│   ├── fear/
│   ├── surprise/
│   ├── disgust/
│   ├── contempt/
│   └── neutral/
├── processed/
│   ├── train/
│   ├── val/
│   └── test/
└── README.md
```

Each subfolder contains `.jpg`, `.png`, or `.webp` images of human faces belonging to that class.

---

## Automated Dataset Helper

Run the dataset download helper:
```bash
python ml/download_dataset.py
```
If you have Kaggle API credentials (`~/.kaggle/kaggle.json`), the script will allow downloading public micro-expression benchmarks directly. Otherwise, it will initialize the expected directories and give step-by-step instructions.

---

## Preprocessing & Training
1. Preprocess and split into normalized 224x224 crops:
   ```bash
   python ml/preprocess.py
   ```
2. Train MobileNetV2 with early stopping:
   ```bash
   python ml/train.py --epochs 25 --batch-size 32 --lr 0.0001
   ```
3. Evaluate metrics and confusion matrix:
   ```bash
   python ml/evaluate.py
   ```
