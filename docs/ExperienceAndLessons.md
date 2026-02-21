# Experience And Lessons

Last updated: 2026-02-22
Owners: all AI agents working in this repo

## Purpose
Use this file as a shared memory for implementation experience, pitfalls, and stable decisions.
Every AI should update this file after finishing meaningful changes.

## Update Rules
- Add new entries at the top of `## Entries` (newest first).
- Keep each entry short and factual.
- Include: `Date`, `Scope`, `What changed`, `Lessons`, `Regression risk`, `Verification`.
- If a rule changes, also sync `docs/homepage-dashboard-currency-config.md`.

## Entry Template
```md
### YYYY-MM-DD - <Scope>
- What changed:
- Lessons:
- Regression risk:
- Verification:
- Related files:
```

## Entries

### 2026-02-22 - MiniMax hard-lock (model/base URL) and 404 prevention
- What changed:
  - Forced cloud AI routing to MiniMax in backend: model fixed to `MiniMax-M2.5`, base URL fixed to `https://api.minimaxi.com/v1`.
  - Forced settings defaults/persistence to keep MiniMax values even if UI submits other model/base URL values.
  - Updated AI config UI on `AIReview` and `Settings` pages to display fixed model/base URL and keep user-editable API Key only.
  - Updated settings-related tests to assert forced MiniMax behavior.
- Lessons:
  - Most MiniMax `404` issues were path mismatch (`/chat/completions` without `/v1`) rather than API key failure.
  - Letting users edit provider/model/base URL in multiple screens causes configuration drift; fixed values plus editable API key is the safer contract.
  - Verification should include both local checks (tests/build) and a real API call to confirm transport/path correctness.
- Regression risk:
  - Any future reintroduction of free-form `ai_base_url` or multi-provider model dropdowns can bring 404 issues back.
  - If OpenAI-compatible call path changes away from `/v1/chat/completions`, MiniMax routing will fail despite valid key.
- Verification:
  - `npm run -s test:run -- src/test/settings.test.ts`
  - `npm run -s build:main`
  - `npm run -s build`
  - Direct API check: `POST https://api.minimaxi.com/v1/chat/completions` with `model=MiniMax-M2.5` returned `200`.
- Related files:
  - `src/main/services/ai-service.ts`
  - `src/main/services/settings-service.ts`
  - `src/renderer/pages/AIReview.tsx`
  - `src/renderer/pages/Settings.tsx`
  - `src/test/settings.test.ts`

### 2026-02-21 - Statistics page mojibake cleanup
- What changed:
  - Replaced garbled Chinese texts in `src/renderer/pages/Statistics.tsx` for chart titles, legends, empty states, heatmap labels, export prompts, and loading text.
  - Kept the already-fixed accounting logic (`总盈亏/总收益率/最大回撤`) unchanged.
- Lessons:
  - Source files may compile while user-facing text remains unreadable; encoding cleanup needs a dedicated verification pass.
  - UI text normalization should be validated together with tests/build after logic-heavy refactors.
- Regression risk:
  - Reusing copied text from legacy encoded sources can quickly reintroduce mojibake.
  - Later edits to chart tabs/tooltips are high-risk areas for garbled labels.
- Verification:
  - `npm run test:run -- src/renderer/pages/Statistics.test.tsx`
  - `npm run build:renderer`
- Related files:
  - `src/renderer/pages/Statistics.tsx`

### 2026-02-22 - Codex single-task convergence loop baseline
- What changed:
  - Added `scripts/codex-single-task-converge.ps1` to run Codex in multi-round convergence for one task with hard gates.
  - Added `docs/codex-single-task-convergence.md` with usage, stop conditions, and output structure.
  - Implemented convergence outputs under `.codex-convergence/<run-id>/` and a latest pointer file.
- Lessons:
  - Iterative automation should be bounded by explicit stop rules (`max rounds`, `max no-improve`) to avoid unproductive loops.
  - Convergence must be judged by objective gates (tests/build), not model self-assessment text.
  - Per-round logs and prompt snapshots are required for diagnosing stagnation and prompt refinement.
- Regression risk:
  - Running with `-SkipTests` or `-SkipBuild` weakens convergence confidence and can hide regressions.
  - Overly broad task statements reduce improvement signal and increase early no-improvement stops.
- Verification:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\codex-single-task-converge.ps1 -Task "dry run validation" -DryRun -MaxRounds 2 -MaxNoImprove 1`
  - Inspect `.codex-convergence/latest-summary.json`
- Related files:
  - `scripts/codex-single-task-converge.ps1`
  - `docs/codex-single-task-convergence.md`

### 2026-02-21 - Statistics tab: total-pnl/return/drawdown accounting alignment
- What changed:
  - Reworked `Statistics.tsx` headline accounting to compute `总盈亏 = 已实现 + 未实现` using SELL trades plus current floating pnl (with FX conversion by display currency).
  - Recomputed `总收益率` from account baseline formula `totalPnl / (totalAssets - totalPnl)` instead of trusting stale `overview.total_return`.
  - Recomputed drawdown series from normalized asset curve and used it for both chart and headline `最大回撤`.
  - Fixed calendar heatmap wiring (`year`, currency symbol), removed duplicate `emotionHeatmap` tab key, and repaired multiple corrupted JSX strings that previously broke renderer compilation.
  - Updated `Statistics.test.tsx` to assert new metric wording and formulas, and added missing `position.list` mock.
- Lessons:
  - Financial KPI cards and chart data must share one accounting basis; mixing backend realized-only values with frontend total-account values causes immediate trust issues.
  - When legacy text encoding damage exists, even minor logic edits can expose hidden syntax faults; compile-first cleanup is required before behavioral verification.
  - Duplicate tab keys in Antd Tabs can silently shadow content and mislead debugging of “wrong data” complaints.
- Regression risk:
  - If future refactors revert `totalReturn` to `overview.total_return`, statistics will drift from displayed total assets again.
  - If asset curve normalization is bypassed for drawdown, max drawdown card/chart will diverge from account baseline assumptions.
  - Reintroducing duplicated tab keys can mask chart content without explicit runtime errors.
- Verification:
  - `npm run test:run -- src/renderer/pages/Statistics.test.tsx`
  - `npm run build:renderer`
- Related files:
  - `src/renderer/pages/Statistics.tsx`
  - `src/renderer/pages/Statistics.test.tsx`

### 2026-02-22 - Dashboard asset curve baseline alignment and hook-order regression fix
- What changed:
  - Fixed Dashboard hook-order crash by removing a conditional-hook path (`useMemo` executed only after loading), and moved curve normalization to a pure helper function.
  - Added `normalizeAssetCurveData` in `Dashboard.tsx` and made the chart use normalized data anchored to:
    - start: `baseline = totalAssets - totalPnl`
    - end: `current totalAssets`
  - Added regression test to assert first/last asset-curve points are pinned to expected baseline/current totals.
- Lessons:
  - In React pages with loading early-return branches, any newly added Hook must be declared before conditional return paths, otherwise hook-order runtime crashes are likely.
  - Financial chart lines and headline KPIs must share the same accounting basis; endpoint anchoring avoids user-visible mismatch between curve and summary cards.
  - Converting critical data transforms into pure functions improves testability and reduces repeated UI regressions.
- Regression risk:
  - Reintroducing hook calls after `if (loading) return ...` can immediately break Dashboard rendering.
  - If future code changes baseline formula or bypasses normalization for chart data, start-date totals can drift from KPI-derived values again.
- Verification:
  - `npm run test:run -- src/renderer/pages/Dashboard.test.tsx`
  - `npm run build:renderer`
  - `npm run build`
- Related files:
  - `src/renderer/pages/Dashboard.tsx`
  - `src/renderer/pages/Dashboard.test.tsx`

### 2026-02-22 - AI provider routing fix for gpt models in AI review
- What changed:
  - Added provider-aware routing in `ai-service`: `gpt-*` models now use OpenAI-compatible streaming (`/chat/completions`), while Claude models continue using Anthropic SDK.
  - Added base URL resolver fallback: if model/url pair is mismatched (e.g., `gpt-*` + Anthropic default URL), service auto-corrects to provider default URL.
  - Improved cloud AI error reporting for `401/403` and blocked-request scenarios with model + URL context.
- Lessons:
  - Model selection alone is insufficient; transport protocol must match provider API shape.
  - Persisted URL settings can become stale when model family changes, so runtime guardrails are needed.
  - Clear provider-specific error messages reduce support/debug time.
- Regression risk:
  - Removing provider routing can reintroduce `403 blocked` for cross-provider model usage.
  - If a gateway is OpenAI-compatible but not using `/chat/completions`, streaming parser assumptions may need adjustment.
- Verification:
  - `npm run build:main`
  - `npm run test:run`
  - `npm run build`
- Related files:
  - `src/main/services/ai-service.ts`
  - `src/renderer/pages/AIReview.tsx`

### 2026-02-22 - Statistics consistency fixes (calendar year, strategy trends, metric wording, risk cash fallback)
- What changed:
  - Fixed calendar heatmap year rendering to use selected year instead of always using current year.
  - Refactored strategy trend and strategy win-rate trend charts to use period-pivoted datasets with one line per strategy.
  - Renamed headline metrics from `总盈亏/总收益率` to `已实现盈亏/已实现收益率` to match backend SELL-only realized logic.
  - Aligned calendar heatmap count scope to realized SELL trades.
  - Improved risk-assessment cash fallback: when no snapshot cash exists, estimate from trade cashflows instead of blindly using initial capital.
  - Added regression tests for heatmap tab uniqueness, calendar year mapping, strategy-trend line semantics, and headline wording.
- Lessons:
  - Visualization bugs often come from data shape mismatch, not just rendering code.
  - Duplicate or ambiguous business wording in financial dashboards causes user trust loss even when code is technically running.
  - Cash fallback logic must avoid optimistic defaults or exposure metrics become systematically understated.
- Regression risk:
  - Reverting chart datasets back to unpivoted mixed rows will reconnect unrelated strategy points.
  - Reintroducing current-year hardcoding in calendar grid will break year switching again.
  - Switching wording back to `总` without changing backend formula reintroduces interpretation errors.
- Verification:
  - `npm run test:run -- src/renderer/pages/Statistics.test.tsx`
  - `npm run test:run`
  - `npm run build`
- Related files:
  - `src/renderer/pages/Statistics.tsx`
  - `src/renderer/pages/Statistics.test.tsx`
  - `src/main/services/stats-service.ts`

### 2026-02-22 - AI review in-page configuration with local persistence
- What changed:
  - Added AI configuration controls directly in `AIReview` page: API Key, API URL, and model, with explicit save action.
  - Added `ai_base_url` to shared settings model and persisted it through settings service.
  - Updated AI service Anthropic client initialization to honor configured `ai_base_url` when present.
  - Extended settings tests to cover `ai_base_url` defaults, parsing, and persistence behavior.
- Lessons:
  - If runtime behavior depends on settings, UI save alone is insufficient; service-level consumption must be wired in the same change.
  - Reusing existing settings IPC path avoids introducing parallel persistence logic and reduces regression surface.
  - URL configuration should be validated before save to prevent hard-to-debug downstream request failures.
- Regression risk:
  - Breaking alignment between `Settings` type and settings-service keys can silently drop saved values.
  - Future refactors that recreate Anthropic clients without reading `ai_base_url` will make UI config appear ineffective.
  - Saving empty or malformed base URLs without guardrails can cause runtime AI failures.
- Verification:
  - `npm run test:run -- src/test/settings.test.ts`
  - `npm run test:run`
  - `npm run build`
- Related files:
  - `src/renderer/pages/AIReview.tsx`
  - `src/main/services/settings-service.ts`
  - `src/main/services/ai-service.ts`
  - `src/shared/types.ts`
  - `src/test/settings.test.ts`

### 2026-02-22 - Statistics page tab duplication and risk-assessment data source
- What changed:
  - Removed duplicated `emotionHeatmap` tab item in `Statistics.tsx` (duplicate tab key caused display collision).
  - Kept the real heatmap tab that renders `emotionHeatmapData` via `renderEmotionHeatmap`.
  - Updated statistics refetch flow: calendar year change now keeps current date-range filter.
  - Switched risk assessment source from local zero-valued snapshot helper to `getPositions()` so `current_value`/exposure metrics are based on real position valuation.
  - Added renderer regression test for emotion heatmap tab uniqueness and content rendering.
- Lessons:
  - Ant Design Tabs requires unique keys; duplicate keys can silently mask one tab's content.
  - For analytics pages, changing one filter (year) should not implicitly drop another filter (date range).
  - Risk metrics are only meaningful when sourced from valued positions, not placeholders.
- Regression risk:
  - Reintroducing duplicate tab keys in `chartTabs` can make wrong chart appear under expected label.
  - Reverting risk assessment to a non-valued position source will show near-zero exposure and misleading warnings.
- Verification:
  - `npm run test:run -- src/renderer/pages/Statistics.test.tsx`
  - `npm run test:run`
  - Optional: `npm run build`
- Related files:
  - `src/renderer/pages/Statistics.tsx`
  - `src/renderer/pages/Statistics.test.tsx`
  - `src/main/services/stats-service.ts`
  - `src/main/ipc/stats-handlers.ts`

### 2026-02-22 - IBKR fixed fee integration and test hardening
- What changed:
  - Introduced shared cost engine for trade fee calculation with IBKR fixed logic across HK/US markets.
  - Wired auto-cost calculation into New Trade and Edit Trade flows so amount/fees/total stay consistent.
  - Updated backend trade creation to use the same shared calculator, with explicit input override support.
  - Expanded and rewrote key tests for trade costs, trade service, settings service, and TradeLog page behavior.
- Lessons:
  - Fee formulas must be single-sourced in shared code; frontend-only calculation causes drift against persisted data.
  - Nullish checks (`??`) are required for numeric financial fields; using `||` breaks explicit zero-fee scenarios.
  - UI tests against Ant Design buttons should avoid exact accessible-name matching when icon prefixes are present.
- Regression risk:
  - Diverging fee constants between UI and backend will reintroduce inconsistent totals.
  - Changing HK/US fee assumptions without updating tests can silently break pnl/cost correctness.
  - Replacing robust role-name regex selectors with strict text-name selectors may cause flaky TradeLog tests.
- Verification:
  - `npm run test:run -- src/test/settings.test.ts src/test/trade-service.test.ts src/renderer/pages/TradeLog.test.tsx`
  - `npm run test:run`
- Related files:
  - `src/shared/trade-costs.ts`
  - `src/main/services/trade-service.ts`
  - `src/renderer/pages/NewTrade.tsx`
  - `src/renderer/components/Trade/EditTradeModal.tsx`
  - `src/test/trade-costs.test.ts`
  - `src/test/trade-service.test.ts`
  - `src/test/settings.test.ts`
  - `src/renderer/pages/TradeLog.test.tsx`

### 2026-02-22 - Homepage currency unification and Positions display boundary
- What changed:
  - Added one global currency control entry in layout (`/new-trade` excluded).
  - Unified currency state via `useCurrencyStore` with local persistence key `app.displayCurrency`.
  - Default currency behavior set to `USD` when no local preference exists.
  - Positions page changed only for `avg cost` and `current price`: display native market currency (`HKD`/`USD`/`CNY fallback`).
  - Kept `current value` and `floating pnl` logic unchanged (still unified conversion path).
- Lessons:
  - UI entry unification must be separated from data conversion rules; they are not always the same requirement.
  - User scope boundaries matter: when asked not to touch downstream logic, isolate field-level rendering changes only.
  - Currency defaults and persistence need explicit contracts to avoid repeated regressions.
- Regression risk:
  - Reintroducing page-level currency controls in Dashboard/other pages causes duplicated state and inconsistency.
  - Accidentally converting Positions price columns to unified currency breaks the requested business rule.
  - Changing `app.displayCurrency` key without migration will reset user preference.
- Verification:
  - `npm run test:run -- src/renderer/pages/Dashboard.test.tsx`
  - `npm run test:run -- src/renderer/pages/Positions.test.tsx`
  - `npm run test:run`
  - Optional: `npm run build`
- Related files:
  - `src/renderer/components/Layout/AppLayout.tsx`
  - `src/renderer/stores/index.ts`
  - `src/renderer/utils/currency.ts`
  - `src/renderer/pages/Dashboard.tsx`
  - `src/renderer/pages/Positions.tsx`
  - `docs/homepage-dashboard-currency-config.md`
