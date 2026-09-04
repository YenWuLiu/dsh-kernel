# dsh-pet-app smoke: kernel boot + HTTP routes + agent chat (no Electron).
$ErrorActionPreference = 'Continue'
$env:DSH_PET_NO_ELECTRON = '1'
$app = 'D:\dsh\dsh-kernel\apps\pet'
Set-Location $app

$proc = Start-Process -FilePath 'node' -ArgumentList '--import','tsx/esm','src/bin.ts' -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\pet-stderr.log" -RedirectStandardOutput "$env:TEMP\pet-stdout.log"
Write-Host "pet app pid: $($proc.Id)"

$ready = $false
foreach ($i in 1..60) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config/meta' -TimeoutSec 3
    $ready = $true; break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) {
  Write-Host "BOOT TIMEOUT. stderr:"; Get-Content "$env:TEMP\pet-stderr.log" -Tail 30
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  exit 1
}
Write-Host "=== 1. /config/meta ==="; $r | ConvertTo-Json -Compress

Write-Host "=== 2. /config (keys + first pet) ==="
$cfg = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config' -TimeoutSec 5
Write-Host "config keys: $($cfg.PSObject.Properties.Name -join ', ')"
Write-Host "main pet[0]: $($cfg.main.pets[0] | ConvertTo-Json -Compress)"

Write-Host "=== 3. /thumb/main/<anim>.webm ==="
$anim = $cfg.main.animations.idle[0]
$thumb = Invoke-WebRequest -Uri "http://127.0.0.1:7340/dsh-pet-7340/thumb/main/$([uri]::EscapeDataString($anim)).webm" -TimeoutSec 5
Write-Host "anim '$anim': status $($thumb.StatusCode), bytes $($thumb.RawContentLength), type $($thumb.Headers['Content-Type'])"

Write-Host "=== 4. /whisper (real LLM) ==="
$w = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/whisper?pet=main' -TimeoutSec 40
Write-Host "whisper ok=$($w.ok) text=$($w.text)"

Write-Host "=== 5. POST /chat - agent with pwsh (computer management) ==="
# Chinese task text via unicode escapes (avoid file-encoding pitfalls):
$taskText = -join (0x7528,0x20,0x70,0x77,0x73,0x68,0x20,0x67E5,0x4E00,0x4E0B,0x20,0x43,0x20,0x76D8,0x5269,0x4F59,0x7A7A,0x95F4,0xFF0C,0x4E00,0x53E5,0x8BDD,0x544A,0x8BC9,0x6211,0x7ED3,0x679C).ForEach([char])
Write-Host "task: $taskText"
$body = @{ text = $taskText } | ConvertTo-Json
$chat = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
Write-Host "chat ok=$($chat.ok)"
Write-Host "reply: $($chat.reply)"

Write-Host "=== stopping app ==="
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "stderr tail:"; Get-Content "$env:TEMP\pet-stderr.log" -Tail 12
