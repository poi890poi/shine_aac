# Blink model benchmark

This benchmark measures the bundled MediaPipe Face Landmarker independently of
the Android camera, UI, calibration flow, and AAC activation state machine.
Every frame is evaluated independently in MediaPipe `IMAGE` mode. Video files
are only the dataset's storage format; frame order and timestamps are not inputs
to inference or scoring.

## Dataset

EyeBlink8 is published under GPL-3.0 by the eyeBlink research project. It has
eight videos of four people and 70,992 annotated frames. One person wears
glasses. The benchmark evaluates the static eye state in each eligible frame;
it does not evaluate blink speed, duration, intervals, or user agility.

- Page: <https://www.blinkingmatters.com/research>
- Archive: <https://www.blinkingmatters.com/files/upload/research/eyeblink8.zip>
- Expected bytes: `312670860`
- SHA-256: `856cb82f3437f3c0d94633027cb74cf74186920ca5926aeebb630d715eba9295`

Extract the archive outside source control. The repository `.tmp/` directory is
ignored and is the default cache used during development.

## Run

Install the pinned dependencies into an isolated environment, then run:

```powershell
python scripts/benchmarks/blink_model/benchmark.py `
  --dataset-root .tmp/blink-model-benchmark/dataset/eyeblink8 `
  --model android-inputs/src/main/assets/face_landmarker.task `
  --output test-results/blink-model-eyeblink8
```

Use `--max-frames 60 --force` for a smoke run. A completed video is written to
its own CSV, so a full run can resume without repeating completed videos.

## Interpretation

For each eye, a positive frame is annotated as 90-100% closed (`FC=C`). A
negative frame is visible, frontal, and outside every annotated blink interval.
Partially closed transition frames, invisible eyes, and non-frontal frames are
excluded from binary eye-state scoring and reported separately.

EyeBlink8 names eyes by their image position. MediaPipe names blendshapes by the
person's anatomical side, so the unmirrored dataset's image-left annotation is
compared with `eyeBlinkRight`, and image-right with `eyeBlinkLeft`. Bilateral AAC
scores are invariant to this swap.

The report includes two views:

1. **Detected-frame classification** measures blink score discrimination only
   when the Face Landmarker returned scores.
2. **Including missing outputs** treats a missing score as not closed. This
   shows the recall impact of face/blendshape failure without involving Android.

Threshold sweeps are diagnostic. Their best threshold is fitted on this same
small dataset and must not be copied into production.
