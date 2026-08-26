#!/usr/bin/env python3
"""Verify that an annotated release tag exists locally and remotely at one commit."""

import argparse
import re
import subprocess
import sys


SEMVER_TAG = re.compile(r"^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$")


def git(*args):
    result = subprocess.run(
        ["git", *args], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def remote_tag_targets(output, tag):
    direct = None
    peeled = None
    for line in output.splitlines():
        fields = line.split()
        if len(fields) != 2:
            continue
        object_id, ref = fields
        if ref == "refs/tags/" + tag:
            direct = object_id
        elif ref == "refs/tags/" + tag + "^{}":
            peeled = object_id
    return direct, peeled


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("tag", help="SemVer tag such as v0.4.0")
    parser.add_argument("expected_commit", nargs="?", default="HEAD")
    parser.add_argument("--remote", default="origin")
    args = parser.parse_args()

    if not SEMVER_TAG.fullmatch(args.tag):
        parser.error("tag must be vX.Y.Z SemVer")

    try:
        expected = git("rev-parse", args.expected_commit + "^{commit}")
        if git("cat-file", "-t", "refs/tags/" + args.tag) != "tag":
            raise RuntimeError(args.tag + " is not an annotated tag")
        local = git("rev-parse", "refs/tags/" + args.tag + "^{}")
        remote_output = git(
            "ls-remote", args.remote,
            "refs/tags/" + args.tag,
            "refs/tags/" + args.tag + "^{}",
        )
        remote_direct, remote_peeled = remote_tag_targets(remote_output, args.tag)
        if not remote_direct or not remote_peeled:
            raise RuntimeError("remote annotated tag or peeled target is missing")
        if local != expected or remote_peeled != expected:
            raise RuntimeError(
                "tag target mismatch: expected %s, local %s, remote %s"
                % (expected, local, remote_peeled)
            )
    except RuntimeError as error:
        print("RELEASE TAG FAIL: " + str(error), file=sys.stderr)
        return 1

    print("RELEASE TAG PASS: %s -> %s (local and %s)" % (
        args.tag, expected, args.remote
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
