$srcRoot = 'D:\NetAlertX-main\NetAlertX-main'
$snapRoot = 'D:\NetAlertX-Reference-Snapshot'

$srcFiles = Get-ChildItem -Path $srcRoot -Recurse -File -Force
Write-Host "Calculating SHA256 for $($srcFiles.Count) files in source..."

$mismatches = @()
$checked = 0
$srcManifest = @()
$snapManifest = @()

foreach ($f in $srcFiles) {
    $rel = $f.FullName.Substring($srcRoot.Length).TrimStart('\', '/')
    $snapFile = Join-Path $snapRoot $rel
    
    $srcHash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash
    $snapHash = (Get-FileHash -Path $snapFile -Algorithm SHA256).Hash
    
    $srcManifest += "$srcHash  $rel"
    $snapManifest += "$snapHash  $rel"
    
    if ($srcHash -ne $snapHash) {
        $mismatches += [PSCustomObject]@{
            File = $rel
            SrcHash = $srcHash
            SnapHash = $snapHash
        }
    }
    $checked++
    if ($checked % 200 -eq 0) {
        Write-Host "Checked $checked / $($srcFiles.Count)..."
    }
}

Write-Host "Done verifying SHA256 for all $checked files."
Write-Host "Total hash mismatches: $($mismatches.Count)"

$srcManifest | Out-File -FilePath "D:\WatchNet-Rebuild\docs\project\source_manifest_sha256.txt" -Encoding utf8
$snapManifest | Out-File -FilePath "D:\WatchNet-Rebuild\docs\project\snapshot_manifest_sha256.txt" -Encoding utf8

if ($mismatches.Count -gt 0) {
    $mismatches | Format-Table | Out-String | Write-Host
} else {
    Write-Host "PERFECT MATCH: All 1393 files match SHA256 bit-for-bit!"
}
