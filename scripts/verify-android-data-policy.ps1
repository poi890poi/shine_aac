$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$androidNamespace = "http://schemas.android.com/apk/res/android"

[xml]$manifest = Get-Content -LiteralPath (Join-Path $repoRoot "app\src\main\AndroidManifest.xml")
$allowBackup = $manifest.manifest.application.GetAttribute("allowBackup", $androidNamespace)
if ($allowBackup -ne "false") {
    throw "Android cloud backup must remain disabled; found android:allowBackup='$allowBackup'."
}

$legacyDomains = @("root", "file", "database", "sharedpref", "external")
[xml]$legacyRules = Get-Content -LiteralPath (Join-Path $repoRoot "app\src\main\res\xml\backup_rules.xml")
$legacyExclusions = @($legacyRules.SelectNodes("/full-backup-content/exclude"))
foreach ($domain in $legacyDomains) {
    $match = $legacyExclusions | Where-Object { $_.domain -eq $domain -and $_.path -eq "." }
    if (-not $match) { throw "Legacy backup rules do not exclude domain '$domain'." }
}

$modernDomains = @(
    "root", "file", "database", "sharedpref", "external",
    "device_root", "device_file", "device_database", "device_sharedpref"
)
[xml]$modernRules = Get-Content -LiteralPath (Join-Path $repoRoot "app\src\main\res\xml\data_extraction_rules.xml")
foreach ($mode in @("cloud-backup", "device-transfer")) {
    $exclusions = @($modernRules.SelectNodes("/data-extraction-rules/$mode/exclude"))
    foreach ($domain in $modernDomains) {
        $match = $exclusions | Where-Object { $_.domain -eq $domain -and $_.path -eq "." }
        if (-not $match) { throw "Modern $mode rules do not exclude domain '$domain'." }
    }
}

Write-Host "Android data policy verified: cloud backup disabled and all app-data domains excluded."
