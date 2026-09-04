# Boot smoke for dsh-kernel: isolated DSH_HOME, no mutation of the user's real home.
$ErrorActionPreference = 'Continue'
$kernel = 'D:\dsh\dsh-kernel'
$tempHome = 'D:\dsh\dsh-kernel-home'
Remove-Item $tempHome -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $tempHome | Out-Null
# Carry over credentials + settings so the DeepSeek route resolves.
Copy-Item "$env:USERPROFILE\.dsh\.credentials.yaml" $tempHome -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.dsh\settings.yaml" $tempHome -ErrorAction SilentlyContinue
$env:DSH_HOME = $tempHome

Write-Host "=== 1. dump-default-config (built bin) ==="
$dump = node "$kernel\apps\cli\lib\bin.js" --profile headless --dump-default-config 2>&1 | Out-String
$rows = ([regex]::Matches($dump, '(?m)^- id: ')).Count
Write-Host "plugin rows: $rows (expect 81 like the official headless profile)"
if ($LASTEXITCODE -ne 0) { Write-Host "DUMP FAILED: $dump"; exit 1 }

Write-Host "=== 2. real headless task (source launch) ==="
Set-Location $kernel
$task = node --import tsx/esm apps/cli/src/bin.ts --profile headless "Reply with exactly one word: the capital of France." 2>&1 | Out-String
Write-Host "exit: $LASTEXITCODE"
Write-Host "output tail:"
$task -split "`n" | Select-Object -Last 6
