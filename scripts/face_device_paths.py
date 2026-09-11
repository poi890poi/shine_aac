"""Keep raw Android benchmark evidence and private restoration state ignored."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def private_output_path(path):
    resolved = Path(path).resolve()
    private_root = (ROOT / '.tmp').resolve()
    if private_root not in resolved.parents:
        raise ValueError('Private state snapshots and raw evidence must stay in a new directory beneath workspace .tmp')
    return resolved
