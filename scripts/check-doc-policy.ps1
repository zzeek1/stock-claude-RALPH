Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$allowedRootMarkdown = @('AGENTS.md', 'task.md')

$rootMarkdown = Get-ChildItem -Path $repoRoot -File -Filter '*.md' | Select-Object -ExpandProperty Name
$violations = @($rootMarkdown | Where-Object { $_ -notin $allowedRootMarkdown })

if ($violations.Count -gt 0) {
  Write-Host '[FAIL] Root markdown policy violated. Unexpected files:' -ForegroundColor Red
  $violations | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host "Allowed root markdown files: $($allowedRootMarkdown -join ', ')" -ForegroundColor Yellow
  exit 1
}

Write-Host '[PASS] Root markdown policy check passed.' -ForegroundColor Green
Write-Host "Root markdown files: $($rootMarkdown -join ', ')"
exit 0
