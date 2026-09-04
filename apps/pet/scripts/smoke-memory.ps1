# ③ Cross-restart memory smoke: boot1 tells the pet a name; boot2 must recall it.
$ErrorActionPreference = 'Continue'
$env:DSH_PET_NO_ELECTRON = '1'
Remove-Item Env:\DSH_PERMISSION_MODE -ErrorAction SilentlyContinue
Set-Location D:\dsh\dsh-kernel\apps\pet

function Start-Pet {
  $p = Start-Process -FilePath 'node' -ArgumentList '--import','tsx/esm','src/bin.ts' -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\pet-mem-stderr.log"
  foreach ($i in 1..60) {
    Start-Sleep -Seconds 2
    try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/config/meta' -TimeoutSec 3; return $p } catch {}
  }
  throw 'boot timeout'
}
function Stop-Pet($p) {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  $c = Get-NetTCPConnection -LocalPort 7340 -State Listen -ErrorAction SilentlyContinue
  foreach ($x in $c) { Stop-Process -Id $x.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}
function Send-Chat($text) {
  $body = @{ text = $text } | ConvertTo-Json
  return Invoke-RestMethod -Uri 'http://127.0.0.1:7340/dsh-pet-7340/chat?pet=main' -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
}

$boot1 = Start-Pet
$t1 = -join (0x6211,0x53EB,0x5C0F,0x660E,0xFF0C,0x8BB0,0x4F60,0x8BB0,0x4F4F,0x3002).ForEach([char])
Write-Host "boot1 task: $t1"
$r1 = Send-Chat $t1
Write-Host "boot1 reply: $($r1.reply)"
Stop-Pet $boot1

$boot2 = Start-Pet
$t2 = -join (0x6211,0x53EB,0x4EC0,0x4E48,0x540D,0x5B57,0xFF1F).ForEach([char])
Write-Host "boot2 task: $t2"
$r2 = Send-Chat $t2
Write-Host "boot2 reply: $($r2.reply)"
if ($r2.reply -match [char]0x5C0F + [char]0x660E) { Write-Host "MEMORY OK: name recalled across restart" } else { Write-Host "MEMORY FAIL: name not in reply" }
Stop-Pet $boot2
