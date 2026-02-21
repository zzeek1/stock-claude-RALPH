Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$taskFile = Join-Path $repoRoot 'task.md'

if (-not (Test-Path $taskFile)) {
  Write-Host "[FAIL] task.md not found at $taskFile" -ForegroundColor Red
  exit 1
}

$content = Get-Content -Path $taskFile
$taskRows = @()

foreach ($line in $content) {
  if ($line -match '^\|\s*(T-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$') {
    $taskRows += [PSCustomObject]@{
      Id       = $matches[1].Trim()
      Status   = $matches[2].Trim()
      Priority = $matches[3].Trim()
      Area     = $matches[4].Trim()
      Task     = $matches[5].Trim()
      Owner    = $matches[6].Trim()
      Updated  = $matches[7].Trim()
      Verify   = $matches[8].Trim()
    }
  }
}

if ($taskRows.Count -eq 0) {
  Write-Host '[FAIL] No task rows found in Machine Board.' -ForegroundColor Red
  exit 1
}

$allowedStatuses = @('TODO', 'DOING', 'BLOCKED', 'DONE')
$invalidStatusRows = @($taskRows | Where-Object { $_.Status -notin $allowedStatuses })
if ($invalidStatusRows.Count -gt 0) {
  Write-Host '[FAIL] Invalid status detected:' -ForegroundColor Red
  $invalidStatusRows | ForEach-Object { Write-Host "  - $($_.Id): $($_.Status)" -ForegroundColor Red }
  Write-Host "Allowed: $($allowedStatuses -join ', ')" -ForegroundColor Yellow
  exit 1
}

$doingRows = @($taskRows | Where-Object { $_.Status -eq 'DOING' })
if ($doingRows.Count -gt 1) {
  Write-Host '[FAIL] More than one DOING task found.' -ForegroundColor Red
  $doingRows | ForEach-Object { Write-Host "  - $($_.Id)" -ForegroundColor Red }
  exit 1
}

$duplicateIds = @($taskRows | Group-Object Id | Where-Object { $_.Count -gt 1 })
if ($duplicateIds.Count -gt 0) {
  Write-Host '[FAIL] Duplicate task IDs found.' -ForegroundColor Red
  $duplicateIds | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Red }
  exit 1
}

$badDateRows = @($taskRows | Where-Object { $_.Updated -notmatch '^\d{4}-\d{2}-\d{2}$' })
if ($badDateRows.Count -gt 0) {
  Write-Host '[FAIL] Updated date must be YYYY-MM-DD.' -ForegroundColor Red
  $badDateRows | ForEach-Object { Write-Host "  - $($_.Id): $($_.Updated)" -ForegroundColor Red }
  exit 1
}

Write-Host '[PASS] task.md board check passed.' -ForegroundColor Green
Write-Host "Tasks: $($taskRows.Count), DOING: $($doingRows.Count)"
exit 0
