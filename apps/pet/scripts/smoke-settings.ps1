# Settings smoke: autostart registry + model routes + chat after model change.
$ErrorActionPreference = 'Continue'
$env:DSH_PET_NO_ELECTRON = '1'
Remove-Item Env:\DSH_PERMISSION_MODE -ErrorAction SilentlyContinue
Set-Location D:\dsh\dsh-kernel\apps\pet
$proc = Start-Process -FilePath 'node' -ArgumentList '--import','tsx/esm','src/bin.ts' -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\pet-set-stderr.log"
foreach ($i in 1..60) { Start-Sleep -Seconds 2; try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config/meta' -TimeoutSec 3; break } catch {} }

Write-Host "=== GET /settings (defaults) ==="
$s = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/settings' -TimeoutSec 5
Write-Host ($s | ConvertTo-Json -Compress)

Write-Host "=== PUT autostart=true ==="
$r = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/settings' -Method Put -Body (@{ autostart = $true } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10
Write-Host "ok=$($r.ok)"
$reg = reg query 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run' /v DshPet 2>&1
Write-Host "registry: $reg"

Write-Host "=== PUT model=valid ==="
$r2 = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/settings' -Method Put -Body (@{ model = @{ provider = 'deepseek-official'; model = 'deepseek-v4-flash' } } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 15
Write-Host "ok=$($r2.ok)"
$sFile = "$env:USERPROFILE\.dsh\dsh-pet-agent\settings.json"
Write-Host "settings.json: $(if (Test-Path $sFile) { (Get-Content $sFile -Raw).Trim() } else { 'MISSING' })"

Write-Host "=== PUT model=invalid ==="
$r3 = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/settings' -Method Put -Body (@{ model = @{ provider = 'nope'; model = 'nope' } } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 15
Write-Host "ok=$($r3.ok) reason=$($r3.reason) message=$($r3.message)"

Write-Host "=== chat after model change (agent recreated) ==="
$body = @{ text = 'say hi in three words' } | ConvertTo-Json
$chat = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 120
Write-Host "chat ok=$($chat.ok) reply: $($chat.reply)"

Write-Host "=== cleanup: model=null, autostart=false ==="
$r4 = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/settings' -Method Put -Body (@{ model = $null; autostart = $false } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10
Write-Host "ok=$($r4.ok)"
$reg2 = reg query 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run' /v DshPet 2>&1
Write-Host "registry after disable: $(if ($LASTEXITCODE -ne 0) { 'ABSENT (correct)' } else { $reg2 })"

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
$c = Get-NetTCPConnection -LocalPort 7340 -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { Stop-Process -Id $x.OwningProcess -Force -ErrorAction SilentlyContinue }
