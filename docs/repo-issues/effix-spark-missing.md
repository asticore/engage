# Issues to open on `asticore/effix` (Spark)

Checked 15 Nov 2026 against the repo. Already there, so not listed: shimmer (skeleton loaders), toast, popup, carousel, countdown, counter, funnel/flow (sankey style) charts, timeline chart, radar, 30+ charts, 5 diagrams, 9 viz types. Keep the `efx-` prefix after the rename to Spark (decided by Matt).

## 1. Data table behaviour (`efx-table`)
Behaviour layer for a plain Shine table: sort by column, search, per-column filter, paging, sticky header, column visibility, row selection (with select all and a `change` event), responsive stack, CSV download, empty state. Data from the existing markup or `data-efx-data` JSON or CSV. Accessible (`aria-sort`, keyboard). Used by Engage Task 40c.

## 2. Chart data input
`data-efx-csv` (inline or URL) and a live-data adapter hook (`Effix.chartSource(name, fn)`) so a page can feed results from a form or data view without rebuilding the chart. Add stacked and mixed series options where missing. Used by Engage Task 40b.

## 3. Polar area chart
Confirm `chart-bar` or `chart-radar` covers polar area; if not add `chart-polar`.

## 4. Star rating (`efx-rating`)
Read-only and input modes, half stars, count, colour token, `change` event.

## 5. Calendar and date picker (`efx-calendar`)
Month view with events from JSON or ICS, optional range picker, first day of week, locale. Used by Engage Tasks 39c and 34b.

## 6. Stepper and multi-step helper (`efx-steps`)
Step state, next and back, validation hook, progress, URL hash sync.

## 7. Lottie player (`efx-lottie`)
Small dotLottie player: autoplay, loop, play on scroll or hover, reduced-motion fallback. Used by Engage Task 33b.

## 8. Content timeline component
A vertical and horizontal timeline for content (not the timeline chart): items, icons, alternating layout, reveal on scroll. Used by Engage Task 39a.

## Notes for every item
Zero dependencies, `data-efx-*` options, Shine tokens, `prefers-reduced-motion` respected, a `.meta.js` entry so the Engage picker can list options.
