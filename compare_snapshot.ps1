$srcRoot = 'D:\NetAlertX-main\NetAlertX-main'
$snapRoot = 'D:\NetAlertX-Reference-Snapshot'

$srcFiles = Get-ChildItem -Path $srcRoot -Recurse -File -Force
$snapFiles = Get-ChildItem -Path $snapRoot -Recurse -File -Force

Write-Host "Source file count: $($srcFiles.Count)"
Write-Host "Snapshot file count: $($snapFiles.Count)"

$srcMap = @{}
foreach ($f in $srcFiles) {
    $rel = $f.FullName.Substring($srcRoot.Length).TrimStart('\', '/')
    $srcMap[$rel] = $f
}

$snapMap = @{}
foreach ($f in $snapFiles) {
    $rel = $f.FullName.Substring($snapRoot.Length).TrimStart('\', '/')
    $snapMap[$rel] = $f
}

$missingInSnap = @()
foreach ($k in $srcMap.Keys) {
    if (-not $snapMap.ContainsKey($k)) {
        $missingInSnap += $k
    }
}

$missingInSrc = @()
foreach ($k in $snapMap.Keys) {
    if (-not $srcMap.ContainsKey($k)) {
        $missingInSrc += $k
    }
}

Write-Host "Missing in Snapshot count: $($missingInSnap.Count)"
Write-Host "Missing in Source count: $($missingInSrc.Count)"

$sizeMismatches = @()
foreach ($k in $srcMap.Keys) {
    if ($snapMap.ContainsKey($k)) {
        if ($srcMap[$k].Length -ne $snapMap[$k].Length) {
            $sizeMismatches += $k
        }
    }
}
Write-Host "Size mismatches: $($sizeMismatches.Count)"
