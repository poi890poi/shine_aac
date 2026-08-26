import importlib.util
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "verify_release_tag", Path(__file__).with_name("verify-release-tag.py")
)
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)
SEMVER_TAG = VERIFY.SEMVER_TAG
remote_tag_targets = VERIFY.remote_tag_targets


class ReleaseTagVerificationTest(unittest.TestCase):
    def test_accepts_only_plain_semver_release_tags(self):
        self.assertIsNotNone(SEMVER_TAG.fullmatch("v0.4.0"))
        self.assertIsNotNone(SEMVER_TAG.fullmatch("v1.12.3"))
        self.assertIsNone(SEMVER_TAG.fullmatch("0.4.0"))
        self.assertIsNone(SEMVER_TAG.fullmatch("v0.4.1-rc1"))

    def test_reads_annotated_remote_tag_and_peeled_commit(self):
        direct, peeled = remote_tag_targets(
            "a" * 40 + "\trefs/tags/v0.4.0\n" +
            "b" * 40 + "\trefs/tags/v0.4.0^{}\n",
            "v0.4.0",
        )
        self.assertEqual("a" * 40, direct)
        self.assertEqual("b" * 40, peeled)


if __name__ == "__main__":
    unittest.main()
