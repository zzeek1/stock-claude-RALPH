# Homepage Dashboard Currency Config (Startup Read Required)

Last updated: 2026-02-21

## Startup Requirement
Every AI session working in this repository MUST read this file before changing homepage-related behavior.
Goal: keep currency behavior stable across Dashboard and Positions and avoid regressions.

## Scope
- In scope: homepage dashboard and positions currency display behavior.
- Out of scope: non-homepage pages unless explicitly requested.
- Special case: `/new-trade` keeps its own workflow and should not show the global currency control.

## Single Source Of Truth
- Shared state: `useCurrencyStore.displayCurrency`
- Persistence key: `app.displayCurrency`
- Default when no saved value exists: `USD`
- Helper module: `src/renderer/utils/currency.ts`

## Unified Currency Entry Rule
- Keep exactly one global currency entry in `src/renderer/components/Layout/AppLayout.tsx`.
- This entry controls homepage-related display currency across panels/pages.
- Do not add duplicated page-level currency controls back into `Dashboard.tsx` or other pages.

## Display Rules
1. Dashboard money values follow the unified `displayCurrency`.
2. Positions table:
- `average cost` and `current price` must use native market currency:
  - `HK` -> `HKD`
  - `US` -> `USD`
  - others -> `CNY`
- `current value` and `floating pnl` must keep existing unified conversion logic using `displayCurrency`.
- Do not change downstream value/pnl computation path unless user explicitly asks.

## Key Files
- `src/renderer/utils/currency.ts`
- `src/renderer/stores/index.ts`
- `src/renderer/components/Layout/AppLayout.tsx`
- `src/renderer/pages/Dashboard.tsx`
- `src/renderer/pages/Positions.tsx`
- `src/renderer/pages/Dashboard.test.tsx`
- `src/renderer/pages/Positions.test.tsx`

## Verification Checklist
Run after any homepage currency changes:
- `npm run test:run -- src/renderer/pages/Dashboard.test.tsx`
- `npm run test:run -- src/renderer/pages/Positions.test.tsx`
- `npm run test:run`
- optional confidence check: `npm run build`

## Guardrails
- Keep patches narrow to the requested area.
- If requirement says "do not change later current value logic", only touch price-display fields in Positions.
- Update this file when currency behavior contracts change.
