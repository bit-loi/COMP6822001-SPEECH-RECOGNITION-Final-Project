import json
import time
from pathlib import Path

import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "dataset.npz"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "results"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
TRAIN_LIMIT = 100_000
LATENCY_SAMPLE_COUNT = 100


def pool_features(sequences):
    """
    Convert variable-length MFCC feature sequences into
    fixed-length vectors using mean and standard deviation.

    Expected input per recording: (features, frames)
    Expected output per recording: 78 values for 39 channels.
    """
    vectors = []

    for i, sequence in enumerate(sequences):
        sequence = np.asarray(sequence, dtype=np.float32)

        if sequence.ndim != 2:
            raise ValueError(
                f"Sequence {i} must be 2D, "
                f"but has shape {sequence.shape}"
            )

        if sequence.shape[0] != 39 and sequence.shape[1] == 39:
            sequence = sequence.T

        if sequence.shape[0] != 39:
            raise ValueError(
                f"Sequence {i} should have 39 feature channels, "
                f"but has shape {sequence.shape}"
            )

        sequence = np.nan_to_num(
            sequence,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        mean = np.mean(sequence, axis=1)
        std = np.std(sequence, axis=1)

        vector = np.concatenate([mean, std])
        vectors.append(vector)

    return np.stack(vectors).astype(np.float32)

print("Loading dataset...")

data = np.load(DATA_PATH, allow_pickle=True)

X_train_all = pool_features(data["train_features"])
y_train_all = np.asarray(data["train_labels"]).astype(str)

X_test = pool_features(data["test_features"])
y_test = np.asarray(data["test_labels"]).astype(str)

labels = sorted(np.unique(y_train_all).tolist())

print("Full training set:", X_train_all.shape)
print("Test set:", X_test.shape)
print("Number of classes:", len(labels))
print("Classes:", labels)

if len(y_train_all) > TRAIN_LIMIT:
    X_train, _, y_train, _ = train_test_split(
        X_train_all,
        y_train_all,
        train_size=TRAIN_LIMIT,
        stratify=y_train_all,
        random_state=RANDOM_STATE,
    )
else:
    X_train = X_train_all
    y_train = y_train_all

print("Training subset:", X_train.shape)
print("The same subset will be used for all three models.")

models = {
    "SVM_RBF": make_pipeline(
        StandardScaler(),
        SVC(
            kernel="rbf",
            C=10,
            gamma="scale",
            cache_size=1000,
        ),
    ),

    "Random_Forest": RandomForestClassifier(
        n_estimators=200,
        max_features="sqrt",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    ),

    "KNN": make_pipeline(
        StandardScaler(),
        KNeighborsClassifier(
            n_neighbors=5,
            weights="distance",
            n_jobs=-1,
        ),
    ),
}

summary = {}

for model_name, model in models.items():
    print("\n" + "=" * 60)
    print("MODEL:", model_name)
    print("=" * 60)

    print("Training...")
    train_start = time.perf_counter()
    model.fit(X_train, y_train)
    train_seconds = time.perf_counter() - train_start

    print(f"Training time: {train_seconds:.2f} seconds")

    print("Predicting on the full test set...")
    predict_start = time.perf_counter()
    predictions = model.predict(X_test)
    total_inference_seconds = time.perf_counter() - predict_start

    accuracy = accuracy_score(y_test, predictions)
    f1_values = f1_score(
        y_test,
        predictions,
        labels=labels,
        average=None,
        zero_division=0,
    )

    cm = confusion_matrix(
        y_test,
        predictions,
        labels=labels,
    )

    average_batch_ms = (
        total_inference_seconds / len(X_test) * 1000
    )

    individual_latencies = []

    for i in range(min(LATENCY_SAMPLE_COUNT, len(X_test))):
        start = time.perf_counter()
        model.predict(X_test[i:i + 1])
        elapsed_ms = (time.perf_counter() - start) * 1000
        individual_latencies.append(elapsed_ms)

    median_single_ms = float(
        np.median(individual_latencies)
    )

    print(f"Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"Average batch throughput cost: {average_batch_ms:.3f} ms/record")
    print(f"Median single-record latency: {median_single_ms:.3f} ms")
    print("\nPer-class F1:")

    for label, value in zip(labels, f1_values):
        print(f"{label}: {value:.4f}")

    print("\nClassification report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=labels,
            zero_division=0,
        )
    )

    model_path = MODEL_DIR / f"{model_name}.joblib"
    joblib.dump(model, model_path)

    np.save(
        RESULTS_DIR / f"{model_name}_confusion_matrix.npy",
        cm,
    )
    np.save(
        RESULTS_DIR / f"{model_name}_labels.npy",
        np.asarray(labels),
    )

    report = classification_report(
        y_test,
        predictions,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )

    with open(
        RESULTS_DIR / f"{model_name}_classification_report.json",
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(report, file, indent=2)

    summary[model_name] = {
        "accuracy": float(accuracy),
        "macro_f1": float(np.mean(f1_values)),
        "training_seconds": float(train_seconds),
        "test_prediction_seconds": float(total_inference_seconds),
        "average_batch_ms_per_record": float(average_batch_ms),
        "median_single_record_ms": median_single_ms,
        "training_examples": int(len(y_train)),
        "test_examples": int(len(y_test)),
        "model_file": str(model_path.relative_to(ROOT)),
    }

    print("Saved model:", model_path)

summary_path = RESULTS_DIR / "classical_model_comparison.json"

with open(summary_path, "w", encoding="utf-8") as file:
    json.dump(summary, file, indent=2)

print("\n" + "=" * 70)
print("MODEL COMPARISON")
print("=" * 70)

print(
    f"{'Model':<18} {'Accuracy':>10} {'Macro F1':>10} "
    f"{'Train (s)':>12} {'Median ms':>12}"
)

for name, result in summary.items():
    print(
        f"{name:<18} "
        f"{result['accuracy']:>10.4f} "
        f"{result['macro_f1']:>10.4f} "
        f"{result['training_seconds']:>12.2f} "
        f"{result['median_single_record_ms']:>12.3f}"
    )

print("\nComparison saved to:", summary_path)
print("All models and evaluation artifacts have been saved.")
 