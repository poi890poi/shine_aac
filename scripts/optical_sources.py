"""Policy boundary for optical-rig media.

Release and automated tests may use only manifest-declared HTTPS media with
source, author, license, and checksum metadata. This module deliberately has no
code path for arbitrary local or user-provided video files.
"""

REQUIRED_SOURCE_FIELDS = ("url", "page", "license", "author", "sha1")


def is_licensed_public_source(source):
    """Return True only for a fully attributed, checksum-pinned HTTPS source."""
    return bool(
        source
        and all(source.get(field) for field in REQUIRED_SOURCE_FIELDS)
        and str(source["url"]).startswith("https://")
    )


def cheek_calibration_cases(manifest, trial_count=6):
    """Build neutral and repeated positive setup cases from public manifest data."""
    positive = next(
        (
            case
            for case in manifest.get("cheek_cases", [])
            if case.get("expect") == "activate"
        ),
        None,
    )
    if not positive:
        return []

    source = next(
        (
            item
            for item in manifest.get("sources", [])
            if item.get("id") == positive.get("source")
        ),
        None,
    )
    if not is_licensed_public_source(source):
        return []

    neutral = dict(
        positive,
        id="downloaded_cheek_neutral",
        expect="no_activate",
        rest_at=float(positive.get("rest_at", 0.0)),
    )
    trials = [
        dict(positive, id="downloaded_cheek_trial_%02d" % index)
        for index in range(1, trial_count + 1)
    ]
    return [neutral] + trials
