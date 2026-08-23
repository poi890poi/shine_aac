#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
if [ ! -f "$ROOT/.optical-rig-python/cv2/__init__.py" ]; then
  echo "Installing rig-only OpenCV dependency..."
  python3 -m pip install --target "$ROOT/.optical-rig-python" opencv-python==4.8.1.78
fi
python3 "$ROOT/scripts/optical-rig-test.py" "$@"
