# Stock Claude Compact Context

Last updated: 2026-02-22
Owner: all AI agents working in this repo

## Purpose
This file is the compact, always-load project context for AI sessions.
Keep it short and stable so startup token usage stays predictable.

## Product Snapshot
- Desktop trading journal for low-frequency traders.
- Stack: Electron + React + TypeScript + sql.js.
- Core value: accurate trade records, reliable stats, actionable AI review.

## Source Of Truth
- Task board and release gates: `task.md`.
- Agent startup/load policy: `AGENTS.md`.
- Homepage/dashboard/positions currency contract: `docs/homepage-dashboard-currency-config.md`.
- Shared KPI canonical contract: `docs/metrics-contract.md`.
- Experience memory: `docs/ExperienceAndLessons.md` (`## Active Lessons` first).
- Session resume/checkpoint pad: `docs/session-continue.md`.

## Architecture Quick Map
- Main process entry: `src/main/index.ts`.
- Renderer entry: `src/renderer/main.tsx`.
- IPC channels: `src/shared/ipc-channels.ts`.
- Data layer: `src/main/database/connection.ts`, `src/main/database/migrate.ts`.
- Business services: `src/main/services/*.ts`.
- UI pages: `src/renderer/pages/*.tsx`.

## High-Sensitivity Contracts
- Financial metrics must use one canonical formula path; avoid page-local re-implementation.
- Shared headline KPIs must read canonical data from `stats:canonicalKpis`.
- Cross-market amounts must be currency-normalized before aggregation.
- Dashboard and Statistics shared metrics must stay source-consistent.
- Follow-up AI conversation should control context size (summary + recent history) to avoid token spikes.

## AI Conversation Context Policy
- Keep follow-up context compact: include review summary, recent limited turns, and current question.
- Avoid replaying full historical prompt/response payloads every turn.
- If detailed trade rows are needed, ask user for the missing scope explicitly.

## Verification Fast Path
- Main-only change: `npm run build:main`.
- Renderer-only change: `npm run build:renderer`.
- Cross-layer change: `npm run build` then targeted tests from `task.md`.
- Metrics contract gate: `npm run check:metrics-contract`.
- Metrics continuous watch: `npm run watch:metrics:once` or `npm run watch:metrics`.

## Maintenance Rules
- Keep this file concise (target under 160 lines).
- Add only stable, reusable rules here.
- Put long narratives and chronology in `docs/ExperienceAndLessons.md`.
