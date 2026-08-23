#!/usr/bin/env python3
# Import a SHINE AAC cheek calibration session ZIP as a local optical-rig
# image-sequence stimulus. The face frames remain gitignored.
# Python 3.7+

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path.cwd()
LOCAL_ROOT = ROOT / "testdata/optical-rig/local"

def frame_duration_ms(rows, i):
    if i + 1 < len(rows):
        d = rows[i + 1]["capturedAtMs"] - rows[i]["capturedAtMs"]
        return max(50, min(400, int(d)))
    return 160

def make_frames(rows, session_dir):
    result = []
    for i, row in enumerate(rows):
        result.append({
            "url": "/local/%s/frames/frame-%d.jpg" % (session_dir.name, row["id"]),
            "ms": frame_duration_ms(rows, i),
            "phase": row.get("phase"),
            "trial": row.get("trial"),
            "score": row.get("score"),
        })
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", help="cheek-calibration-*.zip exported by SHINE AAC")
    args = ap.parse_args()

    src = Path(args.zip)
    if not src.exists():
        raise SystemExit("Missing ZIP: " + str(src))
    LOCAL_ROOT.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(str(src), "r") as z:
        summary = json.loads(z.read("summary.json").decode("utf-8"))
        rows = [
            json.loads(line)
            for line in z.read("frames.jsonl").decode("utf-8").splitlines()
            if line.strip()
        ]
        session_id = "cheek-%s" % summary.get("startedAtMs", "session")
        out = LOCAL_ROOT / session_id
        if out.exists():
            shutil.rmtree(str(out))
        (out / "frames").mkdir(parents=True)
        for row in rows:
            name = "frames/frame-%d.jpg" % row["id"]
            with z.open(name) as inp, (out / name).open("wb") as dst:
                shutil.copyfileobj(inp, dst)
        (out / "summary.json").write_text(
            json.dumps(summary, indent=2), encoding="utf-8"
        )

    cases = []
    neutral = [r for r in rows if r.get("phase") == "Neutral"]
    if neutral:
        cases.append({
            "id": "cheek_neutral",
            "gesture": "cheek",
            "expect": "no_activate",
            "severity": "P1",
            "mirror": bool(summary.get("mirrored", False)),
            "frames": make_frames(neutral, out),
            "note": "Neutral baseline frames from the imported calibration session."
        })

    trials = sorted(set(
        int(r.get("trial") or 0)
        for r in rows
        if r.get("phase") == "Active" and int(r.get("trial") or 0) > 0
    ))
    for tr in trials:
        rest = [r for r in rows if r.get("phase") == "Rest" and int(r.get("trial") or 0) == tr]
        active = [r for r in rows if r.get("phase") == "Active" and int(r.get("trial") or 0) == tr]
        after = []
        next_tr = tr + 1
        after_candidates = [
            r for r in rows
            if (
                (r.get("phase") == "Rest" and int(r.get("trial") or 0) == next_tr)
                or (tr == trials[-1] and r.get("phase") == "Idle")
            )
        ]
        after = after_candidates[:4]
        seq = rest + active + after
        if not active:
            continue
        cases.append({
            "id": "cheek_trial_%02d" % tr,
            "gesture": "cheek",
            "expect": "activate",
            "severity": "P1",
            # The exported frames are already front-camera mirrored. When they
            # are shown on a monitor and captured again by a front camera, the
            # detector will mirror once more. Pre-mirror on the monitor so the
            # detector receives approximately the original analyzer pixels.
            "mirror": bool(summary.get("mirrored", False)),
            "frames": make_frames(seq, out),
            "source_trial": tr,
            "note": "Rest + active trial + release frames from the imported calibration session."
        })

    manifest = {
        "schema": 1,
        "type": "shine-cheek-calibration-sequence",
        "session": summary,
        "cases": cases,
    }
    (out / "sequence-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("Imported:", out)
    print("Cases:", len(cases))
    print("Manifest:", out / "sequence-manifest.json")
    print()
    print("Privacy: this directory contains face images and is intentionally gitignored.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
