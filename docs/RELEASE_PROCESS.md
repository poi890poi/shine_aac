# Release Process

SHINE AAC uses one release version for source, APK metadata, tags, and release files.

## Version Source

Edit `version.properties`:

```properties
versionName=0.2.35
versionCode=38
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

Pushing a `vX.Y.Z` tag starts the GitHub release workflow. Treat its publication as best-effort infrastructure, not as the gate for an internal debug test.

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
.artifacts\releases\v0.2.35\shine-aac-v0.2.35-code38-debug.apk
.artifacts\releases\v0.2.35\SHA256SUMS.txt
.artifacts\releases\v0.2.35\RELEASE_NOTES.md
```

When `docs\releases\vX.Y.Z.md` exists, packaging copies it into the artifact directory and tagged-release CI can use it as the GitHub Release notes. Otherwise the package script creates a minimal fallback note.

Do not share `app-debug.apk` directly. It is an intermediate build output and is overwritten on every build.
Do not commit APK, AAB, or ZIP files. For internal testing, share the exact versioned APK together with the adjacent `SHA256SUMS.txt` through the approved internal channel. If tagged CI succeeds, it can additionally publish equivalent release assets on GitHub.

## Google Play AAB

Google Play uploads should use a signed release Android App Bundle, not the debug APK.

Generate an upload keystore outside Git, then build with:

```powershell
.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties
```

The signed bundle is created at:

```text
app\build\outputs\bundle\release\app-release.aab
```

Keep the real keystore properties file and `.jks` file out of Git. Use `keystore.properties.example` as the template.

## Minimal Release Checklist

1. Run `npm ci`.
2. Update `version.properties`.
3. Run `npm run test:core`.
4. Run `npm run test:web:e2e` and `npm run test:web:packaged`.
5. Run `.\package-release.bat -SdkDir E:\Android\Sdk`.
6. Create tag `vX.Y.Z` on the exact commit.
7. Hand off the versioned APK and `SHA256SUMS.txt` through the approved internal channel.
8. Push the tag. GitHub Actions may additionally rebuild and publish release assets, but CI publication is not required for internal testing.

```powershell
git tag v0.2.35
git push origin v0.2.35
```
