# Dashboard Currency Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add shared currency controls to every Dashboard panel, unify displayed monetary values by selected currency, and persist selection locally (default USD).

**Architecture:** Keep a single currency state in Dashboard, render a reusable control in each panel, and derive converted values from existing stats/position/trade data with FX rates. Persist in localStorage.

**Tech Stack:** React, Ant Design, Recharts, Vitest, Testing Library

---

### Task 1: Add failing tests for dashboard currency controls

**Files:**
- Create: `src/renderer/pages/Dashboard.test.tsx`

1. Write test asserting multiple panel controls render and default currency is USD when no local storage key.
2. Write test asserting switching one control updates total pnl display conversion and persists to localStorage.
3. Run: `npm run test:run -- src/renderer/pages/Dashboard.test.tsx` and verify RED.

### Task 2: Implement dashboard shared currency state and persistence

**Files:**
- Modify: `src/renderer/pages/Dashboard.tsx`

1. Add `CurrencyCode` / `FxRates` types and conversion helpers.
2. Add localStorage-backed `displayCurrency` state with default USD.
3. Add FX fetching (`quote.getFxRates`) and reuse conversion formula.
4. Fetch SELL trades for money re-aggregation.
5. Recompute total pnl / pnl curve / monthly pnl and daily brief monetary fields using selected currency.
6. Add reusable currency control and render it in each dashboard panel.

### Task 3: Verify and keep green

**Files:**
- Modify if needed: `src/renderer/pages/Dashboard.test.tsx`, `src/renderer/pages/Dashboard.tsx`

1. Run test file until GREEN: `npm run test:run -- src/renderer/pages/Dashboard.test.tsx`.
2. Run project verification: `npm run test:run`.
3. Optional safety check: `npm run build`.
