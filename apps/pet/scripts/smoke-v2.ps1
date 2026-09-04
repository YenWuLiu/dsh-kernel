# ① streaming broadcast + ② approval bubble (HTTP-level) smoke.
$ErrorActionPreference = 'Continue'
$env:DSH_PET_NO_ELECTRON = '1'
$env:DSH_PERMISSION_MODE = 'workspace-write'
$env:DSH_PET_APPROVAL = 'bubble'
Set-Location D:\dsh\dsh-kernel\apps\pet
$proc = Start-Process -FilePath 'node' -ArgumentList '--import','tsx/esm','src/bin.ts' -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\pet-v2-stderr.log"
foreach ($i in 1..60) { Start-Sleep -Seconds 2; try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config/meta' -TimeoutSec 3; break } catch {} }

Write-Host "=== 1. streaming broadcast (long reply, mid-flight polls) ==="
# Slow task: count to 30 slowly in the reply so text-deltas span several seconds.
$t1 = -join (0x8BF7,0x5199,0x4E00,0x7BC7,0x6587,0x5B57,0xFF1A,0x4ECE,0x31,0x6570,0x5230,0x33,0x30,0xFF0C,0x6BCF,0x4E2A,0x6570,0x5B57,0x4E4B,0x95F4,0x52A0,0x4E00,0x4E2A,0x9017,0x53F7,0xFF0C,0x6162,0x6162,0x5199,0x4E0B,0x6765).ForEach([char])
Write-Host "task: $t1"
$chatJob = Start-Job -ScriptBlock {
  param($text)
  $body = @{ text = $text } | ConvertTo-Json
  Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 240
} -ArgumentList $t1
$samples = @()
foreach ($i in 1..14) {
  Start-Sleep -Milliseconds 900
  try {
    $bc = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/broadcast?pet=main' -TimeoutSec 3
    if ($bc.ts -gt 0 -and $bc.text) { $samples += "[$i] ts=$($bc.ts) len=$($bc.text.Length) text=$($bc.text.Substring(0, [Math]::Min(50, $bc.text.Length)))" }
  } catch {}
  if ($chatJob.State -eq 'Completed') { break }
}
$chat = Receive-Job $chatJob -Wait -AutoRemoveJob
Write-Host "mid-flight broadcast samples: $($samples.Count)"
$samples | Select-Object -First 6 | ForEach-Object { Write-Host "  $_" }
Write-Host "final reply len: $($chat.reply.Length)"
if ($samples.Count -ge 2) { Write-Host "STREAMING OK (multiple distinct broadcasts during one turn)" } else { Write-Host "STREAMING WEAK ($($samples.Count) sample)" }

Write-Host "`n=== 2. approval bubble (pending -> decide) ==="
$t2 = -join (0x5728,0x20,0x43,0x20,0x76D8,0x6839,0x76EE,0x5199,0x4E00,0x4E2A,0x20,0x70,0x65,0x74,0x2D,0x62,0x75,0x62,0x62,0x6C,0x65,0x2E,0x74,0x78,0x74,0x20,0x6587,0x4EF6).ForEach([char])
Write-Host "task: $t2"
$chatJob2 = Start-Job -ScriptBlock {
  param($text)
  $body = @{ text = $text } | ConvertTo-Json
  Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 300
} -ArgumentList $t2
$approved = $false
foreach ($i in 1..60) {
  Start-Sleep -Seconds 2
  try {
    $p = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/approval/pending?pet=main' -TimeoutSec 3
    if ($p.pending -and $p.pending.Count -gt 0) {
      $req = $p.pending[0]
      Write-Host "pending: id=$($req.id) tool=$($req.toolName) reason=$($req.reason)"
      $d = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/approval/decide' -Method Post -Body (@{ id = $req.id; outcome = 'allowed-once' } | ConvertTo-Json) -ContentType 'application/json; charset=utf-8' -TimeoutSec 5
      Write-Host "decide: ok=$($d.ok)"
      $approved = $true
    }
  } catch {}
  if ($chatJob2.State -eq 'Completed') { break }
}
$chat2 = Receive-Job $chatJob2 -Wait -AutoRemoveJob
Write-Host "chat2 ok=$($chat2.ok) reply: $($chat2.reply)"
if (Test-Path C:\pet-bubble.txt) { Write-Host "FILE CREATED: $(Get-Content C:\pet-bubble.txt -TotalCount 1)" }
Write-Host ($(if ($approved) { 'APPROVAL BUBBLE OK' } else { 'APPROVAL BUBBLE NOT EXERCISED (agent may not have escalated)' }))
Write-Host "--- approval stderr lines ---"; Select-String -Path "$env:TEMP\pet-v2-stderr.log" -Pattern 'approval' | Select-Object -First 6 | ForEach-Object { $_.Line }
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
$c = Get-NetTCPConnection -LocalPort 7340 -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { Stop-Process -Id $x.OwningProcess -Force -ErrorAction SilentlyContinue }
