#!/usr/bin/env python3
"""Import the MOE's 37 official Bopomofo recordings as a small app pack."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path


SOURCE_URL = (
    "https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/"
    "bopomofo_materials_20170213.zip"
)

SPEECH_NAMES = {
    "ㄅ": "玻", "ㄆ": "坡", "ㄇ": "摸", "ㄈ": "佛",
    "ㄉ": "得", "ㄊ": "特", "ㄋ": "呢", "ㄌ": "勒",
    "ㄍ": "哥", "ㄎ": "科", "ㄏ": "喝",
    "ㄐ": "基", "ㄑ": "七", "ㄒ": "西",
    "ㄓ": "知", "ㄔ": "吃", "ㄕ": "詩", "ㄖ": "日",
    "ㄗ": "資", "ㄘ": "疵", "ㄙ": "思",
    "ㄚ": "啊", "ㄛ": "喔", "ㄜ": "鵝", "ㄝ": "欸",
    "ㄞ": "唉", "ㄟ": "欸", "ㄠ": "凹", "ㄡ": "歐",
    "ㄢ": "安", "ㄣ": "恩", "ㄤ": "昂", "ㄥ": "鞥", "ㄦ": "兒",
    "ㄧ": "衣", "ㄨ": "烏", "ㄩ": "迂",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="shine-aac-moe-bopomofo-") as temporary:
        temporary_path = Path(temporary)
        archive = args.archive or temporary_path / "bopomofo.zip"
        if args.archive is None:
            urllib.request.urlretrieve(SOURCE_URL, archive)

        with zipfile.ZipFile(archive) as source:
            source.extract("license.txt", temporary_path)
            entries = []
            for index, symbol in enumerate((chr(code) for code in range(0x3105, 0x312A)), start=1):
                source_name = f"audio/F{index}.WAV"
                wave_path = temporary_path / f"F{index}.WAV"
                wave_path.write_bytes(source.read(source_name))
                output_name = f"f{index:02d}.m4a"
                subprocess.run(
                    [
                        args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                        "-i", str(wave_path), "-c:a", "aac", "-b:a", "48k",
                        "-movflags", "+faststart", str(args.output / output_name),
                    ],
                    check=True,
                )
                entries.append(
                    {
                        "text": SPEECH_NAMES[symbol],
                        "zhuyin": symbol,
                        "audio": output_name,
                    }
                )

            license_text = (temporary_path / "license.txt").read_text(encoding="utf-8-sig")
            (args.output / "NOTICE.txt").write_text(
                license_text
                + "\n\n來源：教育部《國語注音符號手冊》之37個注音符號動畫及音檔\n"
                + SOURCE_URL
                + "\n",
                encoding="utf-8",
            )

    manifest = {
        "schemaVersion": 1,
        "id": "shine-aac-moe-bopomofo",
        "displayName": "教育部人聲注音",
        "locale": "zh-TW",
        "style": "官方人聲",
        "scope": "zhuyin-overlay",
        "previewText": "玻坡摸佛",
        "source": SOURCE_URL,
        "license": "CC BY 4.0",
        "attribution": "2017 © 教育部，國語注音符號手冊-開放部件。",
        "entries": entries,
    }
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
