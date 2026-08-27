#!/usr/bin/env python3
"""Time-independent EyeBlink8 benchmark for the bundled MediaPipe task."""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib
import json
import platform
import statistics
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


DATASET_SHA256 = "856cb82f3437f3c0d94633027cb74cf74186920ca5926aeebb630d715eba9295"
DIAGNOSTIC_THRESHOLD = 0.55


@dataclass(frozen=True)
class Annotation:
    frame_id: int
    blink_id: int
    frontal: bool
    image_left_closed: bool
    image_left_visible: bool
    image_right_closed: bool
    image_right_visible: bool


@dataclass(frozen=True)
class Confusion:
    tp: int = 0
    fp: int = 0
    tn: int = 0
    fn: int = 0

    @property
    def precision(self) -> Optional[float]:
        return safe_div(self.tp, self.tp + self.fp)

    @property
    def recall(self) -> Optional[float]:
        return safe_div(self.tp, self.tp + self.fn)

    @property
    def specificity(self) -> Optional[float]:
        return safe_div(self.tn, self.tn + self.fp)

    @property
    def accuracy(self) -> Optional[float]:
        return safe_div(self.tp + self.tn, self.tp + self.fp + self.tn + self.fn)

    @property
    def balanced_accuracy(self) -> Optional[float]:
        if self.recall is None or self.specificity is None:
            return None
        return (self.recall + self.specificity) / 2.0

    @property
    def f1(self) -> Optional[float]:
        if self.precision is None or self.recall is None or self.precision + self.recall == 0:
            return None
        return 2 * self.precision * self.recall / (self.precision + self.recall)


def safe_div(numerator: int, denominator: int) -> Optional[float]:
    return None if denominator == 0 else numerator / denominator


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_annotations(path: Path) -> Dict[int, Annotation]:
    result: Dict[int, Annotation] = {}
    with path.open("r", encoding="utf-8", errors="replace") as source:
        for line in source:
            if not line or not line[0].isdigit():
                continue
            fields = line.rstrip("\r\n").split(":")
            if len(fields) != 19:
                raise ValueError(f"{path}: expected 19 fields, found {len(fields)}")
            frame_id = int(fields[0])
            result[frame_id] = Annotation(
                frame_id=frame_id,
                blink_id=int(fields[1]),
                frontal=fields[2] != "N",
                image_left_closed=fields[3] == "C",
                image_left_visible=fields[4] != "N",
                image_right_closed=fields[5] == "C",
                image_right_visible=fields[6] != "N",
            )
    return result


def labeled_eye_state(annotation: Annotation, image_side: str) -> Optional[bool]:
    if not annotation.frontal:
        return None
    if image_side == "left":
        visible = annotation.image_left_visible
        closed = annotation.image_left_closed
    else:
        visible = annotation.image_right_visible
        closed = annotation.image_right_closed
    if not visible:
        return None
    if closed:
        return True
    if annotation.blink_id == -1:
        return False
    return None


def labeled_bilateral_state(annotation: Annotation) -> Optional[bool]:
    if not annotation.frontal:
        return None
    if not annotation.image_left_visible or not annotation.image_right_visible:
        return None
    if annotation.image_left_closed and annotation.image_right_closed:
        return True
    if annotation.blink_id == -1:
        return False
    return None


def confusion_for_samples(
    samples: Iterable[Tuple[bool, Optional[float]]],
    threshold: float,
    missing_as_negative: bool,
) -> Confusion:
    tp = fp = tn = fn = 0
    for expected, score in samples:
        if score is None and not missing_as_negative:
            continue
        predicted = score is not None and score >= threshold
        if expected and predicted:
            tp += 1
        elif expected:
            fn += 1
        elif predicted:
            fp += 1
        else:
            tn += 1
    return Confusion(tp=tp, fp=fp, tn=tn, fn=fn)


def wilson_interval(successes: int, total: int) -> Optional[List[float]]:
    if total <= 0:
        return None
    z = 1.959963984540054
    proportion = successes / total
    denominator = 1.0 + z * z / total
    center = (proportion + z * z / (2.0 * total)) / denominator
    margin = z * (
        proportion * (1.0 - proportion) / total + z * z / (4.0 * total * total)
    ) ** 0.5 / denominator
    return [max(0.0, center - margin), min(1.0, center + margin)]


def confusion_dict(value: Confusion) -> Dict[str, object]:
    result = asdict(value)
    result.update(
        precision=value.precision,
        recall=value.recall,
        specificity=value.specificity,
        accuracy=value.accuracy,
        balanced_accuracy=value.balanced_accuracy,
        f1=value.f1,
        precision_95_wilson=wilson_interval(value.tp, value.tp + value.fp),
        recall_95_wilson=wilson_interval(value.tp, value.tp + value.fn),
    )
    return result


def percentile(values: Sequence[float], fraction: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))
    return ordered[index]


def distribution(values: Sequence[float]) -> Dict[str, Optional[float]]:
    return {
        "count": len(values),
        "min": min(values) if values else None,
        "p05": percentile(values, 0.05),
        "median": percentile(values, 0.50),
        "p95": percentile(values, 0.95),
        "max": max(values) if values else None,
        "mean": statistics.fmean(values) if values else None,
    }


def score_distribution(samples: Sequence[Tuple[bool, Optional[float]]]) -> Dict[str, object]:
    positives = [float(score) for expected, score in samples if expected and score is not None]
    negatives = [float(score) for expected, score in samples if not expected and score is not None]
    return {
        "positive": distribution(positives),
        "negative": distribution(negatives),
        "missing_positive": sum(expected and score is None for expected, score in samples),
        "missing_negative": sum(not expected and score is None for expected, score in samples),
    }


def ranking_metrics(samples: Sequence[Tuple[bool, Optional[float]]]) -> Dict[str, Optional[float]]:
    detected = [(expected, float(score)) for expected, score in samples if score is not None]
    positives = sum(expected for expected, _ in detected)
    negatives = len(detected) - positives
    if positives == 0 or negatives == 0:
        return {"roc_auc": None, "average_precision": None}

    ordered = sorted(detected, key=lambda item: item[1])
    positive_rank_sum = 0.0
    index = 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and ordered[end][1] == ordered[index][1]:
            end += 1
        average_rank = ((index + 1) + end) / 2.0
        positive_rank_sum += average_rank * sum(expected for expected, _ in ordered[index:end])
        index = end
    roc_auc = (
        positive_rank_sum - positives * (positives + 1) / 2.0
    ) / (positives * negatives)

    found = 0
    precision_sum = 0.0
    for rank, (expected, _) in enumerate(sorted(detected, key=lambda item: item[1], reverse=True), 1):
        if expected:
            found += 1
            precision_sum += found / rank
    return {"roc_auc": roc_auc, "average_precision": precision_sum / positives}


def threshold_sweep(samples: Sequence[Tuple[bool, Optional[float]]]) -> Dict[str, object]:
    curve: List[Dict[str, object]] = []
    best_threshold = 0.0
    best = Confusion()
    for step in range(101):
        threshold = step / 100.0
        confusion = confusion_for_samples(samples, threshold, missing_as_negative=False)
        curve.append({"threshold": threshold, **confusion_dict(confusion)})
        if confusion.f1 is not None and (best.f1 is None or confusion.f1 > best.f1):
            best_threshold = threshold
            best = confusion
    return {
        "best_threshold_same_dataset": best_threshold,
        "best_confusion_same_dataset": confusion_dict(best),
        "curve": curve,
    }


def discover_videos(dataset_root: Path) -> List[Tuple[str, Path, Path]]:
    videos = []
    for video in sorted(dataset_root.rglob("*.avi"), key=lambda path: int(path.parent.name)):
        videos.append((video.parent.name, video, video.with_suffix(".tag")))
    if not videos:
        raise FileNotFoundError(f"No AVI files found under {dataset_root}")
    return videos


def dataset_glasses_by_video(dataset_root: Path) -> Dict[str, bool]:
    result: Dict[str, bool] = {}
    for path in dataset_root.rglob("*.tag"):
        with path.open("r", encoding="utf-8", errors="replace") as source:
            for line in source:
                if line.lower().startswith("#glasses:"):
                    result[path.parent.name] = line.split(":", 1)[1].strip().upper() == "YES"
                    break
    return result


def load_runtime():
    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
        from mediapipe.tasks import python as mp_python  # type: ignore
        from mediapipe.tasks.python import vision  # type: ignore
    except ImportError as error:
        raise SystemExit("Install the pinned requirements before running the benchmark.") from error
    return cv2, mp, mp_python, vision


CSV_FIELDS = [
    "video_id", "frame_id", "annotated", "blink_id", "frontal",
    "image_left_closed", "image_left_visible", "image_right_closed",
    "image_right_visible", "face_detected", "eye_blink_left", "eye_blink_right",
]


def process_video(
    video_id: str,
    video_path: Path,
    annotation_path: Path,
    model_path: Path,
    output_path: Path,
    max_frames: Optional[int],
) -> Dict[str, object]:
    cv2, mp, mp_python, vision = load_runtime()
    annotations = parse_annotations(annotation_path)
    options = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model_path.resolve())),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.55,
        min_face_presence_confidence=0.55,
        min_tracking_confidence=0.55,
        output_face_blendshapes=True,
    )
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {video_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(".csv.part")
    frame_id = detected = 0
    with vision.FaceLandmarker.create_from_options(options) as landmarker, temporary.open(
        "w", newline="", encoding="utf-8"
    ) as destination:
        writer = csv.DictWriter(destination, fieldnames=CSV_FIELDS)
        writer.writeheader()
        while max_frames is None or frame_id < max_frames:
            ok, bgr = capture.read()
            if not ok:
                break
            image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB),
            )
            result = landmarker.detect(image)
            scores: Dict[str, float] = {}
            if result.face_blendshapes:
                scores = {
                    category.category_name: float(category.score)
                    for category in result.face_blendshapes[0]
                }
            left_score = scores.get("eyeBlinkLeft")
            right_score = scores.get("eyeBlinkRight")
            face_detected = left_score is not None and right_score is not None
            detected += int(face_detected)
            annotation = annotations.get(frame_id)
            writer.writerow({
                "video_id": video_id,
                "frame_id": frame_id,
                "annotated": int(annotation is not None),
                "blink_id": "" if annotation is None else annotation.blink_id,
                "frontal": "" if annotation is None else int(annotation.frontal),
                "image_left_closed": "" if annotation is None else int(annotation.image_left_closed),
                "image_left_visible": "" if annotation is None else int(annotation.image_left_visible),
                "image_right_closed": "" if annotation is None else int(annotation.image_right_closed),
                "image_right_visible": "" if annotation is None else int(annotation.image_right_visible),
                "face_detected": int(face_detected),
                "eye_blink_left": "" if left_score is None else f"{left_score:.9f}",
                "eye_blink_right": "" if right_score is None else f"{right_score:.9f}",
            })
            frame_id += 1
    capture.release()
    temporary.replace(output_path)
    return {"video_id": video_id, "frames": frame_id, "detected": detected}


def read_predictions(paths: Sequence[Path]) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for path in paths:
        with path.open("r", newline="", encoding="utf-8") as source:
            for raw in csv.DictReader(source):
                rows.append({
                    "video_id": raw["video_id"],
                    "frame_id": int(raw["frame_id"]),
                    "annotated": raw["annotated"] == "1",
                    "blink_id": None if raw["blink_id"] == "" else int(raw["blink_id"]),
                    "frontal": raw["frontal"] == "1",
                    "image_left_closed": raw["image_left_closed"] == "1",
                    "image_left_visible": raw["image_left_visible"] == "1",
                    "image_right_closed": raw["image_right_closed"] == "1",
                    "image_right_visible": raw["image_right_visible"] == "1",
                    "face_detected": raw["face_detected"] == "1",
                    "eye_blink_left": None if raw["eye_blink_left"] == "" else float(raw["eye_blink_left"]),
                    "eye_blink_right": None if raw["eye_blink_right"] == "" else float(raw["eye_blink_right"]),
                })
    return rows


def annotation_from_row(row: Dict[str, object]) -> Annotation:
    return Annotation(
        frame_id=int(row["frame_id"]),
        blink_id=int(row["blink_id"]),
        frontal=bool(row["frontal"]),
        image_left_closed=bool(row["image_left_closed"]),
        image_left_visible=bool(row["image_left_visible"]),
        image_right_closed=bool(row["image_right_closed"]),
        image_right_visible=bool(row["image_right_visible"]),
    )


def samples_for(rows: Sequence[Dict[str, object]], target: str) -> List[Tuple[bool, Optional[float]]]:
    samples: List[Tuple[bool, Optional[float]]] = []
    for row in rows:
        if not row["annotated"]:
            continue
        annotation = annotation_from_row(row)
        if target == "bilateral":
            expected = labeled_bilateral_state(annotation)
            left = row["eye_blink_left"]
            right = row["eye_blink_right"]
            score = None if left is None or right is None else (float(left) + float(right)) / 2.0
        else:
            expected = labeled_eye_state(annotation, target)
            # EyeBlink8 labels image position; MediaPipe labels anatomical side.
            score = row["eye_blink_right" if target == "left" else "eye_blink_left"]
        if expected is not None:
            samples.append((expected, None if score is None else float(score)))
    return samples


def summarize(
    rows: Sequence[Dict[str, object]], model_path: Path, dataset_root: Path
) -> Dict[str, object]:
    annotated = [row for row in rows if row["annotated"]]
    targets: Dict[str, object] = {}
    for target in ("left", "right", "bilateral"):
        samples = samples_for(rows, target)
        targets[target] = {
            "eligible_samples": len(samples),
            "diagnostic_raw_threshold": DIAGNOSTIC_THRESHOLD,
            "detected_frames": confusion_dict(
                confusion_for_samples(samples, DIAGNOSTIC_THRESHOLD, missing_as_negative=False)
            ),
            "including_missing_as_not_closed": confusion_dict(
                confusion_for_samples(samples, DIAGNOSTIC_THRESHOLD, missing_as_negative=True)
            ),
            "scores": score_distribution(samples),
            "ranking": ranking_metrics(samples),
            "threshold_sweep": threshold_sweep(samples),
        }
    glasses = dataset_glasses_by_video(dataset_root)
    bilateral_by_video: Dict[str, object] = {}
    for video_id in sorted({str(row["video_id"]) for row in rows}, key=int):
        samples = samples_for(
            [row for row in rows if str(row["video_id"]) == video_id], "bilateral"
        )
        bilateral_by_video[video_id] = {
            "glasses": glasses.get(video_id),
            **confusion_dict(
                confusion_for_samples(samples, DIAGNOSTIC_THRESHOLD, missing_as_negative=True)
            ),
        }
    mediapipe = importlib.import_module("mediapipe")
    opencv = importlib.import_module("cv2")
    return {
        "schema": 2,
        "scope": "independent static-frame model-artifact benchmark",
        "inference_mode": "IMAGE",
        "temporal_state": False,
        "model": {
            "path": str(model_path),
            "bytes": model_path.stat().st_size,
            "sha256": sha256_file(model_path),
        },
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "mediapipe": mediapipe.__version__,
            "opencv": opencv.__version__,
        },
        "dataset": {
            "name": "EyeBlink8",
            "license": "GPL-3.0",
            "archive_sha256": DATASET_SHA256,
            "videos": len({str(row["video_id"]) for row in rows}),
            "decoded_frames": len(rows),
            "annotated_frames": len(annotated),
            "people": 4,
            "people_with_glasses": 1,
        },
        "face_score_coverage": {
            "all_frames": safe_div(sum(bool(row["face_detected"]) for row in rows), len(rows)),
            "annotated_frames": safe_div(
                sum(bool(row["face_detected"]) for row in annotated), len(annotated)
            ),
        },
        "eye_state": targets,
        "bilateral_by_video": bilateral_by_video,
        "limitations": [
            "Only four people are represented; one wears glasses.",
            "No demographic labels are supplied for subgroup analysis.",
            "The diagnostic threshold is not a model default or an Android calibrated threshold.",
            "The best threshold is fitted and evaluated on the same data.",
            "Wilson intervals treat frames as independent and understate person-level uncertainty.",
            "Python MediaPipe uses the exact task artifact, but Android/Python numerical parity is not established.",
        ],
    }


def fmt_percent(value: Optional[float]) -> str:
    return "n/a" if value is None else f"{value * 100.0:.2f}%"


def write_markdown(summary: Dict[str, object], path: Path) -> None:
    dataset = summary["dataset"]
    coverage = summary["face_score_coverage"]
    lines = [
        "# MediaPipe eye-state benchmark — independent images",
        "",
        "Every annotated frame is evaluated independently in MediaPipe IMAGE mode.",
        "There are no timestamps, tracking history, frame-rate assumptions, blink intervals,",
        "hold durations, or AAC policy rules in these results.",
        "",
        "## Dataset and coverage",
        "",
        f"- Decoded frames: {dataset['decoded_frames']}; annotated frames: {dataset['annotated_frames']}.",
        f"- People: {dataset['people']}; people wearing glasses: {dataset['people_with_glasses']}.",
        f"- Face/blendshape coverage on annotated frames: {fmt_percent(coverage['annotated_frames'])}.",
        "",
        "## Threshold-independent model ranking",
        "",
        "| Target | ROC AUC | Average precision |",
        "| --- | ---: | ---: |",
    ]
    for target in ("left", "right", "bilateral"):
        metric = summary["eye_state"][target]["ranking"]
        lines.append(
            f"| Image-{target} | {metric['roc_auc']:.4f} | {metric['average_precision']:.4f} |"
        )
    lines.extend([
        "",
        "## Diagnostic raw-score operating point: 0.55",
        "",
        "This threshold is shown only for comparison. It is not supplied by the model and",
        "is not equivalent to Android's personalized normalized threshold.",
        "",
        "| Target | Precision | Recall | F1 | Balanced accuracy | TP / FP / TN / FN |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ])
    for target in ("left", "right", "bilateral"):
        metric = summary["eye_state"][target]["including_missing_as_not_closed"]
        lines.append(
            f"| Image-{target} | {fmt_percent(metric['precision'])} | {fmt_percent(metric['recall'])} | "
            f"{fmt_percent(metric['f1'])} | {fmt_percent(metric['balanced_accuracy'])} | "
            f"{metric['tp']} / {metric['fp']} / {metric['tn']} / {metric['fn']} |"
        )
    lines.extend([
        "",
        "## Same-dataset threshold sweep",
        "",
        "These are diagnostic upper estimates, not production recommendations.",
        "",
        "| Target | Threshold | Precision | Recall | F1 |",
        "| --- | ---: | ---: | ---: | ---: |",
    ])
    for target in ("left", "right", "bilateral"):
        sweep = summary["eye_state"][target]["threshold_sweep"]
        metric = sweep["best_confusion_same_dataset"]
        lines.append(
            f"| Image-{target} | {sweep['best_threshold_same_dataset']:.2f} | "
            f"{fmt_percent(metric['precision'])} | {fmt_percent(metric['recall'])} | "
            f"{fmt_percent(metric['f1'])} |"
        )
    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {item}" for item in summary["limitations"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--video-id", action="append")
    parser.add_argument("--max-frames", type=int)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--predict-only", action="store_true")
    parser.add_argument("--summarize-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.model.is_file():
        raise FileNotFoundError(args.model)
    all_videos = discover_videos(args.dataset_root)
    selected = set(args.video_id or [video_id for video_id, _, _ in all_videos])
    unknown = selected - {video_id for video_id, _, _ in all_videos}
    if unknown:
        raise ValueError(f"Unknown video IDs: {sorted(unknown)}")
    args.output.mkdir(parents=True, exist_ok=True)
    if not args.summarize_only:
        for video_id, video, annotation in all_videos:
            if video_id not in selected:
                continue
            output_path = args.output / "predictions" / f"video-{video_id}.csv"
            if output_path.exists() and not args.force:
                print(f"skip completed video {video_id}", flush=True)
                continue
            result = process_video(
                video_id, video, annotation, args.model, output_path, args.max_frames
            )
            print(json.dumps(result, sort_keys=True), flush=True)
    if args.predict_only:
        return 0

    prediction_paths = [
        args.output / "predictions" / f"video-{video_id}.csv"
        for video_id, _, _ in all_videos
    ]
    missing = [str(path) for path in prediction_paths if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing prediction files: " + ", ".join(missing))
    summary = summarize(read_predictions(prediction_paths), args.model, args.dataset_root)
    (args.output / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_markdown(summary, args.output / "REPORT.md")
    print(f"wrote {args.output / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
