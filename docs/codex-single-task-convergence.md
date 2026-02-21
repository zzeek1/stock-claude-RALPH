# Codex Single-Task Convergence

Last updated: 2026-02-22

## Goal
Use Codex in iterative rounds for one task until convergence, with hard verification gates and explicit stop rules.

## Script
- `scripts/codex-single-task-converge.ps1`

## Recommended Usage
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\codex-single-task-converge.ps1 `
  -Task "修复统计分析页已实现收益率和已实现盈亏口径，确保USD口径显示正确" `
  -MaxRounds 6 `
  -MaxNoImprove 2
```

## Optional Flags
- `-Model <name>`: force a specific Codex model.
- `-SkipTests`: skip `npm run test:run` gate.
- `-SkipBuild`: skip `npm run build:main` + `npm run build:renderer` gates.
- `-DryRun`: validate the convergence workflow without running `codex exec`.

## Built-in Verification Gates
Default gates per round:
- `npm run test:run`
- `npm run build:main`
- `npm run build:renderer`

The run is considered converged only when all enabled gates pass and Codex exits successfully in the same round.

## Stop Conditions
- `converged`: all gates pass.
- `stopped`: no improvement reaches threshold (`-MaxNoImprove`).
- `not_converged`: reached `-MaxRounds` without convergence.

Improvement metric: failed gate count must decrease compared with previous round.

## Outputs
Per run output directory:
- `.codex-convergence/<run-id>/`

Generated files:
- `round-XX-prompt.txt`
- `round-XX-codex-output.log`
- `round-XX-codex-last-message.txt`
- `round-XX-gate-YY.log`
- `rounds.jsonl`
- `summary.json`

Latest run pointer:
- `.codex-convergence/latest-summary.json`

## Operational Notes
- Keep one clear task per run; avoid mixed objectives.
- Use default gates for production-quality convergence.
- If stopped for no improvement, inspect latest gate logs and revise the task statement before rerun.
