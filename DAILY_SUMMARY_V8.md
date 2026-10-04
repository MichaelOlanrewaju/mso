# Daily Summary — V8 Redesign

## What changed

The Daily Summary has been rebuilt as an operational command center rather than a narrow report.

### New experience
- Executive fuel-sales hero with live PMS + AGO revenue.
- Day Health card for reconciliation and cash-up state.
- KPI strip for collected money, bank deposit, expenses and fuel volume.
- Product-mix sales performance with volume, revenue and margin context.
- Collection-mix visualization for Cash, POS and Transfer.
- Tank stock movement table with visual sales bars.
- Delivery context directly inside stock movement.
- Manager-focused "What needs attention" panel.
- Pump activity cards with session count, litres and value.
- Cash movement, non-fuel sales and sales-cash allocation sections.
- Manager notes and supporting station photos remain available.
- Existing live data calculations, permissions and date filtering are preserved.
- Existing print/share actions remain available.

## Important implementation note

The environment used to package this release does not have `node_modules` installed. An offline install could not complete because one npm package was not cached, and the production build could therefore not be verified here. No claim of a successful `npm run build` is made.

## Local verification

```bash
npm ci
npm run build
npm run dev
```

Then open:

`/summary/<station>`

## BUILD NEXT

Next stage should be Daily Summary V9:

1. Add period comparison: today vs previous trading day.
2. Add 7-day sales trend without making the page visually heavy.
3. Add shift-level breakdown when shift data is available.
4. Add direct "Review" actions from exception items.
5. Add export-ready PDF/CSV report structure.
6. QA mobile widths at 360 / 390 / 430px and desktop.
7. Verify all live API states: loading, empty, timeout, partial data and retry.
8. Run a real production build after dependencies are installed.
