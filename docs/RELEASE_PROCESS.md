# Release Process

SHINE AAC uses one release version for source, APK metadata, tags, and release files.

## Version Source

Edit `version.properties`:

```properties
versionName=0.3.2
versionCode=54
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

Pushing a `vX.Y.Z` tag starts the GitHub release workflow. Treat its publication as best-effort infrastructure; it is separate from Google Play tracks.

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
.artifacts\releases\v0.3.2\shine-aac-v0.3.2-code54-debug.apk
.artifacts\releases\v0.3.2\SHA256SUMS.txt
.artifacts\releases\v0.3.2\RELEASE_NOTES.md
```

When `docs\releases\vX.Y.Z.md` exists, packaging copies it into the artifact directory and tagged-release CI can use it as the GitHub Release notes. Otherwise the package script creates a minimal fallback note.

Do not share `app-debug.apk` directly. It is an intermediate build output and is overwritten on every build.
Do not commit APK, AAB, or ZIP files. The debug APK is for direct-install smoke testing only. Do not upload it to Play Console.

## Signed Release APK And Google Play AAB

Google Play uploads should use a signed release Android App Bundle, not an APK.
The same release build also creates a signed APK for direct installation.

Generate an upload keystore outside Git, then build and package both signed artifacts with:

```powershell
.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties
```

The versioned artifacts and checksums are created at:

```text
.artifacts\releases\v0.3.2\shine-aac-v0.3.2-code54-release.apk
.artifacts\releases\v0.3.2\RELEASE_APK_SHA256SUMS.txt
.artifacts\releases\v0.3.2\shine-aac-v0.3.2-code54-release.aab
.artifacts\releases\v0.3.2\PLAY_AAB_SHA256SUMS.txt
.artifacts\releases\v0.3.2\RELEASE_NOTES.md
```

The APK and AAB under `app\build\outputs` are overwriteable intermediate outputs. Use the versioned APK for direct installation, and upload the versioned AAB from `.artifacts` to the Google Play Internal testing track. Confirm its version code has not already been used in Play Console.

Keep the real keystore properties file and `.jks` file out of Git. Use `keystore.properties.example` as the template.

## Minimal Release Checklist

1. Run `npm ci`.
2. Update `version.properties`.
3. Run `npm run test:core`.
4. Run `npm run test:web:e2e` and `npm run test:web:packaged`.
5. Run `.\package-release.bat -SdkDir E:\Android\Sdk` and use the debug APK for the direct-install runtime smoke.
6. Run `.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties`.
7. Verify the versioned signed APK and AAB, both checksum files, version name, version code, and signing identity.
8. Create and push an annotated tag `vX.Y.Z` on the exact application source commit.
9. Upload the versioned `.aab` to Play Console Internal testing and configure testers. Do not upload the debug APK.

```powershell
git tag -a v0.3.2 -m "SHINE AAC v0.3.2"
git push origin v0.3.2
```

The tagged GitHub workflow publishes the versioned debug APK, its checksum,
and a ZIP containing the APK, checksum, and release notes. Verify the release
page and direct asset URLs after the workflow completes.
