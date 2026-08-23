#!/usr/bin/env sh
set -eu
python3 "$(dirname "$0")/scripts/device-acceptance-test.py" "$@"
