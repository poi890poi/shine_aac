#!/usr/bin/env python3
# Download public optical-rig sample media into a gitignored local directory.
# Python 3.7+

import argparse
import hashlib
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path.cwd()
SOURCES = ROOT / "testdata/optical-rig/sources.json"
OUT = ROOT / "testdata/optical-rig/downloaded"

def sha1(path):
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def download_one(item, dst):
    req = urllib.request.Request(
        item["url"],
        headers={"User-Agent": "SHINE-AAC-optical-rig/1.0"}
    )
    tmp = dst.with_suffix(dst.suffix + ".part")
    delays = (0, 5, 15)
    last_error = None

    for delay in delays:
        if delay:
            print("RETRY", item["id"], "in", delay, "seconds")
            time.sleep(delay)
        try:
            with urllib.request.urlopen(req, timeout=60) as src, tmp.open("wb") as out:
                shutil.copyfileobj(src, out)
            return tmp
        except urllib.error.HTTPError as e:
            last_error = e
            try:
                tmp.unlink()
            except Exception:
                pass
            if e.code != 429:
                break
        except Exception as e:
            last_error = e
            try:
                tmp.unlink()
            except Exception:
                pass
            break

    print("WARN download failed for %s: %s" % (item["id"], last_error))
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not SOURCES.exists():
        raise SystemExit("Run from repository root; missing " + str(SOURCES))

    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    attribution = []
    failures = []

    for item in data.get("sources", []):
        dst = OUT / item["filename"]
        expected = item.get("sha1")

        if dst.exists() and not args.force:
            got = sha1(dst)
            if not expected or got.lower() == expected.lower():
                print("OK", item["id"], dst)
                attribution.append(item)
                continue
            print("Checksum mismatch; re-downloading", dst)

        tmp = download_one(item, dst)
        if tmp is None:
            failures.append(item)
            continue

        got = sha1(tmp)
        if expected and got.lower() != expected.lower():
            try:
                tmp.unlink()
            except Exception:
                pass
            print(
                "WARN SHA-1 mismatch for %s: got %s expected %s" %
                (item["id"], got, expected)
            )
            failures.append(item)
            continue

        tmp.replace(dst)
        print("DOWNLOADED", item["id"], dst)
        attribution.append(item)

    lines = [
        "SHINE AAC optical-rig local stimulus attribution",
        "================================================",
        "",
        "These files are downloaded for local test use and are not committed.",
        "",
    ]
    for item in attribution:
        lines.extend([
            item["id"],
            "  Author: " + item.get("author", ""),
            "  License: " + item.get("license", ""),
            "  Source page: " + item.get("page", ""),
            "  Original URL: " + item.get("url", ""),
            "",
        ])

    if failures:
        lines.extend(["Unavailable during this fetch:", ""])
        for item in failures:
            lines.append("  " + item["id"])
        lines.append("")

    (OUT / "ATTRIBUTION.txt").write_text("\n".join(lines), encoding="utf-8")
    return 0

if __name__ == "__main__":
    sys.exit(main())
