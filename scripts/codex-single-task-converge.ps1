[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Task,

  [ValidateRange(1, 50)]
  [int]$MaxRounds = 6,

  [ValidateRange(1, 20)]
  [int]$MaxNoImprove = 2,

  [string]$Model = '',

  [switch]$SkipTests,
  [switch]$SkipBuild,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent $PSScriptRoot
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$runtimeRoot = Join-Path $repoRoot '.codex-convergence'
$sessionDir = Join-Path $runtimeRoot $runId
$historyFile = Join-Path $sessionDir 'rounds.jsonl'
$summaryFile = Join-Path $sessionDir 'summary.json'
$latestSummaryFile = Join-Path $runtimeRoot 'latest-summary.json'

New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null

$gateCommands = New-Object System.Collections.Generic.List[string]
if (-not $SkipTests) {
  $gateCommands.Add('npm run test:run')
}
if (-not $SkipBuild) {
  $gateCommands.Add('npm run build:main')
  $gateCommands.Add('npm run build:renderer')
}
if ($gateCommands.Count -eq 0) {
  throw 'No verification gates are enabled. Remove -SkipTests/-SkipBuild or enable at least one gate.'
}

function Write-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Message
  )
  Write-Host "[Codex-Converge] $Message" -ForegroundColor Cyan
}

function Invoke-CommandWithCapture {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$OutputFile
  )

  $stdoutFile = "${OutputFile}.stdout"
  $stderrFile = "${OutputFile}.stderr"
  if (Test-Path $stdoutFile) { Remove-Item -Path $stdoutFile -Force }
  if (Test-Path $stderrFile) { Remove-Item -Path $stderrFile -Force }

  $proc = Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList @('/d', '/c', $Command) `
    -WorkingDirectory $WorkingDirectory `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $stdoutFile `
    -RedirectStandardError $stderrFile

  $stdoutText = if (Test-Path $stdoutFile) { Get-Content -Raw $stdoutFile } else { '' }
  $stderrText = if (Test-Path $stderrFile) { Get-Content -Raw $stderrFile } else { '' }
  $combinedText = (($stdoutText, $stderrText) -join [Environment]::NewLine).Trim()
  Set-Content -Path $OutputFile -Value $combinedText -Encoding UTF8

  return [PSCustomObject]@{
    command     = $Command
    exit_code   = $proc.ExitCode
    output_file = $OutputFile
  }
}

function Invoke-GateChecks {
  param(
    [Parameter(Mandatory = $true)][int]$RoundNumber
  )

  $results = @()
  for ($i = 0; $i -lt $gateCommands.Count; $i++) {
    $cmd = $gateCommands[$i]
    $gateLog = Join-Path $sessionDir ("round-{0:D2}-gate-{1:D2}.log" -f $RoundNumber, ($i + 1))
    Write-Step ("Round {0}: verify [{1}]" -f $RoundNumber, $cmd)
    $results += Invoke-CommandWithCapture -Command $cmd -WorkingDirectory $repoRoot -OutputFile $gateLog
  }

  $failed = @($results | Where-Object { $_.exit_code -ne 0 } | Select-Object -ExpandProperty command)
  return [PSCustomObject]@{
    results         = $results
    failed_commands = $failed
    failed_count    = $failed.Count
  }
}

function New-RoundPrompt {
  param(
    [Parameter(Mandatory = $true)][int]$RoundNumber,
    [string[]]$PreviousFailedCommands = @()
  )

  $previousFailedText = if ($PreviousFailedCommands.Count -eq 0) {
    '- none'
  } else {
    ($PreviousFailedCommands | ForEach-Object { "- $_" }) -join "`n"
  }

  $gateText = ($gateCommands | ForEach-Object { "- $_" }) -join "`n"

  return @"
You are running Codex convergence round $RoundNumber of $MaxRounds for one task.

Task:
$Task

Previous failed verification commands:
$previousFailedText

Rules:
1. Make the minimum safe code changes needed to move the task forward.
2. Do not bypass tests or weaken checks.
3. Run local verification commands yourself after edits:
$gateText
4. If blocked, explain the exact blocker and provide the best partial fix.

Final response format (required):
STATUS: COMPLETE | NEEDS_MORE_WORK
ROOT_CAUSE:
CHANGED_FILES:
VERIFICATION:
NEXT_STEP:
"@
}

$runStart = Get-Date
Write-Step "Run id: $runId"
Write-Step "Task: $Task"
Write-Step "Gates: $($gateCommands -join '; ')"
if ($DryRun) {
  Write-Step 'Dry-run mode enabled: Codex execution is skipped.'
}

$codexExecutable = if (Get-Command 'codex.cmd' -ErrorAction SilentlyContinue) {
  'codex.cmd'
} else {
  'codex'
}

$roundResults = @()
$previousFailedCount = [int]::MaxValue
$previousFailedCommands = @()
$noImproveStreak = 0
$finalStatus = 'not_converged'
$finalReason = 'max_rounds_reached'

for ($round = 1; $round -le $MaxRounds; $round++) {
  Write-Step "==== Round $round / $MaxRounds ===="

  $prompt = New-RoundPrompt -RoundNumber $round -PreviousFailedCommands $previousFailedCommands
  $promptFile = Join-Path $sessionDir ("round-{0:D2}-prompt.txt" -f $round)
  $codexOutputFile = Join-Path $sessionDir ("round-{0:D2}-codex-output.log" -f $round)
  $codexLastMessageFile = Join-Path $sessionDir ("round-{0:D2}-codex-last-message.txt" -f $round)
  Set-Content -Path $promptFile -Value $prompt -Encoding UTF8

  $codexExitCode = 0
  if ($DryRun) {
    Set-Content -Path $codexOutputFile -Value 'DRY_RUN: codex exec skipped.' -Encoding UTF8
    Set-Content -Path $codexLastMessageFile -Value 'DRY_RUN: no Codex response.' -Encoding UTF8
  } else {
    $codexCommandParts = New-Object System.Collections.Generic.List[string]
    $codexCommandParts.Add($codexExecutable)
    $codexCommandParts.Add('exec')
    if (-not [string]::IsNullOrWhiteSpace($Model)) {
      $codexCommandParts.Add('-m')
      $codexCommandParts.Add('"' + $Model.Trim() + '"')
    }
    $codexCommandParts.Add('--cd')
    $codexCommandParts.Add('"' + $repoRoot + '"')
    $codexCommandParts.Add('--sandbox')
    $codexCommandParts.Add('workspace-write')
    $codexCommandParts.Add('--full-auto')
    $codexCommandParts.Add('-o')
    $codexCommandParts.Add('"' + $codexLastMessageFile + '"')
    $codexCommandParts.Add('-')
    $codexCommandParts.Add('<')
    $codexCommandParts.Add('"' + $promptFile + '"')
    $codexCommandLine = $codexCommandParts -join ' '

    Write-Step "Round $($round): running codex exec"
    Push-Location $repoRoot
    try {
      $codexStdoutFile = Join-Path $sessionDir ("round-{0:D2}-codex-stdout.log" -f $round)
      $codexStderrFile = Join-Path $sessionDir ("round-{0:D2}-codex-stderr.log" -f $round)
      if (Test-Path $codexStdoutFile) { Remove-Item -Path $codexStdoutFile -Force }
      if (Test-Path $codexStderrFile) { Remove-Item -Path $codexStderrFile -Force }

      $proc = Start-Process `
        -FilePath 'cmd.exe' `
        -ArgumentList @('/d', '/c', $codexCommandLine) `
        -WorkingDirectory $repoRoot `
        -NoNewWindow `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $codexStdoutFile `
        -RedirectStandardError $codexStderrFile

      $codexExitCode = $proc.ExitCode
      $stdoutText = if (Test-Path $codexStdoutFile) { Get-Content -Raw $codexStdoutFile } else { '' }
      $stderrText = if (Test-Path $codexStderrFile) { Get-Content -Raw $codexStderrFile } else { '' }
      $codexOutputText = (($stdoutText, $stderrText) -join [Environment]::NewLine).Trim()
      Set-Content -Path $codexOutputFile -Value $codexOutputText -Encoding UTF8
      if (-not (Test-Path $codexLastMessageFile)) {
        Set-Content -Path $codexLastMessageFile -Value '' -Encoding UTF8
      }
    }
    finally {
      Pop-Location
    }
  }

  $gateCheck = Invoke-GateChecks -RoundNumber $round
  $failedCount = [int]$gateCheck.failed_count

  $improved = $failedCount -lt $previousFailedCount
  if ($improved) {
    $noImproveStreak = 0
  } else {
    $noImproveStreak += 1
  }

  $roundRecord = [ordered]@{
    round               = $round
    codex_exit_code     = $codexExitCode
    failed_count        = $failedCount
    improved            = $improved
    no_improve_streak   = $noImproveStreak
    failed_commands     = @($gateCheck.failed_commands)
    gate_results        = @($gateCheck.results)
    prompt_file         = $promptFile
    codex_output_file   = $codexOutputFile
    codex_message_file  = $codexLastMessageFile
    timestamp_utc       = (Get-Date).ToUniversalTime().ToString('o')
  }
  $roundResults += [PSCustomObject]$roundRecord
  ($roundRecord | ConvertTo-Json -Depth 8 -Compress) | Add-Content -Path $historyFile -Encoding UTF8

  if ($codexExitCode -eq 0 -and $failedCount -eq 0) {
    $finalStatus = 'converged'
    $finalReason = 'all_gates_passed'
    Write-Step "Round $($round): converged."
    break
  }

  if ($noImproveStreak -ge $MaxNoImprove) {
    $finalStatus = 'stopped'
    $finalReason = 'no_improvement_limit_reached'
    Write-Step "Round $($round): stopped due to no improvement for $noImproveStreak rounds."
    break
  }

  $previousFailedCount = $failedCount
  $previousFailedCommands = @($gateCheck.failed_commands)
}

$runEnd = Get-Date
$summary = [ordered]@{
  run_id               = $runId
  task                 = $Task
  status               = $finalStatus
  reason               = $finalReason
  rounds_executed      = $roundResults.Count
  max_rounds           = $MaxRounds
  max_no_improve       = $MaxNoImprove
  model                = if ([string]::IsNullOrWhiteSpace($Model)) { '(default)' } else { $Model.Trim() }
  dry_run              = [bool]$DryRun
  gate_commands        = @($gateCommands)
  started_at_utc       = $runStart.ToUniversalTime().ToString('o')
  finished_at_utc      = $runEnd.ToUniversalTime().ToString('o')
  session_dir          = $sessionDir
  history_file         = $historyFile
  rounds               = $roundResults
}

$summaryJson = $summary | ConvertTo-Json -Depth 10
Set-Content -Path $summaryFile -Value $summaryJson -Encoding UTF8
Set-Content -Path $latestSummaryFile -Value $summaryJson -Encoding UTF8

Write-Host ''
Write-Host '=== Codex Convergence Summary ===' -ForegroundColor Green
Write-Host "Status       : $finalStatus"
Write-Host "Reason       : $finalReason"
Write-Host "Rounds       : $($roundResults.Count)/$MaxRounds"
Write-Host "Session dir  : $sessionDir"
Write-Host "Summary file : $summaryFile"

if ($finalStatus -eq 'converged') {
  exit 0
}

exit 1
