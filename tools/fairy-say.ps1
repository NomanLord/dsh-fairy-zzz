# fairy-say.ps1 -- Fairy voice queue (Windows, no admin, no dependencies)
#
#   Text is synthesized by the local GPT-SoVITS engine on 127.0.0.1:9800 and played
#   with System.Media.SoundPlayer. Every call joins ONE cross-process queue, so two
#   replies never talk over each other -- that echo is exactly why the skin's own
#   auto-read was switched off in 1.0.7 and why this script exists.
#
# Usage:
#   pwsh -File fairy-say.ps1 -Text "text to say"
#   pwsh -File fairy-say.ps1 -TextFile reply.md              # UTF-8, full length
#   pwsh -File fairy-say.ps1 -TextFile reply.md -NoWait      # hand off to a detached
#                                                            # player and return now
#   "text" | pwsh -File fairy-say.ps1                        # pipeline
#
# Exit codes: 0 said / handed off, 2 engine unreachable or no audio,
#             3 nothing to say, 4 timed out waiting for our turn in the queue.
#
# Options: -Port 9800  -Speed 0.72  -Chunk 80  -QueueDir <dir>  -TimeoutSec 900  -NoPlay

param(
  [string]$Text,
  [string]$TextFile,
  [int]$Port = 9800,
  [double]$Speed = 0.72,
  [int]$Chunk = 80,
  [string]$QueueDir,
  [int]$TimeoutSec = 900,
  [switch]$NoWait,
  [switch]$NoPlay
)

$ErrorActionPreference = 'Stop'

# 2026-11-23 16:40 语速：调用方没显式传 -Speed 时，读插件目录的 voice-speed.txt。
# 宿主旧版 spawn 时不带 -Speed（一直是脚本默认 0.72），改这一处让 voice-speed.txt
# 对「自动朗读」也立刻生效，不用重启 DSH。显式 -Speed 仍然优先。
if (-not $PSBoundParameters.ContainsKey('Speed')) {
  try {
    $hint = Join-Path (Split-Path -Parent $PSScriptRoot) 'voice-speed.txt'
    if (Test-Path -LiteralPath $hint) {
      $raw = (Get-Content -LiteralPath $hint -TotalCount 1).Trim()
      $parsed = 0.0
      if ([double]::TryParse($raw, [ref]$parsed) -and $parsed -gt 0) {
        $Speed = [Math]::Min(1.4, [Math]::Max(0.6, $parsed))
      }
    }
  } catch {}
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $QueueDir -or $QueueDir -eq '') { $QueueDir = Join-Path $env:USERPROFILE '.dsh\storages\fairy-voice' }
if (-not (Test-Path $QueueDir)) { New-Item -ItemType Directory -Path $QueueDir -Force | Out-Null }
$QueueFile = Join-Path $QueueDir 'queue.txt'
$TmpDir = Join-Path $QueueDir 'tmp'
if (-not (Test-Path $TmpDir)) { New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null }

$id = [guid]::NewGuid().ToString('N')

# ---------------------------------------------------------------- text input
if (-not $TextFile -and -not $Text) {
  $piped = @($input) -join ' '
  if ($piped.Trim()) { $Text = $piped }
}
if ($TextFile) {
  if (-not (Test-Path $TextFile)) { Write-Error "text file not found: $TextFile"; exit 3 }
  $Text = [System.IO.File]::ReadAllText((Resolve-Path $TextFile), [System.Text.Encoding]::UTF8)
  # 宿主投递的请求文件（say-*.txt）读完就删，别让 requests/ 无限长
  try {
    if ((Split-Path -Leaf $TextFile) -like 'say-*') { Remove-Item -LiteralPath $TextFile -Force -ErrorAction SilentlyContinue }
  } catch {}
}
if (-not $Text -or -not $Text.Trim()) { exit 3 }

# ------------------------------------------------- hand off to a detached player
# The queue is FIFO by ticket, so this process must NOT hold a ticket while idle.
if ($NoWait) {
  $req = Join-Path $TmpDir ("req-$id.txt")
  [System.IO.File]::WriteAllText($req, $Text, (New-Object System.Text.UTF8Encoding($false)))
  $exe = (Get-Process -Id $PID).Path
  $childArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath,
    '-TextFile', $req, '-Port', "$Port", '-Speed', "$Speed", '-Chunk', "$Chunk", '-QueueDir', $QueueDir,
    '-TimeoutSec', "$TimeoutSec")
  if ($NoPlay) { $childArgs += '-NoPlay' }
  Start-Process -FilePath $exe -ArgumentList $childArgs -WindowStyle Hidden | Out-Null
  Write-Output 'queued (detached player)'
  exit 0
}

# ------------------------------------------------------- clean markdown / code
$clean = $Text
$clean = [regex]::Replace($clean, '(?s)```.*?```', 'yes.')
$clean = [regex]::Replace($clean, '`[^`]*`', '')
$clean = [regex]::Replace($clean, '!\[[^\]]*\]\([^)]*\)', '')
$clean = [regex]::Replace($clean, '\[([^\]]+)\]\([^)]*\)', '$1')
$clean = [regex]::Replace($clean, 'https?://\S+', '')
$clean = [regex]::Replace($clean, '<[^>]+>', '')
$clean = [regex]::Replace($clean, '[Hh]\s*\.\s*[Dd]\s*\.\s*[Dd]\s*\.?(?=[A-Za-z0-9])', 'HDD ')
$clean = [regex]::Replace($clean, '[Hh]\s*\.\s*[Dd]\s*\.\s*[Dd]\s*\.?', 'HDD')
$clean = [regex]::Replace($clean, '[*_~#>|]+', ' ')
$clean = [regex]::Replace($clean, '\s+', ' ').Trim()
if (-not $clean) { exit 3 }

# ------------------------------------------------------------ split into reads
$chunks = New-Object System.Collections.Generic.List[string]
$rest = $clean
while ($rest.Length -gt 0) {
  if ($rest.Length -le $Chunk) { $chunks.Add($rest); break }
  $window = $rest.Substring(0, [Math]::Min($Chunk + 20, $rest.Length))
  $cut = -1
  foreach ($mark in @([char]0x3002, [char]0xFF01, [char]0xFF1F, [char]0xFF1B, [char]0xFF0C, [char]0x3001)) {
    $idx = $window.LastIndexOf($mark)
    if ($idx -ge [int]($Chunk * 0.5) -and $idx -gt $cut) { $cut = $idx }
  }
  if ($cut -lt 0) { $cut = $Chunk - 1 }
  $chunks.Add($rest.Substring(0, $cut + 1).Trim())
  $rest = $rest.Substring($cut + 1).Trim()
}
$chunks = @($chunks | Where-Object { $_.Length -gt 0 })
if ($chunks.Count -eq 0) { exit 3 }

# ------------------------------------------------------------------- the queue
# queue.txt holds one ticket per line: "<id>\t<pid>\t<epochSeconds>"
# A ticket whose pid is gone is pruned, so a crashed run can never block the line.
function Read-Tickets {
  if (-not (Test-Path $QueueFile)) { return @() }
  $fs = [System.IO.File]::Open($QueueFile, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
    $all = $sr.ReadToEnd()
    $sr.Dispose()
  } finally { if (-not $fs.SafeFileHandle.IsClosed) { $fs.Dispose() } }
  $out = @()
  foreach ($line in ($all -split "`r?`n")) {
    if (-not $line -or -not $line.Trim()) { continue }
    $parts = $line -split "`t"
    if ($parts.Count -lt 2) { continue }
    $alive = $false
    try { $alive = [bool](Get-Process -Id ([int]$parts[1]) -ErrorAction SilentlyContinue) } catch { $alive = $false }
    $out += [pscustomobject]@{ id = $parts[0]; pid = [int]$parts[1]; alive = $alive }
  }
  return @($out)
}
function Write-Tickets($tickets) {
  $text = ''
  foreach ($t in $tickets) { $text += ("{0}`t{1}`t{2}`n" -f $t.id, $t.pid, 0) }
  $fs = [System.IO.File]::Open($QueueFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $fs.Write($bytes, 0, $bytes.Length)
    $fs.Flush()
  } finally { $fs.Dispose() }
}
function Add-Ticket {
  $mine = [pscustomobject]@{ id = $id; pid = $PID; alive = $true }
  $all = @(Read-Tickets | Where-Object { $_.alive })
  $all += $mine
  Write-Tickets $all
}
function Remove-Ticket {
  $left = @(Read-Tickets | Where-Object { $_.id -ne $id -and $_.alive })
  Write-Tickets $left
}

Add-Ticket
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ($true) {
  $live = @(Read-Tickets | Where-Object { $_.alive })
  if ($live.Count -eq 0 -or $live[0].id -eq $id) { break }
  if ((Get-Date) -gt $deadline) { Remove-Ticket; Write-Error 'timed out waiting for the queue'; exit 4 }
  Start-Sleep -Milliseconds 200
}

# ------------------------------------------------------------------ synthesize
function Get-WavSeconds($path) {
  $b = [System.IO.File]::ReadAllBytes($path)
  if ($b.Length -lt 44) { return 0 }
  $byteRate = 0
  $pos = 12
  while ($pos + 8 -le $b.Length) {
    $cid = [System.Text.Encoding]::ASCII.GetString($b, $pos, 4)
    $size = [BitConverter]::ToInt32($b, $pos + 4)
    if ($cid -eq 'fmt ') { $byteRate = [BitConverter]::ToInt32($b, $pos + 16) }
    elseif ($cid -eq 'data') {
      if ($byteRate -gt 0) { return [Math]::Round([Math]::Max(0, [Math]::Min($size, $b.Length - $pos - 8)) / $byteRate, 2) }
      return 0
    }
    $pos += 8 + $size + ($size % 2)
  }
  return 0
}

$wavs = New-Object System.Collections.Generic.List[string]
function Write-State($phase, $index, $total, $text) {
  # 皮肤靠轮询这个文件知道「现在念到哪一句」，用它驱动眼徽旁那条朗读气泡。
  try {
    $state = @{ id = $script:ticketId; phase = $phase; index = $index; total = $total; text = $text; at = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) } | ConvertTo-Json -Compress
    $tmpFile = Join-Path $QueueDir 'state.json.tmp'
    [System.IO.File]::WriteAllText($tmpFile, $state, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmpFile -Destination (Join-Path $QueueDir 'state.json') -Force
  } catch {}
}
$script:ticketId = $id
try {
  $i = 0
  foreach ($piece in $chunks) {
    $out = Join-Path $TmpDir ("$id-" + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.wav')
    $payload = @{ text = $piece; out = $out; speed = $Speed } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    try {
      [void](Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/tts" -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 300)
    } catch {
      Write-State 'idle' 0 0 ''
      Write-Error "voice engine not reachable on 127.0.0.1:$Port ($($_.Exception.Message))"
      exit 2
    }
    if (-not (Test-Path $out) -or (Get-Item $out).Length -le 2048) {
      Write-State 'idle' 0 0 ''
      Write-Error 'engine returned no usable audio'
      exit 2
    }
    $wavs.Add($out)
    Write-State 'ready' $i $chunks.Count $piece
    $i += 1
  }

  if (-not $NoPlay) {
    $i = 0
    foreach ($wav in $wavs) {
      Write-State 'speaking' $i $chunks.Count $chunks[$i]
      $player = New-Object System.Media.SoundPlayer($wav)
      $player.PlaySync()
      $player.Dispose()
      $i += 1
    }
    Write-State 'idle' 0 0 ''
  }
  $seconds = 0.0
  foreach ($wav in $wavs) { $seconds += Get-WavSeconds $wav }
  Write-Output ("said {0} chunk(s), {1}s of audio" -f $wavs.Count, [Math]::Round($seconds, 2))
}
finally {
  foreach ($wav in $wavs) { Remove-Item $wav -Force -ErrorAction SilentlyContinue }
  Remove-Ticket
  Write-State 'idle' 0 0 ''
}
exit 0
