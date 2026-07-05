# Release Process

SHINE AAC uses one release version for source, APK metadata, tags, and release files.

## Version Source

Edit `version.properties`:

```properties
versionName=0.2.2
versionCode=5
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

Pushing a `vX.Y.Z` tag runs CI and publishes a GitHub Release with the versioned APK attached.

## APK Files

Build and package a versioned debug APK:

```powershell
.\package-release.bat -SdkDir E:\Android\Sdk
```

This creates:

```text
releases\v0.2.2\shine-aac-v0.2.2-code5-debug.apk
releases\v0.2.2\SHA256SUMS.txt
releases\v0.2.2\RELEASE_NOTES.md
```

Do not share `app-debug.apk` directly. It is an intermediate build output and is overwritten on every build.

## Minimal Release Checklist

1. Update `version.properties`.
2. Run `npm run test:core`.
3. Run `npm run test:web:e2e`.
4. Run `.\package-release.bat -SdkDir E:\Android\Sdk`.
5. Create tag `vX.Y.Z` on the exact commit.
6. Push the tag. GitHub Actions publishes the GitHub Release and attaches the versioned APK plus `SHA256SUMS.txt`.

```powershell
git tag v0.2.2
git push origin v0.2.2
```
