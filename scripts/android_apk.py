import argparse
import json
import re
from pathlib import Path


def parse_device_abis(value):
    return [item for item in re.split(r"[\s,]+", value or "") if item]


def resolve_debug_apk(output_directory, device_abis):
    """Resolve Gradle's universal or ABI-split debug APK for one device."""
    output_directory = Path(output_directory).resolve()
    universal = output_directory / "app-debug.apk"
    if universal.is_file():
        return universal

    metadata_path = output_directory / "output-metadata.json"
    if not metadata_path.is_file():
        raise FileNotFoundError(
            "No universal APK or Gradle output metadata in %s" % output_directory
        )
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    elements = metadata.get("elements", [])

    def element_abi(element):
        return next((
            item.get("value")
            for item in element.get("filters", [])
            if item.get("filterType") == "ABI"
        ), None)

    ordered = []
    for abi in device_abis:
        ordered.extend(element for element in elements if element_abi(element) == abi)
    ordered.extend(element for element in elements if element_abi(element) is None)

    for element in ordered:
        filename = element.get("outputFile")
        if not filename:
            continue
        candidate = (output_directory / filename).resolve()
        if candidate.parent == output_directory and candidate.is_file():
            return candidate

    available = sorted(
        "%s:%s" % (element_abi(element) or "universal", element.get("outputFile"))
        for element in elements
    )
    raise FileNotFoundError(
        "No APK matched device ABI(s) %s; available outputs: %s" %
        (list(device_abis), available)
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-directory", required=True)
    parser.add_argument("--device-abis", required=True)
    args = parser.parse_args()
    print(resolve_debug_apk(
        args.output_directory,
        parse_device_abis(args.device_abis),
    ))


if __name__ == "__main__":
    main()
