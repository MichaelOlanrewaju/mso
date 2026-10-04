# MSO Front-End Redesign V4

## Operational Screen Rebuild

V4 extends the V3 design system across the remaining day-to-day operational screens without changing business logic, API hooks, routes, role permissions, or station configuration.

### What changed

- Added a shared `OpsContextStrip` for station/workflow context and live state.
- Applied a unified operational page surface to dashboards, sales, cash-up, tank dip, discharge, attendance, payroll, records, pricing, shortage, variance, administration, and supporting operational pages.
- Standardized legacy cards/panels with the V3 surface language.
- Improved form focus states, field borders, table headers, row hover states, numeric/financial typography, and mobile card radii.
- Added workflow-card and operational status primitives for future screens.
- Extended the same visual treatment to GM, Supervisor, and Cashier experiences.
- Preserved the existing dark supervisor/discharge/payroll themes while giving them consistent spacing, controls, status language, and workflow context.

### Validation

- 117 JSX files parsed successfully with TypeScript JSX parsing; no syntax diagnostics were reported.
- A full `npm ci` / production build could not be completed in the build environment because dependency installation timed out. Do not treat that as an application build failure; verify locally with the commands below.

```bash
npm ci
npm run build
```

## Next stage — V5

V5 should focus on interaction quality and data-heavy workflows:

1. Standardize every data table around one reusable table component.
2. Add consistent filters, date ranges, export actions, pagination, and mobile table patterns.
3. Convert repeated modal/dialog patterns into shared accessible primitives.
4. Finish role-specific dashboard hierarchy and command-center KPIs.
5. Add loading skeletons and empty/error states to every operational route.
6. Perform a full mobile pass at 360px, 390px, 430px, tablet, and desktop widths.
