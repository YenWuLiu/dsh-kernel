# B4+B5+D12 smoke: workspace-write (approval ask) + chat pwsh + broadcast progress.
$ErrorActionPreference = 'Continue'
$env:DSH_PET_NO_ELECTRON = '1'
$env:DSH_PERMISSION_MODE = 'workspace-write'   # approval policy = ask -> pet auto-answerer must fire
Set-Location D:\dsh\dsh-kernel\apps\pet
$proc = Start-Process -FilePath 'node' -ArgumentList '--import','tsx/esm','src/bin.ts' -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\pet-b-stderr.log"
$ready = $false
foreach ($i in 1..60) {
  Start-Sleep -Seconds 2
  try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config/meta' -TimeoutSec 3; $ready = $true; break } catch {}
}
if (-not $ready) { Write-Host "BOOT TIMEOUT"; Get-Content "$env:TEMP\pet-b-stderr.log" -Tail 25; Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; exit 1 }

$taskText = -join (0x7528,0x20,0x70,0x77,0x73,0x68,0x20,0x67E5,0x4E00,0x4E0B,0x43,0x20,0x76D8,0x5269,0x4F59,0x7A7A,0x95F4,0xFF0C,0x4E00,0x53E5,0x8BDD,0x56DE,0x7B54).ForEach([char])
Write-Host "task: $taskText"
$body = @{ text = $taskText } | ConvertTo-Json
$chat = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
Write-Host "chat ok=$($chat.ok)"
Write-Host "reply: $($chat.reply)"

Start-Sleep -Seconds 1
$bc = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/broadcast?pet=main' -TimeoutSec 5
Write-Host "broadcast: ok=$($bc.ok) ts=$($bc.ts) text=$($bc.text)"

Write-Host "--- approval answerer lines in stderr ---"
Select-String -Path "$env:TEMP\pet-b-stderr.log" -Pattern 'approval' | Select-Object -First 5 | ForEach-Object { $_.Line }
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
