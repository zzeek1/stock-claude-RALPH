param(
  [switch]$SkipBuild,
  [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  Write-Host "    $Command"
  Push-Location $repoRoot
  try {
    & powershell -NoProfile -Command $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Step failed: $Name (exit code: $LASTEXITCODE)"
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host "[Release Gate] Start" -ForegroundColor Yellow

if (-not $SkipTests) {
  Invoke-Step -Name "Run test suite" -Command "npm run test:run"
}
else {
  Write-Host "Skip tests by flag: -SkipTests" -ForegroundColor DarkYellow
}

if (-not $SkipBuild) {
  Invoke-Step -Name "Run build" -Command "npm run build"
}
else {
  Write-Host "Skip build by flag: -SkipBuild" -ForegroundColor DarkYellow
}

Invoke-Step -Name "Check task board" -Command "powershell -ExecutionPolicy Bypass -File .\scripts\check-task-board.ps1"
Invoke-Step -Name "Check doc policy" -Command "powershell -ExecutionPolicy Bypass -File .\scripts\check-doc-policy.ps1"

Write-Host ""
Write-Host "[Release Gate] PASS" -ForegroundColor Green
Write-Host "Next: complete manual checklist in task.md section 'Traversal Checklist'."
exit 0
