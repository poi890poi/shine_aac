# Release Process

SHINE AAC uses one release version for source, APK metadata, tags, and release files.

## Version Source

Edit `version.properties`:

```properties
versionName=0.4.0
versionCode=60
```

- `versionName`: public SemVer version.
- `versionCode`: Android integer version code. Always increase it.

## Tags

Use only SemVer release tags:

```text
v0.2.0
v0.2.1
v0.3.0
```

Avoid new milestone-style tags such as `zh-tw-mvp-v1`. Put milestone notes in release notes instead.

Pushing a `vX.Y.Z` tag starts the GitHub validation workflow. Hosted CI uses a
disposable Android debug key, so its APK is test evidence only and must never be
published as the user-downloadable release. GitHub Release publication is a
separate host-side step after physical testing.

## APK Files

Install the pinned web build dependency once after cloning or whenever `package-lock.json` changes:

```powershell
npm ci
```

Build and package a versioned debug APK:

```powershell
.\package-release.bat -SdkDir E:\Android\Sdk
```

This creates ignored local artifacts:

```text
.artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-debug.apk
.artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-debug.zip
.artifacts\releases\v0.4.0\SHA256SUMS.txt
.artifacts\releases\v0.4.0\RELEASE_NOTES.md
```

Packaging verifies the APK signing certificate against
`config\direct-debug-cert.sha256`. This pins the persistent host debug key and
prevents publishing an APK that Android cannot install over prior direct
releases. Back up the corresponding host debug keystore; losing it means future
direct APKs cannot update existing installations.

When `docs\releases\vX.Y.Z.md` exists, packaging copies it into the artifact directory and tagged-release CI can use it as the GitHub Release notes. Otherwise the package script creates a minimal fallback note.

Do not share `app-debug.apk` directly. It is an intermediate build output and is overwritten on every build.
Do not commit APK, AAB, or ZIP files. The debug APK is for direct-install smoke testing only. Do not upload it to Play Console.

## Google Play AAB

Google Play uploads use a signed release Android App Bundle. Direct-install and
physical-test APKs are always the versioned debug APK from `package-release.bat`;
do not build or distribute a separately release-signed APK.

Generate an upload keystore outside Git, then build and package the signed AAB with:

```powershell
.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties
```

The versioned artifacts and checksums are created at:

```text
.artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-release.aab
.artifacts\releases\v0.4.0\PLAY_AAB_SHA256SUMS.txt
.artifacts\releases\v0.4.0\RELEASE_NOTES.md
```

The AAB under `app\build\outputs` is an overwriteable intermediate output.
Upload the versioned AAB from `.artifacts` to the Google Play Internal testing
track. Confirm its version code has not already been used in Play Console.

Keep the real keystore properties file and `.jks` file out of Git. Use `keystore.properties.example` as the template.

## Minimal Release Checklist

Google Play notes are generated from `config/play-release-notes.json`. Update
its version name/code and the existing `zh-TW` and `en-IN` translations, then run
`python scripts/play-release-notes.py --write`. The generated
`docs/PLAY_RELEASE_NOTES.md` contains only the language-tagged copy/paste payload.
Each language is limited to 500 Unicode characters; tags occupy separate lines.
The locale choices come from this app's existing Play listing, not a universal
Google requirement. [Google Play format requirements](https://support.google.com/googleplay/android-developer/answer/9859348).

Both packaging commands fail on stale versions, missing locales, oversized text
or a stale generated document, and export `PLAY_RELEASE_NOTES.txt` beside the
artifacts. The APK ZIP includes it. Paste that file into Play Console;
`RELEASE_NOTES.md` is the detailed changelog and is not a Play Console payload.
Run `npm run test:release-notes` to verify the format/version regression cases.

For temporary tunnel downloads, serve the explicit artifact directory with
`python scripts/serve-release-downloads.py --directory <delivery-directory>`.
Text responses must declare `charset=utf-8`; valid bytes and matching hashes
alone do not establish correct browser display. Verify the public response's
charset and rendered Chinese text before sharing the Play notes link. The
download regression checks real HTTP headers/decoding and unchanged APK bytes.

1. Run `npm ci`.
2. Update `version.properties`.
3. Run `npm run test:core`.
4. Run `npm run test:web:e2e` and `npm run test:web:packaged`.
5. Run `.\package-release.bat -SdkDir E:\Android\Sdk` and use the debug APK for the direct-install runtime smoke.
6. Run `.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties`.
7. Verify the versioned debug APK and signed AAB, their checksum files, version name, version code, and AAB signing identity.
8. Create and push an annotated tag `vX.Y.Z` on the exact application source commit.
9. From the tested host, publish the exact versioned debug APK, ZIP, checksum,
   and release notes. Never substitute the hosted-CI APK.
10. Upload the versioned `.aab` to Play Console Internal testing and configure
    testers. Do not upload the debug APK to Play.

```powershell
git tag -a v0.4.0 -m "SHINE AAC v0.4.0"
git push origin v0.4.0
python scripts\verify-release-tag.py v0.4.0 <release-commit>
```

Do not mark the release complete unless the verifier reports that the local annotated
tag and the remote peeled tag both resolve to the exact intended release commit.

Example host-side GitHub publication after the tag validation succeeds:

```powershell
gh release create v0.4.0 `
  .artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-debug.apk `
  .artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-debug.zip `
  .artifacts\releases\v0.4.0\SHA256SUMS.txt `
  --title "SHINE AAC v0.4.0" `
  --notes-file .artifacts\releases\v0.4.0\RELEASE_NOTES.md
```

If the release already exists, use `gh release upload ... --clobber` and then
`gh release edit ... --notes-file ...`. Download the public asset, verify its
SHA-256 and pinned signing certificate, and install it with `adb install -r` over
the physically tested build before declaring delivery complete.

## Physical-device release gates

Before release, run `device-test.bat` on a physical Android device and review its
`FINDINGS.md`. Unresolved P0/P1 findings block release.

If the release changes camera-switch acquisition, blink/cheek detection, calibration,
classifier timing, optical indication, lifecycle behavior, or activation routing, also
run `optical-rig-test.bat`. The optical gate always exercises cheek calibration and
runtime with checksum-verified, publicly licensed media from
`testdata/optical-rig/sources.json`. Private or user-uploaded face recordings are
prohibited in release automation.
