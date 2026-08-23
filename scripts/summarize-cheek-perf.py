#!/usr/bin/env python3
import argparse
import re
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("result_dir", nargs="?", default=None)
args = ap.parse_args()

if args.result_dir:
    root = Path(args.result_dir)
else:
    candidates = sorted(
        [p for p in Path("test-results").glob("*") if p.is_dir()],
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    if not candidates:
        raise SystemExit("No test-results directory found.")
    root = candidates[0]

pat = re.compile(
    r"CHEEK_PERF\s+path=(\S+)\s+frames=(\d+)\s+avgUs=(\d+)\s+maxUs=(\d+)\s+size=(\d+)x(\d+)"
)
rows = []
for p in root.rglob("*"):
    if not p.is_file():
        continue
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue
    for m in pat.finditer(text):
        rows.append((
            m.group(1), int(m.group(2)), int(m.group(3)),
            int(m.group(4)), m.group(5) + "x" + m.group(6), str(p)
        ))

if not rows:
    raise SystemExit("No CHEEK_PERF samples found under " + str(root))

frames = sum(r[1] for r in rows)
weighted_us = sum(r[1] * r[2] for r in rows) / float(frames)
max_us = max(r[3] for r in rows)
print("Result:", root)
print("Samples:", len(rows))
print("Frames:", frames)
print("Weighted average analyzer time: %.2f ms" % (weighted_us / 1000.0))
print("Maximum reported analyzer time: %.2f ms" % (max_us / 1000.0))
print("Path(s):", ", ".join(sorted(set(r[0] for r in rows))))
print("Resolution(s):", ", ".join(sorted(set(r[4] for r in rows))))
