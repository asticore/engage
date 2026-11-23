# Done (archive)

Everything that has been built and closed, moved here from `docs/remaining-work.md`. Part 1 groups every finished feature or change by category, each with a stable code (for example `SEC-007`). Part 2 is a log by date that links back to those codes. The appendices at the end are the closed planning documents, unchanged.

**Codes, not task numbers.** Old task numbers repeat (several "Task 4"s, 16a and 21a reused), so they are only kept inside the original text. Refer to a finished item by its code.

**Adding an entry.** Add it at the end of the right category in Part 1 with the next free number (never renumber), then add one line to the log in Part 2 under its date. Every entry must also end with a **Where to find it:** line giving the admin or site path so it can be reviewed easily (for example `/admin/content/pages`, `/admin/settings/speed > Page cache`, or the visual editor > element panel), checked against the routes in the code; write `No UI (backend only)` plus the file when there is no screen. Open items stay in `docs/remaining-work.md`.

## Categories

| Code | Category | Entries |
|---|---|---|
| [SPD](#cat-spd) | Speed, builds and updates | 18 |
| [STY](#cat-sty) | Spark, Shine and fonts | 18 |
| [SEC](#cat-sec) | Security, sign-in and privacy | 54 |
| [INT](#cat-int) | Integrations, API and webhooks | 19 |
| [EVT](#cat-evt) | Events, tickets and bookings | 11 |
| [COM](#cat-com) | Commerce and shop | 51 |
| [FRM](#cat-frm) | Forms, comments and spam | 10 |
| [MEM](#cat-mem) | Members, companies and portal | 11 |
| [MED](#cat-med) | Media and files | 10 |
| [I18N](#cat-i18n) | Languages and translations | 12 |
| [AFF](#cat-aff) | Affiliates, agencies and franchising | 28 |
| [SEO](#cat-seo) | SEO, blog and content | 25 |
| [BLD](#cat-bld) | Visual builder, templates and elements | 81 |
| [ADM](#cat-adm) | Admin and settings | 39 |

Appendices: [Elementor-parity tweaks](#appendix-elementor-parity-tweaks-task-list-closed-ve-01-to-ve-15-built-pr-226), [Visual editor vs Elementor gap review](#appendix-visual-editor-vs-elementor-gap-review-closed-items-3-and-4-moved-to-tasks-in-docsremaining-workmd), [Events and tickets audit](#appendix-events-and-tickets-audit-closed-task-1-moved-from-remaining-workmd-22-nov-2026)

---

## Part 1: By category

<a id="cat-spd"></a>
### SPD: Speed, builds and updates

<a id="spd-001"></a>
#### SPD-001 · Fresh-install rules

_Date not recorded_

**Fresh-install rules:** enforced by `tests/int/fresh-install-schema-coverage.int.spec.ts`; the thin-install gap is about repo size and fallbacks, not schema (Task 4).

**Where to find it:** No UI (backend only): tests/int/fresh-install-schema-coverage.int.spec.ts

<a id="spd-002"></a>
#### SPD-002 · Task 15 SITE_URL fallback removed (#158)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 15 SITE_URL fallback removed (#158):** the hard-coded production domain fallback is gone; SITE_URL is required for canonical and mail links. Live check in Task 6.

**Where to find it:** No UI (backend only): SITE_URL setting, no domain fallback in src/utilities/siteOrigin.ts

<a id="spd-003"></a>
#### SPD-003 · Task 13 CI workflow (#162)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 13 CI workflow (#162):** `.github/workflows/ci.yml` `test` job on PRs and main (tsc, eslint, about 390 test files). Open decisions: closed in Task 11 (PR #199).

**Where to find it:** No UI (backend only): .github/workflows/ci.yml (test job)

<a id="spd-004"></a>
#### SPD-004 · Task 12 speed (PR #201, 1 Nov)

_Date: 1 Nov 2026_

**Task 12 speed (PR #201, 1 Nov):** per-request site snapshot (site settings, header, footer, shop settings; buildMetadata reuses it); published pages scanned once per request; home, post and product loaders memoised per request; query counter spec with bounds (home 14 to 11, post 11 to 9, product 11 to 9 reads, layout included). Theme fonts: only the built-in faces the theme picks, from jsDelivr pinned to @fontsource 5.3.0 (Cinzel has no Cyrillic file). Video: optional poster image; with a poster the file video uses preload none. No transcoding here (12b). Images: decoding async everywhere, lazy below the fold, high priority on the header logo and the post's featured image; R2 media stays a plain img (EngageImage's note: next/image cannot resize on Workers). Not done, by decision: no width and height attributes on block images (sizing is CSS-driven and cannot be checked visually here); no 'use client' removals (EmbedConsentFrame must stay client so the iframe never reaches server HTML); bundle size is measured in Task 6; no cross-request JSON snapshot, because the edge page cache already serves anonymous visitors and is purged on change.

**Where to find it:** No UI (backend only): per-request loaders in src, bounds checked by tests/int/speed-page-queries.int.spec.ts

<a id="spd-005"></a>
#### SPD-005 · Task 4 (architecture) closed 2 Nov 2026 (PRs #215, #218, #219, #220, #222)

_Date: 2 Nov 2026_

Task 4 (architecture) closed 2 Nov 2026 (PRs #215, #218, #219, #220, #222): setup script, schema source of truth, bundle budget, lazy sections, sharded CI, Next 16, baseline schema. Only the framework package split is parked as a Matt decision.

**Where to find it:** No UI (backend only): pnpm run setup:cloudflare (scripts/setup-cloudflare.mjs), .github/workflows/ci.yml, src/migrations/baseline/

<a id="spd-006"></a>
#### SPD-006 · Tasks 1 and 5 closed 2 Nov 2026 (PR #221 type debt 83 to 9 any, 43 to 15 eslint-disable)

_Date: 2 Nov 2026_

Tasks 1 and 5 closed 2 Nov 2026 (PR #221 type debt 83 to 9 any, 43 to 15 eslint-disable). Vendor Products mirror moved to Open now as Permanent.

**Where to find it:** No UI (backend only): src/engine/types.ts and eslint.config.mjs (type debt cleanup)

<a id="spd-007"></a>
#### SPD-007 · Task 4 architecture (PR #215, 2 Nov)

_Date: 2 Nov 2026_

**Task 4 architecture (PR #215, 2 Nov):** site name from Site Settings in Header, Footer, checkout, the home page and the seed (neutral default "My website"; no extra reads on page paths). `pnpm run setup:cloudflare` creates or reuses the D1 database and R2 bucket and rewrites the names and ID in `wrangler.jsonc` (idempotent; refuses to change the ID without `--replace`; live values unchanged). `pnpm run bundle:size` reads per-route first-load JS from the `.next` build against `bundle-budget.json` (the budget value is a placeholder until Task 6). Content-type drift test (`tests/int/content-types-drift.int.spec.ts`): about 230 collection fields added to `src/engage-types.ts`, two unused keys removed, stored-elsewhere keys mapped, `seo.xCard` typed as a union. README deploy steps, scripts, feature status (every feature is implemented), database cleanup and template libraries corrected. Checks: tsc, eslint, related vitest. Matt's live checks are in Task 6.

**Where to find it:** /admin/settings/site (General): Site name field, used in Header, Footer, checkout and home page; setup itself is CLI pnpm run setup:cloudflare

<a id="spd-008"></a>
#### SPD-008 · Task 4 speed and Task 5 type debt (PR #217, 2 Nov)

_Date: 2 Nov 2026_

**Task 4 speed and Task 5 type debt (PR #217, 2 Nov):** `any` 167 to 83, eslint-disable 86 to 43 (ratchet baseline lowered). `src/engine/types.ts` has one named loose default (`Loose`); hook results are `unknown`, records `Record<string, unknown>`; edit-screen and lock guards are typed. `@next/next/no-img-element` is off in `eslint.config.mjs` (pictures use the site's own image pipeline; 29 directives gone, decided). Real fixes for set-state-in-effect and exhaustive-deps in SeoCard (useSyncExternalStore), SocialImageInfo, ListRowActions, PasswordGroups, GenerateVariations, useResolvedMedia, commerce provider. Speed (measured on the stale 25 Oct `.next`: admin page 510 KB gzip, public pages about 210 KB; no new build run): admin field widgets (`componentRegistry`) load on use; all admin screens in `adminViewRegistry` load when their route opens (server `lazyView`); PageSpeed and Google cards in EditForm, the popup script, the tracking picker (admins only) and the form renderer load on demand. Server rendering unchanged. Re-measure after the next build with `pnpm run bundle:size` and set the budget in Task 6. Checks: tsc, eslint, related vitest (ratchet, forms, popup, tracking picker, roles guards, edit screens, speed page queries, password groups, bundle reader).

**Where to find it:** No UI (backend only): src/engine/types.ts and eslint.config.mjs (any and eslint-disable counts)

<a id="spd-009"></a>
#### SPD-009 · Task 4 lazy sections and Unused tables (PR #218, 2 Nov)

_Date: 2 Nov 2026_

**Task 4 lazy sections and Unused tables (PR #218, 2 Nov):** a fresh install creates core tables (pages, media, users, settings, navigation) and the sections on by default (tracking); shop, events, blog, FAQs, forms, courses, members, A/B tests, ads, backups, redirects, translations and approval get their tables the first time they are ticked in Settings > General > Features (the same migration sequence replayed with only that section's statements, run before the save lands; a failure rejects the save and the switch stays off), plus a starter template for shop, events and FAQs. Switching off keeps data and tables. Existing installs: migration `20270310_100000_feature_tables_state` marks every section that already has tables as provisioned, switches untouched (tested on a simulated older database). A lazy install plus every section provisioned equals the old install table for table, column for column. Registry `src/features/featureTables.ts` (one owner per table, derived from `FEATURES[].tables`; settings tables are core; test fails for an unclassified or doubly claimed table). Reads of a missing section table return empty (find, findByID, count; privacy export and unsubscribe guarded). Settings > Data and System > Unused tables (admin role is the super admin): rows and size estimate, JSON export, delete by typing the table name, audit entry `database.table-dropped`, refuses core, sections that are on and payment records (orders, refunds, transactions, gift cards, store credit, credit ledger, subscriptions, coupon reservations); a deleted table marks its section deferred so switching it on recreates it. `POST /api/internal-migrate?provision=all` makes every section at once. Measured locally: fresh install about 15 percent faster; the rest is the 147 migrations' own lookups (next speed target: fewer per-migration reads, or the package split); one section takes about 5 s to create. Decisions: posts stay in the Blog section; settings pages are always created; the old Database screen (per-feature cleanup) stays. Live checks in Task 6. Known: `content-types-drift` fails on main (FormSubmission embedId and embedSource not declared), not from this PR.

**Where to find it:** /admin/settings/site > Features (section switches create their tables on first switch on); leftover tables at /admin/unused-tables

<a id="spd-010"></a>
#### SPD-010 · Task 4 Next 16 upgrade (PR #220, 2 Nov)

_Date: 2 Nov 2026_

**Task 4 Next 16 upgrade (PR #220, 2 Nov):** next 15.4.11 to 16.4.3 with eslint-config-next 16.2.7; `@opennextjs/cloudflare` 1.18.1 supports `^16.1.5`, so `--dangerouslyUseUnsupportedNextVersion` is gone from `deploy`, `deploy:app` and `scripts/build.mjs`. Next 16 builds with Turbopack by default and rejects the webpack `extensionAlias`, so build, dev and the OpenNext `buildCommand` use `--webpack`. `middleware.ts` kept (deprecated but supported on the edge; the Node-runtime `proxy` rename is a separate change). tsc, eslint (0 errors), edge-middleware-graph, speed-page-queries and `next build --webpack` pass; the OpenNext build and live deploy are a Task 6 check.

**Where to find it:** No UI (backend only): package.json (Next 16) and scripts/build.mjs

<a id="spd-011"></a>
#### SPD-011 · Task 4 fresh-install speed (PR #222, 2 Nov)

_Date: 2 Nov 2026_

**Task 4 fresh-install speed (PR #222, 2 Nov):** an empty database gets a precomputed final schema (`src/migrations/baseline/`, generated) and the existing migrations are recorded as run, so only newer ones run; existing installs and lazy sections unchanged. Local fresh install 78-83 s down to 6.5-7.5 s. `tests/int/fresh-baseline-parity.int.spec.ts` proves table, column, index, foreign key and seed parity with the full run (lazy default and all sections on) and that a later migration still runs; regenerate with `REGENERATE_BASELINE=1`. Specs that test migrations pass `baseline: false`.

**Where to find it:** No UI (backend only): src/migrations/baseline/ and tests/int/fresh-baseline-parity.int.spec.ts

<a id="spd-012"></a>
#### SPD-012 · Next.js security patch (16 Nov)

_Date: 16 Nov 2026_

**Next.js security patch (16 Nov):** `next` 16.4.3 to 16.4.6 (same minor, clears the known-vulnerability notice that stopped the production build twice). `@opennextjs/cloudflare` stays 1.18.1 (peer range `^16.1.5`), patch file unchanged. Full OpenNext build and type check pass; live deploy check in Live checks.

**Where to find it:** No UI (backend only): package.json (next 16.4.6)

<a id="spd-013"></a>
#### SPD-013 · Fresh install fix (PR)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

Fresh install fix (PR): bid mode terms now live in one JSON column (bid, version_bid) so the product version table is back under D1's 100-column limit; wholesale_applications and customer_tags registered under ecommerce.

Task 15a (part 3, built 17 Nov 2026): the state harness now also covers cards, alerts (default, danger, success, warning, solid), selects, text areas, tabs, accordion summaries, checkboxes and radios (accent colour 3:1) in light and dark, plus focus rings and borders for selects, text areas, tabs and accordions. All passed without a Shine change. The public block CSS (`components/blocks/elements/*.css`) was scanned for fixed colours; the only failures were the star rating colours in `wave66.css` (empty star 1.6:1, filled 2.1:1), now #767676 and #b87d00 with the half star drawn as a gradient instead of opacity. Spec: `tests/int/state-contrast.int.spec.ts`.

Task 14b (leftovers, built 17 Nov 2026): AI tagging. `POST /api/admin-media-ai-tags` (`src/app/(engage)/api/admin-media-ai-tags/route.ts`) asks the chosen vision model which of the site's existing tags fit each picture (`src/features/ai/tagSuggest.ts`); it never creates tags, never removes any, up to 25 pictures a request, JPEG, PNG and WebP only, same AI keys and provider picker as alt text. The Media page bulk bar has an AI tag button and a file's edit screen has Suggest tags with AI (adds and ticks the tags, untick to undo). The tag filter shows a dot in the chosen tag's colour. Files CSV import now tags every file that shares a filename (the export lists them once). Tags and files CSV imports over 1 MB are sent in pieces of up to 900,000 characters with the header repeated (`splitCsv` in `src/features/mediaTags/logic.ts`), so there is no size limit in the screen. No schema change. Specs: `tests/int/media-ai-tags.int.spec.ts`.

**Where to find it:** No UI (backend only): product version table columns in src/migrations (bid JSON column); guard tests/int/d1-column-limit-guard.int.spec.ts

<a id="spd-014"></a>
#### SPD-014 · Lean installer with remote updates (built 18 Nov 2026, v1.2.0)

_Date: 18 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Lean installer with remote updates (built 18 Nov 2026, v1.2.0).** The Deploy button now targets `installer/` (README): `wrangler.jsonc` (no ids, `no_bundle`, D1/R2/Images/cron, `ENGAGE_INSTALL=lean`), `engage.config.json` (`source`, `version`) and `scripts/install.mjs`, which downloads the named release from GitHub, checks sha256 and unpacks to `.engage/`. Releases come from `.github/workflows/release.yml` (tag `vX.Y.Z`) and `scripts/make-release.mjs`: worker.js (wrangler dry-run bundle), assets.tar.gz and `manifest.json` (version, notes from CHANGELOG, migration list, `requiresMigration`, `destructive`, `minFromVersion`, checksums, `workerGzipKiB`). Release source is configurable: `UPDATE_SOURCE` env or `source` in the config (`upstreamRepo` in `src/features/updates/versions.ts`), private sources with `ENGAGE_SOURCE_TOKEN`. The existing update popup (`UpdateNotice`, `admin-update-check`) now reads the manifest (notes, data-change warning). `admin-update-apply`: forks still sync upstream; a lean install takes an R2 backup (`runBackup`; failure offers continue without) then pins the version in the install repo through `pinInstallVersion` (`oneClick.ts`), and `{ rollback: true, version }` pins the previous one. `MigrationBar` and `admin-engage-migrate` show Run migration when the running version is newer than `eg_engage_meta.applied_version` (set by the migration and by first-run init). Local clones deploy as before. Worker is 10.8 MiB gzip, over the 3 MB limit; tracked under Task 39. Tests: `tests/int/engage-updates.int.spec.ts`. Verified: full OpenNext build, release script, installer run against a local release server, `wrangler deploy --dry-run` of the installed site.

**Where to find it:** No UI (backend only): installer/ (wrangler.jsonc, engage.config.json, installer/scripts/install.mjs), behind the Deploy button

<a id="spd-015"></a>
#### SPD-015 · One-click updates, tables and code separate (built 21 Nov 2026)

_Date: 21 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**One-click updates, tables and code separate (built 21 Nov 2026).** The update popup no longer links to GitHub releases. It has two independent parts: "Update tables" (shown when migrations the code runs are not recorded; `/api/admin-engage-migrate`) and "Update site code" (shown only on lean installs and forks when a release changes the Worker; `/api/admin-update-apply` takes a safety backup to R2, then commits the new version to the install repository so the host redeploys). A destructive release needs its checkbox ticked first (also enforced by the API). The GitHub connection is entered once in the popup: `/api/admin-update-connect` checks the token (reads `engage.config.json`, picks the one repository a fine-grained token reaches, or takes `owner/name`) and stores repo and token encrypted in `eg_engage_meta` (`src/features/updates/connection.ts`); `UPDATE_REPO` and `UPDATE_GITHUB_TOKEN` Worker settings still win. Sites deployed straight from the repository show neither code part.

**Where to find it:** Updates popup, bottom right on any /admin page (shows only when action is needed): Update tables and Update site code buttons

<a id="spd-016"></a>
#### SPD-016 · Update popup live check (21 Nov 2026, PRs 531, 532)

_Date: 21 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Update popup live check (21 Nov 2026, PRs 531, 532).** On gracengatsby: no bar and no popup with nothing pending; with the no-op migration `20270321_100000_update_popup_probe` pending the one popup showed, Run migration ran it, the record was written and the popup cleared. Found and fixed (PR 532): the popup's Run migration and Update now posted without a JSON content type and the admin guard refused them (403 "Send a JSON body"). Note: git-deployed sites such as gracengatsby run migrations at deploy, so the popup only matters for release-based installs.

**Where to find it:** Same Updates popup as SPD-015 (bottom right on /admin pages): Update tables button, checked live

<a id="spd-017"></a>
#### SPD-017 · One update popup, stable Shine/Spark URLs (built 21 Nov 2026)

_Date: 21 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**One update popup, stable Shine/Spark URLs (built 21 Nov 2026).** The top "run migration" bar (`MigrationBar`) is gone. `UpdateNotice` (super admins only) is the only popup and shows only when action is needed: `/api/admin-engage-migrate` GET now reports `pending` from the migrations the code runs (`EARLY_MIGRATIONS` + `LATE_MIGRATIONS`) that are not recorded in `eg_migrations` (`pendingMigrationNames`, `src/features/updates/state.ts`), not from the version number, so a release without a new migration never shows it; or a newer release whose manifest says the Worker changed. `manifest.json` gains `requiresWorkerUpdate` (older manifests and a missing manifest read as true): `scripts/make-release.mjs` sets it false when the Worker checksum equals the previous release's and no migration was added, or when run with `--static-only` (asset-only release). The reference-update ("Newer version available for Spark") text no longer appears and the update check no longer calls GitHub for references. Shine and Spark now load from the stable major channel (`shine@v1`, `spark@v0` on jsDelivr), so a new Shine/Spark release reaches every page and portal with no deploy. Trade-off: a changing file cannot carry a fixed SRI hash, so the built-in two have no integrity attribute; protection is the pinned host path `cdn.jsdelivr.net/gh/asticore/` plus the bundled fallback; customer-added assets still support SRI. A runtime hash manifest was rejected: it is served from the same repo so it adds no trust.

**Where to find it:** Updates popup (UpdateNotice) bottom right on /admin pages; replaces the old top migration bar; no separate screen

<a id="spd-018"></a>
#### SPD-018 · 41c

_Date: 22 Nov 2026 · Original group: Task 4 leftovers 41a to 41c (built 22 Nov 2026)_

41c: `tests/int/d1-column-limit-guard.int.spec.ts` fails when a table comes within 5 columns of D1's 100-column limit; the four tables already there (`eg_integrations` 97, `eg_shop_settings` 100, `eg_security_settings` 100, `_eg_products_v` 99) are listed and may not grow.

**Where to find it:** No UI (backend only): tests/int/d1-column-limit-guard.int.spec.ts

<a id="cat-sty"></a>
### STY: Spark, Shine and fonts

<a id="sty-001"></a>
#### STY-001 · Design model steps 1 to 3 (#165, #166, #168); step 4 data side (#177)

_Date not recorded_

**Design model steps 1 to 3 (#165, #166, #168); step 4 data side (#177):** grouped design storage, migration `20270126_100000_design_grouped`, write hooks. #163 closed via #165. Open items: Task 1a.

**Where to find it:** No UI (backend only): src/migrations/20270126_100000_design_grouped.ts and src/lib/design/storedGrouped.ts

<a id="sty-002"></a>
#### STY-002 · Design model step 4c, typed emitter removed (PR #183, 31 Oct)

_Date: 31 Oct 2026_

**Design model step 4c, typed emitter removed (PR #183, 31 Oct):** production check first (zero typed-v2 rows). Typed emitter modules, design-v2-* specs, withElementDesign removed; grouped and v1 paths unchanged.

**Where to find it:** No UI (backend only): design storage in src/lib/design/storedGrouped.ts (typed emitter removed)

<a id="sty-003"></a>
#### STY-003 · Known limits sweep: Fonts (PR #209, 1 Nov)

_Date: 1 Nov 2026_

**Known limits sweep: Fonts (PR #209, 1 Nov):** fixed: fonts installed before 1 Nov get a pinned jsDelivr version, the latest one (what a new install gets) (migration 20270302_100000_font_versions_pinned; if jsDelivr cannot be read during the migration that font keeps its old path until it is reinstalled); built-in faces gain Vietnamese (Cormorant Garamond, Playfair Display, Montserrat, Inter) and Greek (Inter), each pinned with its unicode range. Permanent: none.

**Where to find it:** /admin/theme-styles (Settings > General > Theming), font choices; built-in faces and pinned font versions (migration 20270302_100000_font_versions_pinned)

<a id="sty-004"></a>
#### STY-004 · closed Task 1 (reference file `reference/references.json` with shine, spark and engage-tem

_Date: 9 Nov 2026_

9 Nov 2026: closed Task 1 (reference file `reference/references.json` with shine, spark and engage-templates; Tailwind replaced by Shine CSS in the portal and on the site, vendored in `src/styles/shine`, generated utilities in `src/styles/engage-utilities.css`; Spark loader on the public site), closed Task 2 (Engage templates library listed by default on every install, switchable off, not removable), closed Task 3 (per currency rounding rules on top of the existing display currencies), closed Task 4 (price tiers: quantity breaks and customer type prices, bulk editor, table `eg_shop_price_tiers`), closed Task 5 (events and tickets audited, "Sold out" shown, gaps moved to open Task 1), closed Task 6 (promo badges on shop cards), closed Task 7 (nested categories for shop and blog, tree admin, archive pages and breadcrumbs). One PR for all seven.

**Where to find it:** /admin/references (Settings > Data and System > Reference sources); file reference/references.json

<a id="sty-005"></a>
#### STY-005 · Task 2 (part), 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Task 2 (part), 15 Nov 2026, PR pending: Spark effects picker in the Design panel and the Reference sources admin screen with the update check. Left: real Spark catalogue, update popup tie-in, Tailwind-era classes.

**Where to find it:** /admin/content/pages, open a page in Edit visually > Design panel > Spark effects picker; Reference sources at /admin/references

<a id="sty-006"></a>
#### STY-006 · 20b Size checks (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**20b Size checks (built 16 Nov 2026).** New `tests/int/size-checks.int.spec.ts` renders the real admin and Shine controls (buttons in every size, fields, selects, checkboxes in labels, tabs, list toolbar, text links) in headless Chromium at 375 and 1280 px and checks: every target at least 24 by 24 px, text at least 12 px, neighbouring targets not touching, the primary action at least 44 px high on a phone, and no sideways scrolling at 640 px (200 percent zoom on desktop) and 320 px (400 percent). Fixes: buttons at least 44 px high on narrow screens and touch devices, bare text buttons at least 24 px, checkbox and radio labels at least 24 px (all in `src/styles/a11y-states.css`).

**Where to find it:** No UI (backend only): tests/int/size-checks.int.spec.ts

<a id="sty-007"></a>
#### STY-007 · 20a State contrast tests (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**20a State contrast tests (built 16 Nov 2026).** New `tests/int/state-contrast.int.spec.ts` loads the real admin CSS and the public Shine CSS in headless Chromium and checks, in light and dark: text of buttons, quiet buttons, links and tabs (resting, hover, pressed, keyboard focus, selected) at 4.5:1; disabled buttons, links and fields at 3:1 (we require this although WCAG exempts disabled); keyboard focus rings at 3:1 against the surface; Shine field borders at 3:1. Colours are measured after `color-mix`, transparency and element opacity, and after Shine's colour transitions finish. It found and fixed: Shine disabled buttons and fields too faint (new `src/styles/a11y-states.css`, loaded after Shine in the admin and the public site, so the vendored Shine copy is unchanged), Shine field borders far too pale (1.2:1 now 3:1+), the keyboard ring being too faint on dark in the admin, and admin disabled links (opacity 0.5 to 0.62). Code: `tests/int/state-contrast.int.spec.ts`, `src/styles/a11y-states.css`, `admin.css`, `(frontend)/styles.css`, `custom.css`.

**Where to find it:** No UI (backend only): tests/int/state-contrast.int.spec.ts

<a id="sty-008"></a>
#### STY-008 · CSS modules removed (17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Effix renamed to Spark, Shine only (17 Nov 2026)_

CSS modules removed (17 Nov 2026): the four `*.module.css` files (admin roles and permissions, setup questionnaire and host, Getting started card) are now global classes named `eg-<area>-<name>` in `src/app/(engage)/module-styles.css`, imported by `admin.css` on top of Shine tokens. No CSS module is left, so Shine plus the admin layer is the only style system. Task 2 is closed (open task numbers were not renumbered, to avoid clashing with parallel work).

**Where to find it:** No UI (backend only): src/app/(engage)/module-styles.css (admin roles, setup questionnaire, Getting started card)

<a id="sty-009"></a>
#### STY-009 · Tailwind audit

_Date: 17 Nov 2026 · Original group: Effix renamed to Spark, Shine only (17 Nov 2026)_

Tailwind audit: no Tailwind package, config, `@apply` or `@tailwind` is left. Utility names such as `flex`, `gap-2`, `text-sm` come from Shine, and arbitrary values (`text-[12px]`) come from `src/styles/engage-utilities.css` generated by `scripts/generate-utilities.mjs`. Only the four CSS modules remain (open, Task 2).

**Where to find it:** No UI (backend only): src/styles/engage-utilities.css, generated by scripts/generate-utilities.mjs

<a id="sty-010"></a>
#### STY-010 · Repo renamed `asticore/effix` to `asticore/spark` (v0.4.0, `efx-` became `spark-`, `data-e

_Date: 17 Nov 2026 · Original group: Effix renamed to Spark, Shine only (17 Nov 2026)_

Repo renamed `asticore/effix` to `asticore/spark` (v0.4.0, `efx-` became `spark-`, `data-efx-*` became `data-spark-*`, `window.Effix` became `window.Spark`). Engage now pins Spark at commit `dc0d630` (`reference/references.json`, id `spark`), `SparkLoader` loads `spark.auto.min.js` from jsDelivr and falls back to the vendored copy in `public/vendor/spark/` (core, auto loader and every feature, 1.1 MB), and `EFFECT_CATALOG` was regenerated from Spark (119 effects, `spark-` classes). Pages saved with old `efx-` classes and `data-efx-*` attributes are rewritten in the browser before Spark starts, so nothing stored needs a migration. UI labels, settings description (13 languages), CSP labels, docs and the templates draft say Spark. Closed former Task 40a and the offline copy item of Task 2.

**Where to find it:** /admin/references (Reference sources, Spark pin); code: reference/references.json and SparkLoader in src

<a id="sty-011"></a>
#### STY-011 · Task 2 effects

_Date: 17 Nov 2026 · Original group: Tasks 1 to 3 leftovers (17 Nov 2026)_

Task 2 effects: `EFFECT_CATALOG` is generated from the Spark `.meta.js` files at the pinned commit (`scripts/gen-effect-catalog.cjs`, `src/features/effects/catalogData.ts`, 96 effects including all chart types and diagrams). Reference sources check feeds the update popup (`referencesOutdated` in `/api/admin-update-check`, `src/admin/ui/UpdateNotice.tsx`).

**Where to find it:** Visual editor > Design panel effects picker (list from src/features/effects/catalogData.ts); update check at /admin/references

<a id="sty-012"></a>
#### STY-012 · Shine and Spark from their releases, plus Front-end files (20 Nov 2026)

_Date: 20 Nov 2026_

**Shine and Spark from their releases, plus Front-end files (20 Nov 2026).** The public site and customer portal no longer bundle Shine: the layout writes a `<link>` to `asticore/shine@v1.0.0/dist/shine.min.css` on jsDelivr (a release tag, served unchanged) with a SHA-384 integrity hash, and a one-line script swaps to `public/vendor/shine/shine.min.css` if the CDN or the hash fails (`ShineLink` in `src/features/frontendAssets/FrontendAssetsHead.tsx`). `(frontend)/styles.css` only declares the Shine layer order now. Spark loads from `asticore/spark@v0.4.0` (the same commit as before) with the loader's integrity hash and the bundled fallback; its feature files are fetched by the loader without hashes. Tag, URL and hashes live in `src/features/frontendAssets/builtin.ts`; `tests/int/frontend-assets.int.spec.ts` checks the bundled copies against the hashes. The admin still bundles `src/styles/shine/shine.css` (static admin work owns that). New admin screen Settings > Speed > Front-end files (`/frontend-files`, admin only, `src/features/frontendAssets/`): add any https stylesheet or script by address with optional integrity, type, head or end of body, defer or async, scope (site, portal or both) and an on switch, with presets for Bootstrap 5.3.3, Bulma, Pico, Tailwind Play CDN, Font Awesome Free, jQuery and Alpine (hashes taken from the served files). Stored as one row in `eg_kv` (key `frontend-assets`, no migration, no baseline change), read from isolate memory for 30 s by the layout and the middleware; the admin never loads these files. The hosts are added to the default Content-Security-Policy for public pages (script-src, style-src, font-src); a hand-typed policy is left as written. Saves are audited as `frontend-assets.save`. English only for now (like the CSP builder).

**Where to find it:** /admin/frontend-files (Settings > Speed > Front-end files); public site loads Shine and Spark (src/features/frontendAssets/builtin.ts)

<a id="sty-013"></a>
#### STY-013 · Fonts never bundled; Open Sans is the default (20 Nov 2026)

_Date: 20 Nov 2026_

**Fonts never bundled; Open Sans is the default (20 Nov 2026).** All six `@fontsource/*` packages are gone from `package.json` and the lockfile; nothing imports a font package any more. The admin used to bundle Inter through `@fontsource/inter` CSS imports; `(engage)/layout.tsx` now writes the Open Sans `@font-face` rules (jsDelivr, pinned 5.3.0) and `--font-sans` is Open Sans. Open Sans is a new built-in face (latin, latin-ext, cyrillic, greek, vietnamese and hebrew subsets, 400 to 700) and the default heading and body font for new sites, the layouts' fallback, the settings import and the embed layout. The older built-in faces (Cormorant Garamond, Playfair Display, Cinzel, Jost, Montserrat, Inter) still render from the CDN for sites that already chose them, are marked `legacy`, and the heading and body pickers list them only while one is selected. More fonts are added in Theming > Fonts either from a CDN (Google Fonts or the Fontsource catalog via jsDelivr) or by uploading the font file, which is stored in Media on R2 (existing flow, `src/features/fonts/install.ts`). `tests/int/built-in-fonts.int.spec.ts` checks Open Sans and that no `@fontsource` package is a dependency. Existing sites keep their stored choice; the database default for a missing value on an old row is unchanged, so only rows with no stored font change look (to Open Sans).

**Where to find it:** /admin/theme-styles (Settings > General > Theming), font setting; Open Sans is the default and no font is bundled

<a id="sty-014"></a>
#### STY-014 · 40d third batch and data source (23 Nov 2026)

_Date: 23 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**40d third batch and data source (23 Nov 2026).** count-up on `spark-counter`, flip box on `spark-flip`, tooltip on Shine `data-tooltip`; the CSS counter-math and flip CSS removed. Chart and Table have a "Data from a saved table or chart" field: on the live page `DataViewBackedElement` loads the public Data view and passes its rows as CSV (`src/features/dataViews/csv.ts`). Test baselines in `merge-stats-notice.int.spec.ts` updated for the progress bar and counter markup.

**Where to find it:** Visual editor > Table or Chart element > "Data from a saved table or chart" field; saved tables at /admin/content/data-views

<a id="sty-015"></a>
#### STY-015 · 40d second batch (23 Nov 2026)

_Date: 23 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**40d second batch (23 Nov 2026).** Image carousel on Shine `carousel` + `spark-carousel` (new autoplay, fade, dots and arrows fields), the gallery and image lightbox on `spark-lightbox` (React lightbox dialog and its CSS and tests removed), text ticker on `spark-marquee`, pagination links styled by Shine `pagination`.

**Where to find it:** Visual editor > Gallery element (layout Carousel, larger view option), Text ticker and Pagination elements

<a id="sty-016"></a>
#### STY-016 · 40d (part)

_Date: 23 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**40d (part).** Countdown on `spark-countdown` (the React clock is gone), counter animate on `spark-counter`, progress bar on Shine `progress`, accordion and toggle on Shine `accordion` + `spark-collapse`, back to top on `spark-totop`. Duplicate CSS removed from `styles.css` and `wave36.css`.

**Where to find it:** Visual editor > Elements: Countdown, Counter, Progress bar; Accordion, Toggle and Back to top are hidden from the palette but still render

<a id="sty-017"></a>
#### STY-017 · 40c Tables

_Date: 23 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**40c Tables.** The Table element renders Shine `table`, `table-striped`, `table-hover`, `table-bordered`, `table-compact`, `table-stack` in `table-wrap`; sort, search, column filters, paging, sticky header, column visibility, row selection and CSV download switch on `spark-table` with `data-spark-*` options. Data: CSV or the old "|" lines, 500 rows and 24 columns. Old `be-el-table` CSS removed.

**Where to find it:** Visual editor > Elements > Table (sort, search, filters, paging, sticky header, CSV download options)

<a id="sty-018"></a>
#### STY-018 · 40b Charts

_Date: 23 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**40b Charts.** The Chart element lists every Spark chart, diagram and visualisation (21 charts, 8 diagrams, 10 viz types from `features/effects/catalogData.ts`); option fields are generated from each effect's meta (`src/lib/elements/sparkChartFields.ts`), stored as `o_<id>_<attr>` and rendered as `data-spark-*` (`components/blocks/elements/sparkData.ts`). Data is CSV (header row = series names); the 12 value limit is gone. Charts from the first version (`chartType` bar, line, pie, radar, polar and "label | value" rows) convert when read, so no migration. Series colours follow the theme unless set; a visually hidden table repeats the data. The editor canvas starts Spark for chart and table (`views/visualEditor/SparkCanvasPreview.tsx`). Old SVG renderer and its CSS removed. Tests: `tests/int/elements-wave48.int.spec.ts`, `tests/int/spark-elements.int.spec.ts`.

**Where to find it:** Visual editor > Elements > Chart (21 charts, 8 diagrams, 10 viz types); options in the element panel

<a id="cat-sec"></a>
### SEC: Security, sign-in and privacy

<a id="sec-001"></a>
#### SEC-001 · Password protection and authentication

_Date: 24 Oct 2026_

**Password protection and authentication:** built and merged, including PR #3 (products and events password protection, 24 Oct). Only the Task 6 checks remain.

**Where to find it:** /admin/content/pages (also posts, products, events): edit > Publish box > Visibility > Password protected; visitors get a password gate

<a id="sec-002"></a>
#### SEC-002 · Task 6 admin hardening and multi-domain (29 Oct)

_Date: 29 Oct 2026_

**Task 6 admin hardening and multi-domain (29 Oct):** #122 to #132: admin noindex; custom admin URL; Settings > Domains (host routing, per-domain language, canonical, hreflang, sitemap, robots, redirect to primary, allow-admin); content 'Available on domains'; users and roles 'Allowed domains' with the `domains` permission; per-domain overrides (#129); domain checklist (#130); per-domain page scoping (#131, #132). Open items: Task 6.

**Where to find it:** /admin/settings/domains (Domains): host routing, per-domain language, canonical, sitemap, allow-admin, domain checklist

<a id="sec-003"></a>
#### SEC-003 · Task 13 privacy requests (#160, #164)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 13 privacy requests (#160, #164):** `/account/privacy` download (JSON, no secrets), deletion request with password and email confirmation, admin approve then Erase, completion email, `privacy.*` audit entries. #164 follow-up. Open decisions: closed in Task 11 (PR #199).

**Where to find it:** /admin/privacy (Settings > Security > Privacy requests); customer side at /account/privacy

<a id="sec-004"></a>
#### SEC-004 · Password protection implementation notes folded in (1 Nov)

_Date: 1 Nov 2026_

**Password protection implementation notes folded in (1 Nov):** PBKDF2-SHA256 (100000 iterations, 16-byte salt) hashes in `eg_content_passwords`; 7-day HMAC unlock cookie `eg_unlock_<collection>_<id>`; gate in `src/features/visibility/gate.ts`; admin route `/api/admin-visibility-password`; public `/api/content-unlock` (400 ms delay, safe redirect); locked pages get generic metadata, noindex and no sitemap entry. Leftovers (not blocking): cache purge when a password is set or cleared; confirm protected pages bypass the public cache; role-based permission for managing passwords. Live checks: Task 6.

**Where to find it:** /admin/content/pages (also posts, products, events) > Publish box > Visibility > Password protected; gate in src/features/visibility/gate.ts

<a id="sec-005"></a>
#### SEC-005 · Task 17b password leftovers (PR #190, 1 Nov)

_Date: 1 Nov 2026_

**Task 17b password leftovers (PR #190, 1 Nov):** content-update roles (pages, posts, products, events) can set, clear and list passwords, with ownership still checked (`canManagePasswords`, `src/features/visibility/passwordAccess.ts`). Cache purge on set or clear was already in place (forced, tested). Protected content is never stored: unlock cookies bypass the edge and page caches, private responses are not stored; tests in `tests/int/password-permissions-cache.int.spec.ts`. Decided: a locked gate page has no protected content, so it may be shared. Better Auth is not in this repository; the accounts sign-in path already uses the same gate.

**Where to find it:** /admin/content/pages, posts, products, events > Publish box > Visibility > Password protected; shared passwords at /admin/security/password-groups

<a id="sec-006"></a>
#### SEC-006 · 18l leftovers (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**18l leftovers (built 16 Nov 2026).** Three sign-in places now: admin, customers (`/account/sign-in`) and members (`/account/member-sign-in`, same accounts, its own column in Authentication, Who can sign in with what; organisation-only pages send visitors there). The password can be blocked per customer or member place, never on the admin sign-in, and never when it would leave the place with no way in (refused when saving, and at run time the password form stays open if nothing else is left; `placeHasWayIn`, `passwordOpenFor`). The account forms now enforce the matrix on the server too (password, emailed link, emailed code, posted as a hidden `area` field); before this only the HTTP endpoints did. A blocked social provider now redirects to the sign-in with a sentence that names it ("Signing in with Google is not turned on here") instead of a bare 404; only known provider ids are echoed. Passkeys and the emailed link confirm page are still not place aware. Code: `authMatrix.ts`, `authMethods.ts`, `authMethodActions.ts`, `accounts/placeMethods.ts`, `socialLogin/http.ts`, `socialLogin/messages.ts`, `app/(frontend)/account/member-sign-in/page.tsx`, `tests/int/auth-matrix.int.spec.ts`.

**Where to find it:** /admin/authentication (Who can sign in with what matrix); public /account/sign-in and /account/member-sign-in

<a id="sec-007"></a>
#### SEC-007 · 18g Username sign-in (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**18g Username sign-in (built 16 Nov 2026).** Optional `username` on users (lowercase, unique, 3 to 32 of letters, digits, underscore and dash, reserved words such as admin refused, empty clears it), set from the account profile (shown only while the setting is on). Authentication overview has a Username switch (`usernameSignInEnabled` on Security settings, off by default); when on, the account sign-in field reads "Email or username" and an entry without an at sign is looked up by username and turned into that account's email before the normal login, so the lockout, the audit entries and the failure text are the same as email sign-in and a username cannot be probed (a taken name and an unusable name give the same message). Admin sign-in is unchanged (email). Migration `20270317_130000_username_sign_in` (column, unique index, setting column), baseline regenerated. All 13 dictionaries have the profile strings and the field label. Code: `src/features/accounts/username.ts`, `profile.ts` (`changeUsername`), `actions.ts` (`saveUsernameAction`, `signInActionImpl`), `components/AccountForms.tsx` (`UsernameForm`), `AuthForms.tsx`, `src/collections/Users.ts`, `tests/int/username-sign-in.int.spec.ts`.

**Where to find it:** /admin/authentication > Username switch (off by default); usernames set on the account profile at /account/profile

<a id="sec-008"></a>
#### SEC-008 · Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)

_Date: 16 Nov 2026_

**Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026).** SAML 2.0 per organisation next to OpenID Connect. Signature checking is done by xml-crypto; nothing is parsed by hand. Only the provider's pinned keys count, SHA-1 is refused, DOCTYPE is refused, content is read only from what the signature covers (stops signature wrapping), and issuer, audience, recipient, time window, InResponseTo and one-time assertion id are checked (`src/features/orgSso/saml.ts`, tests in `tests/int/org-sso-saml.int.spec.ts`). Routes: `/api/sso/saml/acs` (POST) and `/api/sso/saml/metadata/<connection id>`. Setup by pasting provider metadata XML or the fields, with certificate rotation (up to three keys). Lazy tables `eg_org_sso_saml`, `eg_saml_seen`. The sign-in page shows a Sign in with single sign-on link when a connection is ready. Organisation owners set up their own organisation's connection, domains and provisioning token on the organisation page (`/api/org-sso`, scoped by the session; shared logic in `adminActions.ts`).

**Where to find it:** /admin/sso (Single sign-on, one connection per organisation; SAML 2.0 option next to OpenID Connect)

<a id="sec-009"></a>
#### SEC-009 · 25c Device authorisation and 25d MCP endpoint (built 16 Nov 2026; part of AI agent access)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**25c Device authorisation and 25d MCP endpoint (built 16 Nov 2026; part of AI agent access).** Device authorisation (RFC 8628): a tool calls `POST /api/device/code` (`client_name`, `scope` read or write) and gets a device code, a short user code like BCDF-GHJK, an address and a polling interval; the admin opens Admin > AI agent access (the address carries the code), checks the code against the tool's name, confirms with their password and approves or denies; the tool polls `POST /api/device/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` and receives a normal agent token once (waiting, slow down, denied, expired and used answers follow the RFC). Approved tokens get the scope the tool asked for with the default caps (read only unless it asked to write). Codes last 10 minutes, at most 50 wait at once, only the hash of the device code is stored, the token is held encrypted and wiped at the first collection. MCP: `POST /api/mcp` speaks Model Context Protocol (JSON-RPC over HTTP) for an agent token only, with tools list_collections, find, get, create and update (no delete). Each call is checked like the same REST request (scopes, forbidden fields) and counted against the token's daily caps and the action log. Both are off unless AI agent access is switched on. The `eg_device_codes` table is created on first use, so no migration. Not built: OAuth proxy for preview deployments (Matt marked it later). Code: `src/features/agentAccess/` (`device.ts`, `deviceStore.ts`, `mint.ts`, `mcp.ts`), routes `src/app/(engage)/api/device/{code,token}`, `api/mcp`, `admin-agents` (approve and deny), `tests/int/agent-mcp-device.int.spec.ts`.

**Where to find it:** /admin/agent-access: approve a device code from a connected tool, confirmed with password

<a id="sec-010"></a>
#### SEC-010 · 25b SCIM provisioning (built 16 Nov 2026; part of Single sign-on)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**25b SCIM provisioning (built 16 Nov 2026; part of Single sign-on).** In Admin > Single sign-on, each connection has a Provisioning (SCIM) line: Turn on makes a token for the organisation and shows it once (Make a new token replaces it, Turn off stops it). Give the identity provider the SCIM address shown on the page (`/api/scim/v2`) and the token as a bearer token. Supports SCIM 2.0 Users (list with paging and `eq` filters on userName, externalId and id; create; get; replace; patch; delete), Groups mapped to the organisation's teams (list, create, get, patch members, delete) and the discovery endpoints (ServiceProviderConfig, ResourceTypes). A token reaches only its own organisation. A new user is a customer account (created if the address has none) with an organisation membership. Deactivating or deleting removes the membership, marks the person inactive and ends their sessions; the account is never deleted and an owner is never removed (409). Staff accounts are never created, changed or removed through it. Only organisation members can be put in a group. The tables (`eg_org_scim`, `eg_org_scim_users`) are created on first use, so no migration. Needs Single sign-on switched on in Site Settings. Code: `src/features/scim/` (core, handler, store), `src/app/(engage)/api/scim/v2/[[...path]]/route.ts`, `api/admin-sso`, `tests/int/scim.int.spec.ts`.

**Where to find it:** /admin/sso > each connection > Provisioning (SCIM) line: Turn on, Make a new token, Turn off

<a id="sec-011"></a>
#### SEC-011 · 25a Single sign-on per organisation, OpenID Connect (built 16 Nov 2026; also covers the OIDC part of 22b)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**25a Single sign-on per organisation, OpenID Connect (built 16 Nov 2026; also covers the OIDC part of 22b).** Switch Single sign-on on in Site Settings, under Features. Admin > Single sign-on (`/admin/sso`, admin only): one connection per organisation with the issuer address, client ID and secret (encrypted), the role new members get (member or admin, never owner), create-on-first-sign-in, and an On switch. Give the identity provider the redirect address shown on the page. Each email domain is claimed by adding a TXT record `_engage-sso.<domain>` = `engage-sso-verify=<token>`; Check now looks it up over DNS (Cloudflare DNS-over-HTTPS) and a domain can be verified for only one connection. People sign in at `/api/sso/start` with their work email (a small form when no email is given); an unknown domain gets the same neutral answer as a failed one. The provider flow reuses the generic OpenID Connect code from 23d (discovery, PKCE, nonce, signature and issuer checks). Rules in `service.ts`: the address must be verified and on a verified domain of the connection; a linked identity signs in as its owner; an existing customer with the address is linked; a staff account is never linked this way; otherwise a customer is created when creation is on; the person is made a member of the organisation without changing an existing role. Two-step still applies. Enforcement: with Require single sign-on ticked (needs a verified domain), password sign-in for addresses on the verified domains is refused with a clear message; staff (admin, editor, viewer) are never blocked. The Authentication overview has a Single sign-on row. Privacy erase removes the links. Code: `src/features/orgSso/` (core, store, service, http, runtime, enforce, `components/SsoPanel.tsx`), routes `src/app/(engage)/api/sso/{start,callback}` and `api/admin-sso`, enforcement in `handleLogin` in `src/localapi/rest.ts`, migration `20270316_435000_org_sso`, `tests/int/org-sso.int.spec.ts`.

**Where to find it:** /admin/settings/site > Features (Single sign-on switch), then /admin/sso

<a id="sec-012"></a>
#### SEC-012 · 23a1 Pending two-step token bound to the browser (built 16 Nov 2026; completes 23a1)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23a1 Pending two-step token bound to the browser (built 16 Nov 2026; completes 23a1).** The first step now sets an HttpOnly cookie `eg_pending_bind` holding a random value and puts only its SHA-256 in the pending token (`pb`). The code step and the emailed-code send refuse a token sent without the matching cookie, without counting toward the lockout and without spending a code. Every path that issues a pending token sets the cookie: password (account form and `/api/users/login`), emailed code and link, passkey, and social sign-in. Tokens issued before this change have no `pb` and are accepted until they expire (5 minutes). Code: `src/features/security/pendingBinding.ts`, `src/localapi/auth.ts` (`newPendingBinding`, `pendingBindingHolds`), `setPendingBindingCookie` in `src/features/accounts/session.ts`, tests in `tests/int/two-factor.int.spec.ts`.

**Where to find it:** No UI (backend only): src/features/security/pendingBinding.ts; tests/int/two-factor.int.spec.ts

<a id="sec-013"></a>
#### SEC-013 · 23h Account switcher (built 16 Nov 2026; shows on the customer account screens and the sign-in screens once so

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23h Account switcher (built 16 Nov 2026; shows on the customer account screens and the sign-in screens once someone is signed in or has another account parked).** The normal `engage-token` cookie stays the active account; the other accounts' session tokens sit in a second signed, HttpOnly, SameSite=Lax cookie `eg_other_sessions` (HMAC with `ENGAGE_SECRET`, at most 4 tokens, newest first, no duplicates). Switching re-validates the target through the engine's own session check (a revoked, expired or deleted account is dropped), parks the account being left, and writes the audit entry `login.success` (detail 'switched account'). Add another account parks the current token and opens sign-in. Logout removes only the active token and promotes none. Admin sessions are never parked or listed. The switcher shows email addresses only; the ids sent from the page are parked session ids, never account ids; the action is rate limited (`switch-account`). Four new portal strings in all thirteen languages. Code: `src/features/accounts/otherSessions.ts` (pure cookie), `switcher.ts`, `switcherActions.ts`, `components/AccountSwitcher.tsx`, wired into `AccountShell.tsx`, test `tests/int/account-switcher.int.spec.ts`.

**Where to find it:** Account switcher on public /account and /account/sign-in screens (shows once someone is signed in or another account is parked)

<a id="sec-014"></a>
#### SEC-014 · 25d AI agent access, first slice (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**25d AI agent access, first slice (built 16 Nov 2026).** Switch AI agent access on in Site Settings, under Features (needs API keys switched on in Security settings). Admin > AI agent access (`/admin/agent-access`, admin only): make a token for a connected AI tool by naming it, choosing read only or read and write (never delete), picking the content it may touch (none ticked means all), a daily cap on writes and reads (defaults 200 and 5000, 0 means no cap) and an expiry; the admin confirms with their password or a two-step code and the token (`egk_...`, an ordinary API key owned by the admin) is shown once. The tool sends it as `Authorization: Bearer <token>`. Every request the token makes is checked against its scopes as before, then against its caps (over a cap returns 429 and is logged as capped, not counted), and written to an action log (time, method, path, result) shown on the page, filterable per agent, with a purge of rows older than 90 days. Admins can change caps or revoke at once (revokes the key too). A revoked grant, or a grant while the feature is off, is refused (fails closed). The Authentication overview has an AI agent access row (Off, Needs setup, On with the active token count). Privacy erase removes the owner's grants and logs. Code: `src/features/agentAccess/` (core, store, gate, `components/AgentAccessPanel.tsx`), `src/app/(engage)/api/admin-agents/route.ts`, gate call at the end of `gateApiKeyRequest` in `src/localapi/rest.ts`, migration `20270316_425000_agent_access`, `tests/int/agent-access.int.spec.ts`.

**Where to find it:** /admin/settings/site > Features (AI agent access switch; API keys on in /admin/settings/security), then /admin/agent-access

<a id="sec-015"></a>
#### SEC-015 · 23k OpenAPI for auth endpoints (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23k OpenAPI for auth endpoints (built 16 Nov 2026).** An OpenAPI 3.1 document for the sign-in side: password sign-in, two-step (code and email code), logout, refresh, forgot and reset password, unlock, `me`; emailed link and code; passkeys (options, register, login, list, rename, remove); social sign-in (providers list, start, callback, pending, One Tap); API key exchange, one-time tokens and the JWKS. Three security schemes (session cookie, API key, access token). Download `JSON` or `YAML` from the API builder page (link under the developer guide downloads) at `/api/admin-api-builder-docs?format=auth-openapi.json` or `.yaml` (admins and the `api` read permission), or with the public docs token like the other formats. The base URL is the request's own origin and no key or secret is written in. A test fails when a documented path has no route file or the documented method is not exported, when a user route is not one the REST dispatcher serves, when an operation id repeats, or a reference does not resolve. Browser-only flows (passkeys, social, One Tap) are described so a client can see what each endpoint expects; English only. Code: `src/features/apiBuilder/authOpenApi.ts`, `guideResponse.ts`, `components/ApiBuilderPanel.tsx`, `tests/int/auth-openapi.int.spec.ts`.

**Where to find it:** /admin/api-builder (developer guide, download JSON or YAML); also /api/admin-api-builder-docs?format=auth-openapi.json

<a id="sec-016"></a>
#### SEC-016 · 23a2 Google connection reuses the sign-in client (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23a2 Google connection reuses the sign-in client (built 16 Nov 2026).** When the Google connection has no client ID and secret of its own, it uses the Google sign-in client from Security. The connection's redirect address must be added to that Google app. Code: `resolveGoogleClient` in `src/features/google/auth.ts`, `tests/int/google-client-fallback.int.spec.ts`. No migration.

**Where to find it:** /admin/google-connection (Settings > General): leave client ID and secret empty to reuse the Security sign-in client

<a id="sec-017"></a>
#### SEC-017 · 23a1 Pending two-step token single use (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23a1 Pending two-step token single use (built 16 Nov 2026, part).** The token after the password step now carries a `jti`; a successful second step records it (in `eg_kv` as `p2fa:<jti>`, swept once expired) and a repeat is refused like a wrong code. Fails open on a database error because the lockout still guards the code. Not done: browser binding (see leftovers). Code: `src/localapi/auth.ts` (`PendingTokenOps`, `loginWithSecondFactor`), `src/features/security/pendingTokenStore.ts`, `src/localapi/engine.ts`, test in `tests/int/two-factor.int.spec.ts`. No migration.

**Where to find it:** No UI (backend only): src/features/security/pendingTokenStore.ts; tests/int/two-factor.int.spec.ts

<a id="sec-018"></a>
#### SEC-018 · 23g Guest accounts and 28a Account cart with merge on sign-in (built 16 Nov 2026; live check in Live checks)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23g Guest accounts and 28a Account cart with merge on sign-in (built 16 Nov 2026; live check in Live checks).** A signed-out visitor's cart pair (id and secret, still kept in the browser) is also remembered in an HttpOnly cookie `eg_guest_cart` (30 days, set by `POST /api/shop-cart/guest` after the pair is checked against the cart). On every page load the shop client asks `GET /api/shop-cart/session`: signed out gives `signedIn: false` and the guest cart carries on; signed in gives the account's one persistent cart (found or created, with its own secret, newest unpurchased cart of that customer) after folding the guest cart into it (same product, variation, price and add-ons add quantities; gift cards and name-your-price lines stay their own lines), then deleting the guest cart and clearing the cookie. Because every sign-in and sign-up path ends in a page load, this covers password, code, magic link, social and passkey sign-in and registration with no change to each path. The cart rules re-check stock and limits on every save; if the whole merge is refused the lines go in one at a time and refused lines are counted, shown as a notice on the cart page. The browser marks an account cart so signing out never keeps showing it. Guest carts untouched for 30 days (no customer, not purchased) are deleted by the hourly Data clean-up job. Payment and cart mutations use the account cart's secret exactly as for a guest cart. The older `/merge` endpoint is unchanged and unused. Code: `src/features/ecommerce/lib/guestCart.ts`, `src/features/ecommerce/server/accountCart.ts`, `src/app/(engage)/api/shop-cart/{session,guest}/route.ts`, `src/engine/commerce/react.tsx`, `src/features/cron/jobs.ts`. Tests: `tests/int/guest-cart.int.spec.ts`. Not built: the cookie holds only the cart pair, not a general anonymous session id (nothing else needs one yet); the notice text is English only.

**Where to find it:** Public /cart and /account/sign-in: guest cart kept in a cookie and merged on sign-in (no admin setting)

<a id="sec-019"></a>
#### SEC-019 · 23g Passkey as a second sign-in step (built 16 Nov 2026; live check in Live checks)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23g Passkey as a second sign-in step (built 16 Nov 2026; live check in Live checks).** The second-step screen (customer sign-in and admin sign-in) shows "Use a passkey instead" when the account named by the pending token has a passkey and passkeys are allowed for that area in the Authentication matrix. `POST /api/passkeys/second-options` takes the pending token, reads the account from it (never from the body), and returns a challenge limited to that account's passkeys (`allowCredentials`); the challenge is a new `second` kind bound to that user id. `POST /api/passkeys/second-verify` runs the same checks as passkey sign-in (shared `checkAssertion` in `passkeys/core.ts`: origin, rpId, known credential, user handle, role and lock, user verification, signature, counter) plus a refusal when the credential belongs to another account or the challenge was issued to another account, then finishes through `loginWithSecondFactor` with `method: 'passkey'`. That method takes no code and is accepted only when the server passes `passkeyVerifiedUserId` equal to the pending token's user (an argument the REST route never sets, so the public second-step endpoint cannot use it); a refused passkey answer calls the same function without it, which counts toward the account lockout like a wrong code. The pending token is marked used on success (23a1), trusted-device cookie and landing redirect work as for a code. Audit: `passkey.login` "second step", `passkey.refused` "second step: ...". New text key `portal.auth.usePasskeyInstead` in all thirteen languages. Code: `src/features/passkeys/core.ts` (`secondStepOptions`, `verifySecondStep`), `src/features/accounts/passkeysHttp.ts`, `src/localapi/auth.ts` (`pendingTokenUser`), `SecondFactorChoice.tsx`, `src/features/passkeys/client.ts`. Tests: `tests/int/passkeys.int.spec.ts` (second sign-in step: only the account's passkeys offered, own passkey accepted, other account's passkey refused, other account's challenge refused, bad signature, locked account), `tests/int/two-factor.int.spec.ts` (passkey as the second step: single use token, refused without or with another user id, lockout, forged token).

**Where to find it:** Public /account/sign-in second step ("Use a passkey instead"); allowed per area in /admin/authentication

<a id="sec-020"></a>
#### SEC-020 · 23d More social providers, generic OpenID Connect and Google One Tap (built 16 Nov 2026; every provider is off

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23d More social providers, generic OpenID Connect and Google One Tap (built 16 Nov 2026; every provider is off until its credentials are saved and it is switched on).** X (OAuth 2.0 with PKCE, Basic client auth, email only when X returns `confirmed_email`), LinkedIn (Sign In with LinkedIn using OpenID Connect, ID token checked against LinkedIn's keys), TikTok (Login Kit v2, `client_key`, profile id only, never an email, so it signs in only after being connected from a profile) and Slack (Sign in with Slack, OpenID Connect) each have a setup guide with console link, scopes and the exact redirect URL, an encrypted client secret, a button with an icon, and a Test sign-in button. A free-form OAuth 2.0 / OpenID Connect provider takes a discovery URL (or authorize, token and optional user info URLs), client ID and secret, scopes, button text, claim names for subject, email and verified, and a Trust the email switch; ID tokens must be RS256 and are checked for signature, issuer, audience and nonce, with a user info fallback when no ID token is returned. Every address must be https on a public host name (no http, IP addresses, localhost, internal names, credentials or ports), checked before any call; the discovery document is cached ten minutes. Google One Tap (Settings > Security > More sign-in providers, needs Google sign-in on and complete) shows Google's prompt on the member sign-in page; the credential is posted to `/api/social/one-tap` with a server-issued nonce and state in the signed state cookie, same-origin only, and goes through exactly the same account rules as the Google button (no staff accounts, no unverified emails, two-step still required). All providers use the existing start, callback, test, linking, unlinking, rate limit, audit and per-place method blocking (Who can sign in with what) paths, and appear on the Authentication overview with switches. Settings for the five new providers and One Tap live in table `eg_social_providers` (created on first use, secret encrypted, no migration, no column added to Security settings, whose table is full). Code: `src/features/socialLogin/` (`providers.ts`, `endpoints.ts`, `flow.ts`, `extraStore.ts`, `extraValidate.ts`, `extraActions.ts`, `admin/ExtraProvidersForm.tsx`, `components/GoogleOneTap.tsx`, `components/ProviderIcon.tsx`), `src/admin/views/SignInProvidersView.tsx`, `src/app/(engage)/api/social/one-tap/route.ts`, `tests/int/social-login-extra.int.spec.ts`. Admin text is English only. Not done: ES256 ID tokens for the free-form provider; the buttons use simple glyphs, not each brand's official artwork.

**Where to find it:** /admin/security/sign-in-providers (X, LinkedIn, TikTok, Slack, generic OpenID Connect, Google One Tap); connected accounts at /admin/security/social

<a id="sec-021"></a>
#### SEC-021 · 23i Access tokens, signing keys and one-time tokens (built 16 Nov 2026; needs API keys switched on in Settings

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23i Access tokens, signing keys and one-time tokens (built 16 Nov 2026; needs API keys switched on in Settings > Security).** `POST /api/auth/token` trades an API key (`Authorization: Bearer egk_...`) for a signed ES256 access token (RFC 9068 shape: header `at+jwt`, claims iss, sub, aud `engage-api`, iat, exp, jti, scope, key). Optional body `scope` (space separated, narrows the key, never widens it) and `expires_in` (default 900 s, 60 to 3600). Send the token as `Authorization: Bearer <token>` anywhere an API key works: it counts as its key, so every check still runs on each request (key revoked or expired, owner locked, category limits) and revoking a key ends its tokens at once. A token cannot be exchanged for another token. Signing keys rotate by themselves every 30 days (lazy, on the next signing); a retired key stays published 25 hours so live tokens still verify, then is deleted. `/.well-known/jwks.json` publishes the public keys (empty while API keys are off); private keys are stored encrypted with the site secret. Admin: API builder page, Access tokens and signing keys (list, Rotate now). One-time tokens: `POST /api/auth/one-time-token` (purpose, optional payload up to 1 KB, `expires_in` up to 3600, default 300) returns an `egot_` token once; `POST /api/auth/one-time-token/verify` uses it up and answers `{valid, purpose, subject, payload}` (404 when unknown, wrong purpose, used or expired). Both need a staff-owned key; API purposes are stored as `app:<purpose>` so they never collide with a site purpose; only a hash is stored; claiming is one atomic update, so two simultaneous uses cannot both win. New audit actions `api-token.issued`, `one-time-token.issued`, `one-time-token.used`, `signing-key.rotated`. The tables `eg_signing_keys` and `eg_one_time_tokens` are created the first time they are used (no migration). Admin panel text is English only. Code: `src/features/apiKeys/tokens/`, `src/features/apiKeys/core.ts` (`isAccessTokenShape`), `service.ts` (`verifyAccessToken` dep), `src/localapi/engine.ts`, `src/app/(engage)/api/auth/`, `src/app/.well-known/jwks.json/route.ts`, `tests/int/api-tokens.int.spec.ts`.

**Where to find it:** /admin/security/api-keys (needs API keys on in /admin/settings/security); token endpoint /api/auth/token

<a id="sec-022"></a>
#### SEC-022 · 23h Session location and self-service delete (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23h Session location and self-service delete (built 16 Nov 2026, part).** A new session's device label now ends with "(near Germany)" style wording from the Cloudflare country header (nothing for a missing, unknown or Tor code), shown as approximate in the sessions list. Password, emailed link or code, and passkey sign-ins record it. No migration (added to the label). Self-service delete already existed: the customer asks on `/account/privacy`, confirms by email, an admin reviews, then `src/features/privacy/erase.ts` runs. English only. Code: `withApproxPlace` in `src/features/security/userSessions.ts`, `src/localapi/rest.ts` (`sessionClient`), `src/features/accounts/session.ts`, `passkeysWiring.ts`, `passwordlessWiring.ts`, `tests/int/session-place.int.spec.ts`.

**Where to find it:** /admin/security/sessions (Signed-in devices, approximate location); customer delete request at /account/privacy

<a id="sec-023"></a>
#### SEC-023 · 23l Who can sign in with what (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23l Who can sign in with what (built 16 Nov 2026, part).** The Authentication screen has a matrix: for the admin sign-in (staff) and the account sign-in (members and customers) the owner allows or blocks magic link, email code, passkeys and each social provider. Everything is allowed until blocked. A blocked method disappears from that form and the server refuses it (social start returns 404, emailed link and code and passkey endpoints return 403; passkeys are refused only when blocked for both places because the endpoints do not know the place). Password cannot be blocked so a site can never lock itself out. Two-step after a social sign-in already existed. Stored as one JSON row in `eg_kv`, no migration. English only. Code: `src/features/security/authMatrix.ts`, `authMethodActions.ts` (`setMethodAreaAction`), `src/admin/views/AuthMethodToggle.tsx` (`AreaToggle`), `AuthenticationView.tsx`, `socialLogin/settings.ts` (`blocked`), `accounts/passwordlessWiring.ts`, `passwordlessHttp.ts`, `passkeysHttp.ts`, `tests/int/auth-matrix.int.spec.ts`.

**Task 43 Forms: forward submissions and get form data out (built 16 Nov 2026).** 43a: notification rules in the form editor now take cc (visible), bcc (hidden, one message per address) and a reply-to-the-visitor switch, next to the existing Only when condition for routing by an answer (`sendSubmissionEmails` in `src/features/forms/notify.ts`). A Forward button on each entry in the form's Submissions tab (`ForwardEntry.tsx`, `/api/admin-form-submission-forward`) emails one entry to typed addresses with a note and optional cc and bcc via the connected email provider (`forwardSubmission`); files are sent as signed links that expire after 7 days (`fileLinks.ts`, public `/api/form-file-link`, needs ENGAGE_SECRET); the forward is appended to the entry's notification status (who, when, to) and written to the activity log as an export; with no email provider the screen says none is connected. Bcc and cc are done as separate or extra recipients, not provider headers, so no provider adapter changed. 43b: `GET /api/forms/{id}` (field names, labels, types, options) and `GET /api/forms/{id}/submissions` (page, limit up to 200, since, until, status, format=csv; oldest first; spam, IP, browser, notes and assignee left out; files as signed links) with an API key holding forms:read and form-submissions:read, the key owner also needing read access to all entries, per-key rate limit (`dataApi.ts`). Webhooks gained: all answers or chosen fields, include meta (page address, consent record, status), an optional shared secret header beside the HMAC signature, files as signed links instead of storage keys, a Send test button (event `form.test`), a delivery log per form with status code and error, Re-send of one delivery (`/api/admin-form-webhooks`, `FormWebhookTools.tsx`); retries with backoff already existed. Recipes for Zapier, Make and the API are in `docs/form-data-recipes.md`, also served by the Recipes link in the delivery log. Tests: `tests/int/form-forwarding-data-api.int.spec.ts`. Leftovers: the privacy-erase and field-level redaction rules do not exist for entries yet, so the API returns what is stored; a separate per-field routing table beyond rules with one condition each is not built. Live check: Task 14 form forwarding and data API.

**Where to find it:** /admin/authentication (matrix: magic link, email code, passkeys, each social provider, for admin and account sign-in)

<a id="sec-024"></a>
#### SEC-024 · 29a Folders as records (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**29a Folders as records (built 16 Nov 2026).** A folder is now a record in `eg_media_folders` (made empty with New folder, or filled in the first time the tree is opened for folders that already hold files, parents included). Files keep their folder as a text path, so file addresses and queries are unchanged. Each folder has colour (dot in the tree), description (shown under the tree), who may use it (roles and companies from Task 10, nearest limited folder decides, admins always pass, only admins change it), default alt text start and default licence for new files (nearest folder that sets them wins), and visibility (the 29f private rule, shared with Private folders). Rename, move and delete change the paths on files and on the records in one action; a record already at the new path wins. Limited folders and their files are hidden from the tree, the gallery and the folder list for people outside the rule, and uploads or moves into them are refused with 403. Left out: a folder optimisation preset (the optimiser settings are site wide and the upload engine takes no per file override), and the rule only guards the admin side (staff); public file addresses stay governed by visibility (29f) and company gates. Code: `src/features/media/folderRecords.ts`, `folderRecordsStore.ts`, `src/views/media/MediaFolderSettings.tsx`, `MediaFolderTree.tsx`, `/api/admin-media-folders` (create, update, rename, move, delete), `admin-media-upload`, `admin-media-move`, migration `20270316_420000_media_folder_records` (adds `allowed_companies`), `tests/int/media-folder-records.int.spec.ts`.

**Where to find it:** /admin/asset-manager (folder tree: colour, description, access, alt text, licence); switch on under Site settings > Features

<a id="sec-025"></a>
#### SEC-025 · 23a Verify auth behaviours (checked 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23a Verify auth behaviours (checked 16 Nov 2026).** Confirmed in code: admin reset of a user's 2FA (`twoFactorActions.ts`, audit `two-factor.reset`); revoke one session (`userSessionService.ts`, audit `session.revoked`); wrong second-step codes count toward the account lockout; magic link and email code entry cap attempts (`MAX_CODE_ATTEMPTS`); exactly 10 distinct backup codes, stored only as hashes (test); Users list uses the generic list view with filters and bulk selection. Delete own account is the privacy erase request flow today (self-service is 23h). Gaps became 23a1 and 23a2. Tests: `tests/int/auth-verify-23a.int.spec.ts`.

**Where to find it:** No UI (backend only): tests/int/auth-verify-23a.int.spec.ts; admin 2FA reset is on the user screen at /admin/other/users

<a id="sec-026"></a>
#### SEC-026 · 23c new sign-ups and active sessions (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23c new sign-ups and active sessions (built 16 Nov 2026).** The dashboard sign-in section shows new accounts in the last 30 days and sessions not yet expired. Code: `loadAccountCounts` in `src/features/security/authStats.ts`, `src/views/dashboard/Dashboard.tsx`, `tests/int/auth-account-counts.int.spec.ts`. No migration.

**Where to find it:** /admin (dashboard), sign-in section: new accounts in the last 30 days and active sessions

<a id="sec-027"></a>
#### SEC-027 · 23b switches on the Authentication overview (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23b switches on the Authentication overview (built 16 Nov 2026).** Magic link, email code, passkeys, email verification and each social provider (once its credentials are complete) now have an On/Off switch on `/authentication`. Admin only, refused while impersonating, written to the audit log as a settings update. A method that is off disappears from the sign-in form and is refused by the server as before. English only. Code: `src/features/security/authMethods.ts` (`togglePatch`), `authMethodActions.ts`, `src/admin/views/AuthMethodToggle.tsx`, `tests/int/auth-methods.int.spec.ts`. No migration.

**Where to find it:** /admin/authentication: On/Off switches for magic link, email code, passkeys, email verification and each social provider

<a id="sec-028"></a>
#### SEC-028 · 24h Disposable email blocking (built 16 Nov 2026, member sign-up)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**24h Disposable email blocking (built 16 Nov 2026, member sign-up).** Members settings, Registration: switch on Refuse sign-ups from throwaway email services (off by default). A built-in list of about 65 well-known services (including subdomains) is refused with a clear message at member sign-up. Typo suggestions for common domains exist as a helper (`suggestEmail`) but are not shown anywhere yet. Code: `src/features/security/emailCheck.ts`, `src/features/members/signup.ts`, `MemberSettings.ts`, migration `20270316_310000_disposable_email`, `tests/int/email-check.int.spec.ts`.

**Where to find it:** /admin/settings/commerce > Member settings > Registration: Refuse sign-ups from throwaway email services

<a id="sec-029"></a>
#### SEC-029 · 24a Challenge on sign-in, register and forgot password (built 16 Nov 2026, member screens)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**24a Challenge on sign-in, register and forgot password (built 16 Nov 2026, member screens).** Form settings, Spam protection: switch on the challenge (Turnstile or reCAPTCHA, with its keys) and Also require the challenge on sign-in, create account and forgot password. The widget appears inside those three forms, the token is checked on the server, a missing or wrong token is refused with a clear message, and it fails open when the keys are missing or the provider cannot be reached so a site is never locked out. Always on when enabled; modes after N failures, admin sign-in, magic link and email code request, reset and code entry are left. English only. Code: `src/features/security/{authCaptcha.ts,AuthCaptcha.tsx,AuthCaptchaField.tsx}`, `accounts/actions.ts`, `AuthForms.tsx`, `AuthScreens.tsx`, setting `spam.protectSignIn`, migration `20270316_360000_auth_captcha`, `tests/int/auth-captcha.int.spec.ts`. Not run against live Cloudflare or Google keys.

**Where to find it:** /admin/settings/content > Form settings > Spam protection: challenge on member sign-in, create account and forgot password

<a id="sec-030"></a>
#### SEC-030 · 18e leftovers built (16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**18e leftovers built (16 Nov 2026).** (1) The user record now keeps `lastLoginMethod` and `lastLoginAt` (password, magic-link, email-code, passkey, or a social provider id), written when a session is minted, carried through the two-step code; impersonation is not recorded. Migration `20270317_130000_last_login_method` adds two nullable columns on `eg_users`. (2) The Last used badge now also shows for magic link, email code and passkey buttons, and on the admin sign-in screen. (3) The account-linking rule is written above `resolveSignIn` in `src/features/socialLogin/service.ts` (link only when the provider email and the account email are both verified and match; staff never auto-link; a signed-in person may link; unlink never removes the last way in). (4) Unlinking the last provider is now also allowed when the account has a passkey or an emailed sign-in is switched on (`otherMethods.ts`). Tests: `auth-slice-3`, `last-used-method`, `social-login` specs. The last login method is stored but not yet shown on the admin user screen.

**Where to find it:** Public /account/member-sign-in and admin sign-in screen: Last used badge; the last method is not shown on the admin user screen

<a id="sec-031"></a>
#### SEC-031 · 23e Last used badge (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23e Last used badge (built 16 Nov 2026).** The member sign-in screen remembers, in a plain cookie `eg_last_method` (one method name, one year), whether this browser last used the password form or a social provider, and shows a small "Last used" badge beside it next time (English only; blocked cookies mean no badge). Code: `src/features/accounts/lastUsed.ts`, `components/LastUsedBadge.tsx`, `AuthScreens.tsx`, `tests/int/last-used-method.int.spec.ts`. No migration.

**Where to find it:** Public /account/member-sign-in: Last used badge beside the method last used in this browser

<a id="sec-032"></a>
#### SEC-032 · 23c Dashboard sign-in cards (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23c Dashboard sign-in cards (built 16 Nov 2026, part).** On the admin dashboard, admins see Failed sign-ins (a 30 day bar chart) and Sign-in methods used (password, social, email link or code, passkey) read from the audit log, shown only while Security is on. English only. Code: `src/features/security/authStats.ts`, `src/views/dashboard/Dashboard.tsx`, `tests/int/auth-stats.int.spec.ts`. No migration.

**Where to find it:** /admin (dashboard): Failed sign-ins (30 day chart) and Sign-in methods used cards

<a id="sec-033"></a>
#### SEC-033 · 23b Authentication overview (built 16 Nov 2026, read only)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**23b Authentication overview (built 16 Nov 2026, read only).** Settings > Security has an Authentication overview link (`/authentication`, admin only): one table with every method (password, email verification, magic link, email code, passkeys, two-step, and each social provider), its status (On, Off, Needs setup with the missing credentials named) and an Open link to the screen that owns the setting. Nothing was removed. English only. Code: `src/features/security/authMethods.ts`, `src/admin/views/AuthenticationView.tsx`, `adminViewRegistry.ts`, `settingsPages.ts`, `tests/int/auth-methods.int.spec.ts`. No migration.

**Where to find it:** /admin/authentication (read only; linked from Settings > Security as Authentication overview)

<a id="sec-034"></a>
#### SEC-034 · Bot challenge on the PayPal buy step (12d leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Bot challenge on the PayPal buy step (12d leftover, built 17 Nov 2026).** The card payment (`/payments/stripe/initiate`) and bank transfer, cheque and cash orders already asked the Turnstile or reCAPTCHA challenge (Task 19a places `cardCheckout` and `offlineOrder`); PayPal did not. `/api/shop-paypal-create` now checks the same `cardCheckout` place (renamed Checkout: card and PayPal payment, mode kept) before reading the cart, so one setting covers both. `PayPalButton` sends the challenge token from the checkout page's widget and the widget renews after each try. Tests in `tests/int/paypal-create-captcha.int.spec.ts`.

**Where to find it:** /admin/settings/content > Form settings > Spam protection, Checkout: card payment and offline orders; PayPal buy step uses the same place

<a id="sec-035"></a>
#### SEC-035 · Customer and member sign-in URL (19l, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Customer and member sign-in URL (19l, built 17 Nov 2026).** Settings > Security has Customer sign-in URL, and Members settings has Member sign-in URL (one segment, lowercase letters, digits and hyphens, 3 to 40 characters; empty keeps `/account/sign-in` and `/account/member-sign-in`). The routes stay at the default paths; the middleware serves a custom path by rewrite (including `/link` for emailed links), redirects a page view of the old path to the new one (form posts and server actions on the old path are still served), sends handler redirects straight to the new path, and marks the custom path noindex. Refused: the admin URL or anything under it, words the site uses (including `account` and `admin`), and the same path for both places. A bad saved value is skipped, never lost. Recovery: `ENGAGE_CUSTOMER_SIGN_IN_PATH` and `ENGAGE_MEMBER_SIGN_IN_PATH` override the fields. Code: `src/features/security/signInPath.ts`, `signInPathValidate.ts`, `src/middleware.ts`, `src/globals/SecuritySettings.ts`, migration `20270317_280000_sign_in_paths` (the member path is a column on `eg_member_settings` because `eg_security_settings` is at the 100 column limit), `tests/int/sign-in-custom-path.int.spec.ts`. Saving a custom path is refused when a top-level page already uses that slug. A locale-prefixed old path (`/fr/account/sign-in`) is not redirected on purpose: the account area never takes a language prefix (see `isPortalPath`), so those addresses were never valid. Not covered: creating a page with the slug of a custom sign-in path afterwards (the sign-in wins).

**Where to find it:** /admin/settings/security (Customer sign-in URL) and /admin/settings/commerce > Member settings (Member sign-in URL)

<a id="sec-036"></a>
#### SEC-036 · Audit drain filter and redaction (19i, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Audit drain filter and redaction (19i, built 17 Nov 2026).** Each webhook subscribed to Activity log entry can now list the actions it wants (one per line; a name ending in a dot such as `user.` matches the whole family; empty means all) and tick fields to leave out of the payload (`actorEmail`, `ip`, `documentId`, `detail`; they are sent as empty strings so the shape stays the same). Settings are in a new JSON column `audit_options` on `eg_webhooks` (migration `20270317_270000_webhook_audit_options`, baseline regenerated), included in webhook export and import. The filter runs when the event is queued (`queueEvent`), redaction when the payload is built (`queueFor`), so a filtered-out entry never creates a log row. Code: `src/features/webhooks/core.ts` (`auditActionMatches`, `redactAuditData`, `parseAuditOptions`), `delivery.ts`, `store.ts`, editor in `components/WebhooksPanel.tsx`; tests in `tests/int/webhooks-core.int.spec.ts` and `webhooks-delivery.int.spec.ts`. Live check in the live-check section.

**Where to find it:** /admin/webhooks: a webhook subscribed to Activity log entry, with the actions it wants and redaction

<a id="sec-037"></a>
#### SEC-037 · Customer and member sign-in URL (19l, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Customer and member sign-in URL (19l, built 17 Nov 2026).** Settings > Security has Customer sign-in URL, and Members settings has Member sign-in URL (one segment, lowercase letters, digits and hyphens, 3 to 40 characters; empty keeps `/account/sign-in` and `/account/member-sign-in`). The routes stay at the default paths; the middleware serves a custom path by rewrite (including `/link` for emailed links), redirects a page view of the old path to the new one (form posts and server actions on the old path are still served), sends handler redirects straight to the new path, and marks the custom path noindex. Refused: the admin URL or anything under it, words the site uses (including `account` and `admin`), and the same path for both places. A bad saved value is skipped, never lost. Recovery: `ENGAGE_CUSTOMER_SIGN_IN_PATH` and `ENGAGE_MEMBER_SIGN_IN_PATH` override the fields. Code: `src/features/security/signInPath.ts`, `signInPathValidate.ts`, `src/middleware.ts`, `src/globals/SecuritySettings.ts`, migration `20270317_280000_sign_in_paths` (the member path is a column on `eg_member_settings` because `eg_security_settings` is at the 100 column limit), `tests/int/sign-in-custom-path.int.spec.ts`. Not done: locale-prefixed old paths (`/fr/account/sign-in`) do not redirect; a published page with the same slug as the custom path is hidden behind the sign-in.

**Where to find it:** /admin/settings/security (Customer sign-in URL) and /admin/settings/commerce > Member settings (Member sign-in URL)

<a id="sec-038"></a>
#### SEC-038 · Guided CSP builder (19j, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Guided CSP builder (19j, built 17 Nov 2026).** Settings > Security > Content-Security-Policy builder (`/admin/security/csp`, admin only). Mode off, report-only or enforce; per directive (default, script, style, image, font, connect, media, frame, worker, object, base, form action, frame ancestors) pick keywords, known hosts (Google Fonts, jsDelivr, GTM, Clarity, Meta Pixel, Stripe, Turnstile, reCAPTCHA, cdnjs, unpkg, chat widgets) or type a host, each added to the default policy or replacing it for that directive. Live preview, validation with the same rules as the free-text policy, and risk warnings. Report-only sends `Content-Security-Policy-Report-Only` while the normal policy keeps enforcing; enforce replaces the enforced policy. Both add `report-uri /api/csp-report`, a public endpoint (only while the builder is on, 16 KB body cap, rate limited, 300 distinct entries, browser-extension noise dropped) that fills the Violations table; Allow adds the reported host to the right directive and saves. The admin, the embed frame document and the shareable data page never get the builder's policy. The free-text policy stays and is merged first. Code: `src/features/security/cspBuilder.ts` (pure), `cspBuilderStore.ts`, `headers.ts` (third argument), `requestGuard.ts` (30 second cached read), `api/admin-csp`, `api/csp-report`, `components/CspBuilderPanel.tsx`, migration `20270318_100000_csp_builder` (`eg_csp_builder`, `eg_csp_reports`), `tests/int/csp-builder.int.spec.ts`. Live check is in Live checks.

**Where to find it:** /admin/security/csp (Content-Security-Policy builder: off, report-only or enforce, per directive)

<a id="sec-039"></a>
#### SEC-039 · Customer and member sign-in URL (19l, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Customer and member sign-in URL (19l, built 17 Nov 2026).** Settings > Security has Customer sign-in URL, and Members settings has Member sign-in URL (one segment, lowercase letters, digits and hyphens, 3 to 40 characters; empty keeps `/account/sign-in` and `/account/member-sign-in`). The routes stay at the default paths; the middleware serves a custom path by rewrite (including `/link` for emailed links), redirects a page view of the old path to the new one (form posts and server actions on the old path are still served), sends handler redirects straight to the new path, and marks the custom path noindex. Refused: the admin URL or anything under it, words the site uses (including `account` and `admin`), and the same path for both places. A bad saved value is skipped, never lost. Recovery: `ENGAGE_CUSTOMER_SIGN_IN_PATH` and `ENGAGE_MEMBER_SIGN_IN_PATH` override the fields. Code: `src/features/security/signInPath.ts`, `signInPathValidate.ts`, `src/middleware.ts`, `src/globals/SecuritySettings.ts`, migration `20270317_280000_sign_in_paths` (the member path is a column on `eg_member_settings` because `eg_security_settings` is at the 100 column limit), `tests/int/sign-in-custom-path.int.spec.ts`. Saving a custom path is refused when a top-level page already uses that slug. A locale-prefixed old path (`/fr/account/sign-in`) is not redirected on purpose: the account area never takes a language prefix (see `isPortalPath`), so those addresses were never valid. A top-level page cannot be saved with the slug of a custom sign-in path either.

**Where to find it:** /admin/settings/security (Customer sign-in URL) and /admin/settings/commerce > Member settings (Member sign-in URL)

<a id="sec-040"></a>
#### SEC-040 · Last sign-in on the admin user screen (18e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Last sign-in on the admin user screen (18e leftover, built 17 Nov 2026).** The admin edit screen for a user shows a Last sign-in card with the method (password, magic link, passkey, social and so on) and the time (UTC), from the `lastLoginMethod` and `lastLoginAt` columns set at every sign-in. Accounts that have not signed in since those columns were added show a plain notice. Thirteen languages. Code: `src/admin/views/EditView.tsx` (`lastLoginCard`), keys `lastLogin.*`. No migration.

Task 15a (part 2): the state harness now covers badges, chips (outline badges), menu items (resting, hover, focus, current), table rows (hover, selected) and switches (track 3:1 off and on) in light and dark, plus size checks for menu items, badges and switches at 375 and 1280 px. Specs: `tests/int/state-contrast.int.spec.ts`, `tests/int/size-checks.int.spec.ts`. No CSS change was needed. Left: other Shine components, public block CSS, 15c one-click apply.

**Where to find it:** /admin/other/users, open a user > Last sign-in card (method and time, UTC)

<a id="sec-041"></a>
#### SEC-041 · IP and country blocking leftovers (19c, 19d, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**IP and country blocking leftovers (19c, 19d, built 17 Nov 2026).** The Security audit page shows a Block this IP button beside every address (confirm, adds to the block list, your own address refused). IP lists > Import a list takes a text or CSV file or an https web address (up to 1 MB, SSRF-safe download shared with media import, up to 2000 entries, bad lines reported). Admin bypass: an admin turns it on in IP lists and that browser gets a signed 30 day cookie (`eg_ip_bypass`, HMAC with ENGAGE_SECRET) that skips both IP and country rules in the middleware. Custom block message (plain text, 300 characters, stored as a `message` row). Country picker with English names and search (`Intl.DisplayNames`). Code: `ipBypass.ts`, `countryNames.ts`, `components/BlockIpButton.tsx`, `IpRulesPanel.tsx`, `/api/admin-ip-rules` (actions `import`, `message`, `bypass`), `requestGuard.ts`, `tests/int/ip-rules.int.spec.ts`.

**Where to find it:** /admin/security/audit (Block this IP button beside each address) and /admin/security/ip-lists (Import a list)

<a id="sec-042"></a>
#### SEC-042 · Audit log drain (19i, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Audit log drain (19i, built 17 Nov 2026, first slice).** Webhooks can subscribe to a new event, Activity log entry (`audit.recorded`). Every ordinary audit entry (sign-ins, setting and user changes, bans, exports and so on) is also sent, signed and retried like any webhook, with only action, actor email, collection, document id, address, detail and time. The noisy request-level entries (blocked probes and addresses, rate limits, API key use) and the webhook system's own entries are left out so the drain cannot loop. Labels in all thirteen languages. Code: `src/features/security/auditLog.ts` (`recordAuditEvent`), `src/features/webhooks/events.ts`.

**Where to find it:** /admin/webhooks, event Activity log entry (audit.recorded); no separate screen

<a id="sec-043"></a>
#### SEC-043 · Per-route rate limit rules (19b, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Per-route rate limit rules (19b, built 17 Nov 2026, first slice).** Settings > Security > Rate limit rules (admin only): a path prefix, a method (or any), a limit and a window (10 s to 24 h), with an on/off switch and a note. Requests are counted per address in D1 (`hitShared`) and the most specific path wins; over the limit gets a 429 with Retry-After and an audit entry. Rules reach all servers within 30 s; `SECURITY_RATE_RULES_OFF=1` switches them off. Code: `src/features/security/{routeRules,routeRulesStore}.ts`, `requestGuard.ts`, `/api/admin-rate-rules`, `RateRulesPanel.tsx`, `RateRulesView.tsx`, migration `20270317_260000_rate_rules` (table `eg_rate_rules`), test `tests/int/rate-rules.int.spec.ts`. Live check: "Live check rate limit rules (19b)".

**Where to find it:** /admin/security/rate-rules (Rate limit rules: path prefix, method, limit, window, on/off)

<a id="sec-044"></a>
#### SEC-044 · Bot detection (19k and 21c, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Bot detection (19k and 21c, built 17 Nov 2026).** Form settings > Spam protection > Bot detection: Off, Ask for the challenge, or Ask for the challenge and refuse the worst, with a minimum score (default 30). Reads the Cloudflare bot score from the `cf-bot-score` header or `request.cf.botManagement.score`; verified bots are never touched; no score from the plan means no change. Challenge mode makes sign-in, create account and forgot password show and require the CAPTCHA even when Protect sign-in is off (needs the keys); block mode also refuses those and quietly discards form submissions from low scores. Honeypot, fill time and probe-path blocking are unchanged. Code: `src/features/security/botSignals.ts`, `authCaptcha.ts`, `forms/submit.ts`, migration `20270317_260000_bot_detection`, `tests/int/bot-detection.int.spec.ts`. Left: see 19k leftovers.

**Where to find it:** /admin/settings/content > Form settings > Spam protection > Bot detection (Off, Ask for the challenge, Refuse; minimum score)

<a id="sec-045"></a>
#### SEC-045 · Sign-in alerts (19g, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Sign-in alerts (19g, built 17 Nov 2026, first slice).** Each sign-in records the device (browser and system) and country in `eg_login_seen`; a sign-in from a new country or new device emails the account owner. An account's first recorded sign-in is never alerted, so enabling it does not mail everyone. Sink pattern: `notifySignIn` in `src/localapi/auth.ts` `finishLogin`, handler registered in `src/localapi/engine.ts`. Skips impersonation and re-authentication checks. Code: `src/features/security/{loginAlert,loginAlertStore}.ts`, migration `20270317_250000_login_seen`, test `tests/int/login-alert.int.spec.ts`. Live check: "Live check sign-in alerts (19g)".

**Where to find it:** No UI (backend only): src/features/security/loginAlert.ts (emails on a new device or country; LOGIN_ALERTS_OFF=1 turns it off)

<a id="sec-046"></a>
#### SEC-046 · Bulk user actions (19f, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Bulk user actions (19f, built 17 Nov 2026, first slice).** Users list (admin only) shows a bulk bar over selectable rows: ban (reason, optional days), unban, sign out everywhere, change role to editor or viewer, each with a confirm step and per-row results. Staff and member accounts only: shop customers, admins (except unban) and the person running it are refused per row. Max 100 per run. Code: `src/features/security/{userBulk,userBulkStore}.ts`, `/api/admin-user-bulk`, `src/admin/views/UsersBulkBar.tsx`, audit action `user.bulk`, test `tests/int/user-bulk.int.spec.ts`. Live check: Task 14 line "Live check bulk user actions (19f)". The Users list also has an All and Banned filter (`?status=banned`, in `src/admin/views/ListView.tsx`).

**Where to find it:** /admin/other/users (Users list): select rows for the bulk bar (ban, unban, sign out everywhere, change role)

<a id="sec-047"></a>
#### SEC-047 · Ban and unban users (19e, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Ban and unban users (19e, built 17 Nov 2026, first slice).** Settings > Security > Banned accounts (admin only): ban an account by email with an internal reason and optional days; it is signed out at once (every session row is deleted) and cannot sign in by any method, and sees only "This account cannot sign in." with no reason. The ban rides on the existing sign-in lock: `lock_until` is the end date (or 9999 for permanent) and `login_attempts` holds a marker (100000) no automatic lockout can reach, so an expired ban lifts itself and the sign-in code can tell a ban from a lockout. Cannot ban yourself. Audit entries `user.banned` and `user.unbanned`. Code: `src/features/security/{userBans,userBansStore}.ts`, `checkLoginPermission` in `src/localapi/auth.ts`, `/api/admin-user-bans`, `UserBansView`, migration `20270317_240000_user_bans` (table `eg_user_bans`), `tests/int/user-bans.int.spec.ts`.

**Where to find it:** /admin/security/bans (Banned accounts)

<a id="sec-048"></a>
#### SEC-048 · Country blocking (19d, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Country blocking (19d, built 17 Nov 2026).** In IP lists, Countries: Off, Block these countries, or Only allow these countries, from two letter codes (XX means an unknown country, which includes missing and T1 headers). Uses Cloudflare's `cf-ipcountry` header for the whole site (pages, admin, sign-in, checkout, API); blocked visitors get a plain 403 message; addresses on the IP allow list skip it; the saving admin cannot block their own country. Stored as rows in `eg_ip_rules` (kinds `country-allow` and `country-block`), no new table. Code: `ipRules.ts` (`decideCountry`), `requestGuard.ts`, `/api/admin-ip-rules` (action `countries`), `tests/int/ip-rules.int.spec.ts`.

**Where to find it:** /admin/security/ip-lists > Countries (Off, Block these countries, Only allow these countries)

<a id="sec-049"></a>
#### SEC-049 · IP allow and block lists (19c, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**IP allow and block lists (19c, built 17 Nov 2026).** Settings > Security > IP lists (admin only): paste addresses or CIDR ranges (IPv4 and IPv6) into the Block or Allow list with a private reason and an optional expiry, remove entries, download a CSV. The middleware answers a plain 403 for a blocked address before any page loads; the allow list wins; an unreadable address is never blocked; the saving admin cannot block their own address; SECURITY_IP_RULES_OFF=1 in the environment switches the lists off. Changes reach every server within 30 seconds (cached read). Audit entries `ip.rule` and `ip.blocked`. Code: `src/features/security/{ipRules,ipRulesStore}.ts`, `requestGuard.ts`, `/api/admin-ip-rules`, `IpRulesView`, migration `20270317_230000_ip_rules` (table `eg_ip_rules`), `tests/int/ip-rules.int.spec.ts`.

**Where to find it:** /admin/security/ip-lists (Block or Allow list, IPv4 and IPv6 ranges, CSV download)

<a id="sec-050"></a>
#### SEC-050 · 19a CAPTCHA modes (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**19a CAPTCHA modes (built 17 Nov 2026).** Form settings > Spam protection has a mode for each place: Member sign-in, Create account, Forgot password (request and new password), Magic link and email code request, Email code entry, Comments, Chat and live chat, Product reviews, Back-in-stock sign-up, Event RSVP, and bank transfer, cheque and cash orders. Modes: Same as before, Off, Always, or Only after repeated failures from the same address (threshold and window are settings; places with a failed step count failures, the others count tries). Needs the keys; no keys means nothing is asked. The widget appears in the form by itself (`/api/captcha-config`, `PlaceCaptcha`) and is replaced after each submit; a blocked script shows a message. Refused attempts are logged as `captcha.failed` in the audit log. The Cloudflare bot score (19k) now applies to every place: challenge mode asks, block mode refuses. Code: `src/features/security/{captchaPlaces,authCaptcha,PlaceCaptcha,rsvpCaptcha}.ts(x)`, `accounts/actions.ts`, review, back-in-stock, offline order, comment and chat routes, migration `20270317_270000_captcha_modes`, `tests/int/captcha-modes.int.spec.ts`. Not run against live keys.

**Where to find it:** /admin/settings/content > Form settings > Spam protection (a mode for each place: sign-in, create account, comments, reviews, checkout)

<a id="sec-051"></a>
#### SEC-051 · 19a and 19k follow-ups (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**19a and 19k follow-ups (built 17 Nov 2026).** (1) Admin sign-in has its own place, Admin sign-in, in the same modes; the admin login form draws the widget and sends the token with the password (`rest.ts` `handleLogin`, `LoginView.tsx`). (2) The card checkout has a place, Checkout: card payment; the token travels with the payment start request, and only the request is checked, never an order or payment record. (3) Accessible alternative: next to the widget a button, Can't use the security check? Answer a question instead, shows a plain question ("What is 7 plus 4?"); it also appears by itself when the widget cannot load. The answer is held in a signed token (ENGAGE_SECRET, 15 minutes); no secret means no alternative (`captchaFallback.ts`). (4) Flagged visitors: Authentication overview shows how many visitors the bot score flagged in the last 7 days, asked or refused, by place; one audit line (`bot.flagged`) per address and hour. (5) Per-form override: Forms > Spam > Bot detection (Use site setting, Off, Ask for the challenge, Ask and refuse the worst). Migration `20270317_280000_captcha_followups`, `tests/int/captcha-modes.int.spec.ts`. Not run against live keys.

**Where to find it:** /admin/settings/content, Form settings > Spam protection (place modes, incl. Admin sign-in); flagged counts on /admin/authentication; per form: /admin/content/forms > Spam > Bot detection

<a id="sec-052"></a>
#### SEC-052 · 19k Cloudflare signal rules (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**19k Cloudflare signal rules (built 17 Nov 2026).** Form settings > Spam protection > Bot detection (when on) has two more lists. Bot fingerprints: JA3 or JA4 hashes, one per line, that always count as a bot whatever the score (read from `cf-ja3-hash` and `cf-ja4`, or the Bot Management data). Allowed verified bot categories: empty lets every verified bot through as before; with categories listed, only verified bots in those categories pass and any other verified bot (an AI crawler, say) is treated like a bot (read from `cf-verified-bot-category` or `cf.verifiedBotCategory`). Same modes apply (ask for the challenge, or refuse), on every place and on forms. No signal from the plan means no change. Code: `src/features/security/botSignals.ts` (`BotRules`, `parseList`), `authCaptcha.ts`, `forms/submit.ts`, migration `20270318_110000_bot_rules`, `tests/int/bot-detection.int.spec.ts`. Not run against live Cloudflare headers.

**Where to find it:** /admin/settings/content, Form settings > Spam protection > Bot detection (Bot fingerprints and Allowed verified bot categories lists)

<a id="sec-053"></a>
#### SEC-053 · Admin two-step on by default and 30-day sign-ins (21 Nov 2026)

_Date: 21 Nov 2026_

**Admin two-step on by default and 30-day sign-ins (21 Nov 2026).** `requireTwoFactorForAdmins` now defaults on and covers administrators even when the Security section is off (`isCovered` in `twoFactorEnforcement.ts`, gate in `localapi/rest.ts`); an unenrolled admin is sent to the setup screen, the sole admin's API is never refused, and `ENGAGE_DISABLE_2FA_ENFORCEMENT` still works. Migration `20270320_100000_admin_two_step_and_30_day_sessions` turns it on for existing sites with a 7 day grace if none was set, and moves the old 720 minute default to 43200. Sessions are server-side rows (revocable from the sessions list) and last a fixed 30 days from sign-in: `TOKEN_EXPIRATION_SECONDS` is 30 days and a refresh never extends past that cap. Release installs get both through the migration. Tests: `two-factor`, `auth-slice-3`, `localapi-auth`, `user-sessions`, `fresh-baseline-parity`.

**Where to find it:** /admin/settings/security, two-step sign-in for admins (Require two-step sign-in or a passkey for the admin); 30-day sessions listed at /admin/security/sessions

<a id="sec-054"></a>
#### SEC-054 · Step-up confirmation for adding administrators (21 Nov 2026)

_Date: 21 Nov 2026_

**Step-up confirmation for adding administrators (21 Nov 2026).** Giving an account the admin role (create or update) now needs a password or authenticator code entered again in the last ten minutes: the screen `/admin/security/confirm` (Security > Confirm it is you) sets a signed httpOnly cookie (`src/features/security/stepUp.ts`, `confirmIdentityAction`), and the Users `beforeChange` hook `requireStepUpForAdminGrant` refuses with 403 and the screen's address otherwise. Not asked: the first admin, internal calls with no signed-in user. Changing your own password (current password) and turning two-step off or regenerating backup codes (password or code) already re-checked. The old 720 minute session setting moves to 30 days in the earlier migration; other values are kept. Tests: `step-up`.

**Where to find it:** /admin/security/confirm (Confirm it is you), shown when adding an admin role on the Users screen at /admin/other/users

<a id="cat-int"></a>
### INT: Integrations, API and webhooks

<a id="int-001"></a>
#### INT-001 · Wave 68 social-feed

_Date not recorded_

**Wave 68 social-feed:** new `social-feed` element. Connected accounts in Settings > Integrations > Social accounts: Instagram, Facebook Page, Pinterest and TikTok need tokens; YouTube channel and RSS need none. Server-side fetch, 30 min cache. X not supported (paid API).

**Where to find it:** /admin/globals/integrations, Social accounts (Settings > General > Integrations); Social feed element in the visual editor

<a id="int-002"></a>
#### INT-002 · Wave 68 embeds

_Date not recorded_

**Wave 68 embeds:** embed element is real consent-gated iframes for Instagram, X, Facebook, TikTok, Pinterest pin, LinkedIn, Spotify and SoundCloud. Shared parser `src/lib/embedProviders.ts`; hosts in `src/lib/embedHosts.ts` feed the CSP. Spotify and SoundCloud also work in audio and video-playlist.

**Where to find it:** Embed element in the visual editor (consent-gated Instagram, X, Facebook, TikTok, Pinterest, LinkedIn, Spotify and SoundCloud); no admin screen of its own

<a id="int-003"></a>
#### INT-003 · Task 19 API and webhooks (30 Oct)

_Date: 30 Oct 2026_

**Task 19 API and webhooks (30 Oct):** API builder #147 and #148 (endpoints at /api/x/<version>/<name>, field whitelist, filters, rate limit, call log, Try it, keys, OpenAPI, Markdown, HTML and Postman downloads, optional guide link, `api` permission); webhooks builder #149 (9 events, HTTPS and SSRF guard, HMAC signing, retries, delivery log with replay and test); gap-fill #150 (failure alerts, `tracking-event.saved`, checkout wiring checked in code). Open items: Task 19.

**Where to find it:** /admin/api-builder (API builder, Try it, keys, OpenAPI and downloads; public /api/x/<version>/<name>) and /admin/webhooks (webhook builder and delivery log)

<a id="int-004"></a>
#### INT-004 · Task 4 tracking (29 and 30 Oct)

_Date: 30 Oct 2026_

**Task 4 tracking (29 and 30 Oct):** #135 to #138 and #140 (events collection, consent-gated runtime, TikTok/Meta/GA4/GTM switches, Settings > Tracking, visual picker); #141 and #142 Add tags editor and follow-up; #143 to #145 tracking connections, editor suggestions, values and Add all; #151 GA4/GTM consent split (Analytics-only loads GA4 and GTM; Marketing-only does not).

**Where to find it:** /admin/settings/tracking (Tracking switches and visual picker); tracking events list at /admin/content/tracking-events

<a id="int-005"></a>
#### INT-005 · Task 3 tracking connections code (PR #187, 1 Nov)

_Date: 1 Nov 2026_

**Task 3 tracking connections code (PR #187, 1 Nov):** Settings > Tracking connections shows a setup status for Google, Meta and TikTok (Done or Missing for app ID or client ID, app secret, ENGAGE_SECRET, sign-in; values never shown). Saving an app secret without ENGAGE_SECRET is refused with a message; the encrypted-field hook refuses to encrypt without ENGAGE_SECRET instead of using an empty key. Connect flows re-tested (80 tests). Decision: task numbers kept as they are, so the gap at 3 is intentional while other tasks are in flight. Live checks in Task 6.

**Where to find it:** /admin/settings/tracking, Tracking connections setup status (Done or Missing); connections screen at /admin/tracking-connections

<a id="int-006"></a>
#### INT-006 · Task 7 integrations leftovers (PR #193, 1 Nov)

_Date: 1 Nov 2026_

**Task 7 integrations leftovers (PR #193, 1 Nov):** reminder and marketing mail (event and cart reminders) sent per recipient with a signed one-click unsubscribe link, List-Unsubscribe headers (Postmark, Resend, SendGrid, Mailgun, Brevo, Mandrill, Cloudflare) and a footer; suppression list `eg_email_suppressions` (migration 20270129) checked before bulk sends; `/api/email-unsubscribe` and Postmark bounce/complaint webhook `/api/email-events/postmark`; Search Console "Submit sitemap" (sign-in now asks for full webmasters scope). Decided: Postmark is the first bounce feed; Twilio stays the only SMS provider; no SMTP, Gmail or indexing request now. Fixed: shop-review-fixes sets SITE_URL itself. Live checks in Task 6.

**Where to find it:** /admin/globals/integrations (Text messages and email connections); suppression list at /admin/email-suppressions; unsubscribe and bounce endpoints are public (/api/email-unsubscribe)

<a id="int-007"></a>
#### INT-007 · Task 7 integrations, what was left (PR #195, 1 Nov)

_Date: 1 Nov 2026_

**Task 7 integrations, what was left (PR #195, 1 Nov):** shipped-order text, opt-in and off by default (Integrations > Text messages switch, migration `20270130_100000_sms_shipped_text`, sent with the shipped email when the first label is bought); bounce and complaint webhooks for Resend, SendGrid, Mailgun, Brevo, Mandrill and SES feed `eg_email_suppressions` (signature checked per provider; Brevo by key in the URL, as Postmark). Decided: Cloudflare Email has no bounce feed; SMTP and Gmail sending not needed; Google services and newsletter or CRM sync are in Open now as build on request. Live checks in Task 6.

**Where to find it:** /admin/globals/integrations, Text messages switch; suppression list at /admin/email-suppressions; bounce and complaint feeds have no screen of their own

<a id="int-008"></a>
#### INT-008 · Task 1 leftovers: relation fields on import and export, options page rules (PR #211, 2 Nov)

_Date: 2 Nov 2026_

**Task 1 leftovers: relation fields on import and export, options page rules (PR #211, 2 Nov):** pages (parent), posts (author, featured image) and products (images, brand, tags, variation pictures) export by name (slug, file name, email, template or group name) and import links them back by the same name; a name not on the site is left unlinked with a warning on the check and the apply; pages import parents first. Options pages: location rules match on user role and on a new "Field value (options page)" rule that compares another field's saved value (the form re-checks it as values change; save uses the values sent); a group with no collection rule applies to an options page when its other rules match. Permanent: public merge tags never know the viewer's roles, so a role rule adds no tag there; relation ids inside block content keep their old behaviour (only top-level, grouped and array fields of pages, posts and products are mapped). No migration.

**Where to find it:** /admin/settings-transfer (Export and import, relation fields); /admin/import-content (import pages and posts); /admin/options (options page location rules, field value rule)

<a id="int-009"></a>
#### INT-009 · Task 2 API gaps: DELETE, custom fields, messages, PDF, send to developer (PR #212, 2 Nov)

_Date: 2 Nov 2026_

**Task 2 API gaps: DELETE, custom fields, messages, PDF, send to developer (PR #212, 2 Nov):** DELETE per endpoint, off by default (`allowDelete`); the key's owner needs delete permission for the collection; pages, posts and events move to the trash (the trash guard applies), other collections are deleted; every DELETE is audited (endpoint path, collection, id, key id, mode; no key or body). Custom fields `cf:<name>` are exposed, read and written: reads and writes follow the field groups that apply to the record for the owner's roles, hide values by their conditions, and run the collection's own save validation (400 with each field); a field no group gives the account is 403. Decided: custom fields are not filtered or sorted yet (the builder refuses them). API runtime messages are in uiStrings (`api.*`, English default, answered in Accept-Language); the admin builder's validation stays English; the 12 other dictionaries hold English for the new keys until a translation pass. PDF guide (`format=guide.pdf`, admin download and public link) is built from the Markdown guide with no library (standard Helvetica and Courier, nothing embedded, Workers-safe). "Send to developer" block: mailto and copy for the read-only public guide link, never a key. OpenAPI, Markdown and Postman include DELETE and custom field types. No migration (endpoint config is JSON). Live checks in Task 6.

**Where to find it:** /admin/api-builder (DELETE switch per endpoint, custom fields cf:, PDF guide, Send to developer block); keys at /admin/security/api-keys

<a id="int-010"></a>
#### INT-010 · Task 2 webhooks: log redaction, retention, DNS guard, booking event, inbound webhooks (PR #214, 2 Nov)

_Date: 2 Nov 2026_

**Task 2 webhooks: log redaction, retention, DNS guard, booking event, inbound webhooks (PR #214, 2 Nov):** the stored body of a finished delivery has secret-looking keys and credential-shaped values replaced (a pending one keeps its exact body until sent; a redacted one cannot be replayed). Retention 7 to 365 days (default 30) on the webhooks screen, with a clean-up button; the cron job purges at that setting. Before each send the host is resolved over DNS over HTTPS and private, loopback, link-local and metadata answers are refused (limits in outbound.ts). `booking.made` fires from event RSVPs and appointment bookings. Inbound endpoints (`/api/webhooks-inbound/<token>`): HMAC per endpoint, replay window 1, 5 or 15 minutes, required Idempotency-Key, creates a draft or published page or post from a payload field, or triggers an outgoing event; request log without bodies. Migration `20270304_100000_webhook_redaction_inbound`. Decisions: inbound content is pages and posts only; "automation" means an outgoing event; the title field is a typed payload path. Checks: tsc, eslint, vitest (webhook specs, fresh-install, related forms, strings, cron, RSVP and migration specs).

**Where to find it:** /admin/webhooks (retention 7 to 365 days with clean-up button, log redaction, DNS guard); inbound endpoints are public at /api/webhooks-inbound/<token>

<a id="int-011"></a>
#### INT-011 · 9 Nov Task 10 easy API creation, keys and feeds (PR pending)

_Date: 9 Nov 2026_

**9 Nov Task 10 easy API creation, keys and feeds (PR pending):** most of it already existed (API builder, per-user keys with scopes, revoke, call log, developer guide, webhooks, members portal keys). Added: API access categories (`eg_api_categories`, `eg_api_category_members`; scopes, rate per minute, key cap; members are a person or a customer organisation; a key is narrowed to its owner's category on every request and the category's rate applies; once any category exists a customer without one cannot use or create a key, staff are unaffected), key rotate (re-checks password or code, old key dies at once, audited), per-key daily usage (`eg_api_key_usage`, 30 days, shown on the key row), admin creates a key for a customer, endpoints can be limited to categories, the customer's portal API guide lists only the endpoints their account can call, data feeds (CSV with formula defusing, JSON lines, XML; `?format=` per call), drag and drop field picker with buttons for keyboard and touch (replaces the checkbox list), webhook link from the builder. Strings in 13 languages. Live checks in Task 20 (Closed Task 10 API).

**Where to find it:** /admin/security/api-keys, API access categories panel; key rotate and daily usage on each key row; data feeds via ?format= on API endpoints

<a id="int-012"></a>
#### INT-012 · 25b Native live chat, first version (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**25b Native live chat, first version (built 16 Nov 2026).** Switch Live chat on in Site Settings, under Features, and set it up in Admin > Live chat: opening hours (time zone aware, overnight allowed), notify email, canned replies, retention, purge. Visitors reach it from the chatbot widget (a Talk to a person button, also after a hand-off) and see staff replies in the same window, polled every 4 seconds; staff inbox polls every 5 seconds with filters, assign, internal notes, canned replies with {name}, transcript, close, reopen and delete. Staff are online while the admin inbox is open (90 second heartbeat); outside hours or with nobody online the visitor sends an offline message that is emailed. New chats email the notify address (or shop admin) and send web push. Visitors can end a chat and email themselves the transcript (notes excluded). CAPTCHA and rate limit apply; chats link to the signed-in account and are erased with the customer in the privacy erase. Code: `src/features/livechat/{core,store,notify}.ts`, `components/{LiveChat,LiveChatPanel}.tsx`, `src/admin/views/LiveChatView.tsx`, `/api/livechat`, `/api/admin-livechat`, migration `20270316_425000_livechat`, `tests/int/livechat.int.spec.ts`.

**Where to find it:** /admin/livechat (Live chat inbox and settings); switch Live chat on at /admin/settings/site, Features; visitors use Talk to a person in the chatbot widget

<a id="int-013"></a>
#### INT-013 · 30a AI site chatbot, first version (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**30a AI site chatbot, first version (built 16 Nov 2026).** Switch Chatbot on in Site Settings, under Features, and set it up in Admin > Chatbot: name, avatar, greeting, tone, brand voice, extra instructions, allowed and blocked topics, languages, opening hours and the hand-off message, contact page and email. Visitors get a corner chat button (when Show on every page is on) or the Chatbot element placed on any page in the visual editor. Answer order: the FAQ first, then pages, posts and products (published, not password protected, title and excerpt only), each answer with links to its sources. With a Claude or OpenAI key (cheap model, chosen from Integrations keys) the model writes the answer only from those numbered sources and cites them; it replies NO_ANSWER when they do not hold it, which becomes a hand-off to the contact page, email and opening hours. With no key, with AI switched off, with the shared AI spend cap reached or with the chatbot's own optional cap reached, a strong FAQ match is returned as it is and anything weaker shows page links or the hand-off. Switches, all off by default: store help (shipping, returns and policy pages as sources), order status (signed-in customers only, only their own latest three orders, read straight from the store with no AI), product recommendations. Rate limit per visitor per hour, honeypot, the Form settings spam challenge on the chat box, a consent notice before the first message, retention in days (old conversations are removed when a new chat starts, or by the Delete old conversations now button) and erase with the customer in the privacy erase. The admin sees use and spend (chatbot calls cost like the AI page builder, in the same usage table with mode chatbot), the conversation log with filters for handed off and rated not helpful, a delete per conversation, and Teach it, which saves a corrected answer as a new FAQ. Visitors rate each answer with thumbs. English labels only for now. Code: `src/features/chatbot/{core,store,service}.ts`, `components/{ChatWidget,ChatWidget.server,ChatbotPanel}.tsx`, `src/admin/views/ChatbotView.tsx`, `/api/chatbot`, `/api/admin-chatbot`, element `chatbot` in `wave38Defs.ts`, tables `chatbot_settings`, `chatbot_conversations`, `chatbot_messages`, migration `20270316_395000_chatbot`, `tests/int/chatbot-core.int.spec.ts`, `tests/int/chatbot-service.int.spec.ts`.

**Where to find it:** /admin/chatbot (chatbot settings and conversation log); switch Chatbot on at /admin/settings/site, Features; visitors get a corner chat button or the Chatbot element

<a id="int-014"></a>
#### INT-014 · 17h Google Analytics link (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17h Google Analytics link (built 16 Nov 2026).** Settings pages can now hold an external link card (`type: 'external'`, an https address that opens in a new tab with `noopener noreferrer`, shown with a ↗ arrow, left out of the settings search). Settings > Tracking has a Google Analytics card to analytics.google.com. Code: `src/admin/settingsPages.ts`, `views/SettingsPageClient.tsx`, `views/SettingsHubView.tsx`. No migration.

**Where to find it:** /admin/settings/tracking, Google Analytics external card (opens analytics.google.com in a new tab)

<a id="int-015"></a>
#### INT-015 · 22h Google Analytics user_id (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**22h Google Analytics user_id (built 16 Nov 2026).** In SEO settings, Analytics: switch on Send signed-in user ID to GA4 (off by default) and keep Hash the ID on (default; a keyed SHA-256 using the site secret, first 32 hex characters, so the account number never leaves the site). The ID is only added when analytics loads, so it is consent gated by the same loader, and only for signed-in users. Code: `src/features/seo/ga4User.ts`, `AnalyticsLoader.tsx`, `SeoScripts.tsx`, `SeoSettings.ts`, migration `20270316_300000_ga4_user_id`, `tests/int/ga4-user-id.int.spec.ts`.

**Where to find it:** /admin/settings/marketing-seo, SEO settings > Analytics > Send signed-in user ID to GA4 (off by default; Hash the ID on)

<a id="int-016"></a>
#### INT-016 · 21b Ads and Pinterest (built 16 Nov 2026, partly)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21b Ads and Pinterest (built 16 Nov 2026, partly).** AdSense: checked `src/features/ads/adapters.ts`. It lists header-bidding adapters (Prebid bidders and Amazon TAM), and AdSense is not one: it is its own ad tag, so there is no AdSense unit type today. Auto ads limit stays Permanent. Not added: a display unit kind for AdSense needs a new kind on the ad unit, its own tag output and its own consent handling, which is a separate piece of work. Pinterest: the existing embed (pin) and the connected-board feed (`socialFeeds`) stay. New: (1) a Pin it button in the Share buttons element (tick Pinterest and give the picture address; with no picture the button is left out, because Pinterest needs one); (2) the Pinterest Tag: an optional Pinterest Tag ID on Tracking connections (10 to 16 digits, validated), loaded for marketing consent only and counted in the withdraw-reload rule. It is kept there because Integrations is at the column limit. Code: `wave36Defs.ts`, `Wave36Elements.tsx`, `src/globals/TrackingConnections.ts`, `AnalyticsLoader.tsx`, `SeoScripts.tsx`, migration `20270316_240000_pinterest_tag`, `tests/int/pinterest-tag-share.int.spec.ts`.

**Where to find it:** /admin/tracking-connections (Pinterest Tag ID); Share buttons element in the visual editor (Pinterest ticked, Pin it button)

<a id="int-017"></a>
#### INT-017 · 18b Live order tracking (built 16 Nov 2026; Sendle polling and a webhook built, other carriers need live check

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**18b Live order tracking (built 16 Nov 2026; Sendle polling and a webhook built, other carriers need live checks or the webhook).** Each parcel on an order now carries a tracking timeline (status, events with time, text and place) saved inside the shipment, so no new table. Five states: label created, in transit, out for delivery, delivered, delivery problem. Sources: the hourly `shipment-tracking` job asks carriers that can answer (Sendle is built in: `track` on the carrier adapter, a new optional method) about undelivered parcels shipped in the last 45 days; a webhook `POST /api/shipment-tracking` (secret in the `TRACKING_WEBHOOK_SECRET` setting, header `x-tracking-secret`, absent secret means the address does not exist) takes updates from any carrier or tracking service (ShipStation, AfterShip, a carrier portal); and staff can add an update by hand on the order (the Shipping panel, for carriers that cannot be asked). The customer is emailed once each when a parcel is out for delivery, delivered, or has a problem (delivered also covers a missed out-for-delivery), switched by Shop switches, Email the customer as their parcel moves. The timeline shows on the admin order and on the customer's order page (`/account/orders/<id>`). Delivered is final; repeat scans change nothing. Code: `ecom/lib/tracking.ts` (pure), `ecom/server/tracking.ts`, `ecom/shipping/{types,sendle}.ts`, `/api/shipment-tracking`, `/api/admin-order-tracking/[id]`, `ecom/admin/OrderPanels.tsx`, `accounts/components/AccountScreens.tsx`, cron job, migration `20270316_220000_shipment_tracking`, `tests/int/shipment-tracking.int.spec.ts`.

**Where to find it:** /admin/shop/orders > order > Shipping panel (timeline and manual update); /admin/globals/shop-extra-settings, Email the customer as their parcel moves; webhook at /api/shipment-tracking

<a id="int-018"></a>
#### INT-019 · Task 15 34j Two-way Google Calendar sync (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34j (23 Nov 2026).** Events now sync both ways with Google Calendar. Settings sit on the Google connection page (Google Calendar sync card): on/off, default calendar, rules `word | calendar address` to send matching events to other calendars, sync interval (5 to 1440 minutes), Test connection, Sync now and a log. A five-minute cron job (`gcal-sync`, runs on the chosen interval) reads Google changes with sync tokens (repeating events arrive as single occurrences, a lapsed token restarts with a fresh read), creates, edits and deletes the matching events here, then sends new, edited and deleted site events to Google. When both sides changed since the last sync the later edit wins and the clash is logged; echoes of our own writes are ignored (5 second clock tolerance). Times go to Google in UTC; all-day Google events import as full days. Tables are created on first use (no migration). The Google sign-in now also asks for the Calendar events permission, so an existing connection must click Connect with Google again. Code: `src/features/gcalSync/{map,store,api,run}.ts`, `admin-gcal-sync` route, `GoogleCalendarSyncCard.tsx`, `cron/jobs.ts`, `google/constants.ts`; tests `tests/int/gcal-sync-34j.int.spec.ts`.

**Where to find it:** Admin > Google connection > Google Calendar sync

#### INT-018 · Task 9, 28d Live review sources (built 22 Nov 2026)

_Date: 22 Nov 2026_

**Task 9, 28d Live review sources (built 22 Nov 2026).** Google reviews (Places API key), Facebook Page reviews (Graph token) and Yelp reviews (Fusion key) are new options in Integrations > Social accounts (each customer enters their own key; stored encrypted like the other tokens). The Reviews block has Live reviews from (the saved source) and a place, page or business ID per block (empty = the default saved with the key). Reviews are fetched on the server through a six hour memory and edge cache with stale fallback, so a visit never calls the provider; they are added after the manual reviews as one wall with the source as a badge. Review structured data is switched off while live reviews show, because search engines do not accept third-party reviews as markup. Code: `src/features/reviewSources/`, `ReviewsLive.tsx`, `/api/admin-review-sources`, `wave48Defs.ts`. Not built: Facebook reviews link back (the API gives none), per-source review counts from the provider (Google returns only five reviews).

**Where to find it:** Reviews block in the visual editor (Live reviews from, place, page or business ID); API keys in /admin/globals/integrations > Social accounts

<a id="cat-evt"></a>
### EVT: Events, tickets and bookings

<a id="evt-001"></a>
#### EVT-001 · 8 Nov Task 6 bookings research and plan (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 6 bookings research and plan (PR #226, 8 Nov):** `the Bookings plan appendix of `docs/remaining-work.md`` (gap list, data model, 4 phases, 14 decisions for Matt).

**Where to find it:** No UI (docs/process only)

<a id="evt-002"></a>
#### EVT-002 · Task 1 (events and tickets), 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Task 1 (events and tickets), 15 Nov 2026, PR pending: `event-rsvps` gets `order_id`, `status` and `cancelled_at` (migration `20270315_100000_event_rsvp_orders`); `markOrderPaid` books each ticket line through `src/features/events/orderRsvps.ts`; a full refund or a cancelled or refunded order cancels the bookings; capacity is settled after insert by `verifyEventCapacity` (lowest id wins); the booking email names the ticket type (`ticketLine`); `EventTiers`, `RsvpForm` and the event page use Shine classes and `events.*` keys in all thirteen languages. Tests: `tests/int/event-order-bookings.int.spec.ts`.

**Where to find it:** No UI (backend only): src/features/events/orderRsvps.ts; ticket bookings show on the event page /events/<slug> and in /admin/content/events

<a id="evt-003"></a>
#### EVT-003 · 17b Booking pages, phase 1 (built 16 Nov 2026 on the proposed defaults in `the Bookings plan appendix of `docs

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17b Booking pages, phase 1 (built 16 Nov 2026 on the proposed defaults in `the Bookings plan appendix of `docs/remaining-work.md``; free appointments only).** New feature Bookings (off by default, switch on in Site Settings, Features; five lazy tables). Settings, Bookings: add a person or place (with a time zone), write weekly hours as lines like `mon-fri 09:00-17:00`, change single days (closed all day, closed for lunch, open extra hours), add booking types (name, address, who it is booked with, length, start every N minutes, gap before and after, least notice, how far ahead, people per time, location), and see the bookings with Completed, No show and Cancel. Public page `/book/<address>`: pick a day, pick a time, give name and email; times are checked again on booking, and two people asking for the last place cannot both get it (insert, then verify). The confirmation email has an add-to-calendar link (`/api/booking-ics`) and a private link `/book/manage/<token>` to cancel before it starts; only a hash of the link is stored. The slot engine is pure and tested across the Sydney and London daylight saving changes. Slot, create and manage routes are rate limited. Code: `src/features/bookings/{engine,logic,store,service}.ts`, `BookingWidget.tsx`, `ManageBooking.tsx`, `BookingsAdminPanel.tsx`, `/api/booking-*`, `/api/admin-bookings`, migration `20270316_170000_bookings`, tests `bookings-engine`, `bookings-logic`.

**Where to find it:** /admin/bookings (Bookings: people or places, weekly hours, booking types, bookings list); switch Bookings on at /admin/settings/site, Features; public page /book/<address>

<a id="evt-004"></a>
#### EVT-004 · 17a Service products (built 16 Nov 2026; deposit and booking still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17a Service products (built 16 Nov 2026; deposit and booking still open).** Decision: a service is a tick box on a simple or variable product, not a separate product type, so it keeps price, options, quantity breaks, add-ons and subscriptions (a new type would have needed every one of the many simple-type checks changed). The Service group has Is a service and a duration in minutes. A service is never shipped (no weight, no shipping step, no shipment label; the existing Virtual flag works the same way) and its page shows a Duration row. It appears in orders and the account like any product. Code: `ecom/lib/service.ts`, `productFields.ts` (serviceFields), `server/pricing.ts`, `server/shipments.ts`, `storefront.ts`, migration `20270316_160000_service_products`, `tests/int/service-product.int.spec.ts`.

**Where to find it:** /admin/shop/products > service product > Service group (Is a service, Duration in minutes); product page shows a Duration row

<a id="evt-005"></a>
#### EVT-005 · Paid bookings (12b leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Paid bookings (12b leftover, built 17 Nov 2026).** A booking type has a price in cents and a full-refund window in hours (Settings, Bookings; migration `20270318_180000_paid_bookings` adds `price_cents`, `refund_hours` and, on bookings, `amount_cents`, `payment_intent_id`, `paid_at`, `refunded_cents`). A booking on a priced type is `pending_payment`: it holds its time (counted as busy) for 30 minutes while the customer pays on a Stripe Checkout Session (`createBookingCheckout` in `src/features/bookings/payment.ts`, session and intent metadata `bookingId` and `bookingToken`). The existing `payment_intent.succeeded` webhook in `src/localapi/rest.ts` calls `onBookingPaid`: it confirms the booking once (replays do nothing) and sends the confirmation email with the private link (taken from the metadata, because only its hash is stored); a payment that arrives after the hold was released is refunded in full. The Reminder emails cron job releases holds that ran out (`releaseExpiredHolds`). Cancelling a paid booking (private link or account page) goes through `cancelWithRefund`: full refund when the cancel is at least the refund window before the start, nothing after that (`refundCentsFor`), and the customer sees which. No hidden service product or order is made: the booking holds the payment itself, so paid bookings do not appear in Orders. Tax, partial refunds, deposits and staff-side refunds are not built. English only. Tests in `tests/int/paid-bookings.int.spec.ts`; not tested against live Stripe.

**Where to find it:** /admin/bookings (booking type price and refund window); public /book/<address>; customer cancel at /account/bookings

<a id="evt-006"></a>
#### EVT-006 · Event places per person (12d leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Event places per person (12d leftover, built 17 Nov 2026).** An event has Most places per person (sidebar, next to Capacity; migration `20270318_170000_event_max_per_person`, columns `max_per_person` and `version_max_per_person`). The RSVP check in `src/hooks/checkEventCapacity.ts` refuses a booking that would take one email over the limit, counting every active booking by that email with case and `+tag` ignored (`perPersonRefusal` in `src/features/events/perPersonLimit.ts`). Ticket purchases through checkout are not limited here (use a purchase limit rule on the ticket product). English only. Tests in `tests/int/event-per-person-limit.int.spec.ts`.

**Where to find it:** /admin/content/events > event sidebar > Most places per person (next to Capacity)

<a id="evt-007"></a>
#### EVT-007 · Appointments in the account portal (12b leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Appointments in the account portal (12b leftover, built 17 Nov 2026).** The Event bookings page in the account (`BookingsScreen`) lists the customer's booking-page appointments, upcoming first, with a Cancel appointment button. They are matched by booking email and shown only once the account's email is confirmed (same rule as event bookings). `src/features/bookings/MyAppointments.tsx`, `CancelAppointment.tsx`, `/api/account-appointments` (checks the booking email is the signed-in account's, then reuses `cancelError`), `listBookingsByEmail` in `store.ts`. English only. Customer reschedule is not built.

**Where to find it:** /account/bookings (Event bookings page, appointments list with Cancel appointment; needs a confirmed account email)

<a id="evt-008"></a>
#### EVT-008 · Booking reminder email (12b leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Booking reminder email (12b leftover, built 17 Nov 2026).** Each confirmed booking starting within the next 24 hours gets one reminder email. `runBookingReminders` in `src/features/bookings/reminders.ts` runs inside the Reminder emails cron job (every 5 minutes); `reminder_sent_at` on `eg_bookings` (migration `20270318_160000_booking_reminders`) is set before sending so nothing goes out twice. The email has no cancel link (only a hash of the manage token is stored), so it points back to the confirmation email. The lead time is fixed at 24 hours. Tests in `tests/int/booking-reminders.int.spec.ts`. English only.

**Where to find it:** No UI (backend only): src/features/bookings/reminders.ts (runs inside the Reminder emails cron job)

<a id="evt-009"></a>
#### EVT-009 · Service staff field and card badge (12a leftovers, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Service staff field and card badge (12a leftovers, built 17 Nov 2026).** A service product has a With field (who does it or what is used). The product page lists it under Duration (`serviceDetails` in `src/features/ecommerce/lib/service.ts`) and the shop card shows a `Service · 1 hour` label (`serviceBadge`, in `ProductCard.tsx`). Migration `20270318_150000_service_staff` adds `service_staff` and `version_service_staff`. The badge on orders, deposits and booking-based selling are not built. English only.

**Where to find it:** /admin/shop/products > service product > With field (under Duration); card badge on the public /shop list (ProductCard.tsx)

<a id="evt-010"></a>
#### EVT-010 · Task 1 ticket tier pricing

_Date: 17 Nov 2026 · Original group: Tasks 1 to 3 leftovers (17 Nov 2026)_

Task 1 ticket tier pricing: decided to build the picker. Each ticket tier on a paid event can have its own shop product (`productId` inside `ticketTiers`, no migration). The event page shows a buy button per tier; a paid order for a tier's product books that tier (`tierForLine`, `createRsvpsForOrder`); the old single ticket product and variation-label matching still work.

**Where to find it:** /admin/content/events > event > ticket tiers (each tier can link its own shop product); event page /events/<slug> shows a buy button per tier

<a id="evt-011"></a>
#### EVT-011 · 16g Event page type on posts (built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**16g Event page type on posts (built 22 Nov 2026).** Posts can pick Event as the Page type. The facts form has Name, Starts, Ends, Venue, Venue address, Image, Ticket price, Currency, Organizer and Status; Name, Starts and Venue are required and the rest recommended, listed in the page checks like the other rich types. Emitted as the post's mainEntity Event node (`richTypes.ts`, `POST_SCHEMA_TYPES`). No migration: the page type and facts columns on posts already existed as text, so no baseline change. AggregateRating on Product was already emitted from approved shop reviews (checked 17 Nov 2026).

**Where to find it:** /admin/content/posts > post > Page type: Event (facts: Name, Starts, Venue, Ticket price); emitted as Event schema on the post page

<a id="cat-com"></a>
### COM: Commerce and shop

<a id="com-001"></a>
#### COM-001 · Task 8 shop (PR #194, 1 Nov)

_Date: 1 Nov 2026_

**Task 8 shop (PR #194, 1 Nov):** offline payments (bank transfer, cheque, cash on delivery): the order is Pending payment with the method, the customer gets the instructions by email, staff press Mark payment received on the order (same paid path as a card payment; no stored transaction changed). Product tags and brands are two collections picked on the product, and both can be set in bulk. Bulk actions on products (publish, trash, tags, brand) and orders (status, with the transition rules). Review request email after an order is completed (off by default, Shop switches row). Verified buyer badge on the product page and as an admin column. Carrier live rates checked in code and pinned by a test (six carriers have built-in rates and labels). Decided: offline orders are Pending payment, not On hold; order statuses stay at seven (shipments track fulfilment); customer bulk actions are not built (personal data, privacy request flow). Brand and tags show under the short description on the product page (translated), and the shop list has Brand and Tag filters (`?brand=`, `?tag=`, kept through paging and other filters). Site search finds products by brand or tag name (newest 200 published products, each once). Migration 20270129_100000_shop_organise_offline. Live checks in Task 6.

**Where to find it:** /admin/shop/orders > order > Mark payment received (offline orders); /admin/shop/products bulk actions, tags and brands; review request switch in /admin/globals/shop-extra-settings

<a id="com-002"></a>
#### COM-002 · Task 4 (part), 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Task 4 (part), 15 Nov 2026, PR pending: variation tier notes, badge product picker, nested blog category URLs and tree merge tags, company-based tier matching.

**Where to find it:** /admin/shop/products > variable product > variation tier notes; /admin/price-tiers (company-based tier matching)

<a id="com-003"></a>
#### COM-003 · 23e Stock hold at checkout (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23e Stock hold at checkout (built 16 Nov 2026, part).** Shop switches: Hold stock while a cart is in checkout (off by default) and Stock hold minutes (15). The final checkout (strict pricing) holds the stock of managed-stock products for its cart with one conditional insert into `eg_stock_reservations`, counting other carts' running holds that have not been paid; a refused hold stops checkout with a clear message. Variations that manage their own stock hold their own pool, others draw on the product's; backorder products and bundles are not held. Ended holds are swept by the abandoned-carts job. Migration `20270317_150000_stock_hold`. Code: `src/features/ecommerce/server/stockHold.ts`, `pricing.ts`, `tests/int/stock-hold.int.spec.ts`.

**Where to find it:** /admin/globals/shop-extra-settings, Shop switches: Hold stock while a cart is in checkout and Stock hold minutes (15); no screen of its own for the hold

<a id="com-004"></a>
#### COM-004 · 23f Cart accessibility (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23f Cart accessibility (built 16 Nov 2026).** Labelled quantity and remove buttons per product, a live region announcing item count and subtotal, focus to the cart heading after Remove. The 375 px check is a live check.

**Where to find it:** Public /cart: labelled quantity and remove buttons per line and live region; no admin setting

<a id="com-005"></a>
#### COM-005 · 23c Coupon, shipping estimate and tax on the cart (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Coupon, shipping estimate and tax on the cart (built 16 Nov 2026, part).** `CartEstimate` on the cart page and in the mini cart: coupon code, country and postcode, then subtotal, discount, shipping, tax and estimated total from `/api/shop-quote`, the same server quote checkout uses, so the numbers match. Re-prices when the lines change. Code: `src/components/CartEstimate.tsx`.

**Where to find it:** Public /cart and mini cart (CartEstimate: coupon, country and postcode, shipping and tax estimate); no admin setting

<a id="com-006"></a>
#### COM-006 · 23b Mini cart drawer or dropdown (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23b Mini cart drawer or dropdown (built 16 Nov 2026).** New Shop switches settings (Settings > Shop): What the cart button does (go to the cart page, slide-out drawer, dropdown) and Open after add to cart. Any link to `/cart` (header, cart button element, locale prefixed) and add to cart on the product page, the add to cart button and the visual editor add to cart element open it. It shows lines, quantity, remove, free-shipping bar, coupon, shipping estimate and tax, cross-sells and Checkout; focus is trapped, Escape closes and returns focus, quantity changes are announced. Migration `20270316_428000_mini_cart`. Code: `src/components/MiniCart.tsx`, `src/features/ecommerce/lib/miniCart.ts`, `/api/shop-cart-ui`, `tests/int/mini-cart.int.spec.ts`. English only; effects from the Spark picker are not wired yet.

**Where to find it:** /admin/globals/shop-extra-settings, Shop switches: What the cart button does and Open the drawer or dropdown after add to cart; public mini cart on any page

<a id="com-007"></a>
#### COM-007 · 28c Free-shipping progress bar (built 16 Nov 2026, part)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**28c Free-shipping progress bar (built 16 Nov 2026, part).** The cart page shows "Spend $X more for free shipping" with a progress bar (and "You have free shipping." once reached), using the lowest enabled Free over amount threshold across shipping zones. Hidden when no threshold is set. It is a hint: checkout still prices shipping from the address. English only. Code: `src/features/ecommerce/lib/freeShipping.ts`, `/api/shop-free-shipping`, `src/components/FreeShippingBar.tsx`, cart page, `tests/int/free-shipping-progress.int.spec.ts`. No migration.

**Where to find it:** Public /cart free-shipping progress bar; threshold comes from shipping zones at /admin/shop/shipping-zones

<a id="com-008"></a>
#### COM-008 · 17d Purchase limits against hoarders and bots (built 16 Nov 2026; waiting list, card fingerprint and bot chall

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17d Purchase limits against hoarders and bots (built 16 Nov 2026; waiting list, card fingerprint and bot challenge still open).** New feature Purchase limits (off by default, switch on in Site Settings, Features; two lazy tables). Settings, Purchase limits: add rules for all products or one product (event tickets are products): most per person (over N days or ever), a wait in hours between orders, and an option to need a signed-in account with a verified email. A person is matched by account, by email (ignoring +tags and Gmail dots) and by delivery address; paid orders and orders still waiting for payment count, cancelled, refunded and failed ones do not, and the order already made from the same cart is not counted twice. The check runs when the order is priced (`buildOrderDraft`, so card, PayPal and offline checkouts all pass through it) and refuses with a clear sentence such as the limit and how many more can be ordered. A throttle of 20 checkout attempts per email per minute stops probing. Every refusal goes to a report with counts for the last day and week. If the feature is off or its tables cannot be read, orders go through. Code: `src/features/purchaseLimits/{logic,store,enforce}.ts`, `PurchaseLimitsPanel.tsx`, `/api/admin-purchase-limits`, hook in `ecom/payments/stripeAdapter.ts`, migration `20270316_190000_purchase_limits`, `tests/int/purchase-limits.int.spec.ts`.

**Where to find it:** /admin/purchase-limits (Purchase limits rules: all or one product, most per person, wait hours, signed-in account); switch on at /admin/settings/site, Features

<a id="com-009"></a>
#### COM-009 · 17c Quote, bid and item requests (built 16 Nov 2026; card payment, bid auctions and form feed still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17c Quote, bid and item requests (built 16 Nov 2026; card payment, bid auctions and form feed still open).** New feature Quotes and requests (off by default, switch on in Site Settings, Features; one lazy table `eg_quote_requests`). Public page `/request-quote?kind=quote|bid|item&product=<id>&title=<name>` (and the `RequestForm` component) takes name, email, phone, quantity, details, needed-by date and, for an offer, the amount; it has a hidden bot field and is rate limited. The customer gets a received email and the shop's admin email gets a notice. Settings, Quotes and requests is the inbox: filter by status, write a quote (lines, price each, days open, terms, and an email message that can use merge tags such as `{{name}}`, `{{total}}`, `{{validUntil}}` and `{{link}}`), send it, decline or close a request, and read the activity log. Sending makes a fresh private link `/quote/<token>` (only its hash is stored). The customer reads the quote, accepts, declines or sends a counter-offer (a note and an optional amount, which puts the request back in front of staff). Accepting is atomic (a double click makes one order) and creates a Pending payment order on the first offline method the shop has switched on, with the payment instructions emailed; staff mark it paid with the usual order action. Quotes past their date show as expired at once and are closed when the inbox is opened. Code: `src/features/quotes/{logic,store,service}.ts`, `RequestForm.tsx`, `QuoteView.tsx`, `QuotesAdminPanel.tsx`, `/api/quote-request`, `/api/quote-view`, `/api/admin-quotes`, `app/(frontend)/{request-quote,quote/[token]}`, migration `20270316_180000_quotes`, `tests/int/quotes-logic.int.spec.ts`.

**Where to find it:** /admin/quotes (Quotes and requests inbox); public /request-quote?kind=quote|bid|item; switch on at /admin/settings/site, Features

<a id="com-010"></a>
#### COM-010 · 16j Storefront currency sweep (built 16 Nov 2026; product screen redesign still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16j Storefront currency sweep (built 16 Nov 2026; product screen redesign still open).** Checked every place that formats a shop price. Fixed the ones that ignored the shop currency: the product page structured data (offers were always AUD), event ticket offers in the page structured data, the Wishlist page prices, and the admin new order email total. Other AUD defaults are fallbacks that only apply when no currency is passed, and every storefront caller passes the shop currency. Pre-order behaviour (button text, release date, cart rules) is already covered by `shop-extra-preorders-wave11` and `preorders-variation-images-wave9`. Test: `tests/int/shop-currency-follow.int.spec.ts`.

**Where to find it:** No UI (backend only): tests/int/shop-currency-follow.int.spec.ts; affects storefront prices on /shop, /wishlist and product page structured data

<a id="com-011"></a>
#### COM-011 · 16i Donations (built 16 Nov 2026; recurring and goal bar still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16i Donations (built 16 Nov 2026; recurring and goal bar still open).** A simple product has a Donation group: tick Is a donation and the buyer sets the amount (name your price rules, so the lowest amount is the minimum price field), with suggested amounts as buttons, a largest amount checked on the server, a campaign name, an optional Give anonymously tick box, and receipt wording. The page shows Donate, the amount buttons and the tick box. The confirmation email (paid and completed) adds a thank you per donation (amount, campaign, anonymous) and the receipt wording once, where the shop puts its ABN and tax text. Order lines keep the campaign, and Shop reports has Donations by campaign with a CSV. A monthly donation is a donation product that is also a subscription product (existing subscription fields). Code: `ecom/lib/donations.ts`, `catalogue.ts`, `storefront.ts`, `server/pricing.ts`, `hooks/cartHooks.ts`, `server/emails.ts`, `shopReports/queries.ts`, `ProductPurchase.tsx`, migration `20270316_150000_product_donations`, `tests/int/donations.int.spec.ts`.

**Where to find it:** /admin/shop/products > simple product > Donation group (Is a donation, suggested amounts, campaign); Donations by campaign on /admin/shop-reports

<a id="com-012"></a>
#### COM-012 · 16h Checkout handoff from forms (built 16 Nov 2026; order bump and upsell still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16h Checkout handoff from forms (built 16 Nov 2026; order bump and upsell still open).** In the visual editor, Form tab, Go to checkout: switch it on and name the product (number, optional variation id, quantity) or a choice field whose option values are product numbers (`12` or `12:variationId`), and map checkout details to form field names (email, full name, phone, street, suburb, state, postcode, country, order note). After the entry is saved the visitor is sent to `/checkout?handoff=...`; the checkout adds the product to the cart, fills the email and address, puts the phone and note in the checkout fields, and removes the code from the address. The handoff only names a product and details; prices, stock and totals come from the cart as always. The settings come from the form, so a visitor can only pick products the form's own choice field offers. Code: `src/features/forms/checkoutHandoff.ts`, `submit.ts`, `config.ts`, `FormSettingsPanel.tsx`, `src/components/CheckoutForm.tsx`, `CheckoutExtras.tsx`, `tests/int/form-checkout-handoff.int.spec.ts`. No migration.

**Where to find it:** Visual editor > form > Form tab > Go to checkout (product number and checkout detail mapping); visitors land on public /checkout?handoff=...

<a id="com-013"></a>
#### COM-013 · 16f Pay-later messaging (already built, verified 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16f Pay-later messaging (already built, verified 16 Nov 2026).** The "or 4 payments of $X with Afterpay" and Klarna lines already show on the product page and the cart (`components/PayLaterMessage.tsx`), only when the method is on, the Show messaging setting is on, and the shop currency and the amount fit the provider's range; the setting hides them. Added `tests/int/pay-later-messaging.int.spec.ts` to lock the rules in. Stripe sandbox check is in Task 14.

**Where to find it:** Public product page and /cart (Afterpay and Klarna lines); Show messaging switch in /admin/settings/commerce, payment settings

<a id="com-014"></a>
#### COM-014 · 16e Product feeds per channel and Pinterest (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16e Product feeds per channel and Pinterest (built 16 Nov 2026).** Feeds are records (table `eg_product_feeds`, lazy with the ecommerce feature) managed at Settings, Product feeds: name, channel (Google Merchant XML, Meta CSV, Pinterest CSV, generic CSV, generic XML), currency (from the display currencies, falls back to the shop currency when no usable rate), price tier (a customer type, uses the Price tiers at quantity 1), category and tag slug, include out of stock, on or off. Each feed has a secret address `/feeds/custom/<32 hex>.xml` or `.csv`, a New address button to rotate it, and a Preview of the first 20 rows plus what the channel would reject (missing columns, duplicate ids, long titles). Password protected products never appear. The two built-in feeds are unchanged. Code: `ecom/lib/feedRecords.ts`, `ecom/server/feedRecords.ts`, `loadFeedFor` in `ecom/server/feeds.ts`, `/api/admin-product-feeds`, `ProductFeedsPanel`, migration `20270316_140000_product_feeds`, `tests/int/product-feeds.int.spec.ts`.

**Where to find it:** /admin/product-feeds (Product feeds: channel, currency, price tier, address, Preview); public /feeds/custom/<token>.xml or .csv

<a id="com-015"></a>
#### COM-015 · 16d Pricing rules by customer variables and preview (built 16 Nov 2026; wholesale mode still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16d Pricing rules by customer variables and preview (built 16 Nov 2026; wholesale mode still open).** Pricing rules (Shop switches) can now match on customer lifetime spend (paid orders by email, less refunds), number of past orders and shipping country, next to the existing quantity, subtotal, category and role rules. Company or member group already worked through the role rule (a role name, a company name or `company:<slug>`; price tiers match the same way, so "match tiers by company" from Task 4 is covered). A rule "spend over 5000 gets 10 percent" shows in the rules taken off the cart and the order. New admin screen Pricing preview (`/admin/pricing-preview`, in Shop settings links) runs the real checkout calculation for a customer email, country and cart, so the preview matches the real cart. Code: `ecom/lib/pricingRules.ts`, `ecom/server/customerStats.ts`, `/api/admin-pricing-preview`, migration `20270316_130000_pricing_rule_customer_conditions`, tests `tests/int/pricing-rules-customer.int.spec.ts`.

**Where to find it:** /admin/pricing-preview (Pricing preview); pricing rules in /admin/globals/shop-extra-settings, Dynamic pricing rules

<a id="com-016"></a>
#### COM-016 · 16c Local pickup method (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16c Local pickup method (built 16 Nov 2026).** The existing Local pickup shipping method takes a list of locations (one per line: name, address, hours, instructions). Checkout shows one choice per location (the option id carries the location, so every payment method works unchanged), the order keeps the chosen place, the packing slip says "Collect from", and ticking "Ready for pickup" on the order emails the customer once (Shop switches: on by default, wording editable). Done as a tick box plus a timestamp, not a new order status, because paid-status lists in reports, numbering, stock and course access would otherwise need changing everywhere; the order stays Processing until you complete it. Code: `ecom/lib/pickup.ts`, `lib/shipping.ts`, `server/orderHooks.ts`, migration `20270316_120000_local_pickup`, test `tests/int/local-pickup.int.spec.ts`.

**Where to find it:** /admin/shop/shipping-zones (Local pickup method, one location per line); Ready for pickup tick box on /admin/shop/orders > order

<a id="com-017"></a>
#### COM-017 · 16a Carton and pallet quantity (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16a Carton and pallet quantity (built 16 Nov 2026).** Products have a Packaging group (units per carton, cartons per pallet, sell in single units, whole cartons or whole pallets, round up, minimum cartons). The cart and checkout refuse an off-size quantity with a plain message (`resolveCartLine`), or raise it to the next full carton or pallet when Round up is on (cart save hook); the storefront box steps by the carton or pallet size and shows "Sold in multiples of 12"; order lines keep the carton size, so the invoice and packing slip read "2 cartons (24 units)"; CSV import and export carry five new columns. Rules in `ecom/lib/packaging.ts`, migration `20270316_110000_product_packaging`, test `tests/int/packaging-quantity.int.spec.ts`.

**Where to find it:** /admin/shop/products > product > Packaging (cartons and pallets) group; public product page quantity box steps by carton

<a id="com-018"></a>
#### COM-018 · Quote text in other languages (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Quote text in other languages (12c leftover, built 17 Nov 2026).** 59 new UI string keys in all twelve dictionaries: `store.quote.*` for the public request form, the quote page (`QuoteView`, heading from `storeTexts()` on `/quote/[token]`, amounts and dates formatted with the visitor's locale) and the request button default text (`requestHref` takes the defaults as a third argument), and `email.quoteReceived|quoteSent|quoteExpiring|quoteBidLost` plus `email.quoteKind.*` for the customer emails. `sendQuoteEmail` and the expiry sweep look up the customer's language with `localeForRecipient` and pass it through `renderQuoteMail` to `renderEmailTemplate`, so wording the site typed in Email templates still wins. The staff emails (new request, counter-offer, accepted, declined), the account Quotes section and the admin panels stay English. No migration. Tests in `tests/int/quote-translations.int.spec.ts`.

**Where to find it:** No admin screen of its own: translations at /admin/translations; public quote page /quote/<token> and request form /request-quote

<a id="com-019"></a>
#### COM-019 · Editable quote emails (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Editable quote emails (12c leftover, built 17 Nov 2026).** The eight quote emails (received, new request, quote sent, expiring, offer not successful, counter-offer, accepted, declined) are templates `quoteReceived`, `quoteAdminNew`, `quoteSent`, `quoteExpiring`, `quoteBidLost`, `quoteCounter`, `quoteAccepted`, `quoteDeclined` in `src/features/email/templateDefaults.ts` (the built-in wording moved there; `QUOTE_EMAILS` in `quotes/logic.ts` now reads it), with wording groups and design fields in the Email templates global (`src/globals/EmailTemplates.ts`), labels and test samples, so they show in Email templates, the email designer and test sends. `renderQuoteMail` (`src/features/quotes/mail.ts`) renders them through `renderEmailTemplate` (site wording and design, built-in wording when blank or unreadable) and fills `{{message}}` with the staff note; `sendQuoteEmail`, the expiry reminder and the auction sweep all use it. Migration `20270318_230000_quote_email_templates` adds 24 text columns to `eg_email_templates`. The baseline file was edited by hand for it (the table SQL produced by running the same ALTERs in SQLite, the migration list entry and header), because `fresh-baseline-parity` fails in the cloud container before it reaches the regeneration step (an unrelated ALTER on `_eg_products_v`); a check that the baseline columns equal the generated schema columns passed. Run `REGENERATE_BASELINE=1` on a machine where that spec runs to confirm. English only. Tests in `tests/int/quote-email-templates.int.spec.ts`.

**Where to find it:** /admin/settings/communication > Email templates (quoteReceived, quoteSent, quoteExpiring, quoteBidLost and the other quote emails)

<a id="com-020"></a>
#### COM-020 · Quote link in the account portal (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Quote link in the account portal (12c leftover, built 17 Nov 2026).** Account, Bookings has a Quotes and requests section (`src/features/quotes/MyQuotes.tsx`, shown with a confirmed email while Quotes is on) listing the customer's requests by email with status, total and valid-until date. Open quote (`OpenQuote.tsx`) posts to `/api/account-quote-link`, which checks the request's email is the account's confirmed email, makes a new private token (only its hash is stored, `setTokenHash`), notes `Opened the quote from their account.` in the activity, and answers the `/quote/<token>` address. The link in the earlier email stops working, which is the price of storing only a hash. Offered only for quoted, countered and accepted requests that are not past their date (`portalCanOpen`). English only. No migration. Tests in `tests/int/quote-portal-link.int.spec.ts`.

**Where to find it:** Public /account/bookings (Quotes and requests section), Open quote link to /quote/<token>; shown while Quotes and requests is on

<a id="com-021"></a>
#### COM-021 · Files on a request (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Files on a request (12c leftover, built 17 Nov 2026).** The public request form has an Attach files box (up to 5). With files it posts multipart to `/api/quote-request`, which checks them with the Media settings allow-list and the file's own bytes (`checkQuoteFiles` in `src/features/quotes/attachments.ts`) before the request is saved, so a refused file makes no request. Files go to the media bucket under `quote-uploads/<request number>/`, a prefix the public media route refuses. No migration and no column: the request number in the key is the link, and files are listed by prefix. Admins see download links on each request (`/api/admin-quote-file`, admin only, sent as downloads with a sandbox CSP); deleting a request deletes its files. Forms feeding a request keep their own file fields on the form entry. Tests in `tests/int/quote-attachments.int.spec.ts`.

**Where to find it:** Public /request-quote (Attach files, up to 5); admin download links on /admin/quotes > request

<a id="com-022"></a>
#### COM-022 · Request buttons (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Request buttons (12c leftover, built 17 Nov 2026).** A `request-button` element (Commerce, `src/lib/elements/requestButtonDefs.ts`, renderer `src/components/blocks/elements/RequestButtonServer.tsx`, a server element in `SITE_ELEMENT_TYPES`) links to `/request-quote` for a request type (quote, offer, item), with optional button text, product number, style, size and alignment. On a product page, or in the single product template, it is about the page's product (read from the block context, name passed as `title`); a product number overrides that. It renders nothing while Quotes and requests is off. No migration. English only (the default wording is the request type name). Tests in `tests/int/request-button-element.int.spec.ts`.

**Where to find it:** Visual editor > Commerce > Request button element (on product pages or the single product template); shows only while Quotes and requests is on

<a id="com-023"></a>
#### COM-023 · Form-fed requests (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Form-fed requests (12c leftover, built 17 Nov 2026).** A form built in the visual editor can feed the quotes feature: Form settings, Send as a request (`requestFeed` in the form's `formConfig`, normalised in `src/features/forms/requestFeed.ts`, no migration). The settings pick the request type (quote, offer or item), an optional product or a choice field whose option values are product numbers, and which form fields fill name, email, phone, quantity, details, needed by and offer. After the entry is stored, `feedRequest` in `src/features/forms/submit.ts` builds the same body the public request form posts, runs it through `parseRequest` and the bid minimum and end checks, saves the request, and sends the received and admin new emails. Details default to a summary of all answers. An entry that does not make a valid request (bad email, offer under the minimum) is still saved as an entry and logged, and Quotes switched off skips the request. Tests in `tests/int/form-request-feed.int.spec.ts`.

**Where to find it:** Visual editor > form settings > Send as a request (request type, product, field mapping)

<a id="com-024"></a>
#### COM-024 · Bid mode (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Bid mode (12c leftover, built 17 Nov 2026).** A simple product has an Offers (bids) section: a minimum offer and an end time (migration `20270318_190000_bid_mode`, `bid_minimum`, `bid_ends_at` and the `version_` pair). `/api/quote-request` refuses a bid under the minimum or after the end (`bidRefusal`). When the end time passes, `runAuctionSweep` (`src/features/quotes/auctions.ts`, run inside the Reminder emails cron job) turns the highest unanswered offer (earliest wins a tie, `auctionWinner`) into a quote at its own price valid for 7 days and emails the accept link (`auctionQuote.ts`), and declines every other offer with a Your offer was not successful email (`bidLost` in `QUOTE_EMAILS`). Products with no end time are left for staff to quote or decline by hand. The offer form is still dropped on a page or product with kind bid and the product number; a built-in button on the product page is part of the open request buttons item. English only. Tests in `tests/int/quote-auctions.int.spec.ts`.

**Where to find it:** /admin/shop/products > simple product > Offers (bids) section (minimum offer, end time); bids handled at /admin/quotes

<a id="com-025"></a>
#### COM-025 · Waiting list with held places (12d leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Waiting list with held places (12d leftover, built 17 Nov 2026).** Shop switches has Waiting list mode (Emailed all at once, the old behaviour, or Offered a held place in order) and Hold hours (default 24). In order mode a restock, or any product save that frees places, offers each free place to the earliest back-in-stock sign-ups, one per person, and emails them (`src/features/ecommerce/waitingList.ts`, pure rules in `lib/waitingList.ts`). An offer sets the sign-up to Offered with a Hold until time; checkout (`resolveCartLine` through `loadPricedLines`) leaves held places free for everyone but the holder, matched on checkout email. A paid order marks the offer Purchased; the Data clean-up job ends lapsed holds (Expired) and offers the place to the next in line. Migration `20270318_210000_waiting_list` adds `waiting_list_mode` and `waiting_list_hold_hours` to `eg_shop_extra_settings` (Shop settings is at the 100-column limit) and `hold_until` to `eg_stock_subscriptions`. Needs stock tracked on the product; unmanaged stock offers one place at a time. English only. Tests in `tests/int/waiting-list.int.spec.ts` and `waiting-list-service.int.spec.ts`.

**Where to find it:** /admin/globals/shop-extra-settings: When stock returns, back-in-stock sign-ups are (Offered a held place in order) and Waiting list hold hours

<a id="com-026"></a>
#### COM-026 · Card fingerprint match for purchase limits (12d leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Card fingerprint match for purchase limits (12d leftover, built 17 Nov 2026).** When a card payment succeeds (`finalizePaidIntent`), the card's Stripe fingerprint (an opaque id, never the number) is saved against the order in `eg_purchase_card_prints` (only while Purchase limits is on; migration `20270318_230000_card_prints`, table owned by the `limits` feature). `priorPurchases` in `src/features/purchaseLimits/store.ts` then also counts orders paid with a card that any of the buyer's matched orders (same account, email or address) used, so one person behind several emails and addresses is one person. Missing table or Stripe error means no link, never a refused sale. Capture in `purchaseLimits/cardPrint.ts`. Tests in `tests/int/purchase-limit-card-match.int.spec.ts`. Orders paid before this change have no fingerprint.

**Where to find it:** No UI (backend only): src/features/purchaseLimits/store.ts (card fingerprint); rules are set at /admin/purchase-limits

<a id="com-027"></a>
#### COM-027 · Atomic last place for purchase limits (12d leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Atomic last place for purchase limits (12d leftover, built 17 Nov 2026).** The limit check used to read earlier orders and the order was written later, so two near-simultaneous orders could both pass. `checkRules` in `src/features/purchaseLimits/enforce.ts` now claims the place first (`claimPlace`, one row per cart and product in `eg_purchase_limit_claims`, kept 10 minutes, migration `20270318_240000_limit_claims`, table owned by the `limits` feature) and only then counts orders and other carts' live claims by the same person (account, email or address). Two racing orders can both be refused but never both pass; a refused order lets go of its claim; a cart with an order is counted by the order, not its claim. An abandoned payment holds the place for up to 10 minutes. Tests in `tests/int/purchase-limit-last-place-race.int.spec.ts` (interleaved callers on an in-memory SQLite, including the old race with the claim table removed).

**Where to find it:** No UI (backend only): src/features/purchaseLimits/enforce.ts (checkRules, claimPlace); rules are set at /admin/purchase-limits

<a id="com-028"></a>
#### COM-028 · Quote expiry reminder and sweep (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Quote expiry reminder and sweep (12c leftover, built 17 Nov 2026).** `runQuoteSweep` in `src/features/quotes/expiry.ts` runs inside the Reminder emails cron job (every 5 minutes): it closes quotes past their validity date and emails the customer once when an open quote ends within 3 days (`expiring` wording in `QUOTE_EMAILS`). The reminder is noted in the quote activity as `Expiry reminder sent for <date>`, so a re-sent quote with a new date is reminded again. The email has no link (only a hash of the token is stored); it points back to the earlier quote email. No migration. English only. Tests in `tests/int/quote-expiry.int.spec.ts`.

**Where to find it:** No UI (backend only): src/features/quotes/expiry.ts (runQuoteSweep, inside the Reminder emails cron job); quote status shown at /admin/quotes

<a id="com-029"></a>
#### COM-029 · Card expiry warning (13a leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Card expiry warning (13a leftover, built 17 Nov 2026).** Once a day (03:00 UTC, inside the `member-dunning` job) `sweepCardExpiry` in `src/features/billing/cardExpiry.ts` reads the card on each active membership and active or past-due shop subscription from Stripe and emails the person when it expires within 30 days, with an update-card link (Stripe billing portal, else the account page). One email per card expiry: a `Card expiry warning sent for MM/YYYY` line in the membership notes or subscription history stops repeats. English only. Tests in `tests/int/card-expiry.int.spec.ts`. Shop subscription dunning (own retry schedule and grace) is not built: shop subscriptions keep Stripe's own retries and the existing failed-payment email.

**Where to find it:** No UI (backend only): src/features/billing/cardExpiry.ts (daily member-dunning job); emails members whose card expires within 30 days

<a id="com-030"></a>
#### COM-030 · Order bump (11h leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Order bump (11h leftover, built 17 Nov 2026).** A product has an Order bump section: pick one simple product and optional wording. While that product is in the cart the checkout shows a tick-box offer (`src/components/OrderBump.tsx`, `/api/shop-order-bump`); ticking adds the product to the cart, unticking removes it. Skipped when the product is unpublished, protected, out of stock or not simple. Migration `20270318_140000_order_bump` adds `order_bump_product_id` and `order_bump_headline` (and the `version_` pair). English only.

**Where to find it:** /admin/shop/products > simple product > Order bump section (pick one product and wording); tick box shown on public /checkout

<a id="com-031"></a>
#### COM-031 · Failed payment email wording (13a leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Failed payment email wording (13a leftover, built 17 Nov 2026).** Settings, Members, Emails has a subject and body for each of the five dunning emails (failed, retry, ended, downgraded, recovered); a blank one keeps the built-in text. Migration `20270318_130000_member_dunning_emails`; `dunningWording` in `src/features/members/dunning.ts`, used by `dunningRun.ts`. The wording lives in Members settings, not the Email templates screen (that screen's global is column-limited). English only.

**Where to find it:** /admin/settings/commerce, Member settings > Emails (subject and body for the five dunning emails)

<a id="com-032"></a>
#### COM-032 · Pay a quote by card (12c leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Pay a quote by card (12c leftover, built 17 Nov 2026).** The quote page has Accept and pay by card next to the offline option. `acceptQuote` in `src/features/quotes/service.ts` makes the order (payment method stripe, pending) and a Stripe Checkout session with `orderID` in the payment intent metadata, so the existing `payment_intent.succeeded` webhook marks it paid. A failed session cancels the order and puts the quote back. Tests in `tests/int/quote-card-payment.int.spec.ts`.

**Where to find it:** Public quote page /quote/<token>: Accept and pay by card button next to the offline option

<a id="com-033"></a>
#### COM-033 · Purchase limit message and trusted customers (12d leftovers, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Purchase limit message and trusted customers (12d leftovers, built 17 Nov 2026).** Each rule has an editable refusal message (`{{product}}` merge field) and an exceptions list of emails the rule never refuses (stored normalised, one per line). Migration `20270318_110000_purchase_limit_message_exempt` adds `message` and `exempt_emails` to `eg_purchase_limit_rules`; logic in `src/features/purchaseLimits/logic.ts`, panel in `PurchaseLimitsPanel.tsx`. Tests in `tests/int/purchase-limits.int.spec.ts`.

**Where to find it:** /admin/purchase-limits > rule > refusal message ({{product}} merge field) and exempt emails list

<a id="com-034"></a>
#### COM-034 · Composite products (11b, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Composite products (11b, built 17 Nov 2026).** New product type Composite (build your own kit). In the product editor, Kit choices holds two lists: Items to choose from (step name, a simple product, price mode Included, Adds a price or Its own price less a percentage, default ticked) and optional Step rules (help text, required, fewest and most items; a step with no rule is required and takes one item). The product's Regular price (and sale schedule) is the starting price; each pick adds to it. The product page shows a picker (radio buttons for one-item steps, tick boxes for several) with a live total, defaults preselected and out-of-stock items disabled. Picks ride on the cart line as JSON in a new `composite` column on `eg_carts_items`; the cart hook, checkout pricing and `/api/shop-composites` (cart display) all price from the database, check the rules and stock (items are tallied across lines with bundles and single products) and keep only the accepted picks. The order line name lists the picks and the order keeps a snapshot of the picked items (`bundleContents`), so stock decrement, oversold flagging and per-line refund restock reuse the bundle path. Tax, shipping class and weight come from the kit product plus the picked items' weights. Only simple, published, non name-your-price products can be offered; saving checks this. No new `eg_products` columns (two child tables per live and versioned copy). Code: `src/features/ecommerce/lib/composite.ts`, `server/composite.ts`, `collections/productComposite.ts`, `src/components/CompositePicker.tsx`, `src/app/(engage)/api/shop-composites/route.ts`, migration `20270317_265000_composite_products`, tests `tests/int/shop-composite.int.spec.ts`. Left open: a Save for later move is disabled for kit lines, and a kit cannot yet be its own source of stock (the kit product itself holds none).

**Where to find it:** /admin/shop/products > product type Composite > Kit choices (Items to choose from, Step rules); public product page shows the picker

<a id="com-035"></a>
#### COM-035 · Local pickup leftovers (11c, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Local pickup leftovers (11c, built 17 Nov 2026).** Pickup hours text such as `Mon-Fri 9-5; Sat 10-2` or `Sun closed` is read by `pickupClosedOn` in `src/features/ecommerce/lib/pickup.ts`; a location closed today gets `closedToday` on its shipping option and checkout shows "(closed today)" (the order is still allowed). The order confirmation and awaiting-payment emails add a "Collect from" block (unless the template places `{{pickup_location}}`), and the account order page shows the collection point and whether it is ready. English only. Tests in `tests/int/local-pickup.int.spec.ts`.

**Where to find it:** /admin/shop/shipping-zones (Local pickup hours, for example Mon-Fri 9-5); public checkout shows (closed today); /account/orders/<id> shows collection point

<a id="com-036"></a>
#### COM-036 · Header cart dropdown (23d)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Header cart dropdown (23d):** Library > Commerce preset Header cart dropdown (compact lines and the subtotal with Checkout).

**Where to find it:** Visual editor > Library > Commerce presets > Header cart dropdown

<a id="com-037"></a>
#### COM-037 · Pre-checkout hold and countdown (23e)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Pre-checkout hold and countdown (23e):** switch Also hold stock while shoppers view their cart (Shop switches, needs the checkout hold on; migration `20270317_200000_stock_hold_in_cart`). `/api/shop-stock-hold` (cart secret required, rate limited) takes the holds when the cart page opens (`server/cartHold.ts`) and returns when the earliest ends. `CartHoldNotice` shows the ticking countdown at the top of the cart totals; screen readers hear it only at the start and end. Holds are never taken when an item is added.

**Where to find it:** /admin/globals/shop-extra-settings, Also hold stock while shoppers view their cart; countdown shown on public /cart

<a id="com-038"></a>
#### COM-038 · Bundle holds (23e)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Bundle holds (23e):** `resolveBundle` now returns the stock pool of each component (`pools`), merged into the cart's pools in `loadPricedLines`, so checkout holds a bundle's component stock.

**Where to find it:** No UI (backend only): src/features/ecommerce/server/bundles.ts (resolveBundle pools); controlled by the stock hold switches in /admin/globals/shop-extra-settings

<a id="com-039"></a>
#### COM-039 · Elements and /cart (23d)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 leftovers, third batch (cart lifetime follow-ups)_

**Elements and /cart (23d):** `MiniCartLinesPart` is the compact list the mini cart drawer now uses and is the new Cart lines (compact) element. Switch Build the cart page in the visual editor (Shop switches) makes `/cart` show the published page with slug cart (`server/cartPage.ts`); the built-in cart is `components/CartPageClient.tsx`.

**Where to find it:** Visual editor elements Cart lines (compact) and the cart page; /admin/globals/shop-extra-settings, Build the cart page in the visual editor

<a id="com-040"></a>
#### COM-040 · Cart expiry reminder (23e)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 leftovers, third batch (cart lifetime follow-ups)_

**Cart expiry reminder (23e):** Cart expiry reminder (days before) in Shop switches, off by default. `server/cartExpiry.ts` runs in the abandoned-carts job, emails a signed-out cart's owner once, only for a known address that has not unsubscribed. Column `expiry_reminder_at` on carts, migration `20270317_190000_cart_expiry_reminder`. English only.

**Where to find it:** /admin/globals/shop-extra-settings, Cart expiry reminder (days before); emails signed-out cart owners from the abandoned-carts job

<a id="com-041"></a>
#### COM-041 · Free-shipping bar per zone (23c)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 leftovers, third batch (cart lifetime follow-ups)_

**Free-shipping bar per zone (23c):** `/api/shop-free-shipping` takes country, state and postcode and uses the matching zone (`thresholdForAddress` in `lib/freeShipping.ts`); the bar reads the destination saved by the cart estimate and updates when it changes.

**Where to find it:** /admin/shop/shipping-zones (Free over amount per zone); public /cart free-shipping bar follows the destination

<a id="com-042"></a>
#### COM-042 · Empty cart suggestions (23c)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 leftovers, third batch (cart lifetime follow-ups)_

**Empty cart suggestions (23c):** an empty cart shows You might like with the newest in-stock products (`newestProducts` in `server/recommendations.ts`, `/api/shop-recommendations` with an empty list). Follows the Show product recommendations switch.

**Where to find it:** Public /cart when empty (You might like); follows Show product recommendations in /admin/globals/shop-extra-settings

<a id="com-043"></a>
#### COM-043 · 23e Cart lifetime setting (built 17 Nov 2026, part)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23e Cart lifetime setting (built 17 Nov 2026, part).** Shop switches: Cart lifetime (days), 30 by default, 1 to 365. The clean-up job deletes untouched guest carts older than that; account and paid carts stay. Migration `20270317_180000_cart_lifetime`. Code: `lib/cartLifetime.ts`, `accountCart.ts` (`sweepGuestCarts`), `cron/jobs.ts`, tests in `tests/int/guest-cart.int.spec.ts`. Still open: the expiry reminder email.

**Where to find it:** /admin/globals/shop-extra-settings, Cart lifetime (days), 30 by default

<a id="com-044"></a>
#### COM-044 · 23c Per-line stock warnings (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Per-line stock warnings (built 17 Nov 2026).** The cart lines show a red message when the quantity in the cart can no longer be bought (stock or limits), using the same catalogue rules as add to cart. The server decides again at checkout. Code: `src/components/CartParts.tsx`.

**Where to find it:** Public /cart: red message on lines that can no longer be bought; no admin setting

<a id="com-045"></a>
#### COM-045 · 23d Cart elements for the visual editor (built 17 Nov 2026, part)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23d Cart elements for the visual editor (built 17 Nov 2026, part).** The cart page is now composed from four reusable parts, each also a visual editor element in the Commerce group: Cart lines (items, quantity, remove, save for later, empty message, saved list), Cart coupon and estimate (free-shipping bar, coupon, shipping estimate, tax, note and gift message), Cart cross-sells, and Cart subtotal and checkout. The Library has a Cart layout preset that places them in two columns. Code: `src/components/CartParts.tsx`, `src/lib/elements/wave66Defs.ts`, `Wave66Server.tsx`, `libraryCommercePresets.ts`, `tests/int/wave66-elements.int.spec.ts`. No migration. The `/cart` route itself is still the app's own page built from the same parts.

**Where to find it:** Visual editor > Commerce elements: Cart lines, Cart coupon and estimate, Cart cross-sells, Cart subtotal and checkout; Library > Cart layout preset

<a id="com-046"></a>
#### COM-046 · 23c Gift wrap flat fee (built 17 Nov 2026, part)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Gift wrap flat fee (built 17 Nov 2026, part).** Shop switches: Offer gift wrap at checkout (off by default) and Gift wrap fee. Checkout shows a Gift wrap tick box with the fee; the server prices it (`giftWrap` in `priceCart`, `giftWrapCents` in `computeOrderTotals`), taxes it like shipping, adds it to the total and stores it inside the order's shipping total with "Gift wrap requested." appended to the order note, so refunds, invoices and reports need no change. Migration `20270317_160000_gift_wrap`. Code: `src/features/ecommerce/lib/giftWrap.ts`, `totals.ts`, `pricing.ts`, `stripeAdapter.ts`, `CheckoutExtras.tsx`, `tests/int/gift-wrap.int.spec.ts`. The invoice shows the fee inside the Shipping line (no separate Gift wrap row yet).

**Where to find it:** /admin/globals/shop-extra-settings, Offer gift wrap at checkout and Gift wrap fee; tick box on public /checkout

<a id="com-047"></a>
#### COM-047 · 23c Cart note and gift message (built 17 Nov 2026, part)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Cart note and gift message (built 17 Nov 2026, part).** The cart page offers an Order note and This order is a gift with a gift message, only when the Order notes checkout field is switched on (`/api/shop-checkout-fields`). They are kept in the browser and pre-filled into that field at checkout (gift message written as "Gift message: ..."), so the order carries one note; the box is cleared once an order is placed. No migration. Code: `src/components/CartNoteBox.tsx`, `src/features/ecommerce/lib/cartNote.ts`, `tests/int/cart-note.int.spec.ts`.

**Where to find it:** Public /cart: Order note and gift message box (shown when the Order notes checkout field is on)

<a id="com-048"></a>
#### COM-048 · 23c Save for later (built 17 Nov 2026, part)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Save for later (built 17 Nov 2026, part).** Each cart line (without add-on answers) has Save for later; saved lines are kept in this browser (local storage, up to 30), listed under the cart, and Move to cart goes through the normal add to cart so stock and limits are checked again. Not saved to the account, so it does not follow the shopper across devices. No migration. Code: `src/components/SavedForLater.tsx`, `src/features/ecommerce/lib/savedForLater.ts`, `tests/int/saved-for-later.int.spec.ts`.

**Where to find it:** Public /cart: Save for later on each line and the saved list (kept in the browser only)

<a id="com-049"></a>
#### COM-049 · 11e field mapping and update schedule (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**11e field mapping and update schedule (built 17 Nov 2026).** Each custom feed has optional column templates for title, description, brand, GTIN, MPN, condition, Google category, product type, colour and size (text with `{field}` placeholders read from the product, dotted paths allowed, plain text used as written, a blank result keeps the built-in value, a bad condition is ignored; a mapped title on a variation keeps its variation label), and a rebuild interval of 15 or 30 minutes, 1, 6 or 24 hours (default 1 hour) that replaces the fixed hour in the feed cache. Columns `mapping` and `refresh_minutes` on `eg_product_feeds` from migration `20270318_200000_product_feed_mapping`. Edited in Settings, Product feeds. English only. Code: `src/features/ecommerce/lib/feedMapping.ts`, `feeds.ts` (`map` hook), `server/feedRecords.ts`, `ProductFeedsPanel.tsx`, test `tests/int/product-feed-mapping.int.spec.ts`.

**Where to find it:** /admin/product-feeds > feed > field mapping (title, description, brand, GTIN and more) and rebuild interval

<a id="com-050"></a>
#### COM-050 · 11e feed cache (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**11e feed cache (built 17 Nov 2026).** Custom feed addresses now serve a stored copy instead of building the whole catalogue on every request. The built text is kept per feed and site address in table `eg_product_feed_cache` (lazy with the ecommerce feature, migration `20270317_270000_product_feed_cache`), reused for up to an hour, and cleared when any product is saved or deleted and when a feed is edited, given a new address or deleted; the next request rebuilds it (the response header `x-feed-cache` shows `hit` or `miss`). The hour limit also picks up price tier, currency rate and settings changes. Feeds over 1.5 MB are built on each request. Code: `src/features/ecommerce/server/feedCache.ts`, `feedCacheHook.ts` (Products hooks), `src/app/(frontend)/feeds/custom/[token]/route.ts`, test `tests/int/product-feed-cache.int.spec.ts`. Still open: field mapping, update schedule, Merchant API sync.

**Where to find it:** No UI (backend only): src/features/ecommerce/server/feedCache.ts (table eg_product_feed_cache); public /feeds/custom/<token> sends x-feed-cache header

<a id="com-051"></a>
#### COM-051 · Task 11d wholesale mode (17 Nov)

_Date: 17 Nov 2026_

**Task 11d wholesale mode (17 Nov):** Shop switches > Wholesale mode (off by default): role name (default `wholesale`), hide prices from signed-out visitors or from everyone but approved wholesale accounts with custom text, minimum order value for wholesale accounts, and open applications. Hidden prices are removed server side from product cards, the product page (the view sent to the browser carries no prices, JSON-LD offers and the template price merge tag are dropped), the shop archive and its filters, and the cart quote and checkout refuse with the same text (`priceCart` in `server/pricing.ts`, `signedIn` input). Products have a Wholesale only checkbox (`wholesale_only`, migration `20270318_100000_wholesale`): hidden from lists, search, related and upsells (`excludeProtected`), 404 on the product page, refused on add to cart (`cartHooks.ts`) and at checkout, and filtered from REST and GraphQL reads (`wholesaleReadClause`). Minimum order is checked at the final checkout for wholesale accounts (admins exempt). Registration: `/account/wholesale` (signed-in customers, `/api/wholesale-apply`, rate limited) stores a pending row in `eg_wholesale_applications`; the Wholesale admin screen (`/admin/wholesale`, `/api/admin-wholesale`, admin only, audited) approves, rejects or removes access, and approving creates a company account owned by the applicant. Approved accounts get the wholesale role in their customer types (`customerTypesForUser`), so existing tiers and rules by role apply. Customer tags (`eg_customer_tags`, edited on the Wholesale screen) are customer types `tag:<name>` and a pricing rule condition "Customers with a tag". The product page shows the viewer's own tiers and a Wholesale minimum order note from the lowest wholesale tier quantity. Code: `lib/wholesale.ts` (pure), `server/wholesale.ts`, `components/WholesalePanel.tsx`, `WholesaleApplyForm.tsx`, test `tests/int/wholesale.int.spec.ts`. Follow-up (17 Nov): wholesale-only now applies to bundles at checkout, approving or rejecting an application emails the applicant (`sendDecisionEmail`, template name `wholesale.decision`, plain text, the admin's optional note included), and the cart estimate shows the minimum order and how much to add (`wholesaleMinOrder` in the `/api/shop-quote` answer). Follow-up (17 Nov): with wholesale mode on and prices hidden the public product feeds publish no rows (a feed has no viewer, so prices would show to everyone); secret-address custom feeds keep their prices and still leave wholesale-only products out. The cart minimum-order notice, product page minimum note, hidden-price text (when the owner leaves it blank), apply form, account page, admin Wholesale screen, Settings link and the approve/reject emails now use the shared UI strings (`store.wholesale.*`, `portal.wholesale.*`, `wholesale.*`, `email.wholesale.*`) in all twelve languages; an owner-typed hidden-price text is shown as typed.

**Where to find it:** /admin/globals/shop-extra-settings, Wholesale mode (role, Hide prices from, minimum order, Accept wholesale applications); /admin/wholesale; product Wholesale only tick box

<a id="cat-frm"></a>
### FRM: Forms, comments and spam

<a id="frm-001"></a>
#### FRM-001 · Task 20 forms and embeds (31 Oct)

_Date: 31 Oct 2026_

**Task 20 forms and embeds (31 Oct):** #167 Form element in the visual editor (New form, Design the fields, Choose existing; the admin Forms list has no Create button; forms are not created in the admin any more; existing forms keep working); #170 form fields editor-only and RSVP verified-email; #175 pages that use a form on the Forms screens, and form fields in the page visual editor; #176 External embeds admin, first slice. Open: see Task 20.

**Where to find it:** /admin/content/forms (no Create button); forms are built in the visual editor (Form element > New form); External embeds at /admin/external-embeds

<a id="frm-002"></a>
#### FRM-002 · Task 3 forms and external embeds (PR #213, 2 Nov)

_Date: 2 Nov 2026_

**Task 3 forms and external embeds (PR #213, 2 Nov):** draft-only pages: a form used only in an unpublished draft lists its page on the Forms screens as a draft (the usage query reads drafts too). External embeds phase 2: a form can have several embeds, each a row in `eg_form_embeds` (migration 20270306_100000_form_embeds, which carries over existing embed keys, switch and websites, so placed snippets keep working) with its own hosted page at `/embed/<key>` (`/embed/forms/<key>` still works; numeric embed addresses do not), a source name, its own websites and a theme picked from the site's design: palette colour, heading or body font, site corner radius. The embed layout now uses the site's theme styles and fonts (it had its own colours). Submissions through an embed carry the source (`embedSource`, shown with the form in Forms). Decided: forms are still built only in the visual editor, whose form panel no longer holds the embed switch or websites (they are on Forms > External embeds); a post that is not through an embed is accepted from this site only; embed keys are random, not numeric ids; the shortcode keeps the form's own key. Live checks are in Task 6.

**Where to find it:** /admin/external-embeds (embeds per form with own websites and theme); /admin/content/forms lists draft-only pages that use a form

<a id="frm-003"></a>
#### FRM-003 · 26b Spam rules for forms (built 16 Nov 2026, forms only)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26b Spam rules for forms (built 16 Nov 2026, forms only).** Form settings, Spam protection has Blocked words (one per line), Link limit (0 means none) and Blocked senders (email or domain per line). A submission that hits one is discarded with the normal success message, like a honeypot hit, and logged. Code: `src/features/forms/spamRules.ts`, `submit.ts`, `FormSettings.ts`, migration `20270316_380000_spam_rules`, `tests/int/spam-rules.int.spec.ts`.

**Where to find it:** /admin/settings/content, Form settings > Spam protection (Blocked words, Link limit, Blocked senders)

<a id="frm-004"></a>
#### FRM-004 · 27b Moderation (built 16 Nov 2026, first slice)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**27b Moderation (built 16 Nov 2026, first slice).** Admin > Comments (Data and System): tabs per status with counts, bulk approve, spam, trash or delete, reply as the site team, and settings: hold every comment, hold a person's first comment, hold comments with links, or publish at once; publish signed-in people at once; blocked words (a match is marked spam); reply levels; close after days. A spam comment looks accepted to the poster. `/api/admin-comments`.

**Where to find it:** /admin/comments > status tabs, bulk approve, spam, trash and settings (hold rules, blocked words, reply depth, close after days)

<a id="frm-005"></a>
#### FRM-005 · 27a Comments on blog posts (built 16 Nov 2026, first slice)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**27a Comments on blog posts (built 16 Nov 2026, first slice).** Switch Comments on in Site Settings, under Features. Each published blog post then shows a Comments block under its content: the approved comments as threads (replies up to a depth you set, 1 to 5; too-deep replies sit beside their parent), initials avatars, a form with name, email (never shown) and comment, a hidden honeypot field, and a Reply button. Comments close a set number of days after the post was published (0 never). Code: `src/features/comments/{core,store}.ts`, `components/CommentsSection*.tsx`, `/api/comments`, tables `comments` and `comment_settings`, migration `20270316_370000_comments`, `tests/int/comments-core.int.spec.ts`.

**Where to find it:** Public: a published blog post (/blog/<slug>) > Comments block. Switch on: /admin/settings/site > Features > Comments. Moderate: /admin/comments

<a id="frm-006"></a>
#### FRM-006 · Moderator email for new comments (22, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Moderator email for new comments (22, built 17 Nov 2026, first slice).** A comment that lands Pending emails every admin address with an excerpt and a link to the Comments screen. Best effort, never blocks posting; `COMMENT_EMAILS_OFF=1` switches it off. Code: `src/features/comments/moderatorMail.ts`, `src/app/(engage)/api/comments/route.ts`, test in `tests/int/comments-core.int.spec.ts`. Live check: "Live check moderator comment email (22)".

**Where to find it:** No UI (backend only): src/features/comments/moderatorMail.ts (admin email for new pending comments; COMMENT_EMAILS_OFF=1 turns it off)

<a id="frm-007"></a>
#### FRM-007 · Spam rules on comments and reviews (21b, built 17 Nov 2026, first slice)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Spam rules on comments and reviews (21b, built 17 Nov 2026, first slice).** The site-wide form spam rules (blocked words, link limit, blocked senders in Settings > Forms) now also run on blog comments (`src/app/(engage)/api/comments/route.ts`) and product reviews (`src/features/ecommerce/reviewEndpoint.ts`). A hit is stored with the Spam status and the poster sees the normal thank-you, so a bot learns nothing. Reuses `checkSpamRules`. Live check: "Live check spam rules on comments and reviews (21b)".

**Where to find it:** /admin/settings/content > Form settings > Spam (blocked words, link limit, blocked senders); also applies to blog comments (/admin/comments) and /admin/shop/product-reviews

<a id="frm-008"></a>
#### FRM-008 · Site-wide CAPTCHA keys, test and look (Task 5, 21a, built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**Site-wide CAPTCHA keys, test and look (Task 5, 21a, built 22 Nov 2026).** Form settings > Spam protection has Test CAPTCHA keys (site key shape plus a siteverify call with a made-up token, for Turnstile or reCAPTCHA, whichever is chosen; route `admin-integration-checks` check `captcha`, `checkTurnstileKeys` in `remoteChecks.ts`) and Appearance (Visible or Invisible: Turnstile `interaction-only`; reCAPTCHA v3 is always invisible), used by forms and every sign-in/place widget. When the reCAPTCHA keys are empty in Form settings, the keys on the Integrations page are used (`getFormSettings`), so one saved pair serves everything. The places list (forms, sign-in, register, reset, magic link, comments, chat, reviews, back-in-stock, RSVP, checkout, offline orders) was built in 19a; a newsletter signup is an ordinary form, so it follows the forms setting. Migration `20270322_110000_captcha_appearance`. Live check: CAPTCHA keys and look.

**Where to find it:** /admin/settings/content > Form settings > Spam (Test CAPTCHA keys button, Appearance: Visible or Invisible); fallback reCAPTCHA keys: /admin/settings/site > Integrations

<a id="frm-009"></a>
#### FRM-010 · Task 15 34h5 Datasources: shared option lists (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34h5 (23 Nov 2026).** Shared option lists edited once. In the visual editor, Form settings > Shared lists (admins) creates a list (name, title, one `Label | value` per line). A Dropdown, Radio or Checkbox field has a new Shared list box: type the list name and its choices replace the field's own, in the form view and in the submission check, because the form is filled in when loaded (`withDatasources` in `loadForm` and the Form block). An unknown or removed list keeps the field's own choices. Lists live in `eg_datasources`, created on first use. Code: `src/features/datasources/{core,store,withDatasources}.ts`, `api/admin-datasources/route.ts`, `SharedListsCard.tsx`, `FormSettingsPanel.tsx`, `forms/elementDefs.ts`, `forms/server.ts`; tests `tests/int/datasources-34h5.int.spec.ts`. Custom fields on other collections do not use shared lists yet.

**Where to find it:** Visual editor > Form settings > Shared lists; any choice field > Shared list

#### FRM-009 · Spam folder, rule actions and Akismet (Task 5, 21b, built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 3 (Spark and Shine for every element), first batch (23 Nov 2026)_

**Spam folder, rule actions and Akismet (Task 5, 21b, built 22 Nov 2026).** Form settings > Spam protection has When a spam rule matches: Hold (default), Flag or Discard. Hold keeps a form entry that hit blocked words, the link limit, a blocked sender or Akismet with the Spam status (visitor sees the normal thanks; no emails, webhooks, requests or appointment slots); staff release it by setting its status to New in Form entries. Flag stores and delivers as normal with Possible spam at the start of the summary. Discard keeps nothing (the old behaviour). Reviews follow the same choice (hold = Spam status, flag = ordinary Pending, discard = nothing stored). New optional Akismet key (encrypted, admin only): when set, every form entry and review is also sent to Akismet; unreachable Akismet never blocks anyone. The Authentication page shows how many form entries, reviews and comments are held (total and this week). Code: `src/features/forms/{akismet,spamCounts,submit}.ts`, `reviewEndpoint.ts`, migration `20270322_100000_spam_rule_action`. Tests in `tests/int/spam-hold-akismet.int.spec.ts`. Live checks: spam rules (26b) and Akismet.

**Where to find it:** /admin/settings/content > Form settings > Spam (When a spam rule matches: Hold, Flag or Discard; Akismet API key); held entries: /admin/other/form-submissions; counts on /admin/authentication

<a id="cat-mem"></a>
### MEM: Members, companies and portal

<a id="mem-001"></a>
#### MEM-001 · Task 6 portal search, slice 1 (#152)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 6 portal search, slice 1 (#152):** search on /account finds orders, site pages and products. Live check in Task 6.

**Where to find it:** Public: /account > search box (orders, site pages, products)

<a id="mem-002"></a>
#### MEM-002 · Task 5 portal search, later slices (PR #191, 1 Nov)

_Date: 1 Nov 2026_

**Task 5 portal search, later slices (PR #191, 1 Nov):** own orders by number, bookings, subscriptions (authenticated `/api/account-search`), settings fields that link to their own anchors on the profile page, and English synonyms shared with site search (`src/features/search/synonyms.ts`). Six new strings in all 12 dictionaries; no migration. Decided: synonyms are English only; site live search uses the same synonyms (`src/features/search/synonyms.ts`). Live check in Task 6.

**Where to find it:** Public: /account > search box (own orders by number, bookings, subscriptions, setting links); site search /search uses the same English synonyms

<a id="mem-003"></a>
#### MEM-003 · Task 5 portal review (PR #216, 2 Nov)

_Date: 2 Nov 2026_

**Task 5 portal review (PR #216, 2 Nov):** account read-through: the order link, bookings heading and empty state (an unconfirmed address now says why), reorder failure message, a confirmation before removing an address, autocomplete on address fields, alert role for errors, a loading state for signed-in screens, translated privacy titles; the Asticore SaaS placeholder removed. Passkey decision: new Security setting "A passkey that verified the user skips the authenticator-app code", **off by default** (migration `20270308_100000_passkey_skip_two_factor`). Correction to the old note: user-verified passkeys already skipped the code; they now do so only when this is on. RSVP decision: keep the email match; bookings and the privacy export show only for a confirmed address, and a customer can now ask for the confirmation link (it was never sent when verification is off). Ratchet: `tests/int/type-ratchet.int.spec.ts` against `tests/int/type-ratchet-baseline.json` (any 249 to 167, eslint-disable 107 to 86). Checks: tsc, eslint, related vitest (passkeys, verification, RSVP, privacy, roles, pages tree, strings, fresh-install); cookie-consent SEO cases time out at 5 s under load and pass with a longer timeout. Matt's checks are in Task 6.

**Where to find it:** Public: /account (order link, bookings heading, address confirmation). Security setting: passkey skips the authenticator-app code, off by default: /admin/settings/security

<a id="mem-004"></a>
#### MEM-004 · Task 14 member groups and companies (9 Nov)

_Date: 9 Nov 2026_

**Task 14 member groups and companies (9 Nov):** companies already existed as organisations (members, teams, roles, invitations, per-document "visible to company"); added company-admin control over who inside the company reads each page, post, product or event: new permission `content:manage` (owners and admins have it, custom roles can carry it), table `eg_content_org_grants` (migration `20270313_100000_org_content_grants`, baseline regenerated, fresh-install specs extended), grants name members or teams and narrow only: no grants means every member (previous behaviour); owners, admins and `content:manage` holders always read; grants are dropped when a member leaves, a team is deleted or the company is deleted; the gate fails closed. Account company page has a Company content access section; strings in all 13 dictionaries. Customer types and API categories read a member's companies through `listOrgsForUser`. Files and downloads moved to open Task 14 (media is served public today). Live check in Task 20.

**Where to find it:** Public: /account/organizations/[id] > Company content access (per-page grants); permission content:manage at /admin/roles

<a id="mem-005"></a>
#### MEM-005 · 18j Organisation access helper (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**18j Organisation access helper (built 16 Nov 2026).** `src/features/organizations/access.ts` is the one place to ask which companies and teams a person is in and whether they may see a record: `loadOrgAccess(d1, userId)` (two small queries; unknown person or failed lookup gives no access), `mayAccessRecord(access, { organizationId, teamId, ownerUserId })` (true, false, or null for an unscoped record so the caller applies its own rule), `orgScopeClause(orgColumn, teamColumn, access, { ownerColumn, includeUnscoped })` for SQL lists, plus `isOrgMember`, `isOrgManager`, `sharesOrg`. Rules: the owner of a record, owners and admins of its company, members of its team (or any member when it names no team). For use by the shop (orders), forms (submissions), approval (requests) and the taskboard (tasks): add nullable `organization_id` and `team_id` columns on that table, then AND the clause into the list query and call `mayAccessRecord` on single reads. Wiring each of those lists is Task 15 and Task 10. Test: `tests/int/org-access-helper.int.spec.ts` (real SQL through node:sqlite). No migration.

**Where to find it:** No UI (backend only): src/features/organizations/access.ts (access helper used by shop, forms, approvals and taskboard)

<a id="mem-006"></a>
#### MEM-006 · 18a Dunning and retry for failed membership payments (built 16 Nov 2026; card-expiring warning and live Stripe

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**18a Dunning and retry for failed membership payments (built 16 Nov 2026; card-expiring warning and live Stripe test still open).** Settings, Members, Billing has three new settings: retry days (default `1,3,5,7`, days after the first failure), grace days (default 10, access kept) and what happens at the end (end the membership, or move to the free tier, which is the default tier in Registration). A failed renewal (`invoice.payment_failed`) now starts a run on the membership (started, attempts, next retry, access-until, all shown read-only): the member keeps access through the grace period (`grantsAccess` reads it), gets a failed-payment email with an update-card link (the Stripe billing portal when it is set up, otherwise the account page), and the hourly `member-dunning` job retries the open invoice on each retry day and emails again. When the grace period ends still unpaid the membership ends or moves to the free tier, the Stripe subscription is cancelled (the id is dropped first so the cancel webhook cannot undo a downgrade) and the member is told. A paid invoice or an active subscription clears the run and sends one thanks email. Each step is added to the membership's internal notes as a log. Settings, Past due members lists the chase with Retry card now and End now. The schedule is pure and tested by moving a clock through retries to the end. Code: `src/features/members/{dunning,dunningRun,webhooks,entitlement,settings}.ts`, `PastDuePanel.tsx`, `/api/admin-member-dunning`, cron job `member-dunning`, migration `20270316_210000_member_dunning`, `tests/int/member-dunning.int.spec.ts`.

**Where to find it:** /admin/settings/commerce > Member settings > Billing (retry days, grace days, end action); run list with Retry card now and End now at /admin/past-due-members

<a id="mem-007"></a>
#### MEM-007 · Task 22c company theming and portal layout (16 Nov)

_Date: 16 Nov 2026_

**Task 22c company theming and portal layout (16 Nov):** a company (organisation) sets its own logo (existing field), colours (main, accent, background, text), heading and body font (fixed safe stacks) and the order and visibility of the sections on its portal page; applies to every member of that company only, scoped to `.org-portal`, never the site theme. Data model decision: stored inside the organisation's own `metadata` JSON under `branding` and `layout`, so no table or migration; every value is validated on write and again on read (`src/features/organizations/branding.ts`), a free-form metadata edit keeps those keys. Owners and admins with `organization:update` use the Details section (`BrandingForm`); a site administrator overrides any company from /admin/security/organizations (`adminSaveOrganizationBranding`, works with customer organisations off, audited). Details can never be hidden. Texts in 13 languages. Tests: `tests/int/organization-branding.int.spec.ts`, 22c block in `tests/int/organizations.int.spec.ts`. Left out: a company-level admin-panel layout (the admin panel is for site staff; the company's dashboard is its portal page, which is what this configures), uploaded custom fonts, and locking a company out of changing its look.

**Where to find it:** Public: /account/organizations/[id] > Details (company colours, fonts, portal section order); site admin override: /admin/security/organizations

<a id="mem-008"></a>
#### MEM-008 · Task 22a ownership transfer and delegation (16 Nov)

_Date: 16 Nov 2026_

**Task 22a ownership transfer and delegation (16 Nov):** accounts here are companies (organisations). Transfer is now two steps: the owner picks a member (`requestOwnershipTransfer`), the member gets an email with a single-use link valid 7 days (`/account/transfer/[token]`, only a SHA-256 is stored), and the roles swap (new owner first, old owner becomes admin) only when that member, signed in as the named account, accepts; the offer can be declined or cancelled, a newer request replaces an older one, and nothing swaps if either person left meanwhile. Delegation: a real member lets another existing account act for them in one company for chosen rights and 1 hour to 90 days (`createDelegation`); rights are limited to what the delegator holds now and never include membership, role, delete or transfer rights (`DELEGABLE_ACTIONS`), a delegate cannot delegate or leave, and it dies on expiry, revoke (delegator, delegate or an owner) or when the delegator leaves. The delegate sees the company in their list with an "acting for" banner, every change they make is audited as `organization.delegate-action` with whose rights were used. Tables `eg_org_transfers` and `eg_org_delegations` (migration `20270316_420000_org_transfer_delegation`, baseline regenerated); code in `src/features/organizations/service.ts`, `store.ts`, `actions.ts`, `OrganizationScreens.tsx`; tests in the 22a block of `tests/int/organizations.int.spec.ts`. Left out: delegation across a person's own account outside companies (sign in as is still admin only), email to the delegate when access is granted, and a site-administrator view of all delegations.

**Where to find it:** Public: /account/organizations/[id] (ownership transfer and delegation); accept a transfer via the emailed link /account/transfer/[token]

<a id="mem-009"></a>
#### MEM-009 · Task 22a (now 17a) ownership transfer and delegation (16 Nov)

_Date: 16 Nov 2026_

**Task 22a (now 17a) ownership transfer and delegation (16 Nov):** accounts here are companies (organisations). Transfer is two steps: the owner picks a member (`requestOwnershipTransfer`), the member gets an email with a single-use link valid 7 days (`/account/transfer/[token]`, only a SHA-256 is stored), and the roles swap (new owner first, old owner becomes admin) only when that member, signed in as the named account, accepts; the offer can be declined or cancelled, a newer request replaces an older one, and nothing swaps if either person left meanwhile. Delegation: a real member lets another existing account act for them in one company for chosen rights and 1 hour to 90 days (`createDelegation`); rights are limited to what the delegator holds now and never include membership, role, delete or transfer rights (`DELEGABLE_ACTIONS`), a delegate cannot delegate or leave, and it ends on expiry, revoke (delegator, delegate or an owner) or when the delegator leaves. The delegate sees the company in their list with an "acting for" banner, and every change they make is audited as `organization.delegate-action` with whose rights were used. Tables `eg_org_transfers` and `eg_org_delegations` (migration `20270316_420000_org_transfer_delegation`, baseline regenerated); code in `src/features/organizations/` (`service.ts`, `store.ts`, `actions.ts`, `OrganizationScreens.tsx`); tests in the 22a block of `tests/int/organizations.int.spec.ts`. Left out: email to the delegate when access is granted, a site-administrator view of all delegations, and delegation of a person's own account outside companies (sign in as is still admin only).

**Where to find it:** Public: /account/organizations/[id] (ownership transfer and delegation); accept a transfer via the emailed link /account/transfer/[token]

<a id="mem-010"></a>
#### MEM-010 · Member past-due banner (13a leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Member past-due banner (13a leftover, built 17 Nov 2026).** `src/features/accounts/components/PastDueBanner.tsx`, shown inside `AccountShell`, tells a member whose membership is past due that the payment failed and when access ends. English only.

**Where to find it:** Public: member account pages (/account) when the membership is past due: payment-failed notice with the date access ends

<a id="mem-011"></a>
#### MEM-011 · 23c Saved for later follows the account (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)_

**23c Saved for later follows the account (built 17 Nov 2026).** For a signed-in shopper `POST /api/shop-saved` merges the browser's saved lines into the account list (the same product and variation adds quantities, like the guest cart merge on sign-in) and returns the merged list; explicit changes (save, move back, delete) send `replace` so a delete stays deleted. Signed out it only uses the browser list. Table `eg_saved_cart_lines` (migration `20270317_170000_saved_cart_lines`), removed by the privacy erase. Code: `src/features/ecommerce/server/savedLines.ts`, `src/app/(engage)/api/shop-saved/route.ts`, `src/components/SavedForLater.tsx`, `tests/int/saved-for-later.int.spec.ts`.

**Where to find it:** Public: /cart > Save for later (signed-in shoppers keep the list on their account)

<a id="cat-med"></a>
### MED: Media and files

<a id="med-001"></a>
#### MED-001 · Task 12b media formats and admin progress bar (PR #202, 1 Nov)

_Date: 1 Nov 2026_

**Task 12b media formats and admin progress bar (PR #202, 1 Nov):** picture output format (follow the WebP and AVIF switches by default, Original, JPEG, WebP, AVIF; JPEG XL kept as it is because Cloudflare cannot write it) and video output format (Original, MP4, WebM), each overridable per file. Block images use the delivery URL (block media resolved in ElementWithMedia). Video links (`video/link`) added from the gallery with a title and a poster; the Video element picks an upload or a link. Optimise on videos converts to MP4 through Cloudflare Stream in steps, only with a Stream account ID and token (WebM is not made by Stream and is kept). Admin progress bar on link clicks, submits and data requests. Lazy-loaded tag editor, visual editor field panel and pages tree. Theme fonts stay on jsDelivr (self-host option later). Matt's steps are in Task 6.

**Where to find it:** /admin/settings/content > Media settings > Optimisation (output format for pictures and videos); per-file override on /admin/content/media

<a id="med-002"></a>
#### MED-002 · Known limits sweep: Media, Import and export, Fonts, Speed (PR #207, 1 Nov)

_Date: 1 Nov 2026_

**Known limits sweep: Media, Import and export, Fonts, Speed (PR #207, 1 Nov):** 16 fixed: new media types (ico, heic, bmp, tiff, ogg, m4a, json, rtf, ods; JSON and RTF are downloads only); uploads over 25 MB as R2 multipart; names starting with original are served; transparent pictures become WebP instead of JPEG; ODS read as a spreadsheet; settings and template imports count streamed bytes; shop customers exportable (admin only); picture details matched by id then file name, and settings remap picture ids; fonts kept on a settings import when their files are on the site; font files of removed fonts deleted from R2 after the save; Fontsource files pinned to the version recorded at install; font subsets chosen (latin, latin-ext, cyrillic, greek, vietnamese); Google stylesheets ask only for offered weights; Speed option to self-host the built-in theme fonts; image block srcset. Permanent: SVG (no sanitiser in deps); old .xls; re-optimising keeps a picture's file name so links work; Stream makes MP4 only, JPEG XL and WebM choices keep the file, video links are URLs; the Worker reads a request into memory once; imported admin users stay editors unless allowed; font files are not in exports; customers are not recreated on import. Moved to tasks: relation fields (Task 1), JS bundle (Task 4), gallery and card srcset (Task 5).

**Where to find it:** /admin/settings/content > Media settings (Uploads: file types, SVG; Optimisation); /admin/settings/speed (self-host theme fonts); /admin/settings-transfer (imports)

<a id="med-003"></a>
#### MED-003 · Task 5 srcset and account colours (PR #208, 1 Nov)

_Date: 1 Nov 2026_

**Task 5 srcset and account colours (PR #208, 1 Nov):** gallery, image gallery, carousel, card, team member and image box pictures get a srcset from the ElementWithMedia candidates and a sizes attribute (no extra reads; the image block already had one). Account and portal search colours use theme roles (surface, text, error, success), so they follow the dark theme; the mobile nav scrim fades to the theme background. TODO/FIXME: none left in `src/` (nothing to clear). Decided: sizes are column-share estimates (phone full width, desktop 50vw for card top, 25vw left or right, 50vw image box, 280px team photo). Logo strip keeps one URL (fixed height, no sizes yet). Permanent: none. Live check in Task 6.

**Where to find it:** Public site: gallery, image gallery, carousel, card, team member and image box pictures (srcset automatic, no setting); no admin spot

<a id="med-004"></a>
#### MED-004 · Known limits: SVG, Openverse hosts, RSVP guest details (PR #210, 2 Nov)

_Date: 2 Nov 2026_

**Known limits: SVG, Openverse hosts, RSVP guest details (PR #210, 2 Nov):** 3 fixed: SVG uploads behind Allow SVG uploads (off by default), each file cleaned on upload against an in-repo allow-list (scripts, event attributes, foreignObject, outside links and url(), style imports and non-picture data addresses removed; DOCTYPE, entities and processing instructions refused) and served sandboxed with nosniff; the Openverse picture host list is editable in Media settings, defaulting to the built-in list; a View guest details permission: Event RSVPs read now gives the RSVP counts (no names, emails or CSV), and View guest details adds the rows and export (editors keep it, viewers and custom roles do not by default). Permanent: a customer sees only RSVPs under their own verified address; check-in keeps its own guard. Live checks in Task 6.

**Where to find it:** /admin/settings/content > Media settings > Uploads (Allow SVG uploads, off by default); Openverse hosts in Media settings; View guest details permission: /admin/roles

<a id="med-005"></a>
#### MED-005 · 29g Previews, renditions, import, quotas (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**29g Previews, renditions, import, quotas (built 16 Nov 2026).** File page: inline players for video and audio and an inline sandboxed PDF preview; video tiles in the Media grid show the first frame. Asset manager, Rendition presets: named size, fit (scale-down, contain, cover, crop, pad) and format (auto, jpeg, png, webp, avif); each picture's page lists them under Download as, served by `/api/admin-media-rendition` through the Cloudflare Images binding (501 with a plain message when the account has none; nothing is stored). Import a file (`/api/admin-media-import`): an https address or a Google Drive link to one file shared as Anyone with the link; never http, credentials, odd ports or local and private hosts; redirects followed by hand and checked at every hop; size capped by the upload limit; then stored like an upload (type check, folder access and defaults from 29a, quota, duplicate check, rights default licence, activity). Activity log now also records upload by whom, import, replace (when a version is kept), and downloads by zip, rendition and share link. Storage section: totals by kind and the largest folders; site limit (MB) is now enforced on upload and import, plus per role and per company limits (stored as JSON on the settings row, use counted from uploads by the people in that role or company). Code: `src/features/dam/{importUrl,renditions,quota,quotaGuard}.ts`, `store.ts` (renditions, totals, quota use), `AssetManagerPanel.tsx`, `DamAssetPanel.tsx`, `MediaGalleryGrid.tsx`, `admin-media-rendition`, `admin-media-import`, `admin-media-dam`, `media-share/[token]`, migration `20270316_440000_media_quotas` (`quotas_json`), `tests/int/dam-previews-import-quota.int.spec.ts`.

**Where to find it:** /admin/content/media > file page (inline video, audio and PDF previews; Download as rendition presets); storage limits on /admin/asset-manager

<a id="med-006"></a>
#### MED-006 · 29c Search and filters (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Features)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**29c Search and filters (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Features).** Settings, Media search (`/admin/media-search`, anyone who can read media; an Advanced search link sits beside the Media page's search box): one form searches words (every word must match in the file name, alt text, caption, credit, folder, custom details, camera data or the words inside a document), type (pictures, video, audio, documents), folder (and sub-folders), collection, tag (and its sub-tags, when Media tags is on), added date range, size, minimum width and height, shape (landscape, portrait, square), status, licence state (expired, expiring soon, embargoed, any problem) and each searchable custom detail; sort by newest, oldest, name or size; 48 per page. Saved searches (Save this search, Run, Delete) and smart collections (Make a smart collection): a collection that has no fixed members and fills itself from its search whenever it is opened from the Collection filter on the Media page; files cannot be added to one by hand. Words inside documents: on upload (and Read it from the file, which also works in bulk through the API) the text of a .docx and of a PDF with plain or Flate-compressed text is read, up to 20,000 characters, and stored after a marker in the file's search text so editing its details never loses it. Every value is a bound SQL parameter. Code: `src/features/dam/{search,textExtract}.ts`, `store.ts` (`runSearch`, `smartCollectionIds`, saved searches), `MediaSearchPanel.tsx`, `src/admin/views/MediaSearchView.tsx`, `/api/admin-media-dam?search=1`, `tests/int/dam-search.int.spec.ts`, `tests/int/dam-search-db.int.spec.ts` (runs the SQL on an emulated D1).

**29f Private files, share links and zip (built).** Files and folders can be made private (single file, bulk, or a folder rule that new uploads inherit). A private file's public address returns the same not-found to anyone without media read access, with no-store headers. Share links (`/api/media-share/<token>`) cover a file or a collection, with expiry, optional password, and a download limit counted atomically; only a hash of the token is stored and the link is shown once. The share page lists files, offers single downloads, previews (uncounted, only for links without a password) and a zip (max 100 files / 100 MB); files whose rights are expired or unapproved are left out. Access check fails open to public if the tables are missing. Code: `src/features/dam/{access,share,zip}.ts`, `store.ts`, `src/app/(engage)/api/media-share/[token]/route.ts`, `src/localapi/rest.ts` (`handleGetMediaFile`), `DamAssetPanel.tsx`, `AssetManagerPanel.tsx`, `MediaGalleryGrid.tsx`, `tests/int/dam-private.int.spec.ts`.

**Where to find it:** /admin/media-search (Advanced search link on /admin/content/media); switch on at /admin/settings/site > Features > Asset manager

<a id="med-007"></a>
#### MED-007 · 29d Versions and safe delete (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Fea

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**29d Versions and safe delete (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Features).** Every Replace from a file's page keeps the file being replaced as a version (stored under `versions/<id>/...`, never served by the public file route), newest few kept (Settings, Asset manager, Previous versions kept, default 5, 0 turns it off). A file's Asset manager panel lists versions with date, size and pixel size, Compare (earlier version and current side by side, pictures), Restore (the current file becomes a version first, so a restore can be undone) and Delete. Deleting a file that is in use through the media collection (the edit page, the REST API) is refused with the places listed when Warn before deleting is on; a new `beforeDelete` collection hook in `src/localapi/operations.ts` makes that possible (a throwing hook refuses the delete). The panel offers Replace everywhere (every page, post, product, setting and so on that uses the file is pointed at another file, only the changed fields are written) and Delete anyway (passes `context.allowUsedDelete`). Deleting a file removes its asset record, collection links, versions and stored version objects. Code: `src/features/dam/{versions,versionsIo,safeDelete,replaceEverywhere}.ts`, `store.ts`, `src/collections/Media.ts` hooks, `admin-media-replace/[id]/route.ts`, `admin-media-dam` actions `restoreVersion`, `deleteVersion`, `replaceEverywhere`, `deleteMedia`, `tests/int/dam-versions.int.spec.ts`, `localapi-operations.int.spec.ts`.

**Where to find it:** /admin/content/media > file page > Asset manager panel (Versions, Compare, Restore, Delete, Replace everywhere); versions kept on /admin/asset-manager

<a id="med-008"></a>
#### MED-008 · 29b and 29e Asset manager, first slice (built 16 Nov 2026; switch on under Site Settings, Features, Asset mana

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**29b and 29e Asset manager, first slice (built 16 Nov 2026; switch on under Site Settings, Features, Asset manager).** One feature key `dam` owns every table for Task 29 (migration `20270316_390000_dam`: `media_assets`, `media_folders`, `media_collections`, `media_collection_items`, `media_meta_fields`, `media_versions`, `media_shares`, `media_activity`, `media_saved_searches`, `media_renditions`, `media_dam_settings`), so later parts of Task 29 add no schema. The media collection is untouched: per-file details live in `eg_media_assets`. **Rights and status:** each file's page has an Asset manager panel with status (draft, in review, approved, archived), licence type and terms, credit, usage notes, territory, release note, licence start and expiry and embargo date. A file with no row counts as approved with no rights. An expired, embargoed, not yet started or archived file (and, if Require approval is on, any file not approved) is flagged on its page and left out of the visual editor media picker (`/api/admin-media-dam?unusable=1`). Only an admin can approve; anyone with media access can send for review. Bulk Set status on the Media page. **Collections:** a file can be in many; create, rename and delete under Settings, Asset manager (`/admin/asset-manager`), tick them on the file's page, bulk Add to collection or Remove from collection on the Media page, and a Collection filter that combines with folder and tag. **Custom metadata:** the admin defines fields (text, select, date, number, link) with required, searchable and applies-to (images, video, audio, documents); values are validated and stored with a search text. **Camera data:** on JPEG upload the EXIF block is read (camera, lens, date taken, exposure, creator, copyright, description, GPS) and stored searchable; GPS is dropped unless Do not keep GPS is switched off; Read it from the file does existing photos. **Duplicates (part of 29d):** every upload is hashed (SHA-256 of the bytes sent); the same bytes again are reported in the upload reply (`duplicateOf`) and, if set to Refuse, rejected with 409. **Report and settings:** expired and soon-to-expire licences on the Asset manager page, activity log per file, settings for warning days, versions kept, delete warning and storage limit (the last three are stored, used by later parts). Code: `src/features/dam/{rights,metaFields,exif,hash,store,onUpload}.ts`, `DamAssetPanel.tsx`, `AssetManagerPanel.tsx`, `src/admin/views/AssetManagerView.tsx`, `/api/admin-media-dam`, hooks in `admin-media-upload`, `MediaGalleryView.tsx`, `MediaGalleryGrid.tsx`, `MediaPicker.tsx`, `tests/int/dam-logic.int.spec.ts`.

**Where to find it:** /admin/settings/site > Features > Asset manager (switch on); then /admin/asset-manager and /admin/content/media > file page > Asset manager panel

<a id="med-009"></a>
#### MED-009 · 19b Media tags and sub-tags (built 16 Nov 2026; switch on under Site Settings, Features, Media tags)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**19b Media tags and sub-tags (built 16 Nov 2026; switch on under Site Settings, Features, Media tags).** A tree of tags (parent and child) each with a colour. Tag manager at Settings, Media tags (`/admin/media-tags`): add, edit (rename, recolour, move inside another tag; a tag cannot go inside itself or repeat a name beside its siblings), delete (sub-tags move up a level, files are untouched), file counts per tag and with sub-tags. On the Media page: select files, pick a tag, Add tag or Remove tag (bulk), and a Tag filter beside the folder filter; filtering by a parent tag shows files with any of its sub-tags, and it combines with the folder filter. CSV: Download tags CSV (`tag,color`, nested as `Parent > Child`) and Download files CSV (`filename,tags` with several tags joined by `;`), and paste or choose a file to import either; import only adds, never removes, and files are matched by filename. Tags survive export and import. Code: `src/features/mediaTags/{logic,store}.ts`, `MediaTagsPanel.tsx`, `src/admin/views/MediaTagsView.tsx`, `/api/admin-media-tags`, `MediaGalleryView.tsx` and `MediaGalleryGrid.tsx`, migration `20270316_230000_media_tags` (feature key `mediatags`, tables `media_tags`, `media_tag_links`), `tests/int/media-tags.int.spec.ts`.

**Where to find it:** /admin/media-tags (tag tree, CSV import and export); /admin/content/media (select files, Add tag, Tag filter); switch on at /admin/settings/site > Features > Media tags

<a id="med-010"></a>
#### MED-010 · 19a Media tree view (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**19a Media tree view (built 16 Nov 2026).** The media page has a left-hand collapsible folder tree (above the gallery on narrow screens): "All files" plus nested folders with file counts, the current folder highlighted, a breadcrumb, and tree keys (Up and Down, Right to open, Left to close or go to the parent, Enter to show, F2 rename, Delete remove). Drag files from the gallery (the selected ones, or just the one you grab) onto a folder, or drag a folder onto another folder or onto "All files" to move it with everything inside. New, Rename and Delete folder buttons: delete never removes files, they move up one level. Only the `folder` text on each file changes, so file addresses and links stay valid; renames use exact prefix tests at a slash, so `a` never touches `ab` or `a_b`. No new table, so no migration. Code: `src/features/media/folderTree.ts` (pure), `/api/admin-media-folders` (GET counts, POST rename, move, delete), `src/views/media/MediaFolderTree.tsx`, `MediaGalleryView.tsx`, `MediaGalleryGrid.tsx` (drag source), `tests/int/media-folder-tree.int.spec.ts`.

**Where to find it:** /admin/content/media > left folder tree (All files and folders; drag files or folders; New, Rename, Delete folder)

<a id="cat-i18n"></a>
### I18N: Languages and translations

<a id="i18n-001"></a>
#### I18N-001 · Task 3 languages (28 Oct)

_Date: 28 Oct 2026_

**Task 3 languages (28 Oct):** #35 routing; #36 translation overlay on 11 routes; #37 SEO (hreflang, canonical, sitemap, og:locale); #38 Translations page, reviewers and workflow; #39 publish rule; #40 builder language and translate panel; #41 machine translation (Google, DeepL, AI) with monthly limit; #42 machine drafts; #43 block text; #44 portal auto-language; #45 one row per page; #46 per-user admin language; #47 to #51 admin batches and portal strings in 12 languages; #52 admin labels; #53 and #55 to #113 builder, storefront, email and admin text; #115 to #121 and #134 admin leftovers.

**Where to find it:** /admin/settings/site > Language settings; translation overview at /admin/translations

<a id="i18n-002"></a>
#### I18N-002 · Task 3 languages, locale links (#54 merged 30 Oct)

_Date: 30 Oct 2026_

**Task 3 languages, locale links (#54 merged 30 Oct):** locale-prefixed links, rich-text links and translated slugs per locale (#59 and #139 folded in). Only its live check remains (Task 6).

**Where to find it:** Public: locale-prefixed URLs and translated slugs (languages on /admin/settings/site > Language settings; page slugs on /admin/content/pages)

<a id="i18n-003"></a>
#### I18N-003 · Task 3 and 4 leftovers (31 Oct, PR #181)

_Date: 31 Oct 2026_

**Task 3 and 4 leftovers (31 Oct, PR #181):** about 50 hard-coded admin aria-labels (fonts manager, email designer, theme styles, cookie consent, results tabs, shop settings, layout controls, ListView Trash link, ConditionsField) now read the reference table in all 12 dictionaries. Meta and TikTok pixel fields get their own labels per group (`label.field.metaPixel.*`, `label.field.tiktokPixel.*`). Left: template-literal aria-labels (Task 3).

**Where to find it:** Admin screens only (screen-reader labels, no setting); strings in src/features/uiStrings/dictionaries/

<a id="i18n-004"></a>
#### I18N-004 · Task 3 languages closed (PR #186, 31 Oct)

_Date: 31 Oct 2026_

**Task 3 languages closed (PR #186, 31 Oct):** the template-literal admin aria labels (ArrayField, PagesTree, theme styles, email designer, approval workflow steps) and the shop revenue chart text now read parameterised keys in the reference table (`aria.*`, `chart.*`, `theme.contrastAgainst`) in all 12 dictionaries. Decided by Matt: the portal is not part of the translation workflow; SubscriptionOfferBox and the header, footer and menu locale on portal paths stay English. Left: the chart period words (day, week, month) stay English.

**Where to find it:** Admin screens only (screen-reader labels, no setting); strings in src/features/uiStrings/dictionaries/; portal stays English

<a id="i18n-005"></a>
#### I18N-005 · Tasks 5 and 6, 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Tasks 5 and 6, 15 Nov 2026, PR pending: regions, language and domain audit in `the Regions audit appendix of `docs/remaining-work.md``; gaps are Tasks 41 and 42.

**Where to find it:** No UI (docs/process only)

<a id="i18n-006"></a>
#### I18N-006 · Task 3 (part), 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Task 3 (part), 15 Nov 2026, PR pending: 150 English-only admin strings translated into the twelve other languages. Left: promo badge field labels, template library text, ut/api/apiBuilder strings.

**Where to find it:** Admin screens only (150 translated labels, no setting); strings in src/features/uiStrings/dictionaries/

<a id="i18n-007"></a>
#### I18N-007 · 21k Languages (built 16 Nov 2026, the switcher style; the translations table already existed; language-specifi

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21k Languages (built 16 Nov 2026, the switcher style; the translations table already existed; language-specific merge tags are not built).** Language switcher element: Show (own-language name, short code, flag and name, flag only), Layout (row or list), Hover effect (underline, background, none) and Align. No placement option: it is placed only in the visual editor and in header templates, as before. Flags come from the region of the code (en-AU is Australia) or a usual country for the language, are hidden from screen readers, and the language name stays as the accessible label and tooltip. The old look is the default. The Translations overview (`TranslationsOverview.tsx`, `translationOverview.ts`) already lists every item with one status per language and filters by type, language and status, so no change there. Code: `src/features/multilingual/switcherStyle.ts` (pure), `Wave65Server.tsx`, `wave65Defs.ts`, `wave65.css`, `tests/int/switcher-style.int.spec.ts`. No migration.

**Where to find it:** Visual editor (/admin/visual-editor/...) > Language switcher element: Show, Layout, Hover effect, Align; appears on the public site where placed

<a id="i18n-008"></a>
#### I18N-008 · Approval text in the other twelve languages (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Approval text in the other twelve languages (12e leftover, built 17 Nov 2026).** The Hand over block and history labels in the Review box, the "handed to" note in the review queue, and the section and stand-in parts of the workflow editor now come from the admin string table (`approval.review.*`, `approval.queue.handedTo`, `approval.workflow.*` in `src/features/uiStrings/keys.ts` and all twelve dictionaries). Not translated: server messages (state machine errors, the review emails, history notes such as "Handed to Nia.") and the older author-route text of the workflow editor, which are English like the rest of the approval screens.

**Where to find it:** Admin approval screens: review box Hand over block, review queue 'handed to' note, workflow editor sections (strings in src/features/uiStrings/keys.ts)

<a id="i18n-009"></a>
#### I18N-009 · 16k Dropdown switcher and translation progress bars (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16k Dropdown switcher and translation progress bars (built 17 Nov 2026).** The Language switcher Layout now has As a dropdown: a native details element (no script, opens by keyboard) whose button shows the current language in the chosen Show style, with the other languages listed under it; Hover and Align apply. The Translations header shows a progress bar beside each language's approved count. Language-specific merge tags are still open. Code: `switcherStyle.ts`, `Wave65Server.tsx`, `wave65Defs.ts`, `wave65.css`, `TranslationsView.tsx`, `tests/int/switcher-style.int.spec.ts`. No migration.

**Where to find it:** Visual editor > Language switcher element > Layout: As a dropdown; translation progress bars on /admin/translations

<a id="i18n-010"></a>
#### I18N-010 · Task 3 translations

_Date: 17 Nov 2026 · Original group: Tasks 1 to 3 leftovers (17 Nov 2026)_

Task 3 translations: promo badge field labels (`label.field.promoBadges.*`; `adminFieldLabel` now ignores array row numbers in the path); 74 `ut.*`, `api.*`, `apiBuilder.*` and `dns.*` strings translated into the twelve languages; template library manifests take an optional `languages` list (default English) and the Template libraries screen says when a library has no text in the admin language (`docs/template-libraries.md`).

**Where to find it:** /admin/translations (74 strings, promo badge labels); /admin/settings/template-libraries (language note per library)

<a id="i18n-011"></a>
#### I18N-011 · Hebrew admin and portal language (20 Nov 2026)

_Date: 20 Nov 2026_

**Hebrew admin and portal language (20 Nov 2026).** `he` joins the admin interface languages (`ADMIN_UI_LOCALES`, right to left via `RTL_ADMIN_UI_LOCALES`, so `dir="rtl"` on the admin and portal), with `dictionaries/he.ts` and `public/ui-strings/he.json` (static file, same as the others, nothing bundled in the Worker). The browser's old code `iw` maps to `he`. The public site already had Hebrew as a content language with `dir="rtl"`. Translations are machine written (live check). Tests: language suites extended.

**Where to find it:** /admin/settings/my-preferences (admin language: Hebrew, right to left); public Hebrew was already a content language

<a id="i18n-012"></a>
#### I18N-012 · 41a

_Date: 22 Nov 2026 · Original group: Task 4 leftovers 41a to 41c (built 22 Nov 2026)_

41a: the Permalinks group and Blog address field labels are in the UI strings (`label.field.permalinks`, `label.field.blogBase`) in all 13 languages. Hints and save errors stay English: the SEO screen is English only for descriptions, and there is no translation path for field descriptions. Raise with Matt if he wants descriptions translated everywhere.

**Where to find it:** /admin/settings/marketing-seo > Permalinks (Blog address and Permalinks labels translated; hints stay English)

<a id="cat-aff"></a>
### AFF: Affiliates, agencies and franchising

<a id="aff-001"></a>
#### AFF-001 · 31d Linking to affiliate products (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31d Linking to affiliate products (built 16 Nov 2026).** The Buy button of an external or affiliate product now points at a cloaked short link on the site, `/go/<product id>?s=<source>` (`src/app/(frontend)/go/[id]/route.ts`): it counts the click, then 302s to the product's own address. Only published external products with an http(s) address redirect (else not found); bots and callers over 60 a minute are redirected without being counted; no-store, noindex and no-referrer headers. Clicks are counters per product, source and day in `eg_outbound_clicks` (no visitor identifier; migration `20270317_100000_outbound_clicks`, baseline regenerated). Source is the `s` value, else the page it came from on the site, else direct. The product edit page shows clicks per source for the last 30 days (`OutboundClicksField`, `GET /api/admin-outbound-clicks`). Links keep rel noopener, noreferrer, nofollow and sponsored. A disclosure line sits under the button, text `store.affiliateDisclosure` (editable as site text, all dictionaries fall back to English). Decision: cloaking is always on and the disclosure is a site text, because `eg_shop_settings` is at the 100 column limit of D1. Code: `ecommerce/outbound.ts`, `outboundShared.ts`, `storefront.ts`, `components/ProductPurchase.tsx`. Live check in Task 14.

**Where to find it:** /admin/shop/products > product edit (external or affiliate product: Buy button, clicks by source); public Buy button /go/<product id>?s=<source>; report /admin/outbound-clicks

<a id="aff-002"></a>
#### AFF-002 · 31e Easy affiliate setup, first version (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31e Easy affiliate setup, first version (built 16 Nov 2026).** Switch Affiliates on and the defaults already work (30 day cookie, last click, 10 percent, 30 days before payable, manual payouts). A public page `/affiliates` shows the commission, cookie length, program terms (your text, or a standard template) and a join form (honeypot, rate limited, duplicate email refused); Approve new sign-ups automatically is a setting (otherwise they wait as Pending). After joining, the person sees their private dashboard link on screen. Code: `src/app/(frontend)/affiliates/page.tsx`, `JoinForm.tsx`, `/api/affiliate-join`, settings in `AffiliatesPanel.tsx`.

**Where to find it:** /admin/affiliates (switch on at /admin/settings/site > Features > Affiliates); public join page /affiliates

<a id="aff-003"></a>
#### AFF-003 · 31c Affiliate dashboard, first version (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31c Affiliate dashboard, first version (built 16 Nov 2026).** Each affiliate has a private dashboard link (`/affiliates/dashboard?token=...`, 48 character token, not indexed) showing their referral link, visits, orders, waiting, payable and paid amounts and each commission. There is no sign-in for affiliates yet: copy the link from the Affiliates screen (Copy dashboard link makes one for older affiliates) and send it. Code: `src/app/(frontend)/affiliates/dashboard/page.tsx`, migration `20270316_350000_affiliate_portal`.

**Where to find it:** Public: /affiliates/dashboard?token=... (private link); copy it from /admin/affiliates > Copy dashboard link

<a id="aff-004"></a>
#### AFF-004 · 31c emails (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31c emails (built 16 Nov 2026).** Three plain-text emails to the affiliate's own address: approved (admin approves, or automatic approval on sign-up; carries link, rate and private results page), commission earned (when an attributed order is paid; amount and payable date) and payout recorded (amount and note). A switch on the Affiliates screen (on by default) turns them off. They are logged in the email log as `affiliate.approved`, `affiliate.commission`, `affiliate.payout`, need SITE_URL, never block approving, paying or an order, and are English only. Code: `src/features/affiliates/{emails,service}.ts` (`sendAffiliateEmail`), migration `20270316_420000_affiliate_emails`, `tests/int/affiliate-emails.int.spec.ts`.

**Where to find it:** /admin/affiliates (affiliate email switch, on by default); sent emails in the Email log (/admin/settings/communication > Email log)

<a id="aff-005"></a>
#### AFF-005 · 31a attribution (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31a attribution (built 16 Nov 2026).** Coupon-code attribution: each affiliate can have a coupon code (button on the Affiliates table); an order that used it and carries no link cookie is credited to that affiliate (self-referral and first-order rules still apply). UTM values from the landing are kept in a small `eg_ref_utm` cookie and stored on the commission with the attribution source (link or coupon). Consent category: a setting files the referral cookie under Necessary (default, as before) or Preferences, Analytics or Marketing; for those the visit route stores and logs nothing until the visitor has switched that category on in the cookie banner, and the capture script retries when they choose. Code: `src/features/affiliates/{core,consentGate,service,store}.ts`, `/api/affiliate-visit`, `/api/admin-affiliates` (`coupon` action), `AffiliateCapture.tsx`, migration `20270316_410000_affiliate_attribution`, tests in `tests/int/affiliates-core.int.spec.ts`.

**Where to find it:** /admin/affiliates (coupon button per affiliate; cookie consent category setting: Necessary, Preferences, Analytics, Marketing); public /?ref=<code>

<a id="aff-006"></a>
#### AFF-006 · 31e Get started checklist and share kit (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31e Get started checklist and share kit (built 16 Nov 2026).** The Affiliates page shows a five-step Get started list (choose rules, first affiliate, first visit, first commission, first payout) worked out from the data, hidden once all are done, and a Copy share kit button per affiliate that copies a ready message with their link, rate, cookie days and private dashboard link. Code: `setupSteps` and `shareKit` in `src/features/affiliates/core.ts`, `AffiliatesPanel.tsx`, `settingsConfigured` in `store.ts`, tests in `tests/int/affiliates-core.int.spec.ts`.

**Where to find it:** /admin/affiliates > Get started checklist (top) and Copy share kit per affiliate

<a id="aff-007"></a>
#### AFF-007 · 31b rules (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31b rules (built 16 Nov 2026).** On the Affiliates screen: a per-affiliate commission rate button (blank uses the program rate; used when a commission starts waiting), a Minimum payout setting (Record payout refuses below it), a first-order-only switch (a buyer's later orders through the same affiliate earn nothing; buyer email is stored on the commission), and a Download payouts as CSV link (spreadsheet-formula safe). Code: `src/features/affiliates/{commission,service,store}.ts`, `/api/admin-affiliates` (`rate` action, `?export=payouts`), migration `20270316_400000_affiliate_rules`, tests in `tests/int/affiliate-commission.int.spec.ts`.

**Where to find it:** /admin/affiliates > per-affiliate Rate button, Minimum payout, first-order-only switch, Download payouts as CSV

<a id="aff-008"></a>
#### AFF-008 · 31b Commissions and manual payouts (built 16 Nov 2026, first version)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31b Commissions and manual payouts (built 16 Nov 2026, first version).** On the Affiliates screen, set cookie days, which click counts (first or last), the default commission percent (10), and days before payable (30). When a buyer who carries an affiliate's `eg_ref` cookie creates an order, the order is attributed (not to the affiliate's own email). When it is paid (checkout, webhook or an admin moving it to Processing or Completed) a commission is worked out once on subtotal minus discounts and waits out the pending days; refunds reduce it in proportion and a full refund reverses it (a commission already paid is left for you to recover by hand). The table shows waiting, owed now and paid per affiliate, a Record payout button (you pay outside the site; it records the amount and note and marks those commissions paid), the recent commissions and the payouts log. An affiliate with commissions cannot be deleted, only suspended. Code: `src/features/affiliates/{commission,service,store}.ts`, hooks in `Orders.ts`, `OrderRefunds.ts` and `markOrderPaid` (`orders.ts`), `/api/admin-affiliates`, migration `20270316_330000_affiliate_commissions` (tables `affiliate_settings`, `affiliate_commissions`, `affiliate_payouts`), `tests/int/affiliate-commission.int.spec.ts`. The order hooks were not run against a real payment here.

**Where to find it:** /admin/affiliates > cookie days, first or last click, default commission percent, days before payable; Record payout button; commissions table

<a id="aff-009"></a>
#### AFF-009 · 31a Affiliate tracking, first slice (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**31a Affiliate tracking, first slice (built 16 Nov 2026).** Switch Affiliates on in Site Settings, under Features, then open Settings > Data and System > Affiliates (admin only). Add an affiliate (name, optional email and code; a code is made for you if left blank), approve or suspend, copy their link (`yoursite.com/?ref=code`) or delete. A visitor who arrives with a link for an active affiliate gets the first-party `eg_ref` cookie for 30 days (last click wins) and the landing is logged with the page and UTM source, medium and campaign. Crawlers and scripts are not logged, the route is rate limited and always answers ok so codes cannot be probed. English only. Code: `src/features/affiliates/{core,store}.ts`, `components/AffiliatesPanel.tsx`, `AffiliateCapture*.tsx` (mounted in the public layout), `/api/affiliate-visit`, `/api/admin-affiliates`, `src/admin/views/AffiliatesView.tsx`, feature `affiliates` (tables `affiliates`, `affiliate_visits`), migration `20270316_320000_affiliates`, `tests/int/affiliates-core.int.spec.ts`.

**Where to find it:** /admin/affiliates (switch on at /admin/settings/site > Features > Affiliates); public visit link /?ref=<code>

<a id="aff-010"></a>
#### AFF-010 · Outbound clicks report (26d, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Outbound clicks report (26d, built 17 Nov 2026).** Shop > Outbound clicks lists clicks on external and affiliate product buttons for all products over the last 30 days, by product and source. Code: `readAllClicks` in `src/features/ecommerce/outbound.ts`, `src/admin/views/OutboundClicksView.tsx`, nav entry in `navStructure.ts`. Live check: "Live check outbound clicks report (26d)".

**Where to find it:** /admin/outbound-clicks (Shop group, Outbound clicks report, last 30 days)

<a id="aff-011"></a>
#### AFF-011 · 22d Franchising, first version (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**22d Franchising, first version (built 17 Nov 2026).** Switch Franchising on in Site Settings. Admin > Franchising: add franchises (name, domain, optional owner email; one franchise per domain), pause or remove them, create the owner account (an editor limited to the franchise domain through Allowed domains, one-time password), and roll a page template out: one page per active franchise, shown only on its domain (Available on domains), with the template's blocks and section locks plus a chosen document lock (fixed layout where only text may change, fully locked, or none; unlock roles empty so only admins pass). Rolling out again updates the same pages, so head-office changes reach every franchise. The overview shows franchises, active ones and rolled-out pages. Uses the existing locks, domain scoping and Allowed domains. English only. Code: `src/features/franchising/`, `src/app/(engage)/api/admin-franchises/route.ts`, `src/admin/views/FranchisingView.tsx`, migration `20270317_120000_franchising` (tables `eg_franchises`, `eg_franchise_pages`).

**Where to find it:** /admin/franchising (switch on at /admin/settings/site > Features > Franchising)

<a id="aff-012"></a>
#### AFF-012 · 17f Client reports, PDF and logo (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17f Client reports, PDF and logo (built 17 Nov 2026).** Each report can be downloaded as a PDF: the Admin > Client reports table has a PDF link, and the report link has "Download as PDF" (`/api/client-report?token=...&format=pdf`, also with `&from=&to=`). The PDF is written without a library by the shared writer in `src/features/apiBuilder/pdf.ts`, which now takes an optional logo. The logo is the brand logo chosen under Email settings. A JPEG (grey or colour, baseline) or a plain PNG (8-bit grey or colour, not interlaced, no transparency) is drawn above the title (`src/features/clientReports/logo.ts`); a transparent, palette, WebP or SVG logo is left out of the PDF. The emailed report shows the same logo at the top (any image type the email can show) and has a "Download as PDF" link. Emails carry the link, not an attachment, because the email sender has no attachments yet. Specs in `tests/int/agency-tools.int.spec.ts`.

**Where to find it:** /admin/client-reports > PDF link per report; public /client-report/<token> > Download as PDF; logo from /admin/settings/communication (Email settings)

<a id="aff-013"></a>
#### AFF-013 · 17f Client reports, sections, dates and Google numbers (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17f Client reports, sections, dates and Google numbers (built 17 Nov 2026).** Each report now has chosen sections (sales, form entries, published pages and posts, website traffic, search, page speed; none ticked shows all, so older reports are unchanged) and the period can be fixed dates ("Fixed dates" with a start and end). Traffic comes from Google Analytics and search from Search Console, read through the stored Google connection on the server, so the client opens the link with no sign-in; each range is cached for five minutes per property and dates (`src/features/clientReports/google.ts`). Search Console dates are held back three days. When Google is not connected or no property is chosen, the report says so instead of leaving a gap. The top pages, channels and search queries show as tables on the page, in the email and in the CSV. A viewer can pick other dates on the report link (`?from=&to=`, also on the CSV link). Page speed is the average of the latest stored mobile test per page. Migration `20270318_250000_client_report_options` adds `sections`, `range_from` and `range_to` to `eg_client_reports`. Specs in `tests/int/agency-tools.int.spec.ts`.

**Where to find it:** /admin/client-reports (sections, fixed dates, Google numbers); public /client-report/<token>?from=&to=; Google connection: /admin/google-connection

<a id="aff-014"></a>
#### AFF-014 · 22f Client reports, first version (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**22f Client reports, first version (built 17 Nov 2026).** Switch Client reports on in Site Settings. Admin > Client reports: make a named report with a period (7, 30, 90 days or this month), copy its private read-only link (`/client-report/<token>`, 192-bit token, no sign-in, noindex, numbers only: orders, revenue, refunds, net, units, customers, form entries, published pages and posts; a section whose feature is off is left out), download the numbers as CSV (admin and public link), email the report now, and set a weekly or monthly email to up to ten addresses (new "Client report emails" cron job, one failed send is not retried every hour). A link can be switched off, restored or replaced with a new one. English only. Code: `src/features/clientReports/`, `src/app/(engage)/api/admin-client-reports/route.ts`, `src/app/(engage)/api/client-report/route.ts`, `src/app/(frontend)/client-report/[token]/page.tsx`, migration `20270317_110000_client_reports` (table `eg_client_reports`).

**Where to find it:** /admin/client-reports (make a report, copy its link, CSV, email now, weekly or monthly emails); public /client-report/<token>

<a id="aff-015"></a>
#### AFF-015 · 17g Agency demos leftovers (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17g Agency demos leftovers (built 17 Nov 2026).** Reset now also deletes pages, posts and products (matched by slug) and pictures added after the copy; saving the copy keeps the picture files in the media bucket under `demo-copy/<file name>` (up to 500 files of 15 MB), and reset puts back lost pictures first so the import maps picture ids by file name. The banner text on the Agency demos screen shows to visitors as a strip above every public page (Shine classes, `DemoBanner` in the frontend layout). Start a demo from a starter: creates a switched-on site template from a chosen starter and saves the copy in one step (site templates are not part of the copy, so a reset leaves them). Export as static HTML: the browser crawls the sitemap pages without sign-in, fetches style sheets, fonts and pictures, drops scripts, rewrites links relative and downloads a zip (limits: 300 pages, 1500 files, 150 MB). Code: `src/features/demos/` (`pictures.ts`, `staticExport.ts`, `components/DemoBanner.tsx`, `components/StaticExportPanel.tsx`, `service.ts`), `tests/int/agency-tools.int.spec.ts`.

**Where to find it:** /admin/demos (Start a demo from a starter, Export as static HTML, reset leftovers); demo banner shows on public pages

<a id="aff-016"></a>
#### AFF-016 · 22g Agency demos, first version (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**22g Agency demos, first version (built 17 Nov 2026).** Switch Agency demos on in Site Settings, under Features. Admin > Agency demos: Save the site as the demo copy (settings, header and footer, redirects, page templates, field groups, pages, posts, products and picture details; never users, roles, customers or keys; capped at 1.5 MB, over that it says so), Reset to the saved copy now, a reset schedule (never, hourly, daily) run by the new "Demo reset" cron job, a view-only demo account (Viewer role, limited to the current domain, one-time password shown once), and Download as an importable package (the same file Settings, Export and import reads). English only. Code: `src/features/demos/` (`core.ts`, `store.ts`, `service.ts`, `components/DemosPanel.tsx`), `src/app/(engage)/api/admin-demos/route.ts`, `src/admin/views/DemosView.tsx`, migration `20270317_100000_demos` (tables `eg_demo_settings`, `eg_demo_snapshots`), cron job in `src/features/cron/jobs.ts`, `tests/int/agency-tools.int.spec.ts`.

**Where to find it:** /admin/demos (switch on at /admin/settings/site > Features > Agency demos): save demo copy, reset schedule, demo account, download package

<a id="aff-017"></a>
#### AFF-017 · 26b payout details and 26a bot count (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26b payout details and 26a bot count (built 17 Nov 2026).** An affiliate can say how they want to be paid on their dashboard (plain text, 300 characters, saved with their private token); the owner sees it under their name on the Affiliates page and in a Payout details column of the payout CSV, then pays outside the site as before. Crawler and script hits on the visit route are still not logged as visits but are counted per day in `eg_affiliate_bot_hits`, and the Recent visits note shows the count for the last 7 days. Code: `src/app/(engage)/api/affiliate-payout-details/route.ts`, `PayoutDetailsForm.tsx`, `store.ts` (`setPayoutDetails`, `countBotHit`, `botHitsSince`), migration `20270317_200000_affiliate_payout_bots`.

**Where to find it:** /admin/affiliates (Payout details column in payout CSV; bot count in Recent visits); affiliate sets details on /affiliates/dashboard?token=...

<a id="aff-018"></a>
#### AFF-018 · 26c creatives kit (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26c creatives kit (built 17 Nov 2026).** On the Affiliates page the owner ticks up to 20 images from the media library. Each active affiliate's dashboard then shows them with a Download link and a copy-ready HTML snippet (an image linking to the affiliate's own referral link with rel sponsored nofollow; values escaped). One shared kit for everyone; pending and suspended affiliates see none; private media files stay protected by the file route. Code: `parseCreativeIds` and `bannerSnippet` in `core.ts`, `imageChoices` and `creativesByIds` in `store.ts`, `AffiliateDashboardView.tsx`, `AffiliatesPanel.tsx`, migration `20270317_190000_affiliate_creatives`, tests in `tests/int/affiliates-core.int.spec.ts`.

**Where to find it:** /admin/affiliates (creatives kit: tick up to 20 images); affiliate sees them on /affiliates/dashboard?token=...

<a id="aff-019"></a>
#### AFF-019 · 26c member portal (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26c member portal (built 17 Nov 2026).** A signed-in member with a verified email can open `/account/affiliate` and see their own affiliate dashboard. The affiliate is matched by email, so a member only sees results for their own verified address (the private-link page still works). A member who is not an affiliate sees the Join form, and the public Affiliates page links here. The dashboard body is shared in `AffiliateDashboardView.tsx`. Uses the site sign-in and email verification, so no new tables. Code: `src/app/(frontend)/account/affiliate/page.tsx`, `findByEmail` in `store.ts`.

**Where to find it:** Public: /account/affiliate (signed-in member with verified email; join form if not an affiliate)

<a id="aff-020"></a>
#### AFF-020 · 26a visit log (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26a visit log (built 17 Nov 2026).** The Affiliates page lists the newest 50 tracked visits (time, affiliate, landing page, UTM values). Crawlers are still not logged. Code: `recentVisits` in `src/features/affiliates/store.ts`, `/api/admin-affiliates`, `AffiliatesPanel.tsx`. No new tables.

**Where to find it:** /admin/affiliates (Recent visits: newest 50 tracked visits)

<a id="aff-021"></a>
#### AFF-021 · 26c reports (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26c reports (built 17 Nov 2026).** The Affiliates page shows Orders, commissioned sales and conversion (orders per visit, reversed commissions not counted) for each affiliate and a Top affiliates table (top ten by sales). No new tables. Code: `affiliateReport` in `src/features/affiliates/commission.ts`, `/api/admin-affiliates`, `AffiliatesPanel.tsx`, tests in `tests/int/affiliate-commission.int.spec.ts`.

**Where to find it:** /admin/affiliates (orders, commissioned sales and conversion per affiliate; Top affiliates table)

<a id="aff-022"></a>
#### AFF-022 · 26b product and tier rates (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26b product and tier rates (built 17 Nov 2026).** The commission is now worked out line by line: the order discount is shared across lines in proportion to their value, a product with its own rate (Affiliates > Product rates, a product picker) earns that rate, other lines earn the program rate or the sales tier rate, and an affiliate's own rate beats both. Sales tiers are one per line ("sales in dollars, rate percent") in the settings; an affiliate's commissioned sales so far (waiting and paid) pick the tier. The blended percent is stored unrounded so refunds still reduce the commission in proportion. Code: `commissionForLines`, `parseTiers`, `tierRate` in `src/features/affiliates/commission.ts`, `service.ts`, `store.ts` (`eg_affiliate_product_rates`), migration `20270317_180000_affiliate_rates`, tests in `tests/int/affiliate-commission.int.spec.ts`.

**Where to find it:** /admin/affiliates > Product rates; sales tiers in the Affiliates settings on the same screen

<a id="aff-023"></a>
#### AFF-023 · 26b category (tag) commission rules (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26b category (tag) commission rules (built 17 Nov 2026).** Choice: the shop already groups products with Product tags (a many-to-many on products; the old Digital/Physical `category` select is only a type flag), so category rates use tags. Affiliates screen has Tag rates (table `eg_affiliate_tag_rates`, migration `20270317_220000_affiliate_tag_rates`). Precedence per order line: the affiliate's own rate, the product's rate, the highest rate among the product's tags (`highestTagRate`, tag lookup in `productTagMap` reads `eg_products_rels`), then the tier or program rate.

**Where to find it:** /admin/affiliates > Tag rates

<a id="aff-024"></a>
#### AFF-024 · 26b renewals and recurring commission (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26b renewals and recurring commission (built 17 Nov 2026).** Affiliates settings has Commission on subscription renewals and Stop after (months, 0 for no limit); migration `20270317_210000_affiliate_recurring`. A renewal order (made by the Stripe payment webhook, `subscriptions/webhooks.ts`, only for billing reason subscription_cycle) goes to `affiliateRenewalPaid` in `affiliates/service.ts`: it finds the affiliate who earned the buyer's first non-renewal commission (`originalCommissionForEmail`, matched by buyer email), checks they are still active and the window has not passed (`renewalWindowOpen`), stores a commission with source `renewal`, then works it out like any paid order (override, product rate, tier, waiting period, emails). Refunds work as before.

**Where to find it:** /admin/affiliates > settings > Commission on subscription renewals, Stop after (months)

<a id="aff-025"></a>
#### AFF-025 · 26c affiliate webhook events (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26c affiliate webhook events (built 17 Nov 2026).** Four new events in `webhooks/events.ts`: `affiliate.joined`, `affiliate.approved`, `affiliate.commission.earned` (the commission starts its waiting period) and `affiliate.payout.recorded`, each with an allowlist of fields (no token or payout details) and a label in all thirteen languages (`webhooks.event.affiliate.*` in `uiStrings`). Emitted through `emitAffiliateEvent` and `emitAffiliateStatus` in `affiliates/service.ts` from the join route, the admin create, status and payout actions and the paid-order hook. They also work as Email > Notifications triggers' source events and appear in the generated webhook guide.

**Where to find it:** /admin/webhooks (affiliate.joined, affiliate.approved, affiliate.commission.earned, affiliate.payout.recorded events)

<a id="aff-026"></a>
#### AFF-026 · 26c translated affiliate emails and the now-payable email (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26c translated affiliate emails and the now-payable email (built 17 Nov 2026).** The approved, commission and payout emails now take their wording from the interface strings (`affiliate.email.*` in `uiStrings`, all thirteen languages) and are sent in the site's default language when Languages is on, English otherwise (`emailStrings` in `affiliates/service.ts`; affiliates have no language of their own yet). A new hourly job `affiliate-payable` (`cron/registry.ts`, `cron/jobs.ts`) emails each affiliate once when a commission's waiting period ends (`sendPayableEmails`; flag column `payable_notified`, migration `20270317_230000_affiliate_payable_email`, which marks existing past-due commissions as sent so old ones are not emailed). With a waiting period of 0 days no second email is sent. The approved email is the automatic welcome email (26e).

**Where to find it:** No UI of its own: affiliate emails sent from /admin/affiliates actions; wording in src/features/uiStrings/keys.ts (affiliate.email.*)

<a id="aff-027"></a>
#### AFF-027 · 26e Affiliates page template and the welcome email (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26e Affiliates page template and the welcome email (built 17 Nov 2026).** A new element `affiliate-join` (def `lib/elements/affiliateDefs.ts`, server renderer `components/blocks/elements/AffiliateServer.tsx`) shows the program summary, terms and join form, with switches for each part; it renders nothing while Affiliates is off. The visual editor page template Templates > Affiliates page (Shop) puts a hero, three explaining cards and that element on a page (`templatePresets.ts`; the design v1 corpus snapshot gained its entry). The automatic welcome email is the approved email, now translated (see 26c). The dashboard card idea was dropped: Matt chose the setup checklist on the Affiliates page only.

**Where to find it:** /admin/templates > Affiliates page (Shop) template; public /affiliates

<a id="aff-028"></a>
#### AFF-028 · 26a short links (vanity codes per product) (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**26a short links (vanity codes per product) (built 17 Nov 2026).** Choice: a vanity code is a short link, `/a/<code>`, that belongs to one affiliate and opens one product (or the home page) with that affiliate's referral code and any utm values attached, so the normal capture and attribution do the tracking. Affiliates screen, Short links adds and removes them; the affiliate's dashboard lists their own. Table `eg_affiliate_links` (migration `20270317_240000_affiliate_links`), route `app/(frontend)/a/[code]/route.ts`, store helpers `addShortLink`, `resolveShortLink`, `listShortLinks`. The destination is always a path on the site; a switched-off program, unknown code or draft product gives 404 or the home page.

**Where to find it:** /admin/affiliates > Short links (add, remove); affiliate lists theirs on /affiliates/dashboard?token=...; public /a/<code>

<a id="cat-seo"></a>
### SEO: SEO, blog and content

<a id="seo-001"></a>
#### SEO-001 · Task 2a blog builder, first slice (#154, 31 Oct)

_Date: 31 Oct 2026_

**Task 2a blog builder, first slice (#154, 31 Oct):** "Write with AI" on the Blog list: questions, five titles, outline edit, section-by-section writing, meta, slug, tags and category, then Create draft (saved as an unpublished post). Uses the AI plumbing and spend cap. Later slices: see Task 2a.

**Where to find it:** /admin/content/posts > Write with AI (blog list)

<a id="seo-002"></a>
#### SEO-002 · Task 2a and 2b, second PR (feat/task-2ab, commit d7510dc, 1 Nov)

_Date: 1 Nov 2026_

**Task 2a and 2b, second PR (feat/task-2ab, commit d7510dc, 1 Nov):** blog builder saved prompts and brand voice (migration 20270128), cited-only sources, per-post AI limit, featured image gallery match; template libraries Library tab filter, audit entries, version pinning; 40 new strings in all 12 dictionaries. Fresh-install order specs pass (146 tests). Live checks in Task 6.

**Where to find it:** /admin/content/posts > Write with AI (saved prompts, brand voice, sources); template libraries at /admin/settings/template-libraries

<a id="seo-003"></a>
#### SEO-003 · Task 2a and 2b, first PR (PR #189, 1 Nov)

_Date: 1 Nov 2026_

**Task 2a and 2b, first PR (PR #189, 1 Nov):** private library token with Test token button; migration 20270127 copies the old token; old "Template repositories" group, its fields and `/api/template-repos` routes removed; blog SaaS button disabled with a note; `site-templates-resolve` cold import moved to the preload; migration offsets in the fresh-install specs moved for the new migration. Decisions for the remaining 2a and 2b items are in their sections.

**Where to find it:** /admin/settings/template-libraries (private library token with Test token button)

<a id="seo-004"></a>
#### SEO-004 · Task 10 SEO (PR #200, 1 Nov)

_Date: 1 Nov 2026_

**Task 10 SEO (PR #200, 1 Nov):** cornerstone checkbox on pages and posts; the audit checks cornerstone items more strictly (900 words, keyphrase in a subheading, internal links and alt text) and filters to them. Bulk edit of SEO titles and meta descriptions in the audit list: one request, up to 100 rows, each row written as the signed-in user with access rules on. Sitemap image entries for posts (featured image), products (images, up to 10) and events (cover). Orphan check for pages (no published content links to them) and up to five link suggestions per page by title and keyphrase words; no AI, menus not counted. VideoObject for YouTube video elements (Vimeo and uploaded files get none: no thumbnail). FAQ questions on a non-FAQPage page now go in a separate FAQPage node (before, a WebPage with questions), and /faq emits FAQPage. A published post, product or event whose slug changes gets a 301 from the old path, skipped when one exists (as the tree does). Migration 20270131_100000_seo_cornerstone. Live checks in Task 6.

**Where to find it:** /admin/content/pages and /admin/content/posts (cornerstone checkbox); /admin/seo-audit (bulk SEO title and meta edit, orphan pages, link suggestions)

<a id="seo-005"></a>
#### SEO-005 · Known limits: SEO, redirects, consent, email, shop, ads (PR #205, 1 Nov)

_Date: 1 Nov 2026_

**Known limits: SEO, redirects, consent, email, shop, ads (PR #205, 1 Nov):** 17 fixed: ads in-feed and sidebar slots wired; shop coupon race closed by an atomic 30-minute hold; shop brand, tag and search filters in the database (no newest-200 scan); SES List-Unsubscribe header; suppression list admin screen; CSV quoted newlines; orphan check counts menu, header and footer; slug change redirects pages and their descendants, and courses; 404 log in Redirects > 404s; VideoObject for Vimeo and uploaded video, and a per-video upload date; consent log requests signed and rate limited; Meta and Clarity consent API on withdrawal; banner preview uses unsaved edits; banner logo from the media library; AdSense id format checked. Permanent: AdSense auto ads cannot be unloaded on client navigation; Prebid price floors need the vendor module; Cloudflare Email has no bounce feed; complaints and bounces suppress bulk mail only (deliberate); customer bulk actions and custom order statuses are not built; a YouTube playlist has no single video; GA4 or GTM without Consent Mode, TikTok and custom code are stopped only by reload. Live checks in Task 6 (Known limits sweep).

**Where to find it:** /admin/seo/redirects > 404s tab; Settings > Communication > Suppression list; /admin/seo-audit (orphan check)

<a id="seo-006"></a>
#### SEO-006 · 21l Site planner (built 16 Nov 2026, planning and draft pages; filling each page with the AI builder is not wi

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21l Site planner (built 16 Nov 2026, planning and draft pages; filling each page with the AI builder is not wired).** Switch Site planner on in Site Settings, under Features, then open Settings > Site planner. Describe the site; optionally Ask me questions first (the AI asks 5 to 7, you answer); Make the page plan returns a tree of up to 40 pages, each with a brief and a list of sections. Edit titles, move pages under other pages, change status (Idea, Briefed, Draft page made, Done), edit briefs and sections, add or remove pages, or ask the AI to Suggest more pages (merged in, repeats skipped). Create draft pages makes a draft for every page that has none, with the right parent, and never publishes. Progress counts and the next page to fill show at the top. It uses the Claude or OpenAI key and the monthly spend cap from Integrations (usage is counted as planner), and replies are checked before use (bad JSON, loops and duplicate slugs are repaired or refused). Admin only. Code: `src/features/sitePlanner/plan.ts` (pure), `prompts.ts`, `store.ts`, `SitePlannerPanel.tsx`, `SitePlannerView.tsx`, `/api/admin-site-planner`, feature `siteplanner` (table `site_plans`), migration `20270316_290000_site_planner`, `tests/int/site-planner.int.spec.ts`. The AI calls were not run against a real key here.

**Where to find it:** /admin/site-planner (switch on at /admin/settings/site > Features > Site planner)

<a id="seo-007"></a>
#### SEO-007 · 21i Coming soon and staging (built 16 Nov 2026; signup form and the visual builder for the screen are not buil

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21i Coming soon and staging (built 16 Nov 2026; signup form and the visual builder for the screen are not built).** Coming soon: under Site pages and maintenance the Screen choice is now Maintenance or Coming soon. Coming soon takes a launch date and time, shows a live countdown (days, hours, minutes, seconds) under the headline and message, and opens the site to everyone by itself when the date is reached (the page reloads at zero). Admins, the preview link, the search-engine noindex on the screen and the excluded paths work as before. Staging: set `SITE_ENV=staging` (or `STAGING=1`) in the host's environment (not in the database, so copying the live database cannot switch it on or off). On a staging site every response carries `X-Robots-Tag: noindex, nofollow, noarchive`, pages carry the matching meta tag, `/robots.txt` disallows everything, every admin page shows an orange Staging banner, email sending is refused and logged as turned off, and card payments, shop subscription checkout and membership checkout throw instead of starting. Code: `src/features/site/staging.ts`, `countdown.ts`, `LaunchCountdown.tsx`, `MaintenanceScreen.tsx`, `pagesShape.ts`, `SitePages.ts`, `StagingBanner.tsx`, middleware, robots route, `email/index.ts`, `stripeAdapter.ts`, migration `20270316_280000_coming_soon`, `tests/int/coming-soon-staging.int.spec.ts`.

**Where to find it:** /admin/settings/site > Site pages (Screen: Maintenance or Coming soon, launch date). Staging: env SITE_ENV=staging (no screen)

<a id="seo-008"></a>
#### SEO-008 · 21h SEO checks (built 16 Nov 2026, the broken link checker only)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21h SEO checks (built 16 Nov 2026, the broken link checker only).** The SEO audit screen has a Broken links section: Check links reads every link in published pages, posts, products and events, checks them in batches of 20 (this site and other sites, HEAD then GET, 6 second limit, private and local addresses refused), and lists the broken ones (404 and 410) with the pages that hold them. Links to sites that refuse the check (401, 403, 429, 5xx, no answer) are listed as unsure, not broken. For a broken link on this site you type the new address and Add redirect creates a 301. Admin only. Code: `src/features/seo/linkCheck.ts`, `linkCheckSummary.ts`, `linkCheckRun.ts`, `/api/admin-seo-links`, `BrokenLinksPanel.tsx`, `tests/int/link-check.int.spec.ts`. No migration.

**Where to find it:** /admin/seo-audit > Broken links > Check links; Add redirect makes a 301

<a id="seo-009"></a>
#### SEO-009 · 21g Structured data (built 16 Nov 2026, the extra types)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21g Structured data (built 16 Nov 2026, the extra types).** Pages and posts can now be typed Recipe, Job posting, How-to, Software application, Review, Person or Local business (posts: Recipe, How-to, Review). A "Page type facts (JSON)" box appears for those types, and the page's structured data gets the matching node as its main entity (ingredients, steps and times for a Recipe, company, place and pay for a job, rating for a review, and so on). Properties without data are left out, and a missing-facts list per type (Google's required and recommended properties) is available from `validateRich`. Event, Product offers, Course, VideoObject, FAQPage and breadcrumbs already existed. Code: `src/features/seo/richTypes.ts` (pure builders and validator), `schemaType.ts`, `pageSchema.ts`, `PageJsonLd.tsx`, `Pages.ts`, `Posts.ts`, migration `20270316_270000_schema_facts`, `tests/int/rich-schema.int.spec.ts`.

**Where to find it:** /admin/content/pages or /admin/content/posts > edit > Page type (Recipe, Job posting, How-to, Software application, Review, Person, Local business)

<a id="seo-010"></a>
#### SEO-010 · 21f Blog RSS (built 16 Nov 2026; the knowledgebase part is not built)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21f Blog RSS (built 16 Nov 2026; the knowledgebase part is not built).** `/feed.xml` lists the newest 30 published posts as RSS 2.0 (title, link, date, author, categories, excerpt), `?category=<slug>` or `?tag=<slug>` narrows it (same slugs as the archive pages), and a Summary or Full text setting plus an on or off switch live in Blog settings. Full text converts the post's rich text to simple HTML; posts built only with page blocks fall back to the excerpt. The blog page advertises the feed so readers and browsers can find it. Code: `src/features/blog/rss.ts` (pure), `src/app/(frontend)/feed.xml/route.ts`, `BlogSettings.ts`, `blog/page.tsx`, migration `20270316_260000_blog_rss`, `tests/int/blog-rss.int.spec.ts`. Comments moved to Task 27, as before.

**Where to find it:** /admin/settings/content > Blog settings (RSS on or off, Summary or Full text); public /feed.xml

<a id="seo-011"></a>
#### SEO-011 · 21d Breadcrumb styling (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21d Breadcrumb styling (built 16 Nov 2026).** New Breadcrumbs group in SEO settings: separator (/, >, a single angle, |, -, a bullet), Home label, make the current page a link, and structured data on or off. The automatic breadcrumb trail uses them, and the Auto breadcrumbs element can override the Home label and separator for one trail (block design controls cover colours and spacing as for any element). Structured data off removes the BreadcrumbList from the shop, blog, events and courses pages. The manual Breadcrumbs element gained the same separators. Code: `src/features/seo/breadcrumbSettings.ts` (pure), `src/globals/SeoSettings.ts`, `Wave63Server.tsx`, `wave63Defs.ts`, `wave36Defs.ts`, `Wave36Elements.tsx`, the four archive pages, migration `20270316_250000_breadcrumb_settings`, `tests/int/breadcrumb-settings.int.spec.ts`.

**Where to find it:** /admin/settings/marketing-seo > Breadcrumbs (separator, Home label, current page as link, structured data switch)

<a id="seo-012"></a>
#### SEO-012 · 16l Site planner extras (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**16l Site planner extras (built 17 Nov 2026).** Per plan: a brand voice (overrides the Build with AI one in every planner AI call) and a page template (Create draft pages starts every draft from its sections, with fresh row ids). Per page: Suggest sections (AI), drag to reorder (drop on the top or bottom half of another page; dropping on a page of another level moves it under that parent, never under its own child) with Move up and Move down buttons for the keyboard, and Fill this page with AI, which opens that page in the visual editor with the Build with AI dialog already open, set to whole page, with the page's brief and sections entered; Next planned page (in plan tree order, pages that have a draft) follows once the page is saved. A Plan diagram shows the tree as boxes and lines, the box edge showing the status. Plan settings are part of the saved plan JSON, so no migration. The planner and editor texts are in the shared UI strings (`planner.*`) in all 13 languages (built 23 Nov 2026). Code: `src/features/sitePlanner/plan.ts`, `prompts.ts`, `SitePlannerPanel.tsx`, `src/app/(engage)/api/admin-site-planner/route.ts`, `src/views/VisualEditor.tsx`, `visualEditor/AiBuilderPanel.tsx`, `EditorDock.tsx`, `tests/int/site-planner-extras.int.spec.ts`.

**Where to find it:** /admin/site-planner (brand voice, page template, Suggest sections, drag to reorder, Plan diagram, Fill this page with AI)

<a id="seo-013"></a>
#### SEO-013 · 16i Screen templates and staging blocks (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**16i Screen templates and staging blocks (built 17 Nov 2026).** Two new template kinds, Maintenance screen and Coming soon screen (Templates, tab Maintenance and coming soon), are built in the visual editor like any template. When one is in use it replaces the built-in screen; a template with a Template content element shows the built-in screen there. A Countdown element with a blank date counts down to the launch date set under Site pages and maintenance. A new Coming soon signup element draws the email box (the built-in Coming soon form; it draws nothing while that form is a Draft). Starters: Countdown and signup, Back soon. With no template the built-in screen is unchanged, and the kinds are optional so the coverage warnings do not list them. No migration. On a staging site (`SITE_ENV=staging`) text messages, web push and outgoing webhooks are now switched off too (a webhook delivery is logged as skipped). Code: `src/features/siteTemplates/kinds.ts`, `render.tsx` (`transformBlocks`, `replaceContent`), `starters.ts`, `src/features/site/screenContext.ts`, `screenCountdown.ts`, `src/lib/elements/comingSoonDefs.ts`, `ComingSoonServer.tsx`, `src/app/(frontend)/layout.tsx`, `sms/index.ts`, `push/send.ts`, `webhooks/delivery.ts`, `tests/int/screen-templates.int.spec.ts`.

**Where to find it:** /admin/templates > Maintenance and coming soon tab; Countdown and Coming soon signup elements in the visual editor

<a id="seo-014"></a>
#### SEO-014 · 16i Coming soon email signup (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**16i Coming soon email signup (built 17 Nov 2026).** While the coming soon screen is up, visitors see an email box. It posts to a built-in form called Coming soon (public key `comingsoon`, created the first time it is needed and published), so each signup is an ordinary form entry: it shows under the form's Submissions, goes out with its email forwarding rules, webhooks and data API. No new list or table. To turn the signup off, set the Coming soon form to Draft (it stays in place and the screen shows no box). The box is also hidden when Forms is switched off, and when a captcha is on for forms (the screen has no challenge widget, so every signup would fail). Its text (`comingSoon.signup.*`) is in the admin reference table and all 12 other dictionaries. No migration. Code: `src/features/forms/comingSoon.ts`, `comingSoonKey.ts`, `comingSoonSignup.ts`, the create hook in `configHooks.ts` (fixed key only for this form, read from the request context), `src/features/site/ComingSoonSignup.tsx`, `MaintenanceScreen.tsx`, `src/app/(frontend)/layout.tsx`, `tests/int/coming-soon-signup.int.spec.ts`.

**Where to find it:** Public: coming soon screen email box; signups are entries of the Coming soon form at /admin/content/forms (set it to Draft to hide)

<a id="seo-015"></a>
#### SEO-015 · 16d Breadcrumb schema on pages and posts follows the sitewide settings (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**16d Breadcrumb schema on pages and posts follows the sitewide settings (built 17 Nov 2026).** Ordinary pages, posts, products and events already emitted a BreadcrumbList inside the page script; it now respects the SEO settings Breadcrumbs switch (structured data off removes it) and uses the sitewide Home label. No migration. Code: `src/features/seo/PageJsonLd.tsx`, `schemaNodes.ts`; test `tests/int/seo-breadcrumb-pages-posts.int.spec.ts`.

18b and 18c leftovers: the Authentication overview has a Test button per method (provider configuration check for social providers, a test email to the signed-in admin for magic link, email code and email verification; `testAuthMethodAction`, `features/security/authMethodTest.ts`). The dashboard Sign-ins card has From and To date pickers (`?signinFrom=&signinTo=`, up to 365 days, `features/security/authRange.ts`) instead of a fixed 30 days. No migration; thirteen languages.

**Where to find it:** Public: pages and posts structured data (BreadcrumbList); follows /admin/settings/marketing-seo > Breadcrumbs

<a id="seo-016"></a>
#### SEO-016 · Blog address (16e, built 17 Nov 2026)

_Date: 17 Nov 2026_

**Blog address (16e, built 17 Nov 2026).** SEO settings > Permalinks has a Blog address (one segment, lowercase letters, digits and hyphens, 3 to 40 characters; empty or `blog` keeps `/blog`). A custom address is served from the `/blog` folder by rewrite, and a page view of `/blog` redirects (308) to it, keeping the rest of the path and query. The sitemap and the blog post, blog index, category, tag and author canonical tags use the new address at once. The save check refuses site words, the admin and sign-in addresses, and a top-level page with the same address. Migration `20270317_290000_blog_base` adds `permalinks_blog_base` to `eg_seo_settings` (baseline regenerated). Code: `src/features/seo/permalinks.ts` (pure rules), `permalinkStore.ts` (one cached D1 read, 60 seconds, dropped on save), `permalinkValidate.ts`, `src/middleware.ts`, `src/features/seo/sitemap.ts`, `src/features/siteTemplates/archiveQueries.ts`; test `tests/int/blog-base-permalinks.int.spec.ts`. Shop bases and the other leftovers are in `docs/remaining-work.md` under Task 16e.

**Where to find it:** /admin/settings/marketing-seo > Permalinks > Blog address; public /blog (or the custom address)

<a id="seo-017"></a>
#### SEO-017 · Task 16g facts editor (17 Nov 2026)

_Date: 17 Nov 2026_

**Task 16g facts editor (17 Nov 2026).** The page type facts are a form instead of JSON (`src/fields/schemaFacts/SchemaFactsField.tsx`, fields per type in `FACT_FIELDS` in `richTypes.ts`), shown for Recipe, Job posting, How-to, Software application, Review, Person and Local business, with a live list of missing required and recommended facts. The same list is a Page type facts check in the SEO analysis and the audit (`factsCheck` in `analysis/analyze.ts`). Stored value is the same JSON text, no migration. Tests in `tests/int/rich-schema.int.spec.ts`.

**Where to find it:** /admin/content/pages or /admin/content/posts > edit > Page type facts (form); missing-facts list in SEO analysis (/admin/seo-audit)

<a id="seo-018"></a>
#### SEO-018 · Task 16f feed addresses and images (17 Nov 2026)

_Date: 17 Nov 2026_

**Task 16f feed addresses and images (17 Nov 2026).** `<blog>/category/<slug>/feed` (a nested category uses its last slug) and `<blog>/tag/<slug>/feed` are rewritten in the middleware to `/feed.xml?category=` and `?tag=` (`src/features/blog/feedAddress.ts`); category and tag pages add their own feed link to the page head unless the feed is off (`feedLink.ts`); items carry the featured image as `enclosure` and `media:content`; item links use the configured blog address. No migration. Tests in `tests/int/feed-address.int.spec.ts`.

**Where to find it:** Public: /blog/category/<slug>/feed and /blog/tag/<slug>/feed; settings at /admin/settings/content > Blog settings

<a id="seo-019"></a>
#### SEO-019 · Task 16h site-wide traffic lights (17 Nov 2026)

_Date: 17 Nov 2026_

**Task 16h site-wide traffic lights (17 Nov 2026).** The SEO audit screen shows five lights above the summary for admins: robots.txt (blocks everything, no Sitemap line), sitemap (off, empty), HTTPS, canonical address (not set, trailing slash) and duplicate titles (`src/features/seo/sitewideChecks.ts`, gathered in `/api/admin-seo-audit`, shown by `SitewideLights` in `SeoAuditClient.tsx`). Computed on each visit, nothing stored, no migration. Tests in `tests/int/sitewide-checks.int.spec.ts`.

**Where to find it:** /admin/seo-audit (five traffic lights above the summary: robots.txt, sitemap, HTTPS, canonical address, duplicate titles)

<a id="seo-020"></a>
#### SEO-020 · 16p Audit columns: image file sizes and last modified (built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**16p Audit columns: image file sizes and last modified (built 22 Nov 2026).** The crawl stores the Last-Modified header and, for the first six same-site images of each page, a HEAD request's content-length (total and largest) in the existing page JSON column (no migration). The audit table has three new columns: Image files total (KB), Largest image (KB) and Last modified. External broken links stay in the broken link checker on the same screen. Code: `crawl/runner.ts` (`imageSizes`, `lastModifiedOf`), `crawl/model.ts`, `crawl/table.ts`.

**Where to find it:** /admin/seo-audit > site audit table, columns Image files total (KB), Largest image (KB), Last modified

<a id="seo-021"></a>
#### SEO-021 · 16e Visitor-facing blog links follow the blog address (built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**16e Visitor-facing blog links follow the blog address (built 22 Nov 2026).** Post list, post navigation, loop grid cards, archive cards, category, tag and author pages (post links, sub category links, breadcrumbs, pagination), blog index (pagination, collection JSON-LD), site search results and suggestions and the 404 page now build post and category links from the saved blog address (`blogPath` and `readBlogBase`, optional `blogBase` argument on `postArchiveItems`, `categoryUrl`, `categoryCrumbs`, `subCategoryLinks`, `loopItemsFromDocs`). No migration.

**Where to find it:** /admin/settings/marketing-seo > SEO settings > Permalinks > Blog address; public blog pages (/blog, post, category, tag, author, search, 404) follow it

<a id="seo-022"></a>
#### SEO-022 · 16d Manual Breadcrumbs follows the sitewide settings (built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**16d Manual Breadcrumbs follows the sitewide settings (built 22 Nov 2026).** The manual Breadcrumbs element now renders through a server wrapper (`ManualBreadcrumbsElement` in `Wave63Server.tsx`, reached from `BlockRenderer.tsx`). It takes the separator from SEO settings unless the element sets its own, relabels a first item called Home (address blank or /) with the Home label, and drops its BreadcrumbList JSON-LD when structured data is off. The editor canvas still draws the plain element.

**Where to find it:** /admin/settings/marketing-seo > SEO settings > Breadcrumbs (separator, Home label, JSON-LD); manual Breadcrumbs element in the visual editor on any page

<a id="seo-023"></a>
#### SEO-023 · Task 7 Add several pages on the Pages screen (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 7 Add several pages on the Pages screen (22 Nov 2026).** Pages list header has an Add several pages button (`src/features/bulkCreate/AddSeveralPages.tsx`, loaded in the browser only). A dialog takes one title per line, an optional shared parent page, template, status (draft, or published for users with publish permission) and, when Languages is on, the language the titles are written in (saved as that language's title translation). Show the addresses runs the same plan as Bulk create (clashes, missing parents) and lists the slugs; Create makes the pages through the signed-in user's own access rules; Undo this batch works for a day while nothing is published. It reuses `/api/admin-bulk-create` (new `options` action and `defaults` field) and the Task 11g plan and run code; tests in `tests/int/bulk-create.int.spec.ts`. Live check in Live checks.

**Where to find it:** /admin/content/pages > Add several pages button in the page list header

<a id="seo-024"></a>
#### SEO-024 · Task 6 items 16m, 16n, 16o: accessibility in the SEO review, snippets and PageSpeed checklist, site audit dash

_Date: 22 Nov 2026_

**Task 6 items 16m, 16n, 16o: accessibility in the SEO review, snippets and PageSpeed checklist, site audit dashboard (22 Nov 2026).** Migration `20270322_100000_seo_site_audit` adds `eg_seo_crawl_runs`, `eg_seo_crawl_pages`, `eg_seo_crawl_config`, `eg_seo_snippet_targets` and `eg_pagespeed_results.audits` (all in `CORE_TABLE_BASES`, baseline regenerated). 16m: `analysis/accessibility.ts` adds heading order, empty headings and image alt checks to `analyze()` (new `accessibility` list and score; the editor SEO tab shows an Accessibility analysis section; audit rows carry `findings` marked SEO or Accessibility and the audit list shows a badge); the rendered-page checks (landmarks, link and button names, labels, frame titles, duplicate ids, tabindex, aria-hidden focus, ARIA roles, lang, skip link) are in the catalogue `crawl/issues.ts` and run in the site audit and the page card; contrast, tap size and focus order come from the PageSpeed accessibility audits. 16n: `src/features/seo/snippets.ts` is a data-driven catalogue of Google's gallery (paragraph, list and table are judged from the content; the rest from JSON-LD with required and recommended properties; FAQ and How-to are markup only); the edit screen has a Snippets and page checks card (`ui/PageChecksCard.tsx`, route `/api/admin-seo-page`) that loads the live page, shows ticked types and types the page has, an Add a type menu, suggestions from the collection, target types saved per page, the Rich Results Test link and our own SEO, accessibility and technical checklist (passing and Not applicable rows stay). `pagespeed/checklist.ts` parses every audit of every category in the PageSpeed response (so new groups such as Agentic browsing appear without a rebuild), stores it on the newest result of a page and device, and the PageSpeed card shows it as the Full checklist (Pass, Warning, Fail, Check by hand, Not applicable). 16o: `src/features/seo/crawl/` crawls the sitemap plus every published page over the site's own address a few pages per step (`/api/admin-seo-crawl`, admin only; the screen loops the steps, the `seo-crawl` cron job continues and starts scheduled crawls), parses each page (`htmlFacts.ts`), judges it with about 60 checks (`issues.ts`: titles, descriptions, headings, thin and duplicate content, status codes and redirect chains, canonical, hreflang return links, images, structured data, Open Graph, mixed content, speed, size, orphans, depth, broken internal links, accessibility), keeps the last three runs and compares with the previous one. The SEO audit screen has a Site audit panel: health score, Errors, Warnings, Notices with the change, issue cards that filter, a table of 30 chooseable columns with sort, search and filters, a detail panel with fix hints and an editor link, CSV export, Mark noindex, Add 301 redirects and a schedule (off, daily, weekly; off by default). Tests: `tests/int/seo-site-audit.int.spec.ts`, fresh-install spec extended. Left open under Task 6: image file sizes and last modified as columns, external broken links in the audit table, the Pages list row overview, rings from our own checks.

**Where to find it:** /admin/content/pages > edit a page > SEO card > Accessibility analysis; site-wide: /admin/seo-audit (Accessibility badge, rendered-page checks); PageSpeed checklist on the page edit screen

<a id="seo-025"></a>
#### SEO-025 · Task 8 blog builder editable question sets (built 22 Nov 2026, was 27b)

_Date: 22 Nov 2026_

**Editable question sets.** Write with AI asks the questions of the chosen set. Admins press Edit questions to add sets, reword and give hints, reorder, mark required, add up to 8 custom free-text questions, remove or add back standard questions, name the post type or brand, and mark one set to use first. The topic question always stays and is required. Custom answers reach every prompt as extra notes and are saved with saved prompts. With no saved sets the built-in standard questions are used; Reset to the standard questions deletes the saved sets. Table `eg_blog_question_sets` (migration 20270322_100000, core table), `/api/admin-blog-builder/question-sets` (anyone who can use Write with AI reads, admins change), code in `src/features/blogBuilder/questionSets.ts`, `questionSetStore.ts`, `admin/QuestionSetEditor.tsx`, `admin/BlogWizard.tsx`; thirteen languages. Test: `tests/int/blog-builder-question-sets.int.spec.ts`. Live check in Live checks.

**Where to find it:** /admin/content/posts > Write with AI (Blog list) > Edit questions

<a id="cat-bld"></a>
### BLD: Visual builder, templates and elements

<a id="bld-001"></a>
#### BLD-001 · Waves 67-68 delivery

_Date not recorded_

**Waves 67-68 delivery:** Lottie via the embed provider; CSP frame-src allows embed, video and map hosts; React #418 hydration fixes.

**Where to find it:** Visual editor > Elements > Lottie animation, or Embed element with the Lottie provider

<a id="bld-002"></a>
#### BLD-002 · Export and assets

_Date not recorded_

**Export and assets:** Download HTML, asset collection and relinking, server template-asset insert, repo manifest refresh.

**Where to find it:** Visual editor > top bar > Import / Export > Download HTML (asset collection and relinking in the same export flow)

<a id="bld-003"></a>
#### BLD-003 · Build with AI

_Date not recorded_

**Build with AI:** Claude or OpenAI via Integrations keys; new section, whole page and edit selected modes; plan then build; refine by chat; media matching; monthly spend cap; SSE streaming.

**Where to find it:** Visual editor > Elements tab > Build with AI (needs a Claude or OpenAI key in /admin/settings/site > Integrations)

<a id="bld-004"></a>
#### BLD-004 · Editor usability

_Date not recorded_

**Editor usability:** selection breadcrumb, Checks, save status, shortcuts and first-use tour, navigator reorder, recents and favourites, style presets, inline heading editing, "/" quick-insert, upload and paste in the media picker, Global (reusable) sections, library category filter as a single dropdown.

**Where to find it:** Visual editor: Navigator and Elements tabs, Checks, keyboard shortcuts, first-use tour, "/" quick insert; reusable sections at /admin/content/reusable-sections

<a id="bld-005"></a>
#### BLD-005 · Page settings

_Date not recorded_

**Page settings:** title, slug, status, SEO title and description, social image, noindex.

**Where to find it:** Visual editor > Page settings (Finder) for title, slug, status, SEO title and description, social image, noindex

<a id="bld-006"></a>
#### BLD-006 · Templates

_Date not recorded_

**Templates:** template presets, form presets (live), shop presets, site-wide page effects, template display conditions and widgets, 9 template starters (edit screen). Site-template kinds (archive-category, archive-tag, archive-author, search-results, not-found and others) with starters, template import and export.

**Where to find it:** /admin/templates (presets, starters, site template kinds, conditions, import and export)

<a id="bld-007"></a>
#### BLD-007 · Wave 69

_Date not recorded_

**Wave 69:** `embed-code` element (third-party scripts and widgets run in a sandboxed iframe served from `/embed-frame/<hash>`, consent gated, published content only, snippet never in URL; renders where a page path exists). Elements tab one scroll with compact tiles and a Comfortable/Compact toggle. Blog tags and author displayName/slug with `/blog/tag/[slug]` and `/blog/author/[slug]` archives and sitemap; byline no longer shows email. hideNativeCursor admin toggle. Social accounts Test connection button. Page audio also on Posts. Admin menu "Posts" renamed "Blog". Duplicate breadcrumbs type fixed (template widget now `auto-breadcrumbs`).

**Where to find it:** Visual editor > Elements > Embed code; blog tags and author on /admin/content/posts; public /blog/tag/[slug] and /blog/author/[slug]

<a id="bld-008"></a>
#### BLD-008 · Wave 68 fixes

_Date not recorded_

**Wave 68 fixes:** hideNativeCursor option; fade-in on nested sections; installed fonts live in canvas; Preview-as picker always in top bar; product featured image in context; event dynamic tags and event block context; post.author falls back to business name.

**Where to find it:** /admin/settings/site > Site settings (hideNativeCursor option); visual editor top bar > Preview as picker

<a id="bld-009"></a>
#### BLD-009 · Wave 68 other

_Date not recorded_

**Wave 68 other:** per-page background audio in Page settings (pageAudio group; starts muted, plays on first interaction). Rich inline text for quote, button and list. Category archive route `/blog/category/[slug]`. Templates list screen has a starters panel and import.

**Where to find it:** Visual editor > Page settings (background audio, starts muted); /admin/templates > starters panel and import; public /blog/category/[slug]

<a id="bld-010"></a>
#### BLD-010 · Elements

_Date not recorded_

**Elements:** text, heading, list, quote, code (with highlighting), table, button, icon, image, image lightbox, image accordion, video, video playlist, audio, map, divider, html, embed (consent gated), anchor, card, gallery, image comparison, hotspots, counter, progress, star rating, countdown, chart, data view, social, breadcrumbs, toc, search box, nav-menu, pagination, notice, marquee, tooltip, content switcher, reviews, loop, site logo, form builder, business hours, slides, author box, post navigation, language switcher, add to cart, cart link, product rating.

**Where to find it:** Visual editor > Elements tab (element library: text, media, layout, interactive, commerce and other elements)

<a id="bld-011"></a>
#### BLD-011 · Section display modes

_Date not recorded_

**Section display modes:** columns, flex, tabs, accordion, carousel, grid, popup, stacked cards, horizontal scroll, sticky scroll story.

**Where to find it:** Visual editor > selected section settings (display modes: columns, flex, tabs, accordion, carousel, grid, popup, stacked cards, horizontal scroll, sticky scroll)

<a id="bld-012"></a>
#### BLD-012 · Design panel

_Date not recorded_

**Design panel:** backgrounds (colour, gradient, image, parallax, video, overlay, masks, slideshow, noise, blob), typography, spacing with units and link, border and shadow, hover and focus states, advanced (transform, position, filters, scoped CSS), effects (reveal, hover, glass, pointer, Ken Burns, animated border), visibility rules (applied in browser), theme tokens, reset and "only changed", search.

**Where to find it:** Visual editor > selected block > Design panel (backgrounds, typography, spacing, border, hover, advanced, effects, visibility rules, theme tokens)

<a id="bld-013"></a>
#### BLD-013 · Foundation

_Date not recorded_

**Foundation:** undo/redo, clipboard and duplicate, drag and drop, keyboard move, autosave, lock banner, unsaved-changes guard, device-aware editing with per-device overrides, navigator, sections with columns and inner sections, import/export, column resize, sidebar hidden while editing.

**Where to find it:** Visual editor (page edit > Edit in visual editor): undo and redo, clipboard, drag and drop, autosave, navigator, device overrides, Import / Export

<a id="bld-014"></a>
#### BLD-014 · Waves 43 to 48 (16 to 18 Oct) and waves 30 and 31

_Date: 18 Oct 2026_

**Waves 43 to 48 (16 to 18 Oct) and waves 30 and 31:** device-aware editing, undo/redo, shortcuts, context menu, structure picker, column panel; Theming global, colour resolver, repeater field, navigator, inline text editing, copy/paste style, and the colour, link, icon, range, dimensions, typography, shadow and gradient fields. All live.

**Where to find it:** Visual editor (page edit > Edit in visual editor): device-aware editing, undo and redo, context menu, column panel; Theming global at /admin/theme-styles

<a id="bld-015"></a>
#### BLD-015 · Waves 70-71 (deployed 23 Oct)

_Date: 23 Oct 2026_

**Waves 70-71 (deployed 23 Oct):** Settings > Blog switches `showAuthors`, `authorArchives` and `showTags`, all default ON; per-post `hideAuthor` checkbox; migration 20261111_100000_blog_author_tag_switches (columns added to prod D1 directly on 23 Oct; the idempotent migration will no-op later). Wave 71: admin shell hydration fix (ThemeContext and NavContext start with server-safe defaults and sync in a mount effect).

**Where to find it:** /admin/settings/content > Blog (showAuthors, authorArchives, showTags); per-post Hide author checkbox on /admin/content/posts

<a id="bld-016"></a>
#### BLD-016 · Visual editor closed 23 Oct 2026, except Task 1a

_Date: 23 Oct 2026_

**Visual editor closed 23 Oct 2026, except Task 1a:** fixed 23 Oct: embed ratio field shown only for providers that follow it; provider select uses real option groups; AI builder usage rows flagged estimated when no token counts; embed-code identical snippets verified harmless; 'Posts' renamed 'Blog' across admin; migration `20261111` registry row present in prod eg_migrations. Verified live earlier: wave 68 and 69 library UI, routes, CSP, migrations, blog-settings fields.

**Where to find it:** No UI (docs/process only)

<a id="bld-017"></a>
#### BLD-017 · Task 1a visual builder (18 to 23 Oct)

_Date: 23 Oct 2026_

**Task 1a visual builder (18 to 23 Oct):** waves 48 to 71 shipped and pushed (wave 68 embeds and social-feed, wave 69 embed-code and blog tags and authors, waves 70 and 71 blog switches); PR #2 (AI builder guide cap 17000 to 18000, 24 Oct).

**Where to find it:** No UI (docs/process only)

<a id="bld-018"></a>
#### BLD-018 · Task 2 templates (through 27 Oct)

_Date: 27 Oct 2026_

**Task 2 templates (through 27 Oct):** Theming DONE; site template kinds, resolver and 'Template content' element (waves 23, 62 to 68); conditions editor (wave 62); starters (waves 63, 68); PR #27 archive grid and pagination; PR #28 Templates dashboard, tabs and coverage panel; Preview-as and import/export (wave 67). Public pages return 200 without any template.

**Where to find it:** /admin/templates (site template kinds, Template content element, conditions, starters, Preview as, import and export)

<a id="bld-019"></a>
#### BLD-019 · Task 2b Templates hub (28 Oct)

_Date: 28 Oct 2026_

**Task 2b Templates hub (28 Oct):** PR #31 one Templates table with Suggested missing (phase 1); #32 reusable sections open in the visual builder; #33 loop templates, loop-grid and archive-filter; #34 archive filters, per-item merge tags, old list pages redirect to /admin/templates.

**Where to find it:** /admin/templates (one Templates table with Suggested missing, reusable sections, loop templates, archive filters)

<a id="bld-020"></a>
#### BLD-020 · Task 1a short links (#182, 31 Oct)

_Date: 31 Oct 2026_

**Task 1a short links (#182, 31 Oct):** vm.tiktok.com, vt.tiktok.com, pin.it and on.soundcloud.com resolve to their canonical address on save (SSRF-guarded resolver; 5 hops, 5 s), so the embed renders as an iframe. Admin route POST `/api/admin-embed-resolve` is ready. Left: editor paste field and other collections (Task 1a).

**Where to find it:** Visual editor > Embed element > paste field (TikTok, SoundCloud and Pinterest short links resolved on save)

<a id="bld-021"></a>
#### BLD-021 · Task 1a AI guide cap (#178)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 1a AI guide cap (#178):** fixes the `ai-builder-v2` guide text being over the 18000 cap (18080 failed on main). Live check in Task 6.

**Where to find it:** No UI (backend only): AI builder guide text length cap (ai-builder-v2), referenced in .github/workflows/ci.yml

<a id="bld-022"></a>
#### BLD-022 · Task 1a legacy breadcrumbs and flaky spec (#179)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 1a legacy breadcrumbs and flaky spec (#179):** saved templates with the old breadcrumbs type now render; one flaky spec fixed.

**Where to find it:** No UI (backend only): render of saved templates with the old breadcrumbs type, src/components/blocks/elements/Wave63Server.tsx

<a id="bld-023"></a>
#### BLD-023 · Task 1a leftovers (#155)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 1a leftovers (#155):** visual editor draft recovery after session expiry (unsaved tree offered back, never auto-applied); AI usage flags `ai_builder_usage.estimated` (set when the provider sends no token counts; column present since 23 Oct). Live check in Task 6.

**Where to find it:** Visual editor: draft offered back after session expiry (never auto-applied); the AI usage estimated flag is a database column with no separate screen

<a id="bld-024"></a>
#### BLD-024 · Task 2b templates hub (#153, #169, #161)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 2b templates hub (#153, #169, #161):** #153 blog post in Loop merge tags, tag and author archive routes, header and footer conditions; #169 templates consolidate (header and footer tab, audience, page picker); #161 template libraries slice 1 (Settings > Template libraries, Library tab, "Create page from this template", pictures to Media, old Integrations repo list copied across). Later slices: see Task 2b.

**Where to find it:** /admin/settings/template-libraries (Library tab, Create page from this template); /admin/templates (header and footer tab, audience, page picker)

<a id="bld-025"></a>
#### BLD-025 · Task 2 duplicate starters (#153)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 2 duplicate starters (#153):** `/admin/templates` shows one starters list (New site template and Import); site template edit screen shows only Export.

**Where to find it:** /admin/templates (one starters list with New site template and Import; site template edit screen shows Export only)

<a id="bld-026"></a>
#### BLD-026 · Task 2 template parts (#159, 31 Oct)

_Date: 31 Oct 2026_

**Task 2 template parts (#159, 31 Oct):** sidebar-left and sidebar-right templates in the Templates hub; a "Template part" element by template id (a part inside a part is dropped); domain and language conditions on header, footer and sidebar (priority, then specificity); hub "Where used" column.

**Where to find it:** /admin/templates (sidebar-left and sidebar-right templates, Where used column); visual editor > Template part element

<a id="bld-027"></a>
#### BLD-027 · Task 1a short-link coverage (PR #184, 31 Oct)

_Date: 31 Oct 2026_

**Task 1a short-link coverage (PR #184, 31 Oct):** the editor resolves a pasted or entered short link for its own provider (`POST /api/admin-embed-resolve`; silent on failure); the save-time hook covers page templates, reusable sections, site templates, products, lessons and the blog, FAQ and shop intro blocks.

**Where to find it:** Visual editor > Embed element paste field (short links resolved on save for page templates, reusable sections, products, lessons and blog, FAQ and shop intro blocks)

<a id="bld-028"></a>
#### BLD-028 · Task 2 page and section templates CLOSED 31 Oct (PR #185)

_Date: 31 Oct 2026_

**Task 2 page and section templates CLOSED 31 Oct (PR #185):** template part id is a picker of site templates (`/api/admin-site-templates`; saved numeric ids still work); Preview as has an audience choice (any visitor, guest, member) on every site template kind; archive templates (blog, shop, category, tag, author) and sidebars preview with a sample post or product. Single product add to cart already had a passing render test (no change). Live checks are in Task 6.

**Where to find it:** Visual editor > Template part element (picker of site templates); /admin/templates > site template > Preview as audience choice

<a id="bld-029"></a>
#### BLD-029 · Task 1a Visual builder CLOSED 31 Oct

_Date: 31 Oct 2026_

Task 1a Visual builder CLOSED 31 Oct: typed design emitter removed (#183, prod D1 had 0 typed rows); short-link resolver in editor paste and all block collections (#184). Decided: email designer and theme tokens stay separate models (different outputs: email HTML, site tokens). Accepted as known limits: React #418 logs once on editor load (harmless); engage-types.ts uses casts for Post.tags and User.displayName/slug; Pinterest stays link cards; Next 16 deferred to Task 4. PR #3 fresh-install specs live in Task 6.

Finished tasks (PR numbers) first, then the visual editor waves through 71.

**Where to find it:** No UI (docs/process only)

<a id="bld-030"></a>
#### BLD-030 · Task 6 clarity (PR #192, 1 Nov)

_Date: 1 Nov 2026_

**Task 6 clarity (PR #192, 1 Nov):** tree rows move focus with plain arrows, Home, End, Left and Right (Alt+Arrow still moves); Expand all and Collapse all; shared `Tooltip` (hover, keyboard and touch focus, aria-describedby) replaces about 180 intrinsic-element `title=` attributes across admin and visual editor screens, with 67 new keys translated into all 12 dictionaries; colour sweep: about 400 literal colours in 41 admin CSS files now use `--lit-*` tokens (light values identical, dark values derived: neutrals mirrored, coloured text lifted to 4.5:1); dark rules for password groups, visibility access, blog builder errors, visibility messages and pages-tree badges; base ramp fixed (light muted text 4.93:1, dark muted 5.63:1); SEO status dots get a shape as well as colour. Left on purpose: public-site CSS (blocks, storefront, consent, forms), coloured fills kept as they were, iframe titles (accessible names), two native `<option>` titles and one `<abbr>`, and one pre-existing light contrast miss (white on #f44336 danger button, 3.7:1, light values not changed). Live checks in Task 6.

**Where to find it:** /admin/content/pages tree: Expand all, Collapse all, arrow, Home and End keys; shared Tooltip on icon buttons across admin and visual editor

<a id="bld-031"></a>
#### BLD-031 · 8 Nov Task 3 Elementor gap review (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 3 Elementor gap review (PR #226, 8 Nov):** `the Elementor gap review appendix of this file`; built: custom attributes with a strict allowlist, popup idle trigger and overlay/close/animation options (never impossible to close), visibility rules for weekday, time (visitor clock) and language. Left for later: dynamic link/image sources (needs a check and scope decision), scroll-linked motion (Firefox lacks view timelines).

**Where to find it:** Visual editor > section display mode popup (idle trigger, overlay and close options); Design panel > Visibility rules (weekday, time, language)

<a id="bld-032"></a>
#### BLD-032 · 8 Nov Task 2 drag from the Elements bar (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 2 drag from the Elements bar (PR #226, 8 Nov):** root cause: the iframe pass-through flag was set in a capture-phase dragstart listener before React's setData, so dataTransfer.types was empty; now tracked in the bubble phase (`trackLibraryDrag`, `src/views/visualEditor/dropSlot.ts`).

**Where to find it:** Visual editor > Elements tab: drag an element from the Elements bar onto the canvas (iframe drag fix)

<a id="bld-033"></a>
#### BLD-033 · 8 Nov Task 1 visual editor Elementor-parity tweaks (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 1 visual editor Elementor-parity tweaks (PR #226, 8 Nov):** VE-01 to VE-15 from `the Elementor tweaks appendix of this file`: paste style guarded and device-safe, CSS id de-duplication with warning, hidden blocks faded in the editor, edit lock and overwrite check, shortcuts (Mod+S/E/I/P, Mod+Shift+C/V/H/M), context menu Edit/Navigator/Reset style, History and Revisions panel, 13 more per-device style keys, preview button, unsaved-state save buttons, Finder, padding drag handles, multi-select, text style presets in Theme styles (JSON, no migration).

**Where to find it:** Visual editor: History tab, Preview page button, right-click context menu, Mod+S/E/I/P shortcuts; text style presets at /admin/theme-styles

<a id="bld-034"></a>
#### BLD-034 · 21c Sliders (built 16 Nov 2026, extends the existing Slides element)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21c Sliders (built 16 Nov 2026, extends the existing Slides element).** Slides now take up to 10 slides, each with a background picture or video (.mp4 or .webm, muted and looped, picture shows first and for reduced motion) and an animated text layer (fade up, slide in, zoom or none). New element options: loop (off stops at the ends), arrows, dots, thumbnails under the slider, and a separate height on phones. Only the slide in view and its neighbours load their picture or video. Autoplay stays off by default and stops on hover, focus and reduced motion. Slides saved earlier look the same. `slides`, `gallery` and the hidden `image-carousel` are kept. Code: `src/lib/elements/slidesLogic.ts` (pure), `wave65Defs.ts`, `Wave65Elements.tsx`, `wave65.css`, `tests/int/slides-settings.int.spec.ts`.

**Where to find it:** Visual editor > Elements > Slides (up to 10 slides with background picture or video, text layer, loop, arrows, dots, thumbnails)

<a id="bld-035"></a>
#### BLD-035 · 21a A/B tests: suggestions and visual-editor editing (built 16 Nov 2026, partly; the on-canvas control and var

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21a A/B tests: suggestions and visual-editor editing (built 16 Nov 2026, partly; the on-canvas control and variant switch is not built).** In the visual editor (Navigator tab, under Checks) a new A/B tests panel, shown when editing a saved page and A/B testing is switched on: (1) Ideas for this page, from the page itself: a second headline for the first headings, a clearer label than Submit, Learn more or Click here, a different top picture, a simpler layout for crowded sections, each with a plain reason and the kind of effect to expect (no invented numbers); (2) Create test: pick a goal (a button selector is clicked, or a page path is visited), and the section is copied into a new section template that becomes Variant B, with a draft block test (50/50, original as control) on the page; (3) the page's tests with Edit variant (opens the variant's template in this same editor), Start, Stop and Open (the results screen, unchanged). Start refuses a test with no goal or a variant with no section. Code: `src/features/abTesting/suggestions.ts` (pure), `/api/admin-ab-quick`, `src/views/visualEditor/AbIdeasPanel.tsx`, `EditorDock.tsx`, `VisualEditor.tsx`, `tests/int/ab-suggestions.int.spec.ts`.

**Where to find it:** Visual editor > Navigator tab > Checks > A/B tests panel (when A/B testing is on): Ideas, Create test, Edit variant, Start, Stop

<a id="bld-036"></a>
#### BLD-036 · 20c Visual editor design warnings (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**20c Visual editor design warnings (built 16 Nov 2026).** The Checks panel now also flags: low text contrast when a colour is a named theme token (`var(--sh-text)` and the other Shine tokens, checked in both the light and the dark theme, so dark-mode text on a fixed light block is caught); text over a gradient background, checked against both stops; text over a picture, video or slideshow with no overlay of at least 30 percent (it cannot sample the picture, so this is an info prompt to add an overlay); the hover colours (the one you did not set falls back to the normal colour) at 4.5:1; and the keyboard focus ring colour at 3:1 against the background. Contrast messages end with a fix: Try #000000 or #ffffff text, or change the background if neither works. Unknown names (`var(--ink)`) are not checked, as before. Code: `src/views/visualEditor/designWarnings.ts`, `tests/int/editor-warnings.int.spec.ts`.

**Where to find it:** Visual editor > Navigator tab > Checks (design warnings: text contrast, gradients, picture overlays, hover and focus colours)

<a id="bld-037"></a>
#### BLD-037 · 16h Convert text to list or table in the visual editor (built 22 Nov 2026)

_Date: 22 Nov 2026 · Original group: Task 9, 28d Live review sources (built 22 Nov 2026)_

**16h Convert text to list or table in the visual editor (built 22 Nov 2026).** Right-click a Text editor block of plain, unformatted text and choose Convert to bulleted list, Convert to numbered list (two or more lines; leading bullets or numbers are stripped) or Convert to table (every line has the same cells split by `|`, a tab or `;`; the first line becomes the header). The block keeps its place and id and the change is one undo step. Code: `visualEditor/convertText.ts`, menu in `VisualEditor.tsx`, tests in `tests/int/convert-text.int.spec.ts`. No migration.

**Where to find it:** Visual editor > right-click a plain Text block > Convert to bulleted list, Convert to numbered list or Convert to table

<a id="bld-038"></a>
#### BLD-038 · Task 10 widgets batch 1: world clock, progress tracker, dark mode toggle, bigger charts (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 10 widgets batch 1: world clock, progress tracker, dark mode toggle, bigger charts (22 Nov 2026).** Three new client elements in `wave68Defs.ts` and `Wave68Elements.tsx` (styles `wave68.css`): World clock (up to 12 cities as `City | IANA zone` lines, analogue SVG or digital, 12 or 24 hour, seconds and date options, bad zones skipped), Progress tracker (steps, current step number, optional query parameter that overrides it, horizontal or vertical, `aria-current`), Dark mode toggle (switch that sets `data-theme` on the page, saves the choice in the browser, starts from the system setting). The Chart element now takes up to 100 values and accepts pasted CSV lines. Tests: `tests/int/wave68-elements.int.spec.ts`, `elements-wave48.int.spec.ts`.

**Where to find it:** Visual editor > Elements > World clock, Progress tracker, Dark mode toggle; Chart element (up to 100 values, pasted CSV lines)

<a id="bld-039"></a>
#### BLD-039 · Task 10 widgets batch 2: product images, stock, short description, meta (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 10 widgets batch 2: product images, stock, short description, meta (22 Nov 2026).** Four server elements in `wave69Defs.ts` and `Wave69Server.tsx` (gallery island in `Wave69Elements.tsx`, styles `wave69.css`) reading the product from the block context, which now also carries sku, gtin, short description, category, all pictures (up to 20), low stock level and backorders (`blockContextFrom.ts`). Product stock shows in stock, low stock with the count (product level or the element's own), out of stock or backorder. Tests: `tests/int/wave69-elements.int.spec.ts`.

**Where to find it:** Visual editor on a product template (/admin/templates) > Elements > Product images, Product stock, Product short description, Product meta

<a id="bld-040"></a>
#### BLD-040 · Task 10 widgets batch 3: sitemap and age gate (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 10 widgets batch 3: sitemap and age gate (22 Nov 2026).** Sitemap (`Wave70Server.tsx`, server): published pages as a tree by parent, depth 1 to 6, slug exclusions drop whole branches, members-only and no-index pages left out. Age gate (`Wave70Elements.tsx`, client): full-screen dialog, Yes/No buttons or date of birth with minimum age, answer remembered N days in the browser, skipped for crawler user agents, deny goes only to an https address or a same-site path, otherwise shows a message. Left from the age gate: per-country rules and a popup preset. Defs `wave70Defs.ts`, tests `tests/int/wave70-elements.int.spec.ts`.

**Where to find it:** Visual editor > Elements > Sitemap and Age gate

<a id="bld-041"></a>
#### BLD-041 · Task 10 display conditions batch 4: device, country, query parameter, cookie (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 10 display conditions batch 4: device, country, query parameter, cookie (22 Nov 2026).** Four more rules next to sign-in, role, URL, schedule, weekday, time and language (`src/lib/visibilityRules.ts`, keys `showDevices`, `showParam`, `showCookie`, `showCountry` in `blockStyle.ts`, controls in `DesignPanel.tsx`). Device: mobile under 600 px, tablet 600 to 899 px, desktop 900 and up, read from the window width. Query parameter and cookie: `name` or `name=value`, read in the browser (no cached page split). Country: the `/api/visibility-state` answer now includes the edge country code (never cached); unknown country hides the block. All rules fail closed when their value is unknown. Tests: `tests/int/visibility-rules.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design panel > Visibility rules (device, country, query parameter, cookie)

<a id="bld-042"></a>
#### BLD-042 · Task 10 chat button batch 5 (22 Nov 2026)

_Date: 22 Nov 2026_

**Task 10 chat button batch 5 (22 Nov 2026).** `chat-button` element (`Wave70Elements.tsx`, def in `wave70Defs.ts`): WhatsApp (`wa.me`, digits checked, prefilled text), Messenger (`m.me`) and Telegram (`t.me`) links built only from validated numbers or usernames, optional hours window in the visitor's own time (overnight wraps), optional floating corner button, opens in a new tab with `noopener`. Tests in `tests/int/wave70-elements.int.spec.ts`.

**Where to find it:** Visual editor > Elements > Chat button (WhatsApp, Messenger, Telegram), optional floating corner button

<a id="bld-043"></a>
#### BLD-043 · Task 15 34a Timeline element (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34a Timeline (23 Nov 2026).** The `timeline` element is now in the library (no longer hidden). Layouts vertical, alternating and horizontal (sideways scroll), per item icon, picture, link, colour and group heading, line and dot colours, Spark `spark-reveal` option, opt-in Event structured data for ISO dates. Three Examples in the presets (`timeline-vertical`, `timeline-alternating`, `timeline-horizontal`). Code: `wave36Defs.ts`, `Wave36Elements.tsx`, `wave36.css`, `templatePresets.ts`, test `tests/int/timeline-element.int.spec.ts`. Leftover: items filled from a collection (posts, events, course steps) stays in Task 15 as 34a2.

**Where to find it:** Visual editor > Elements > Timeline, and Templates > Timeline examples
<a id="bld-045"></a>
#### BLD-045 · Task 12 editor contrast and blue dark mode (31a, 31b) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31a and 31b (23 Nov 2026).** The canvas root (`.ve-frame-root`) now sets the site's page colours and `color-scheme: light`, so no editor token reaches canvas text. The admin dark theme maps the whole elevation ramp onto a new blue ramp (`--ac-navy-*` in `custom.css`, both the `data-theme` and the OS-dark blocks). `tests/int/editor-theme-contrast.int.spec.ts` checks every filled editor button pair (accent, danger, select, chrome) and the text pairs in both editor themes at 4.5:1, border and focus colours at 3:1, and the navy ramp steps. The editor Checks contrast warning (theme tokens, gradients, images, hover) already existed from Task 20c.

**Where to find it:** Visual editor and admin in dark mode; `tests/int/editor-theme-contrast.int.spec.ts`

<a id="bld-046"></a>
#### BLD-046 · Task 12 panels and mechanics (31c, 31d) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31c and 31d (23 Nov 2026).** Verified the docked Elements, Settings, Navigator and History panel (no popup in the add flow, Templates tab in the library, 820 px and 390 px previews, per-device badge) and added Arrow, Home and End keys to the dock tab list. Import now has an upgrade layer (`CLIPBOARD_UPGRADES`, `upgradeClipboardTree`) for older files; newer files still fail with a clear message, unknown elements stay as placeholders, section and element exports are tested. Decision: the inline text editor stays the hardened contentEditable, with the read-only guard for formatted content (`canEditAsPlainText`); a Lexical swap is not needed.

**Where to find it:** Visual editor > left dock tabs; top bar > Import / Export

<a id="bld-047"></a>
#### BLD-047 · Task 12 shared field kit and first design controls (31e, 31h part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e and 31h, first slice (23 Nov 2026).** `fieldKit.tsx`: `PopoverGroup` (non-modal, Escape and outside click close it), `LengthField` (number plus the six units px, %, em, rem, vw, vh, per device), `SizeLimitRows`, `FlipRows`, `TextShadowStrokePopover`. New design keys in `blockStyle.ts`: min width, max width, max height with units and per-device overrides (a 0 max clears an inherited limit), flip horizontal and vertical per device, justify alignment, text stroke (width and colour), custom text shadow (x, y, blur, colour). Emitted as scoped CSS with media queries; sanitised on read; mapped in `v1Groups.ts` and `designHelpers.ts`. Tests in `tests/int/design-size-limits-flip-stroke.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design > Spacing (size limits), Typography (text shadow and stroke), Advanced > Transform (flip)

<a id="bld-048"></a>
#### BLD-048 · Task 12 reference matrix and Font Awesome Pro (31f, 31g) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31f and 31g (23 Nov 2026).** `docs/visual-builder-reference-matrix.md` lists every builder capability against Elementor free and Pro and the ten add-on products (competitor cells marked uncertain until checked live). Font Awesome Pro: Admin > Front-end files > Font Awesome Pro takes a kit code or a Font Awesome Pro stylesheet address (only Font Awesome hosts, https), a Test button, CSP hosts added automatically; the icon picker then offers the Pro styles for this site only and falls back to solid free icons when the licence is removed. Nothing from Pro is bundled. Stored in the front-end files record (no new table). Tests: `tests/int/font-awesome-pro.int.spec.ts`.

**Where to find it:** Admin > Front-end files; icon picker style menu

<a id="bld-044"></a>
#### BLD-044 · Task 15 34b Social feeds, wall and embeds (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34b (23 Nov 2026).** Social accounts gained Vimeo, Twitch (token `clientId:accessToken`), Spotify podcast, Google Business posts, and embed-only X and LinkedIn (account field holds post links; each shows as a consent-gated embed through `EmbedConsentFrame` and `resolveEmbed`). The Social feed element gained Masonry wall, Highlight and Slider layouts, moderation lists (hide, pin, only containing, hide containing: `src/features/socialFeeds/moderate.ts`), refresh time per element (`ttlFor`), Load more (CSS only, no script), popup (CSS `:target`, no script), Follow button and a marketing-cookie gate for pictures. Test button works for every provider through `fetchPosts`. Code: `adapters.ts`, `types.ts`, `service.ts`, `Wave67Server.tsx`, `wave67Defs.ts`, `social-feed.css`, `Integrations.ts`; tests `tests/int/social-feeds-34b.int.spec.ts`. Not built: LinkedIn and X posts as API feeds (no free API), a per-post Hide button in the admin (the lists take addresses), hashtag filter on providers whose posts carry no caption.

**Where to find it:** Settings > Integrations > Social accounts; Visual editor > Elements > Social feed

<a id="bld-049"></a>

## BLD-049 · Task 11 maps and weather connections (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 11 maps and weather connections (30a, 30b; 23 Nov 2026).** New admin screen Maps and weather (`/maps-weather`, `src/admin/views/MapsWeatherView.tsx`, API `admin-maps-weather`), settings kept in one `eg_kv` row (`src/features/mapsWeather/store.ts`, keys encrypted, never returned to the browser, admin only, no migration). Maps: default provider OpenStreetMap (no key), plus Google Maps, MapTiler and Mapbox with keys; a provider without a key falls back to OpenStreetMap. Per element override of provider and style (light, dark, grayscale, satellite, terrain), extra markers ("lat,lng | Label"), marker colour, directions link. The published Map element is now server rendered (`MapServer.tsx`): addresses are geocoded once through Nominatim and stored (`geocode.ts`), a picture placeholder (MapTiler, Mapbox, Google static) shows before the visitor presses Show map, the iframe loads only then (the consent gate), a pasted embed link still wins, and the editor canvas keeps the client preview. Weather: Open-Meteo (default, no key), OpenWeather, WeatherAPI and Tomorrow.io through one normalised shape (`src/features/weather/providers.ts`), units, language, cache minutes, Test button, monthly call counter, and the Weather element and Dynamic text tags `{{weather.temp}}`, `{{weather.condition}}`, `{{weather.place}}`, `{{weather.wind}}` (with a place field) use the chosen provider. Follow-up (23 Nov 2026): the Map element runs on MapLibre GL 4.7.1 loaded from jsDelivr with integrity hashes only after Show map (`MapEngine.tsx`, never bundled; the default CSP gained `worker-src 'self' blob:`): tiles from OpenStreetMap (dark and grayscale as a filter), MapTiler or Mapbox, markers with popups, clustering over 3 markers, ctrl or two-finger scroll zoom, custom marker picture (https only), a plain-embed fallback if the library is blocked, and an OpenStreetMap tile picture with scripts blocked. Google keeps its embed (the embed API ignores styles, so Google style JSON cannot apply; use MapTiler or Mapbox for custom styling). Weather element has a Current and next hours view (12 hours from every provider). Tests: `tests/int/maps-weather.int.spec.ts`.

**Where to find it:** Settings > General > Maps and weather; Map and Weather elements in the visual editor
<a id="bld-050"></a>
#### BLD-050 · Task 12 border sides, custom shadow, 20 dividers (31e part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e second slice (23 Nov 2026).** Per-side border widths and the double border style; a custom box shadow layer (x, y, blur, spread, colour, inset) for Normal and for Hover, replacing the preset when set; five new shape dividers (book, split, tilt with opacity, curve with opacity, fan) for 20 in total. Popovers in `fieldKit.tsx` (`BorderSidesPopover`, `BoxShadowPopover`); keys sanitised on read and mapped in `v1Groups.ts`. Tests: `tests/int/design-border-shadow-dividers.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design > Border; Design > Dividers

<a id="bld-051"></a>
#### BLD-051 · Task 14 templates, examples and theme builder (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 14 (33a to 33i), built 23 Nov 2026.** **33a** Templates hub: popups (a reusable section whose section shows as a popup) get their own type, reusable sections are marked global, the library tab is renamed Examples, and each missing site template has a one-click Create now (first starter, else blank, opens the visual builder) beside Choose starter (`rows.ts`, `SuggestedTemplates.tsx`). **33b** Example picker: items carry optional type, industry, colour style and light or dark; the hub tab and the editor panel filter by them, a Dark previews switch shows the dark picture, and the editor inserts at the chosen spot, at the end of the page or over the selected section, with a summary of pictures saved to Media (`templateLibraries/filter.ts`, `TemplateLibraryPanel.tsx`, `TemplateBrowser.tsx`, `VisualEditor.tsx`). **33c** Engage side of the templates repo draft: `library.json` and item files accept schemaVersion 2, kinds `site-template`, `loop` and `popup` (listed as sections with a type), `siteKind`, `pairWith`; a site template or loop item has Create template (starts off) and a popup item becomes a reusable section (`/api/template-libraries/create-template`); the author guide lists the fields (`docs/template-libraries.md` section 4). **33d** Items follow the theme: `var(--sh-id)` tokens and fixed colours listed in `requires.colours` become the site's `var(--eg-c-id)` on insert (`templateLibraries/themeMap.ts`), so dark values apply. **33e** Theme builder: a sample homepage preview (header, hero, cards, shop card, form, footer), a Domains tab (the primary domain is the master; other domains inherit it and override chosen colours, light and dark values, fonts and corner radii, saved per host in `eg_theme_domain_overrides`, applied in the public layout; `themeStyles/inherit.ts`, `domainStore.ts`, `/api/admin-theme-domains`), and a Clone a site tab (reads a public page and its stylesheets, proposes colours and radius to tick, `cloneSite.ts`, `/api/admin-theme-clone`). **33f** New loop in the Templates hub: name, source, filter, sort, count, columns, and Place on blog or shop archive (`siteTemplates/loops.ts`, `/api/admin-loops`). **33g** Header and footer starters: desktop and mobile header, members-only header (audience condition), footer with columns and socials. **33h** Buttons on the theme page open the header, footer, blog, post, shop, product, event, search and 404 templates in the visual builder, creating a draft first when none exists (`templatesHub/entryPoints.ts`). **33i** Theme guide: a six step walkthrough on the theme page, first visit of a new site and the Theme guide button (`AdminTour` now takes steps). Tests: `templates-hub-library-filters`, `template-theme-map`, `theme-builder-33e`, `loops-33f`, `template-entry-points`, `theme-tour-33i`, `template-starters`.

**Leftovers built 23 Nov 2026:** inserting a library item with a light or dark twin (`pairWith`) takes the twin that matches the Dark previews or Light or dark choice (`pickThemeVariant`, `/api/template-libraries/use` `prefer`); New loop now also adds the Archive filter above the Loop grid on the archive.

**Where to find it:** Templates > Examples; Templates (New loop, Create now); Theme styles (Domains, Clone a site, Theme guide, edit buttons, sample homepage)

##<a id="bld-052"></a>
#### BLD-052 · Task 13 container layout: gaps, unit widths, overflow, tag, block order (23 Nov 2026)

_Date: 23 Nov 2026_

**32a Container layout (built 23 Nov 2026).** `src/lib/sectionLayout.ts` and its generated CSS (`styles.css`, canvas) gain, per device: separate row gap and column gap (linked by default), boxed content width, container width and max width each with the six units (px, %, em, rem, vw, vh), overflow (visible, hidden, auto, scroll), align content, wrap reverse (desktop, tablet, mobile), baseline in align items, and the container HTML tag (div, section, header, footer, main, article, aside, nav, or a link with a checked address). Old pages render the same: every new key is optional and the legacy `boxedWidth` still works. Blocks get a per-device `order` (Position accordion); a column with ordered blocks turns into a flex column. Panel: Layout > Container layout. Tests: `tests/int/container-layout.int.spec.ts`. Grid, tabs and other display modes keep their own controls (the container extras apply to the flex layout).

**Where to find it:** Visual editor > select a section > Layout > Container layout; select a block > Design > Position > Order in the column

<a id="bld-053"></a>
#### BLD-053 · Task 13 legacy block conversion: report, bulk convert, undo (23 Nov 2026)

_Date: 23 Nov 2026_

**32b Legacy block conversion (built 23 Nov 2026).** Converters for rich text (text editor), table of contents (automatic mode on the Table of contents element), event grid, FAQ and product grid join hero, call to action, image and text and gallery. The grid blocks become the new `event-grid`, `faq-list` and `product-grid` elements that reuse the old components, so output is the same; FAQ structured data reads `faq-list` at any depth (`collectFaqBlocks`). `src/features/legacyBlocks`: pure whole-document converter (nested blocks included, idempotent), read-only report over pages, posts, products, page templates, templates and reusable sections, preview, convert all or one document, per-document report, backup of the old value in R2 (`legacy-block-backups/<batch>.json`) written before any change, and undo per batch. Route `/api/admin-legacy-blocks` (admin only). Starters, seeds, the importer and the shop presets now build the new elements. The library hides the five legacy blocks; renderers stay so old exports still import. Limit: older saved versions (version history) keep the legacy blocks and render as before; convert again after restoring one. Tests: `tests/int/legacy-blocks.int.spec.ts`.

**Where to find it:** Settings > Data and System > Legacy blocks (/admin/legacy-blocks); visual editor > Elements > Event grid, FAQ, Product grid

<a id="bld-054"></a>
#### BLD-054 · Task 13 reusable section inputs (23 Nov 2026)

_Date: 23 Nov 2026_

**32c Element parameters (built 23 Nov 2026).** A reusable section can hold a Section inputs element (`section-params`) declaring up to 12 inputs of type text, link, image, colour, number or choice; the section's content uses `{{param:key}}`. The Reusable section with inputs element (`section-instance`) picks a section and shows the inputs as a small form; only changed values are stored, so a change to the source layout or to a default reaches every use, except inputs a use overrides. Values are checked per type (links and colours are validated, choices must be listed); a token that is a whole value keeps its type, so an image id stays an image id. Save as template has "Save as a reusable section with inputs": each input names the value now in the section and every exact match becomes the token. No new table: declarations live in the section's content, values in the element's props. Instances carry the nesting chain so a section cannot contain itself. Code: `src/lib/sectionParams.ts`, `sectionParamDefs.ts`, `ReusableSectionBlock.tsx`, `/api/admin-section-params`. Tests: `tests/int/section-params.int.spec.ts`.

**Where to find it:** Visual editor > Save as template > Save as a reusable section with inputs; Elements > Reusable section with inputs and Section inputs

<a id="bld-055"></a>
#### BLD-055 · Task 12 image placement and overline (31e part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e third slice (23 Nov 2026).** Image background size (cover, contain, auto), position (nine), repeat and fixed attachment, and the overline text decoration. `BgImagePlacement` in `fieldKit.tsx`; keys sanitised on read and mapped in `v1Groups.ts`. Sticky with per-device switch and offsets already existed (per-device `position`, `posTop`, `posBottom`). Tests: `tests/int/design-bg-placement-overline.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design > Background (image) and Typography > Decoration

<a id="bld-056"></a>
#### BLD-056 · Task 15 34c Calendar element (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34c (23 Nov 2026).** New `calendar` element backed by the Events collection (recurring events are already separate occurrences). Views month, week, day, agenda and list; category filter (keyword rules `keyword | Category | #colour`, no new database field) and tag filter (#hashtags in title or summary); colour by category; event popup with image, map link, Add to Google, Add to calendar (ICS) and details link; Subscribe link to the new `/api/events/feed` iCalendar feed (`buildEventsCalendar` in `ics.ts`); design options for accent, text and background colour, font family, density, first day of week, 12 or 24 hour, optional fixed time zone (day cells follow it). Events are read on the server and the views run in the browser, so a static page snapshot stays correct (today is read in the browser). Code: `src/features/calendar/{model,feed}.ts`, `CalendarServer.tsx`, `CalendarClient.tsx`, `calendar.css`, `calendarDefs.ts`; tests `tests/int/calendar-34c.int.spec.ts`. Leftovers are Task 15 item 34c2.

**Where to find it:** Visual editor > Elements > Calendar; /api/events/feed

<a id="bld-057"></a>
#### BLD-058 · Task 15 34f Slider options (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34f (23 Nov 2026).** Checked: the `slides` element is the hero slider (one slide at a time, any heading, text, button, picture or video, autoplay, loop, arrows, dots, thumbnails) and the section "Slider" display mode takes any blocks per slide. Added to the section slider: dots (`carouselDots`), loop-around arrows (`carouselLoop`), autoplay in seconds (`carouselAutoplay`, a small script that pauses on hover and focus and stays off with reduced motion: `CarouselAutoplay.tsx`) and slides per view on tablets and phones (`carouselPerViewTablet`, `carouselPerViewMobile`). Options are in `sectionLayout.ts`, `FieldPanel.tsx`, `SectionBlock.tsx` and `tabs.css`; labels in all thirteen languages; the AI builder hint lists them. Three Examples: `slider-hero`, `slider-testimonials`, `slider-logos`. Test: `tests/int/section-slider-34f.int.spec.ts`. The Spark `spark-carousel` behaviour is still used by the Image carousel element; the section slider keeps its own scroll-snap track so every slide stays in the HTML.

**Where to find it:** Visual editor > a section > Display as > Slider; Templates > Slider examples
#### BLD-057 · Task 12 image mask and link rel options (31e part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e fourth slice (23 Nov 2026).** Image mask (SVG or PNG address, https or on this site, with size, position and repeat) and rel sponsored and ugc on the wrapper link. The heading element already offers h1 to h6. Tests: `tests/int/design-mask-image-link-rel.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design > Advanced > Mask; Design > Visibility > Wrapper link

<a id="bld-059"></a>
#### BLD-059 · Task 12 heading tag choice and per-device text styling (31e part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e fifth slice (23 Nov 2026).** The heading element's HTML tag now also offers p, div and span (effects always render a real heading; an unknown tag falls back to h2). Text transform, font style and text decoration can differ per device (new responsive keys, scoped media-query CSS, panel selects follow the device toggle). Tests: `tests/int/design-heading-tag-device-text.int.spec.ts`.

**Where to find it:** Visual editor > Heading > HTML tag; Design > Typography with the device toggle

<a id="bld-060"></a>
#### BLD-070 · Task 15 34g2 Floating action button (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34g2 part (23 Nov 2026).** New `floating-action-button` element: a round button fixed to the bottom right or left that opens a menu of links (call, email, scroll to top, any page) using a native details element, so it works without JavaScript. Only safe web, tel, mailto and in-page addresses are kept, at most 8 items. Code: `utilityDefs.ts`, `UtilityElements.tsx`; test in `tests/int/utility-elements-34g.int.spec.ts`. Still open in 34g2: poll, social proof popups, Trustpilot and Tripadvisor sources.

**Where to find it:** Visual editor > Elements > Layout > Floating action button

#### BLD-069 · Task 15 34d 3D viewer and product configurator (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34d part (23 Nov 2026).** Two new elements. **3D model viewer** (`model-viewer`): GLB or glTF from Media or an address (other file types are refused), poster picture, height, slow turn (off for reduced motion), AR button on phones; the open model-viewer component loads from unpkg only when scrolled near, like the Lottie player. **Product configurator** (`product-configurator`): built from pictures only. Option lines `Group | Option | picture | price change` become radio groups, the chosen option of each group is a stacked layer, the total updates from the base price, an Exploded view button spreads the layers apart and shows hotspot dots (`across % | down % | label`), and the chosen options are shown as a summary line. Unsafe picture addresses are dropped. Code: `threeDDefs.ts`, `ThreeDElements.tsx`, `ThreeDClient.tsx`, `wave36.css`, `registry.ts`, `elementComponents.tsx`, `elementUtil.ts` (media key); tests `tests/int/three-d-34d.int.spec.ts`. The other parts of 34d are tasked as 34d2.

**Where to find it:** Visual editor > Elements > Media > 3D model viewer, Product configurator

#### BLD-068 · Task 15 34h Oxygen and Storyblok parity check (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34h (23 Nov 2026).** Checked each line against the code. **Oxygen.** Query loops with conditions: built (loop elements, Archive filter). Design sets and templates: built (Task 14). Code blocks for CSS and JS: built (`embed-code`, `html`, per block custom CSS). Dynamic data: built (dynamic link and image sources, loop context). Spark based effects and reveal: built; click, scroll and hover triggers that run chosen actions: partial, tasked as 34h2. Reusable components: built as reusable sections (`ReusableSections`), without per-instance properties, tasked as 34h3. Shared class and selector styles with CSS variables edited once: partial (theme colours and fonts become variables; no named shared style classes), tasked as 34h4. **Storyblok.** Nestable components with schema: built (sections and elements). Content types and fields: built (`customFields`). Workflow stages: built (`approval`). Version history with compare: built (`VersionsList`, `versionDiff`). Field level translation: built (`multilingual`). Roles, webhooks and REST API: built (`roles`, `webhooks`, `apiBuilder`). Preview links, tags and click-to-edit visual preview: built. Asset manager: built (Task 24). Scheduled publishing: built (`schedule`). **Gaps tasked:** datasources (shared option lists used by select fields) as 34h5, and releases (publish a bundle of changes together) as 34h6.

**Where to find it:** Task list items 34h2 to 34h6 in `docs/remaining-work.md`

#### BLD-061 · Task 15 34e Archive filters (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34e (23 Nov 2026).** Checked: the archive filter already had search, category, tag, price range and sort, and the shop page already had attribute and brand facets with shareable links. Added to the Archive filter element and the shop archive: In stock only (`?instock=1`), On sale (`?onsale=1`) and minimum rating (`?rating=1..5`, from the cached `ratingAverage`), removable chips for every active filter, and an update-without-reload mode (`ArchiveFilterForm.tsx`: a soft navigation on change, the plain GET form and Apply button remain the no-JavaScript path). Code: `archiveFilter.ts`, `blockContext.ts`, `ArchiveFilter.tsx`, `ArchiveFilterForm.tsx`, `loopDefs.ts`, `shop/page.tsx`; tests `tests/int/archive-filter-34e.int.spec.ts`. Tags on every content type with a tag cloud stay in Task 28c and gallery category filters in 33b, as the original item said.

**Where to find it:** Visual editor > Elements > Archive filter; /shop
#### BLD-060 · Task 12 gradient kinds and second shadow layer (31e part) (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 12 31e sixth slice (23 Nov 2026).** Background gradient type (linear, radial, conic) with an optional middle colour stop and position; a second custom box shadow layer (layers join with a comma). Also fixed a type error in `ArchiveFilterForm.tsx` that was failing the build on main. Tests: `tests/int/design-gradient-shadow-layers.int.spec.ts`.

**Where to find it:** Visual editor > selected block > Design > Background (gradient) and Border > Custom shadow

<a id="bld-062"></a>
#### BLD-063 · Task 15 34g Elfsight catalogue sweep (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34g (23 Nov 2026).** Checked the Elfsight list against the element registry. **Already built:** announcement and notification bar (`sticky-bar`), before and after slider (`image-comparison`), cookie banner (consent settings), Google Calendar embed (`embed` provider), Spotify and SoundCloud players (`audio`, `embed`), news ticker (`text-ticker`), lead capture popups with triggers (popup sections), WhatsApp, Messenger and Telegram buttons (`chat-button`), back to top (`back-to-top`). **Built now:** QR code (`qr-code`, drawn locally with the sign-in QR encoder, no outside service) and PDF viewer (`pdf-viewer`, browser viewer in a lazy frame with a download link). **Tasked as 34g2:** Poll and survey with stored votes, sales and social proof popups, floating action button menu, Trustpilot and Tripadvisor review sources. Code: `utilityDefs.ts`, `UtilityElements.tsx`, `elementUtil.ts` (media key), `registry.ts`; tests `tests/int/utility-elements-34g.int.spec.ts`.

**Where to find it:** Visual editor > Elements > QR code, PDF viewer
#### BLD-062 · Transform controls as popover groups (23 Nov 2026)

_Date: 23 Nov 2026_

Rotate, Offset, Scale and Skew are now four popover groups in the Advanced tab. Each holds its Normal rows (per device) and its Hover rows, and every saved tf and tfh value is kept. Flip sits in the Scale group. A test covers the structure.

**Where to find it:** Visual editor, Design panel, Advanced, Transform

<a id="bld-064"></a>
#### BLD-064 · Line height and word spacing units per device (23 Nov 2026)

_Date: 23 Nov 2026_

Line height can be a multiplier or px, em or rem. Word spacing can be px, em or rem. Both units are saved per device, sanitised against the six-unit whitelist, and emitted in the desktop CSS and the tablet and mobile media queries. A test covers defaults, units, an unknown unit and the per-device output.

**Where to find it:** Visual editor, Design panel, Typography

<a id="bld-065"></a>
#### BLD-066 · Task 15 34i AI on any selected element (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34i (23 Nov 2026).** The Build with AI edit mode now works on any selected element, nested section or column block, not only top-level sections. Non-section nodes are wrapped in a one-column section carrying their own id (`wrapForAi`), the reply is unwrapped to the replacing blocks (`unwrapAiReplacement`) and spliced into the owning column as one undo step; locked parts block the replace. The element settings panel has a new Edit with AI button (all 13 languages) that opens the dialog; with no provider the connect hint stays. Code: `src/features/ai/subtreeEdit.ts`, `VisualEditor.tsx` (`aiReplaceSelected`), `FieldPanel.tsx`, `EditorDock.tsx`; tests `tests/int/subtree-ai-34i.int.spec.ts`.

**Where to find it:** Visual editor > select any element > Edit with AI

#### BLD-065 · Blend mode per device (23 Nov 2026)

_Date: 23 Nov 2026_

Blend mode is now a per-device setting (Default, then tablet and mobile overrides, including a device set back to Normal). It is validated against the blend list and emitted in the tablet and mobile media queries. A test covers it.

**Where to find it:** Visual editor, Design panel, Advanced, Appearance

<a id="bld-067"></a>
#### BLD-067 · Position offsets with units per device (23 Nov 2026)

_Date: 23 Nov 2026_

Top, right, bottom and left offsets share a per-device unit (px, %, em, rem, vw, vh). A device that only changes the unit re-emits the inherited offsets in its media query. Unknown units are dropped. A test covers it.

**Where to find it:** Visual editor, Design panel, Advanced, Position

<a id="bld-068"></a>
#### BLD-068 · Border width per device (23 Nov 2026)

_Date: 23 Nov 2026_

Border width is now set per device. A tablet or mobile width re-emits the inherited style and colour in its media query, and 0 removes the border on that device. Width is clamped to 0 to 50 px. A test covers it.

**Where to find it:** Visual editor, Design panel, Border

<a id="bld-071"></a>
#### BLD-072 · Task 15 34g2 Poll element (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34g2 part (23 Nov 2026).** New `poll` element (Elements > Media): a question with 2 to 12 options. Each browser votes once (an HttpOnly cookie id, stored with the vote in `eg_poll_votes`, created on first use), then sees the results as bars with percentages and its own choice marked. The page is fetched in the browser from `/api/polls`, so published static pages stay static; the vote route checks the origin and limits ids and choices. The poll id keeps or restarts the count. Code: `src/features/polls/core.ts` and `store.ts`, `api/polls/route.ts`, `PollClient.tsx`, `UtilityElements.tsx`, `utilityDefs.ts`; tests `tests/int/poll-34g2.int.spec.ts`. Still open in 34g2: social proof popups, Trustpilot and Tripadvisor sources.

**Where to find it:** Visual editor > Elements > Media > Poll

#### BLD-071 · Background colour per device (23 Nov 2026)

_Date: 23 Nov 2026_

The solid background colour can now be set per device. A tablet or mobile colour is validated and emitted in its media query. An unsafe colour string is dropped. A test covers it.

**Where to find it:** Visual editor, Design panel, Background

<a id="bld-073"></a>
#### BLD-073 · Font family per device (23 Nov 2026)

_Date: 23 Nov 2026_

The font family in the Typography group can be set per device (Default, then tablet and mobile). Built-in, token and installed families are accepted and anything else is dropped. The override is emitted in the device media query. A test covers it.

**Where to find it:** Visual editor, Design panel, Typography

#### BLD-075 · Task 10 29d Pay button (23 Nov 2026)

_Date: 23 Nov 2026_

A Pay button element (commerce group): puts one product in the cart and opens the checkout, which runs the normal payment methods (test mode until the shop goes live). Options: label, product ID, quantity, and an optional amount box for pay what you want or donation products with a suggested and a smallest amount (checked in the browser and again by the server). No payment code was added. Code: `wave72Defs.ts`, `Wave72Elements.tsx` (`payLine`, `toCents`), `wave72.css`, `tests/int/wave72-elements.int.spec.ts`.

**Where to find it:** Visual editor, Elements, Commerce, Pay button
<a id="bld-074"></a>
#### BLD-074 · Hover blend mode and hover text stroke (23 Nov 2026)

_Date: 23 Nov 2026_

The Hover group now has a blend mode and a text stroke (width and colour). Values are validated like the other hover keys and written into the scoped hover rule. A test covers the output and the sanitising.

**Where to find it:** Visual editor, Design panel, Hover

#### BLD-077 · Task 10 29e Cart and order display conditions (23 Nov 2026)

_Date: 23 Nov 2026_

Display conditions gain Cart (has items or is empty) and Customer orders (has ordered before or has not). The cart rule reads an item count the cart keeps in the browser, so it needs no request and updates when items are added or removed. The orders rule asks `/api/visibility-state?orders=1` (one small lookup, only on pages that use it, never cached); signed out or unknown hides the block. Code: `visibilityRules.ts` (`ca`, `o`), `VisibilityGate.tsx`, `EcommerceProvider` count mirror, `tests/int/visibility-rules.int.spec.ts`.

**Where to find it:** Visual editor, Design panel, Display conditions
<a id="bld-076"></a>
#### BLD-076 · Shape divider width, invert and bring to front (23 Nov 2026)

_Date: 23 Nov 2026_

Each shape divider (top and bottom) now has a width from 100 to 400 percent, centred on the block, an invert option that mirrors it vertically, and a bring to front option that draws it above the block content. The editor canvas and the live site share the same component. Width is clamped on save. A test covers the markup and the clamp.

**Where to find it:** Visual editor, Design panel, Dividers

<a id="bld-082"></a>
#### BLD-082 · Task 3 chart and table data, grid editor, Spark carousel, flip and typed text (23 Nov 2026)

_Date: 23 Nov 2026 · Original group: Task 3, 40b to 40d_

Chart and Table data has a grid editor (add and remove rows and columns, import a CSV file, edit as text). The image carousel and gallery carousel layout use Shine `carousel` plus `spark-carousel`, card flip uses `spark-flip`, and the rotating headline and Rotate heading effect use `spark-typed`. The Data view Table or chart element uses Shine `table` and `spark-table`; its own sort, search and paging script is gone. Form submissions on a form's Submissions tab sort by any column and filter by any answer (newest 2,000 entries). PRs 646, 654 and 662. Slides, tabs and breadcrumbs stay custom (no Spark equivalent). Form results as a chart source was dropped: submissions stay private and are viewed in the admin.

**Where to find it:** Visual editor, Chart, Table, Image carousel, Card; Forms, Submissions tab

<a id="bld-078"></a>
#### BLD-081 · Task 9 content, layout and marketing options and examples (23 Nov 2026)

_Date: 23 Nov 2026 · Original group: Task 9, 28a to 28c_

Built across 22 and 23 Nov: Wrapper link and Read more (height clamp) on any block, the `{{readingTime}}` merge tag, dismissible alert and toast, button hover effects, FAQ and How-To schema options, Lottie player, Video popup, Billing toggle, filterable gallery, the Categories and tags element (list, tag cloud, grid), Load more button and infinite scroll on the Loop element, and an Examples group in the Elements panel (Number box, Ticket and offer card, Promo box, Icon label, Blog sidebar). Live reviews (28d) are INT-018. Everything else in the old scope is built in `engage-templates` (see Task 9 leftovers) or in Task 46. Tests: wrap-collapse-reading-time, alert-dismiss-toast, button-fx, section-schema, video-popup, billing-toggle, gallery-filter, taxonomy-list, loop-load-more, example-presets.

#### BLD-079 · Task 15 34a2 Timeline from events or posts (23 Nov 2026)

_Date: 23 Nov 2026_

**Task 15 34a2 (23 Nov 2026).** New `timeline-feed` element (Elements > Media, Timeline from events or posts): fills a timeline on the server from upcoming Events, past Events or blog Posts (1 to 24, soonest or newest first), skipping drafts, trashed and protected items, with each item linking to its page (`/events/slug` or `/blog/slug`) and grouped by year. It draws with the normal Timeline (layout, line and dot colours, Spark reveal, optional Event structured data for events only). It is a separate element so the existing Timeline keeps working on the canvas. Code: `calendarDefs.ts`, `features/calendar/timelineFeed.ts`, `TimelineFeedServer.tsx`, `Wave38Elements.tsx`; tests `tests/int/timeline-feed-34a2.int.spec.ts`. Course steps are not a source yet.

**Where to find it:** Visual editor > Elements > Media > Timeline from events or posts

#### BLD-078 · Theme colour tokens on every design colour field (23 Nov 2026)

_Date: 23 Nov 2026_

Every colour field in the design panel already offered the Theme picker. The one that did not, the active tab colour on sections, now uses the same colour row and its sanitiser accepts var(--token) values. A test covers hex, token and unsafe values.

**Where to find it:** Visual editor, Section settings, Tabs

<a id="bld-080"></a>
#### BLD-080 · Hover gradient background (23 Nov 2026)

_Date: 23 Nov 2026_

The Hover group has a linear gradient background (from colour, to colour, angle). It is validated like the other hover keys and written into the scoped hover rule. A test covers the output, the defaults and the sanitising.

**Where to find it:** Visual editor, Design panel, Hover

<a id="cat-adm"></a>
### ADM: Admin and settings

<a id="adm-001"></a>
#### ADM-001 · Task 2c (27 Oct)

_Date: 27 Oct 2026_

**Task 2c (27 Oct):** collections under their menu groups (for example /admin/content/pages, /admin/shop/orders); old /admin/collections links 308-redirect. PRs #29, #30.

**Where to find it:** Admin sidebar menu groups, e.g. /admin/content/pages and /admin/shop/orders (old /admin/collections links redirect)

<a id="adm-002"></a>
#### ADM-002 · Accessibility and admin text

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Accessibility and admin text:** #181 (above); #134 admin text in all dictionaries.

**Where to find it:** /admin/translations (admin text in every dictionary; accessibility fixes across admin screens)

<a id="adm-003"></a>
#### ADM-003 · Task 16 and 3 polish (#180)

_Date: 31 Oct 2026 (inferred from neighbouring entries)_

**Task 16 and 3 polish (#180):** README deploy checklist; blog wizard placeholder. Live check in Task 6.

**Where to find it:** /admin/content/posts > Write with AI (blog wizard placeholder); README deploy checklist is docs only

<a id="adm-004"></a>
#### ADM-004 · Task 5 tables and charts, slice 2 (PRs #173 and #174, 31 Oct)

_Date: 31 Oct 2026_

**Task 5 tables and charts, slice 2 (PRs #173 and #174, 31 Oct):** Export CSV on generic lists (visible columns, every filtered row, up to 5000); one sortable admin table (`SortableTable`) on five admin screens; one shared admin bar chart (`AdminBarChart`) with the shop revenue chart on it; lightweight table structure spec. Decisions taken: no new bulk actions; products and redirects keep their own export.

**Where to find it:** Export CSV in list toolbars (e.g. /admin/content/pages); sortable tables and shared bar chart on list screens such as /admin/shop-reports

<a id="adm-005"></a>
#### ADM-005 · Task 5 tables and charts, slice 1 (PR #171, 31 Oct)

_Date: 31 Oct 2026_

**Task 5 tables and charts, slice 1 (PR #171, 31 Oct):** shop revenue chart value axis with grid; audit and PageSpeed empty and error text translated (12 dictionaries). #172 empty-state text on the review queue, API keys, email testing screens.

**Where to find it:** /admin/shop-reports (shop revenue chart value axis and grid)

<a id="adm-006"></a>
#### ADM-006 · Task 4 tables and charts (PR #188, 1 Nov)

_Date: 1 Nov 2026_

**Task 4 tables and charts (PR #188, 1 Nov):** consent acceptance chart and PageSpeed trend moved onto the shared admin charts (`AdminBarChart` with a new `axisMax`; new `AdminLineChart`), both with axis text. Dashboard 30-day trend for orders and form submissions, shown only while the Shop or Forms feature is on. CSV export shows an exporting state and says when the 5000-row cap truncates (cap unchanged). axe-core 4.14.0 added; `tests/int/admin-lists-axe.int.spec.ts` runs WCAG 2.0 A and AA on ten admin lists and found one real fault (rows-per-page select had no name; fixed). Decisions: the data-views `ChartSvg` stays on its own renderer (public embeds; it draws pie and scatter, which the shared bar chart cannot, and it already prints axis text); the Ads report has no chart (a by-day table only), so nothing to move. Ten lists = pages, posts, products, orders, forms, form submissions, events, RSVPs, redirects, coupons. New text in all 12 dictionaries. Live checks in Task 6.

**Where to find it:** /admin (Last 30 days orders and form submissions trend); /cookie-consent (consent chart); page edit > PageSpeed card (trend chart)

<a id="adm-007"></a>
#### ADM-007 · Task 9b settings UX (PR #196, 1 Nov)

_Date: 1 Nov 2026_

**Task 9b settings UX (PR #196, 1 Nov):** hub at /settings ("All settings" in nav) lists the nine settings pages, Theming, Roles, Interface languages, Translations, Cookie consent, Ads settings, Shop switches and the other settings screens, with search over every visible setting (label and help text) that links to its page and section. Decided: no global moved (the hub lists them). Reset this section per section: confirm, then the config defaults go into the form; nothing is saved until Save; fields with no default and secret-looking names are never reset. "Last changed by X on DATE" on each settings page (admins only) from the audit log; every global save now writes a settings.update row. English help text for every settings field that lacked it, in settingsDescriptions.ts (SETTINGS_FIELD_HELP); other languages come from the normal translation flow. The hub, search, reset and last-changed text is English only for now, outside the 12 dictionaries. Live checks in Task 6.

**Where to find it:** /admin/settings (hub with search over every setting; Reset this section and Last changed by on each settings page)

<a id="adm-008"></a>
#### ADM-008 · Task 9a settings safety (PR #197)

_Date: 1 Nov 2026 (inferred from neighbouring entries)_

**Task 9a settings safety (PR #197):** every form-based global save sends the version it loaded and is refused with 409 and a "reload the page" message when the global changed in another tab or by another admin (shared in `useDocumentSave`). Custom CSP is merged into the default policy, not a replacement, and is validated on save (unknown directive or bad source gets a field error); a directive whose only source is 'none' still replaces the default for that directive. Admin URL, two-factor rules, admin passwordless and passkey access and the domain list email every admin the old and new values, who and when; decided: no second-admin confirm (single-admin sites would lock out), the audit row comes from the settings audit hook (9b). Integrations gets Check ID format (offline), Check AI keys and Check Cloudflare zone (read-only). Live checks in Task 6.

**Where to find it:** Any /admin/settings/<tab> save (409 on version clash); /admin/security/csp (custom CSP merge and validation); /admin/settings/site > Integrations (Check buttons)

<a id="adm-009"></a>
#### ADM-009 · Task 9c settings checks (PR #198, 1 Nov)

_Date: 1 Nov 2026_

**Task 9c settings checks (PR #198, 1 Nov):** Integrations has Check Maps key (shape only: a website-restricted key is never called from the server), Check PageSpeed key (one call with no page address, so no test runs), Check reCAPTCHA keys (site key shape; secret key by siteverify with a made-up token) and Check code format for the Search Console verification code (offline). Tracking connections and Google connection send the versions they loaded (`X-Expected-Versions`); every write route refuses with 409 and the Settings sentence when tracking-connections, google-connection or integrations moved on, before revoking or writing. Decided: Stripe and shipping carriers were already checked on Payments and Shipping (Task 8) and are unchanged; carriers without a live API (StarTrack, Couriers Please, Shippit) are labelled "Keys only" and only their keys are checked; Clarity, Meta and TikTok IDs stay format checks (Meta and TikTok sign-in is their connect check). Known limit: the version a screen keeps comes from a read just after its write, so a change in another tab within the same few milliseconds is not caught. Live checks in Task 6.

**Where to find it:** /admin/settings/site > Integrations: Check Maps key, Check PageSpeed key, Check reCAPTCHA keys, Check code format for Search Console

<a id="adm-010"></a>
#### ADM-010 · Task 11 operations (PR #199, 1 Nov)

_Date: 1 Nov 2026_

**Task 11 operations (PR #199, 1 Nov):** error spike alert (admin email when 10 or more new errors are first seen in 15 minutes, at most one an hour; threshold and on/off in Speed settings > Error alerts; cron job `error-alert`). Restore round-trip spec now covers the approval-workflows tables (the backup table list is discovered from sqlite_master, so none is hand-kept). Privacy export adds store credit, its movements, carts and product reviews (no cart secret); erase deletes carts and clears the reviewer name and email on reviews; account menu links to `/account/privacy`. Dashboard notice "Review your privacy policy and cookie notice" (dismissed per browser; hides once the linked policy page is edited after creation). CI: 7 excluded specs now run; the rest keep a reason in `ci.yml`. Migration `20270201_100000_error_alert_settings`. Decisions: (1) gate is merges to main only with green CI; deploy path and `scripts/build.mjs` unchanged; `test` as a required status check is a Task 6 step. (2) Alert goes by email to all admins, counting new error-log entries (first seen), not repeats of an old error. (3) Restore: round trip in CI; a live drill on a copy is a monthly Task 6 step. (4) Privacy: form entries and booking entries are kept on erase and stay access-controlled (staff with permission only); payment transactions untouched; store credit kept with the accounting records; overdue requests are shown in the list only; emails English only. (5) The site admin owns the policy and cookie text; the dashboard notice reminds them. Task numbers are not renumbered yet (Task 12 onward keep their numbers).

**Where to find it:** /admin/settings/speed > Error alerts (threshold, on or off); /account/privacy (account menu, privacy export and erase); dashboard notice on /admin

<a id="adm-011"></a>
#### ADM-011 · Task 1 multisite (PR #203, 1 Nov)

_Date: 1 Nov 2026_

**Task 1 multisite (PR #203, 1 Nov):** admin site switcher in the sidebar (shown with two or more sites; per-person choice in preferences, checked on the server; only sites the account may use; All sites only for an account with no domain limit; default is the primary site). Admin lists for pages, posts and products show the chosen site plus shared content; new content takes the chosen site when "Available on domains" is empty. Connect domain on Settings > Domains attaches a domain to the Worker through the Workers custom-domains API when account ID, Worker name, zone and token are saved in Integrations > Cloudflare; otherwise the manual steps stay. Menu links to a page scoped only to another domain output its absolute address. Migration `20270220_100000_cloudflare_worker_domains` (two columns). Migration `20270220_110000_domain_scoped_content`: one-time rewrite of older scope lists (replaces the manual re-save), unique index on (scope, slug) for posts and products, duplicate slugs get `-<id>`. Already in place, checked in code: Sites screen with per-domain name, language, primary, status and overrides (Settings > Domains), lockdown by Allowed domains, uiStrings for the picker and DNS checklist (13 dictionaries), page hreflang across domains, admin noindex (meta, X-Robots-Tag, robots.txt with the custom admin path). Decisions: switcher sits in the sidebar (the admin has no top bar); Connect domain uses the zone set in Integrations, so a domain in another zone needs its own zone (not built); other dictionaries use English for the new switcher and Connect domain strings until translated. Permanent: none. Left: Products mirror in the ecommerce plugin (vendor code). Matt's live checks in Task 6.

**Where to find it:** Admin sidebar site switcher (two or more sites); /admin/settings/domains > Connect domain; Integrations > Cloudflare on /admin/settings/site

<a id="adm-012"></a>
#### ADM-012 · Known limits: specs, schema, small leftovers (PR #204, 1 Nov)

_Date: 1 Nov 2026_

**Known limits: specs, schema, small leftovers (PR #204, 1 Nov):** version-delete-real-engine and schedule-publish-due build their own D1 and are back in CI, with AdminNavClient, nav-structure and heading-effects (stale expectations fixed, `server-only` alias in vitest); `scripts/checkDevD1.mts` rebuilds a local D1 stub (runs before `test:int`); migration 20270224_100000_block_form_id adds `form_id` to the twelve Form block tables (fixes "no such column"), rels legacy names media_id/faqs_id in the shadow schema, KNOWN_UNMIGRATED empty; getting-started ticks now save (the list-prefs sanitiser dropped them); blog and events listings emit an ItemList; two unused CSS rules removed; README cron line. Permanent: none in this area. Left: cookie-consent spec (still excluded), shop listing stays a plain CollectionPage.

**Where to find it:** No UI (backend only): tests/int specs and CI config; getting-started ticks on the /admin dashboard

<a id="adm-013"></a>
#### ADM-013 · Known limits: editing, approval and roles, custom fields, admin, locks (PR #206, 1 Nov)

_Date: 1 Nov 2026_

**Known limits: editing, approval and roles, custom fields, admin, locks (PR #206, 1 Nov):** 18 fixed: non-publisher saves of a published page become drafts; text-only editing keeps element styling props; every publish purges the page cache; approval hash matches form and database values; custom role matrices reach the publish guards; approval writes are claimed with a conditional update; one person may approve two steps by workflow setting (off by default); edits that reset a review write a history row; a workflow change offers to move documents in review; post tags match tag rules; shared field names warn; picture and file fields checked on the server; card state saved per card and merged; a failed save opens its card; old RSVP and submission lists redirect to their tabs; old collapse rows deleted; SEO settings clear the rules cache; template locks copy to pages made from a template. Checked, no change: backup covers approval tables; template parts are lockable through site templates. Moved to Task 1: options page location rules. Permanent: RSVP rights, Openverse host list, per-isolate rules cache up to 60 s.

**Where to find it:** No UI (backend only): approval, publish guard and page cache fixes in src/features/approval; workflow settings at /admin/roles > Approval workflows

<a id="adm-014"></a>
#### ADM-014 · 8 Nov Task 5 fresh-install questionnaire (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 5 fresh-install questionnaire (PR #226, 8 Nov):** dashboard dialog for admins, suggestions only turn sections on, summary before applying; migration `20270311_100000_setup_questionnaire` (existing installs marked skipped), baseline regenerated, fresh-install specs extended; translated.

**Where to find it:** /admin dashboard: setup questionnaire dialog (admins only; suggestions only turn sections on)

<a id="adm-015"></a>
#### ADM-015 · 8 Nov Task 4 admin walkthrough (PR #226, 8 Nov)

_Date: 8 Nov 2026_

**8 Nov Task 4 admin walkthrough (PR #226, 8 Nov):** once per user account (`eg_preferences` key `admin-tour`), Help button in the sidebar replays it, focus trap, 12 languages.

**Where to find it:** Admin sidebar > Help button (replays the admin walkthrough; shown once per account automatically)

<a id="adm-016"></a>
#### ADM-016 · repo renamed to `asticore/engage` (closed Task 21). Repo-slug links updated (README Deploy

_Date: 9 Nov 2026_

9 Nov 2026: repo renamed to `asticore/engage` (closed Task 21). Repo-slug links updated (README Deploy button, Stripe appInfo URL, template library guide URL, docs). Worker, D1, R2 names, localStorage cart key, export app id and gracengatsby.com left unchanged on purpose (renaming would break the live deploy and saved data).

**Where to find it:** No UI (docs/process only)

<a id="adm-017"></a>
#### ADM-017 · admin menu polish (Home label, no theme toggle or tooltips in the menu, name and photo in 

_Date: 9 Nov 2026_

9 Nov 2026: admin menu polish (Home label, no theme toggle or tooltips in the menu, name and photo in My preferences and the side menu, mobile menu slides in from the right with visible items). Better Auth: not used in this repo, so no equivalent was built.

**Where to find it:** Admin sidebar menu and /admin/settings/my-preferences (name and photo)

<a id="adm-018"></a>
#### ADM-018 · 9 Nov Task 17 feedback button for super admins (PR pending)

_Date: 9 Nov 2026_

**9 Nov Task 17 feedback button for super admins (PR pending):** sidebar Feedback button (admin role only, next to Help) opens the new issue page of asticore/engage in a new tab, pre-filled with portal version (package.json), admin page path and admin language; `src/admin/ui/FeedbackButton.tsx`, `feedbackUrl.ts`, strings in 13 languages, test `tests/int/feedback-url.int.spec.ts`. No tables, so no migration. Live click check goes into the live checklist (Task 20).

**Where to find it:** Admin sidebar > Feedback button (admin role only, next to Help); opens the project's new-issue page in a new tab

<a id="adm-019"></a>
#### ADM-019 · 9 Nov Task 17 feedback popup (follow-up)

_Date: 9 Nov 2026_

**9 Nov Task 17 feedback popup (follow-up):** the Feedback button now opens a modal (focus trapped, Esc/backdrop closes) with Report a bug / Request a feature; each opens the matching new issue page (`template=bug_report.md` + label `bug`, or `feature_request.md` + label `enhancement`) with version, admin page and language pre-filled. Issue templates now carry labels. New strings (feedback.title/bug/feature/hint/cancel) in 13 languages; test extended.

**Where to find it:** Admin sidebar > Feedback button > dialog with Report a bug and Request a feature

<a id="adm-020"></a>
#### ADM-020 · Task 18 activity log with clear (9 Nov, PR pending)

_Date: 9 Nov 2026_

**Task 18 activity log with clear (9 Nov, PR pending):** the audit log already held account-security events only; creates, edits, publishes, unpublishes and deletes on content, templates, forms, roles, shop settings records and similar collections (list in `ACTIVITY_LOGGED`, `src/localapi/registry.ts`; users log creates and deletes only; products hooked directly) now write to it, plus an `export` event on the activity, products, redirects and list CSV downloads. New screen `/security/activity` (`ActivityLogView`): filter by person (email or id; names link to that person's rows), event, collection and dates; CSV download; Clear panel (older than N days, one person, or all) that shows the count, needs the word CLEAR, and writes an `activity.cleared` record. Consent, privacy and clear records are never removed (`PROTECTED_AUDIT_ACTIONS`). Retention stays on the Security settings (`auditLog.retentionDays`, existing prune). Privacy erase now blanks email, address and browser on the customer's log rows. Spec `tests/int/activity-log.int.spec.ts`. No new table, so no migration.

**Where to find it:** /admin/security/activity (filters by person, event, collection and date; CSV download; Clear panel)

<a id="adm-021"></a>
#### ADM-021 · Task 7, 15 Nov 2026, PR pending

_Date: 15 Nov 2026_

Task 7, 15 Nov 2026, PR pending: Scheduled tasks screen has Next run, Run now, turn off and on per job (`JobControls`, `/api/admin-cron-job`, audit logged) and a 50 run history; one runner per job in `src/features/cron/jobs.ts`; state in `eg_cron_job_state` (migration `20270315_200000_cron_job_state`); the `schedules` heartbeat job cannot be turned off. Tests: `tests/int/cron-job-state.int.spec.ts`.

**Where to find it:** /admin/scheduled-tasks (Next run, Run now, on and off per job, 50-run history)

<a id="adm-022"></a>
#### ADM-022 · 32a Remove the Asticore SaaS button (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**32a Remove the Asticore SaaS button (built 16 Nov 2026).** The permanently disabled "Get suggestions from Asticore SaaS" button and its note are gone from the blog builder, with the two string keys in all thirteen dictionaries and the `.blog-ai__saas` style. Code: `BlogWizard.tsx`, `uiStrings/keys.ts`, dictionaries, `blog-builder.css`.

**Where to find it:** /admin/content/posts > Write with AI (Asticore SaaS suggestions button removed)

<a id="adm-023"></a>
#### ADM-023 · 21j Em dashes (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**21j Em dashes (built 16 Nov 2026).** All em dashes are gone from user-facing text: the select placeholder (now `Select`), the empty column hint, the divider icon, the empty option in custom fields (now `None`), and the translate banner in the English keys and all eleven dictionaries (a colon now), plus the Russian strings (a colon, or a comma where the sentence read better, for example in the renewal and event reminder emails). New `tests/int/no-em-dashes.int.spec.ts` fails if one appears in any `.ts` or `.tsx` file under `src` (the only exception is the page title separator pattern in `seo/resolve.ts`, which matches the character without showing it).

**Where to find it:** No UI (backend only): tests/int/no-em-dashes.int.spec.ts; em dashes removed from UI text across admin and emails

<a id="adm-024"></a>
#### ADM-024 · 17e Approval assigned to a named person (built 16 Nov 2026; reassign, due date and reminders still open)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**17e Approval assigned to a named person (built 16 Nov 2026; reassign, due date and reminders still open).** Settings, Roles, Approval workflows: each step can now name people as well as roles. Naming anyone means only they (and admins) can approve or send back that step; a tick box keeps the roles as a fallback. A workflow can also name a different approver for an author: that author's work is approved by the person named, at every step, whatever the step says, and nobody else (except admins) can approve it. A step may be named people only (no role). Saving checks the people exist and an author is not their own approver. The submit email and the next-step email go to the named people (and the roles too when the fallback is on), the waiting text and the refusal message name the person, and the history already records who approved. Per content type is the existing one active workflow per type. Code: `src/features/approval/{workflows,stateMachine,notify,handlers,workflowCollection,workflowForm}.ts`, `src/admin/views/{ApprovalWorkflowsPanel,RolesView,RolesViewClient}.tsx`, migration `20270316_200000_approval_named_approvers` (columns `approver_users`, `also_roles`, `author_routes`), `tests/int/approval-named-approvers.int.spec.ts`.

**Where to find it:** /admin/roles > Approval workflows > workflow step (named people and roles; author-specific approver)

<a id="adm-025"></a>
#### ADM-025 · 16g Bulk creation of pages, posts and products (built 16 Nov 2026)

_Date: 16 Nov 2026 · Original group: Built in the 15 to 32 run (16 Nov 2026), moved from remaining-work.md_

**16g Bulk creation of pages, posts and products (built 16 Nov 2026).** Settings, Bulk create: pick pages, posts or products, paste one title per line or a CSV (title, slug, parent, template; or upload a file), press Check the list for a table showing every row, its address and its problem (address already used or repeated in the list, parent or template not found, parents pointing at each other, duplicate product title), then Create makes drafts for every clean row, parents first, through the signed-in user's own access rules. Up to 200 rows per batch. The result report lists created, skipped and failed rows, with Undo this batch, which removes the drafts that are still unpublished and under a day old. One audit entry per batch (`bulk.created`, `bulk.undone`). No migration. Code: `src/features/bulkCreate/{plan,run}.ts`, `BulkCreatePanel.tsx`, `/api/admin-bulk-create`, `tests/int/bulk-create.int.spec.ts`.

**Where to find it:** /admin/bulk-create (Settings > Data and System > Bulk create): Check the list, Create, Undo this batch

<a id="adm-026"></a>
#### ADM-026 · 18j taskboard company scope (built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**18j taskboard company scope (built 17 Nov 2026).** A taskboard board can belong to a company and optionally one of its teams (`organization_id`, `team_id` on `eg_task_boards`, migration `20270319_100000_taskboard_org_scope`). Board settings show Company and Team pickers when Companies exist. `canAccessBoard` in `src/features/taskboard/logic.ts` follows the access helper for scoped boards (creator, company owners and admins, team members, or company members when no team); admins always open every board; unscoped boards keep the member-list rule. `src/app/(engage)/api/admin-taskboard/route.ts` loads the person's access. Test: `tests/int/taskboard.int.spec.ts`.

**Where to find it:** /admin/taskboard > board settings (Company and Team pickers, shown when Companies exist)

<a id="adm-027"></a>
#### ADM-027 · Task 14b leftovers (tag chips)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

Task 14b leftovers (tag chips): coloured tag chips on each media tile (also in the media picker, same grid) and a Tags column in the list view; a Tags box on the file edit screen with a tick per tag that saves at once (`MediaTagsEdit`, GET `/api/admin-media-tags?media=ID`); all hidden when Media tags is off. New admin strings in all 13 dictionaries. Tests: `tests/int/media-tags.int.spec.ts` (chipsFor).

**Where to find it:** /admin/content/media (tag chips on tiles, Tags column in list view, Tags box on file edit); tags screen /admin/media-tags

<a id="adm-028"></a>
#### ADM-028 · Task 14c (S3-compatible backup target)

_Date: 17 Nov 2026 (inferred from neighbouring entries) · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

Task 14c (S3-compatible backup target): the S3 backup destination has an optional Endpoint field (`destination_s3_endpoint`, migration 20270318_110000, idempotent). Empty means Amazon S3; an https origin (Backblaze B2, Wasabi, MinIO, Spaces) is used path-style with the same signer; plain http is refused. WebDAV not built. Tests: `tests/int/backup-s3-endpoint.int.spec.ts`, fresh-install spec, baseline regenerated.

**Where to find it:** /admin/settings/data-system > Backups > Destination > Amazon S3 > Endpoint field

<a id="adm-029"></a>
#### ADM-029 · A person per section (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**A person per section (12e leftover, built 17 Nov 2026).** No section field exists, so a section is derived (`src/features/approval/sections.ts`): for pages, the top-level page a page sits under (keyed by its id, the page itself when it has no parent); for posts, the first category (trimmed, lower case). Events, courses and products have none. A workflow has `sectionRoutes` (`{ "<section>": [user ids] }`, migration `20270318_220000_approval_section_routes`, `section_routes`); the editor shows "A different approver for a section" for Pages and Posts workflows (`loadSectionChoices` feeds the pickers: up to 200 top-level pages, distinct first categories of up to 1000 posts). Priority at a step: the author's route, then the section route, then the step's own named people or roles (`namedApprovers`). The review box, the step block message and the emails say "the approver named for this section". The section is worked out per request (not stored), so moving a page under another top-level page changes who approves it; admins and stand-ins work as before. Tests in `tests/int/approval-reassign.int.spec.ts`.

**Where to find it:** /admin/roles > Approval workflows > Pages or Posts workflow > A different approver for a section

<a id="adm-030"></a>
#### ADM-030 · Approver picker for non-staff people (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Approver picker for non-staff people (12e leftover, built 17 Nov 2026).** The people lists on the Roles page (named approvers, per-author approvers, stand-ins) now include anyone with a custom role, not only built-in staff roles, and read users in pages of 500 up to 5000 instead of stopping at 500 (`approverCandidates` in `workflowForm.ts`, `RolesView.tsx`). Plain customers stay out. A named person still needs review permission to approve. Test in `tests/int/approval-reassign.int.spec.ts`.

**Where to find it:** /admin/roles > Approval workflows: named approver and per-author approver pickers (includes custom roles)

<a id="adm-031"></a>
#### ADM-031 · Reassigning a review and stand-ins (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Reassigning a review and stand-ins (12e leftover, built 17 Nov 2026).** Reassign: on a document in review, an approver of the current step (or an admin) picks someone in the Review box and presses Hand over (`reassign` action in `src/features/approval/stateMachine.ts` and `handlers.ts`; GET returns `assignee`, `allowed.reassign` and `reviewerChoices`, names only). The person may then approve or send back that step besides the usual approvers, gets an email (`notifyReassigned`), and the queue row shows "handed to". It is stored inside the existing `reviewApprovals` JSON (no column on content tables) and cleared when the review moves to the next step, is sent back, withdrawn or restarted by an edit; a partial approval keeps it. Hand back to the usual approvers clears it. History row `reassigned` (no migration; `action` is plain text). Stand-ins: in the workflow editor (Roles page), Stand-ins for reviewers who are away lists a reviewer, who covers, and an optional last day away (`standIns` JSON on the workflow, migration `20270318_210000_approval_stand_ins`, `stand_ins`). While away, the stand-in may act wherever that reviewer could (their roles, or their name on a named step), still needs review permission of their own, sees those reviews in the queue and gets the step and overdue emails (`withStandIns` in `notify.ts`). Admins are not affected. English only. Tests in `tests/int/approval-reassign.int.spec.ts`.

**Where to find it:** Page edit screen, Review box > Hand over (for approvers of the current step); /admin/review-queue shows handed to

<a id="adm-032"></a>
#### ADM-032 · Overdue tag in the review queue (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Overdue tag in the review queue (12e leftover, built 17 Nov 2026).** Queue rows carry `overdue` (`loadReviewQueue` in `src/features/approval/handlers.ts`, using `isOverdue` and the workflow's review due days); `ReviewQueueTable.tsx` shows an Overdue tag beside the waiting time, in the queue page and the dashboard card. English only.

**Where to find it:** /admin/review-queue (Overdue tag beside waiting time); also the review card on the /admin dashboard

<a id="adm-033"></a>
#### ADM-033 · Review due days and overdue reminder (12e leftover, built 17 Nov 2026)

_Date: 17 Nov 2026 · Original group: Task 23 last leftovers (holds, countdown, header dropdown)_

**Review due days and overdue reminder (12e leftover, built 17 Nov 2026).** Each approval workflow has Days a review may wait (0 for none; migration `20270318_120000_approval_review_due_days`, column `review_due_days`). `runOverdueReviewReminders` in `src/features/approval/overdue.ts` runs inside the Scheduled publishing cron job: for reviews past the due date it emails the approvers of the waiting step once and writes an `Overdue reminder sent` comment on the review history so the next run skips it. Tests in `tests/int/approval-overdue.int.spec.ts`.

**Where to find it:** /admin/roles > Approval workflows > Days a review may wait; reminder sent by /admin/scheduled-tasks (Scheduled publishing job)

<a id="adm-034"></a>
#### ADM-034 · Tasks 4, 5, 6 leftovers (17 Nov)

_Date: 17 Nov 2026_

**Tasks 4, 5, 6 leftovers (17 Nov):** Task 4: `{{category_path}}` and `{{category_url}}` now fill on tag and author archives (they get the category tree), and a single post has `{{post.category_path}}` and `{{post.category_url}}` dynamic tags (`categoryTrail` and `categoryHref` in the post context); promo badge tag and category rules use a picker (`BadgeSlugField`: Product tags from `/api/product-tags`, categories Digital and Physical; typed slugs from before are kept and flagged when unknown). Task 5: five new events for webhooks and notification rules: `stock.low` (raised from `sendStockAlerts`, low and out, whatever the stock email setting says), `course.enrolled` (Enrolments afterChange), `subscription.started`, `subscription.cancelled`, `subscription.payment_failed` (Stripe subscription handler); each has an allowlist of fields, merge tags, labels in 12 languages. Task 6: style card names, descriptions and the section text are translated into the twelve languages (keys `themeStyle.*`); the generator picks a heading font and body font from the fonts installed in Site fonts (by the picks' heading kind, deterministic by seed; says so when none match and keeps the theme fonts) and suggests an effect from the Effects picker, each with a reason line. `/api/editor-fonts` now also returns each font's id and category.

**Where to find it:** /admin/settings/commerce > Shop switches > Promo badges (tag and category pickers); /admin/webhooks and /admin/notifications for the new events

<a id="adm-035"></a>
#### ADM-035 · Tasks 7 to 10 leftovers (17 Nov 2026)

_Date: 17 Nov 2026_

**Tasks 7 to 10 leftovers (17 Nov 2026).** Task 7: a browser opening a company-limited download while signed out is redirected to `/account/sign-in?redirect=` (`isBrowserNavigation`, `mediaSignInRedirect` in `src/features/organizations/mediaGate.ts`, used by `handleGetMediaFile`); Cloudflare Images work stays inside R2 through the binding, and the only public copy was the temporary Stream copy, so a company-limited or private video is now never sent to Stream (`isRestricted` in `optimiseStoredVideo`, `admin-media-optimise` route). Task 8: Empty the data has an optional "restart the numbering" step (`resetCounters`, clears `sqlite_sequence`), and the download is paged in parts of 5000 rows a table (`exportFeatureData(db, flags, feature, page)`, the panel downloads every part). Task 9: update popup text through `useAdminT` (`update.*` keys, twelve languages). Task 10: all Taskboard text through `useAdminT` (`tb.*` keys, twelve languages) and activity lines name the assignee instead of a user number. Tests: `media-company-gate`, `section-empty-data`, admin UI string suites.

**Where to find it:** /admin/database > Empty the data (optional restart of numbering); company-limited download rules are backend only

<a id="adm-036"></a>
#### ADM-036 · Tasks 8 to 10 second batch (17 Nov 2026)

_Date: 17 Nov 2026_

**Tasks 8 to 10 second batch (17 Nov 2026).** Task 10: `task.assigned`, `task.commented` and `task.due` are webhook events and notification triggers (`src/features/webhooks/events.ts`, `src/features/notifications/triggers.ts`, "customer" means the assignee); a switched-on rule owns the email, otherwise the built-in plain email goes out (`hasRule` in `src/features/taskboard/actions.ts`). Card archive and restore (`archived_at` on `eg_task_cards`, migration `20270318_100000_taskboard_archive_due`, activity `card.archived`, `card.restored`, Show archived toggle). Due reminders: hourly job `taskboard-due` (`src/features/taskboard/dueReminders.ts`, column `due_notified`: once per due date, skips archived cards and the board's last column). My tasks page `/admin/my-tasks` (`MyTasksPanel`, `GET /api/admin-taskboard?mine=1`). Task 9: one click update for a fork (`src/features/updates/oneClick.ts`, `POST /api/admin-update-apply`, Worker secrets `UPDATE_REPO` and `UPDATE_GITHUB_TOKEN`, fine-grained token with Contents read and write on the fork only; no database column because `eg_integrations` is full); version bumped to 1.1.0. Task 8: Empty the data on Media can also delete the uploaded files from R2 (`src/features/cleanup/emptyFiles.ts`; backups go to their own destination so are not touched). Tests: `taskboard`, `section-empty-files`, `update-one-click`.

**Where to find it:** /admin/notifications and /admin/webhooks (task events); /admin/taskboard > Show archived; due reminders in /admin/scheduled-tasks (taskboard-due)

<a id="adm-037"></a>
#### ADM-037 · Tasks 5 and 6 follow-ups (17 Nov)

_Date: 17 Nov 2026_

**Tasks 5 and 6 follow-ups (17 Nov):** notification rules have a look (stored as channel `email_brand` in `eg_notification_rules`, so no schema change): plain, or designed (wrapped in the Email design brand with the tags filled; stays plain until the brand is switched on). Email designer: undo and redo (`designerHistory.ts`, bursts of typing count as one step, 50 steps, Ctrl or Cmd + Z / Y), preview at Gmail, Outlook and Apple Mail content widths beside Computer and Phone, and dark mode colour checks in the lint (low text contrast, pure black text or panel, logo in dark mode, dim accent links). Style cards: drawn preview thumbnails (`StyleThumb`), the explanation lines are structured (`reasonItems`, keys `themeStyle.r.*`) and translated in the twelve languages, and the suggested effect is remembered in the browser and offered with an Apply button in the visual editor's Effects picker (never applied automatically).

**Where to find it:** /admin/notifications (rule look: plain or designed); /admin/email-designer (undo, redo, Gmail, Outlook and Apple Mail widths); style cards in /admin/settings/communication > Email design

<a id="adm-038"></a>
#### ADM-038 · Task 10 activity log feed and release notes (17 Nov 2026)

_Date: 17 Nov 2026_

**Task 10 activity log feed and release notes (17 Nov 2026).** Every taskboard write adds its entries to the main Activity log under collection `taskboard` (`src/features/taskboard/activityLog.ts`, written by the `admin-taskboard` route from the new rows in `eg_task_activity`; created maps to create, deleted to delete, the rest to update). `CHANGELOG.md` holds the release notes (1.1.0 and 1.0.0); tagging is left for Matt's decision. Test: `taskboard`.

**Where to find it:** /admin/security/activity (taskboard rows under collection taskboard); release notes in CHANGELOG.md (docs)

<a id="adm-039"></a>
#### ADM-039 · 41b

_Date: 22 Nov 2026 · Original group: Task 4 leftovers 41a to 41c (built 22 Nov 2026)_

41b: `tests/int/bid-terms-field.int.spec.ts` covers `BidTermsField`; every message from the Authentication overview actions (switch, allow or block, Test button and provider checks) now reads from `auth.msg.*` strings in the admin's language, in all 13 languages (`authMethodActions.ts`, `authMethodTest.ts`).

**Where to find it:** /admin/authentication (switch, allow or block, Test button and provider checks; messages in the admin language)

---

## Part 2: Log by date

### 23 Nov 2026

- [BLD-082](#bld-082) Task 3 chart and table data, grid editor, Spark carousel, flip and typed text
- [BLD-081](#bld-081) Task 9 content, layout and marketing options and examples
- [BLD-080](#bld-080) Hover gradient background
- [BLD-079](#bld-079) Task 15 34a2 Timeline from events or posts
- [BLD-078](#bld-078) Theme colour tokens on every design colour field
- [BLD-077](#bld-077) Task 10 29e Cart and order display conditions
- [BLD-076](#bld-076) Shape divider width, invert and bring to front
- [BLD-075](#bld-075) Task 10 29d Pay button
- [BLD-074](#bld-074) Hover blend mode and hover text stroke
- [BLD-073](#bld-073) Font family per device
- [BLD-072](#bld-072) Task 15 34g2 Poll element
- [BLD-071](#bld-071) Background colour per device
- [BLD-070](#bld-070) Task 15 34g2 Floating action button
- [BLD-069](#bld-069) Task 15 34d 3D viewer and product configurator
- [BLD-068](#bld-068) Border width per device
- [BLD-067](#bld-067) Position offsets with units per device
- [BLD-066](#bld-066) Task 15 34i AI on any selected element
- [BLD-065](#bld-065) Blend mode per device
- [BLD-064](#bld-064) Line height and word spacing units per device
- [BLD-068](#bld-068) Task 15 34h Oxygen and Storyblok parity check
- [BLD-063](#bld-063) Task 15 34g Elfsight catalogue sweep
- [BLD-062](#bld-062) Transform controls as popover groups
- [BLD-061](#bld-061) Task 15 34e Archive filters
- [BLD-060](#bld-060) Task 12 gradient kinds and second shadow layer (31e part)
- [BLD-059](#bld-059) Task 12 heading tag choice and per-device text styling (31e part)
- [BLD-058](#bld-058) Task 15 34f Slider options
- [BLD-045](#bld-045) Task 15 34c Calendar element
- [BLD-057](#bld-057) Task 12 image mask and link rel options (31e part)
- [BLD-056](#bld-056) Task 15 34c Calendar element
- [BLD-055](#bld-055) Task 12 image placement and overline
- [BLD-049](#bld-049) Task 11 maps and weather connections (23 Nov 2026)
- [BLD-050](#bld-050) Task 12 border sides, custom shadow, 20 dividers
- [BLD-052](#bld-052) Task 13 container layout (32a)
- [BLD-053](#bld-053) Task 13 legacy block conversion (32b)
- [BLD-054](#bld-054) Task 13 reusable section inputs (32c)
- [BLD-044](#bld-044) Task 15 34b Social feeds, wall and embeds
- [BLD-043](#bld-043) Task 15 34a Timeline element
- [BLD-045](#bld-045) Task 12 editor contrast and blue dark mode
- [BLD-046](#bld-046) Task 12 panels and mechanics
- [BLD-047](#bld-047) Task 12 field kit and first design controls
- [BLD-048](#bld-048) Task 12 reference matrix and Font Awesome Pro
- [BLD-051](#bld-051) Task 14 templates, examples and theme builder (33a to 33i)
- [STY-014](#sty-014) 40d third batch and data source (23 Nov 2026)
- [STY-015](#sty-015) 40d second batch (23 Nov 2026)
- [STY-016](#sty-016) 40d (part)
- [STY-017](#sty-017) 40c Tables
- [STY-018](#sty-018) 40b Charts

### 22 Nov 2026

- [SEO-025](#seo-025) Task 8 blog builder editable question sets
- [ADM-039](#adm-039) 41b
- [BLD-037](#bld-037) 16h Convert text to list or table in the visual editor (built 22 Nov 2026)
- [BLD-038](#bld-038) Task 10 widgets batch 1: world clock, progress tracker, dark mode toggle, bigger charts (22 Nov 2026)
- [BLD-039](#bld-039) Task 10 widgets batch 2: product images, stock, short description, meta (22 Nov 2026)
- [BLD-040](#bld-040) Task 10 widgets batch 3: sitemap and age gate (22 Nov 2026)
- [BLD-041](#bld-041) Task 10 display conditions batch 4: device, country, query parameter, cookie (22 Nov 2026)
- [BLD-042](#bld-042) Task 10 chat button batch 5 (22 Nov 2026)
- [EVT-011](#evt-011) 16g Event page type on posts (built 22 Nov 2026)
- [FRM-008](#frm-008) Site-wide CAPTCHA keys, test and look (Task 5, 21a, built 22 Nov 2026)
- [FRM-010](#frm-010) Task 15 34h5 Datasources: shared option lists
- [FRM-009](#frm-009) Spam folder, rule actions and Akismet (Task 5, 21b, built 22 Nov 2026)
- [I18N-012](#i18n-012) 41a
- [INT-019](#int-019) Task 15 34j Two-way Google Calendar sync
- [INT-018](#int-018) Task 9, 28d Live review sources (built 22 Nov 2026)
- [SEO-020](#seo-020) 16p Audit columns: image file sizes and last modified (built 22 Nov 2026)
- [SEO-021](#seo-021) 16e Visitor-facing blog links follow the blog address (built 22 Nov 2026)
- [SEO-022](#seo-022) 16d Manual Breadcrumbs follows the sitewide settings (built 22 Nov 2026)
- [SEO-023](#seo-023) Task 7 Add several pages on the Pages screen (22 Nov 2026)
- [SEO-024](#seo-024) Task 6 items 16m, 16n, 16o: accessibility in the SEO review, snippets and PageSpeed checklist, site audit dash
- [SPD-018](#spd-018) 41c

### 21 Nov 2026

- [SEC-053](#sec-053) Admin two-step on by default and 30-day sign-ins (21 Nov 2026)
- [SEC-054](#sec-054) Step-up confirmation for adding administrators (21 Nov 2026)
- [SPD-015](#spd-015) One-click updates, tables and code separate (built 21 Nov 2026)
- [SPD-016](#spd-016) Update popup live check (21 Nov 2026, PRs 531, 532)
- [SPD-017](#spd-017) One update popup, stable Shine/Spark URLs (built 21 Nov 2026)

### 20 Nov 2026

- [I18N-011](#i18n-011) Hebrew admin and portal language (20 Nov 2026)
- [STY-012](#sty-012) Shine and Spark from their releases, plus Front-end files (20 Nov 2026)
- [STY-013](#sty-013) Fonts never bundled; Open Sans is the default (20 Nov 2026)

### 18 Nov 2026

- [SPD-014](#spd-014) Lean installer with remote updates (built 18 Nov 2026, v1.2.0)

### 17 Nov 2026

- [ADM-026](#adm-026) 18j taskboard company scope (built 17 Nov 2026)
- [ADM-027](#adm-027) Task 14b leftovers (tag chips)
- [ADM-028](#adm-028) Task 14c (S3-compatible backup target)
- [ADM-029](#adm-029) A person per section (12e leftover, built 17 Nov 2026)
- [ADM-030](#adm-030) Approver picker for non-staff people (12e leftover, built 17 Nov 2026)
- [ADM-031](#adm-031) Reassigning a review and stand-ins (12e leftover, built 17 Nov 2026)
- [ADM-032](#adm-032) Overdue tag in the review queue (12e leftover, built 17 Nov 2026)
- [ADM-033](#adm-033) Review due days and overdue reminder (12e leftover, built 17 Nov 2026)
- [ADM-034](#adm-034) Tasks 4, 5, 6 leftovers (17 Nov)
- [ADM-035](#adm-035) Tasks 7 to 10 leftovers (17 Nov 2026)
- [ADM-036](#adm-036) Tasks 8 to 10 second batch (17 Nov 2026)
- [ADM-037](#adm-037) Tasks 5 and 6 follow-ups (17 Nov)
- [ADM-038](#adm-038) Task 10 activity log feed and release notes (17 Nov 2026)
- [AFF-010](#aff-010) Outbound clicks report (26d, built 17 Nov 2026)
- [AFF-011](#aff-011) 22d Franchising, first version (built 17 Nov 2026)
- [AFF-012](#aff-012) 17f Client reports, PDF and logo (built 17 Nov 2026)
- [AFF-013](#aff-013) 17f Client reports, sections, dates and Google numbers (built 17 Nov 2026)
- [AFF-014](#aff-014) 22f Client reports, first version (built 17 Nov 2026)
- [AFF-015](#aff-015) 17g Agency demos leftovers (built 17 Nov 2026)
- [AFF-016](#aff-016) 22g Agency demos, first version (built 17 Nov 2026)
- [AFF-017](#aff-017) 26b payout details and 26a bot count (built 17 Nov 2026)
- [AFF-018](#aff-018) 26c creatives kit (built 17 Nov 2026)
- [AFF-019](#aff-019) 26c member portal (built 17 Nov 2026)
- [AFF-020](#aff-020) 26a visit log (built 17 Nov 2026)
- [AFF-021](#aff-021) 26c reports (built 17 Nov 2026)
- [AFF-022](#aff-022) 26b product and tier rates (built 17 Nov 2026)
- [AFF-023](#aff-023) 26b category (tag) commission rules (built 17 Nov 2026)
- [AFF-024](#aff-024) 26b renewals and recurring commission (built 17 Nov 2026)
- [AFF-025](#aff-025) 26c affiliate webhook events (built 17 Nov 2026)
- [AFF-026](#aff-026) 26c translated affiliate emails and the now-payable email (built 17 Nov 2026)
- [AFF-027](#aff-027) 26e Affiliates page template and the welcome email (built 17 Nov 2026)
- [AFF-028](#aff-028) 26a short links (vanity codes per product) (built 17 Nov 2026)
- [COM-018](#com-018) Quote text in other languages (12c leftover, built 17 Nov 2026)
- [COM-019](#com-019) Editable quote emails (12c leftover, built 17 Nov 2026)
- [COM-020](#com-020) Quote link in the account portal (12c leftover, built 17 Nov 2026)
- [COM-021](#com-021) Files on a request (12c leftover, built 17 Nov 2026)
- [COM-022](#com-022) Request buttons (12c leftover, built 17 Nov 2026)
- [COM-023](#com-023) Form-fed requests (12c leftover, built 17 Nov 2026)
- [COM-024](#com-024) Bid mode (12c leftover, built 17 Nov 2026)
- [COM-025](#com-025) Waiting list with held places (12d leftover, built 17 Nov 2026)
- [COM-026](#com-026) Card fingerprint match for purchase limits (12d leftover, built 17 Nov 2026)
- [COM-027](#com-027) Atomic last place for purchase limits (12d leftover, built 17 Nov 2026)
- [COM-028](#com-028) Quote expiry reminder and sweep (12c leftover, built 17 Nov 2026)
- [COM-029](#com-029) Card expiry warning (13a leftover, built 17 Nov 2026)
- [COM-030](#com-030) Order bump (11h leftover, built 17 Nov 2026)
- [COM-031](#com-031) Failed payment email wording (13a leftover, built 17 Nov 2026)
- [COM-032](#com-032) Pay a quote by card (12c leftover, built 17 Nov 2026)
- [COM-033](#com-033) Purchase limit message and trusted customers (12d leftovers, built 17 Nov 2026)
- [COM-034](#com-034) Composite products (11b, built 17 Nov 2026)
- [COM-035](#com-035) Local pickup leftovers (11c, built 17 Nov 2026)
- [COM-036](#com-036) Header cart dropdown (23d)
- [COM-037](#com-037) Pre-checkout hold and countdown (23e)
- [COM-038](#com-038) Bundle holds (23e)
- [COM-039](#com-039) Elements and /cart (23d)
- [COM-040](#com-040) Cart expiry reminder (23e)
- [COM-041](#com-041) Free-shipping bar per zone (23c)
- [COM-042](#com-042) Empty cart suggestions (23c)
- [COM-043](#com-043) 23e Cart lifetime setting (built 17 Nov 2026, part)
- [COM-044](#com-044) 23c Per-line stock warnings (built 17 Nov 2026)
- [COM-045](#com-045) 23d Cart elements for the visual editor (built 17 Nov 2026, part)
- [COM-046](#com-046) 23c Gift wrap flat fee (built 17 Nov 2026, part)
- [COM-047](#com-047) 23c Cart note and gift message (built 17 Nov 2026, part)
- [COM-048](#com-048) 23c Save for later (built 17 Nov 2026, part)
- [COM-049](#com-049) 11e field mapping and update schedule (built 17 Nov 2026)
- [COM-050](#com-050) 11e feed cache (built 17 Nov 2026)
- [COM-051](#com-051) Task 11d wholesale mode (17 Nov)
- [EVT-005](#evt-005) Paid bookings (12b leftover, built 17 Nov 2026)
- [EVT-006](#evt-006) Event places per person (12d leftover, built 17 Nov 2026)
- [EVT-007](#evt-007) Appointments in the account portal (12b leftover, built 17 Nov 2026)
- [EVT-008](#evt-008) Booking reminder email (12b leftover, built 17 Nov 2026)
- [EVT-009](#evt-009) Service staff field and card badge (12a leftovers, built 17 Nov 2026)
- [EVT-010](#evt-010) Task 1 ticket tier pricing
- [FRM-006](#frm-006) Moderator email for new comments (22, built 17 Nov 2026, first slice)
- [FRM-007](#frm-007) Spam rules on comments and reviews (21b, built 17 Nov 2026, first slice)
- [I18N-008](#i18n-008) Approval text in the other twelve languages (12e leftover, built 17 Nov 2026)
- [I18N-009](#i18n-009) 16k Dropdown switcher and translation progress bars (built 17 Nov 2026)
- [I18N-010](#i18n-010) Task 3 translations
- [MEM-010](#mem-010) Member past-due banner (13a leftover, built 17 Nov 2026)
- [MEM-011](#mem-011) 23c Saved for later follows the account (built 17 Nov 2026)
- [SEC-034](#sec-034) Bot challenge on the PayPal buy step (12d leftover, built 17 Nov 2026)
- [SEC-035](#sec-035) Customer and member sign-in URL (19l, built 17 Nov 2026)
- [SEC-036](#sec-036) Audit drain filter and redaction (19i, built 17 Nov 2026)
- [SEC-037](#sec-037) Customer and member sign-in URL (19l, built 17 Nov 2026)
- [SEC-038](#sec-038) Guided CSP builder (19j, built 17 Nov 2026)
- [SEC-039](#sec-039) Customer and member sign-in URL (19l, built 17 Nov 2026)
- [SEC-040](#sec-040) Last sign-in on the admin user screen (18e leftover, built 17 Nov 2026)
- [SEC-041](#sec-041) IP and country blocking leftovers (19c, 19d, built 17 Nov 2026)
- [SEC-042](#sec-042) Audit log drain (19i, built 17 Nov 2026, first slice)
- [SEC-043](#sec-043) Per-route rate limit rules (19b, built 17 Nov 2026, first slice)
- [SEC-044](#sec-044) Bot detection (19k and 21c, built 17 Nov 2026)
- [SEC-045](#sec-045) Sign-in alerts (19g, built 17 Nov 2026, first slice)
- [SEC-046](#sec-046) Bulk user actions (19f, built 17 Nov 2026, first slice)
- [SEC-047](#sec-047) Ban and unban users (19e, built 17 Nov 2026, first slice)
- [SEC-048](#sec-048) Country blocking (19d, built 17 Nov 2026)
- [SEC-049](#sec-049) IP allow and block lists (19c, built 17 Nov 2026)
- [SEC-050](#sec-050) 19a CAPTCHA modes (built 17 Nov 2026)
- [SEC-051](#sec-051) 19a and 19k follow-ups (built 17 Nov 2026)
- [SEC-052](#sec-052) 19k Cloudflare signal rules (built 17 Nov 2026)
- [SEO-012](#seo-012) 16l Site planner extras (built 17 Nov 2026)
- [SEO-013](#seo-013) 16i Screen templates and staging blocks (built 17 Nov 2026)
- [SEO-014](#seo-014) 16i Coming soon email signup (built 17 Nov 2026)
- [SEO-015](#seo-015) 16d Breadcrumb schema on pages and posts follows the sitewide settings (built 17 Nov 2026)
- [SEO-016](#seo-016) Blog address (16e, built 17 Nov 2026)
- [SEO-017](#seo-017) Task 16g facts editor (17 Nov 2026)
- [SEO-018](#seo-018) Task 16f feed addresses and images (17 Nov 2026)
- [SEO-019](#seo-019) Task 16h site-wide traffic lights (17 Nov 2026)
- [SPD-013](#spd-013) Fresh install fix (PR)
- [STY-008](#sty-008) CSS modules removed (17 Nov 2026)
- [STY-009](#sty-009) Tailwind audit
- [STY-010](#sty-010) Repo renamed `asticore/effix` to `asticore/spark` (v0.4.0, `efx-` became `spark-`, `data-e
- [STY-011](#sty-011) Task 2 effects

### 16 Nov 2026

- [ADM-022](#adm-022) 32a Remove the Asticore SaaS button (built 16 Nov 2026)
- [ADM-023](#adm-023) 21j Em dashes (built 16 Nov 2026)
- [ADM-024](#adm-024) 17e Approval assigned to a named person (built 16 Nov 2026; reassign, due date and reminders still open)
- [ADM-025](#adm-025) 16g Bulk creation of pages, posts and products (built 16 Nov 2026)
- [AFF-001](#aff-001) 31d Linking to affiliate products (built 16 Nov 2026)
- [AFF-002](#aff-002) 31e Easy affiliate setup, first version (built 16 Nov 2026)
- [AFF-003](#aff-003) 31c Affiliate dashboard, first version (built 16 Nov 2026)
- [AFF-004](#aff-004) 31c emails (built 16 Nov 2026)
- [AFF-005](#aff-005) 31a attribution (built 16 Nov 2026)
- [AFF-006](#aff-006) 31e Get started checklist and share kit (built 16 Nov 2026)
- [AFF-007](#aff-007) 31b rules (built 16 Nov 2026)
- [AFF-008](#aff-008) 31b Commissions and manual payouts (built 16 Nov 2026, first version)
- [AFF-009](#aff-009) 31a Affiliate tracking, first slice (built 16 Nov 2026)
- [BLD-034](#bld-034) 21c Sliders (built 16 Nov 2026, extends the existing Slides element)
- [BLD-035](#bld-035) 21a A/B tests: suggestions and visual-editor editing (built 16 Nov 2026, partly; the on-canvas control and var
- [BLD-036](#bld-036) 20c Visual editor design warnings (built 16 Nov 2026)
- [COM-003](#com-003) 23e Stock hold at checkout (built 16 Nov 2026, part)
- [COM-004](#com-004) 23f Cart accessibility (built 16 Nov 2026)
- [COM-005](#com-005) 23c Coupon, shipping estimate and tax on the cart (built 16 Nov 2026, part)
- [COM-006](#com-006) 23b Mini cart drawer or dropdown (built 16 Nov 2026)
- [COM-007](#com-007) 28c Free-shipping progress bar (built 16 Nov 2026, part)
- [COM-008](#com-008) 17d Purchase limits against hoarders and bots (built 16 Nov 2026; waiting list, card fingerprint and bot chall
- [COM-009](#com-009) 17c Quote, bid and item requests (built 16 Nov 2026; card payment, bid auctions and form feed still open)
- [COM-010](#com-010) 16j Storefront currency sweep (built 16 Nov 2026; product screen redesign still open)
- [COM-011](#com-011) 16i Donations (built 16 Nov 2026; recurring and goal bar still open)
- [COM-012](#com-012) 16h Checkout handoff from forms (built 16 Nov 2026; order bump and upsell still open)
- [COM-013](#com-013) 16f Pay-later messaging (already built, verified 16 Nov 2026)
- [COM-014](#com-014) 16e Product feeds per channel and Pinterest (built 16 Nov 2026)
- [COM-015](#com-015) 16d Pricing rules by customer variables and preview (built 16 Nov 2026; wholesale mode still open)
- [COM-016](#com-016) 16c Local pickup method (built 16 Nov 2026)
- [COM-017](#com-017) 16a Carton and pallet quantity (built 16 Nov 2026)
- [EVT-003](#evt-003) 17b Booking pages, phase 1 (built 16 Nov 2026 on the proposed defaults in `the Bookings plan appendix of `docs
- [EVT-004](#evt-004) 17a Service products (built 16 Nov 2026; deposit and booking still open)
- [FRM-003](#frm-003) 26b Spam rules for forms (built 16 Nov 2026, forms only)
- [FRM-004](#frm-004) 27b Moderation (built 16 Nov 2026, first slice)
- [FRM-005](#frm-005) 27a Comments on blog posts (built 16 Nov 2026, first slice)
- [I18N-007](#i18n-007) 21k Languages (built 16 Nov 2026, the switcher style; the translations table already existed; language-specifi
- [INT-012](#int-012) 25b Native live chat, first version (built 16 Nov 2026)
- [INT-013](#int-013) 30a AI site chatbot, first version (built 16 Nov 2026)
- [INT-014](#int-014) 17h Google Analytics link (built 16 Nov 2026)
- [INT-015](#int-015) 22h Google Analytics user_id (built 16 Nov 2026)
- [INT-016](#int-016) 21b Ads and Pinterest (built 16 Nov 2026, partly)
- [INT-017](#int-017) 18b Live order tracking (built 16 Nov 2026; Sendle polling and a webhook built, other carriers need live check
- [MED-005](#med-005) 29g Previews, renditions, import, quotas (built 16 Nov 2026)
- [MED-006](#med-006) 29c Search and filters (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Features)
- [MED-007](#med-007) 29d Versions and safe delete (built 16 Nov 2026; part of the Asset manager, switch on under Site Settings, Fea
- [MED-008](#med-008) 29b and 29e Asset manager, first slice (built 16 Nov 2026; switch on under Site Settings, Features, Asset mana
- [MED-009](#med-009) 19b Media tags and sub-tags (built 16 Nov 2026; switch on under Site Settings, Features, Media tags)
- [MED-010](#med-010) 19a Media tree view (built 16 Nov 2026)
- [MEM-005](#mem-005) 18j Organisation access helper (built 16 Nov 2026)
- [MEM-006](#mem-006) 18a Dunning and retry for failed membership payments (built 16 Nov 2026; card-expiring warning and live Stripe
- [MEM-007](#mem-007) Task 22c company theming and portal layout (16 Nov)
- [MEM-008](#mem-008) Task 22a ownership transfer and delegation (16 Nov)
- [MEM-009](#mem-009) Task 22a (now 17a) ownership transfer and delegation (16 Nov)
- [SEC-006](#sec-006) 18l leftovers (built 16 Nov 2026)
- [SEC-007](#sec-007) 18g Username sign-in (built 16 Nov 2026)
- [SEC-008](#sec-008) Task 20a SAML 2.0, sign-in button and self-service setup (16 Nov 2026)
- [SEC-009](#sec-009) 25c Device authorisation and 25d MCP endpoint (built 16 Nov 2026; part of AI agent access)
- [SEC-010](#sec-010) 25b SCIM provisioning (built 16 Nov 2026; part of Single sign-on)
- [SEC-011](#sec-011) 25a Single sign-on per organisation, OpenID Connect (built 16 Nov 2026; also covers the OIDC part of 22b)
- [SEC-012](#sec-012) 23a1 Pending two-step token bound to the browser (built 16 Nov 2026; completes 23a1)
- [SEC-013](#sec-013) 23h Account switcher (built 16 Nov 2026; shows on the customer account screens and the sign-in screens once so
- [SEC-014](#sec-014) 25d AI agent access, first slice (built 16 Nov 2026)
- [SEC-015](#sec-015) 23k OpenAPI for auth endpoints (built 16 Nov 2026)
- [SEC-016](#sec-016) 23a2 Google connection reuses the sign-in client (built 16 Nov 2026)
- [SEC-017](#sec-017) 23a1 Pending two-step token single use (built 16 Nov 2026, part)
- [SEC-018](#sec-018) 23g Guest accounts and 28a Account cart with merge on sign-in (built 16 Nov 2026; live check in Live checks)
- [SEC-019](#sec-019) 23g Passkey as a second sign-in step (built 16 Nov 2026; live check in Live checks)
- [SEC-020](#sec-020) 23d More social providers, generic OpenID Connect and Google One Tap (built 16 Nov 2026; every provider is off
- [SEC-021](#sec-021) 23i Access tokens, signing keys and one-time tokens (built 16 Nov 2026; needs API keys switched on in Settings
- [SEC-022](#sec-022) 23h Session location and self-service delete (built 16 Nov 2026, part)
- [SEC-023](#sec-023) 23l Who can sign in with what (built 16 Nov 2026, part)
- [SEC-024](#sec-024) 29a Folders as records (built 16 Nov 2026)
- [SEC-025](#sec-025) 23a Verify auth behaviours (checked 16 Nov 2026)
- [SEC-026](#sec-026) 23c new sign-ups and active sessions (built 16 Nov 2026)
- [SEC-027](#sec-027) 23b switches on the Authentication overview (built 16 Nov 2026)
- [SEC-028](#sec-028) 24h Disposable email blocking (built 16 Nov 2026, member sign-up)
- [SEC-029](#sec-029) 24a Challenge on sign-in, register and forgot password (built 16 Nov 2026, member screens)
- [SEC-030](#sec-030) 18e leftovers built (16 Nov 2026)
- [SEC-031](#sec-031) 23e Last used badge (built 16 Nov 2026)
- [SEC-032](#sec-032) 23c Dashboard sign-in cards (built 16 Nov 2026, part)
- [SEC-033](#sec-033) 23b Authentication overview (built 16 Nov 2026, read only)
- [SEO-006](#seo-006) 21l Site planner (built 16 Nov 2026, planning and draft pages; filling each page with the AI builder is not wi
- [SEO-007](#seo-007) 21i Coming soon and staging (built 16 Nov 2026; signup form and the visual builder for the screen are not buil
- [SEO-008](#seo-008) 21h SEO checks (built 16 Nov 2026, the broken link checker only)
- [SEO-009](#seo-009) 21g Structured data (built 16 Nov 2026, the extra types)
- [SEO-010](#seo-010) 21f Blog RSS (built 16 Nov 2026; the knowledgebase part is not built)
- [SEO-011](#seo-011) 21d Breadcrumb styling (built 16 Nov 2026)
- [SPD-012](#spd-012) Next.js security patch (16 Nov)
- [STY-006](#sty-006) 20b Size checks (built 16 Nov 2026)
- [STY-007](#sty-007) 20a State contrast tests (built 16 Nov 2026)

### 15 Nov 2026

- [ADM-021](#adm-021) Task 7, 15 Nov 2026, PR pending
- [COM-002](#com-002) Task 4 (part), 15 Nov 2026, PR pending
- [EVT-002](#evt-002) Task 1 (events and tickets), 15 Nov 2026, PR pending
- [I18N-005](#i18n-005) Tasks 5 and 6, 15 Nov 2026, PR pending
- [I18N-006](#i18n-006) Task 3 (part), 15 Nov 2026, PR pending
- [STY-005](#sty-005) Task 2 (part), 15 Nov 2026, PR pending

### 9 Nov 2026

- [ADM-016](#adm-016) repo renamed to `asticore/engage` (closed Task 21). Repo-slug links updated (README Deploy
- [ADM-017](#adm-017) admin menu polish (Home label, no theme toggle or tooltips in the menu, name and photo in 
- [ADM-018](#adm-018) 9 Nov Task 17 feedback button for super admins (PR pending)
- [ADM-019](#adm-019) 9 Nov Task 17 feedback popup (follow-up)
- [ADM-020](#adm-020) Task 18 activity log with clear (9 Nov, PR pending)
- [INT-011](#int-011) 9 Nov Task 10 easy API creation, keys and feeds (PR pending)
- [MEM-004](#mem-004) Task 14 member groups and companies (9 Nov)
- [STY-004](#sty-004) closed Task 1 (reference file `reference/references.json` with shine, spark and engage-tem

### 8 Nov 2026

- [ADM-014](#adm-014) 8 Nov Task 5 fresh-install questionnaire (PR #226, 8 Nov)
- [ADM-015](#adm-015) 8 Nov Task 4 admin walkthrough (PR #226, 8 Nov)
- [BLD-031](#bld-031) 8 Nov Task 3 Elementor gap review (PR #226, 8 Nov)
- [BLD-032](#bld-032) 8 Nov Task 2 drag from the Elements bar (PR #226, 8 Nov)
- [BLD-033](#bld-033) 8 Nov Task 1 visual editor Elementor-parity tweaks (PR #226, 8 Nov)
- [EVT-001](#evt-001) 8 Nov Task 6 bookings research and plan (PR #226, 8 Nov)

### 2 Nov 2026

- [FRM-002](#frm-002) Task 3 forms and external embeds (PR #213, 2 Nov)
- [INT-008](#int-008) Task 1 leftovers: relation fields on import and export, options page rules (PR #211, 2 Nov)
- [INT-009](#int-009) Task 2 API gaps: DELETE, custom fields, messages, PDF, send to developer (PR #212, 2 Nov)
- [INT-010](#int-010) Task 2 webhooks: log redaction, retention, DNS guard, booking event, inbound webhooks (PR #214, 2 Nov)
- [MED-004](#med-004) Known limits: SVG, Openverse hosts, RSVP guest details (PR #210, 2 Nov)
- [MEM-003](#mem-003) Task 5 portal review (PR #216, 2 Nov)
- [SPD-005](#spd-005) Task 4 (architecture) closed 2 Nov 2026 (PRs #215, #218, #219, #220, #222)
- [SPD-006](#spd-006) Tasks 1 and 5 closed 2 Nov 2026 (PR #221 type debt 83 to 9 any, 43 to 15 eslint-disable)
- [SPD-007](#spd-007) Task 4 architecture (PR #215, 2 Nov)
- [SPD-008](#spd-008) Task 4 speed and Task 5 type debt (PR #217, 2 Nov)
- [SPD-009](#spd-009) Task 4 lazy sections and Unused tables (PR #218, 2 Nov)
- [SPD-010](#spd-010) Task 4 Next 16 upgrade (PR #220, 2 Nov)
- [SPD-011](#spd-011) Task 4 fresh-install speed (PR #222, 2 Nov)

### 1 Nov 2026

- [ADM-006](#adm-006) Task 4 tables and charts (PR #188, 1 Nov)
- [ADM-007](#adm-007) Task 9b settings UX (PR #196, 1 Nov)
- [ADM-008](#adm-008) Task 9a settings safety (PR #197)
- [ADM-009](#adm-009) Task 9c settings checks (PR #198, 1 Nov)
- [ADM-010](#adm-010) Task 11 operations (PR #199, 1 Nov)
- [ADM-011](#adm-011) Task 1 multisite (PR #203, 1 Nov)
- [ADM-012](#adm-012) Known limits: specs, schema, small leftovers (PR #204, 1 Nov)
- [ADM-013](#adm-013) Known limits: editing, approval and roles, custom fields, admin, locks (PR #206, 1 Nov)
- [BLD-030](#bld-030) Task 6 clarity (PR #192, 1 Nov)
- [COM-001](#com-001) Task 8 shop (PR #194, 1 Nov)
- [INT-005](#int-005) Task 3 tracking connections code (PR #187, 1 Nov)
- [INT-006](#int-006) Task 7 integrations leftovers (PR #193, 1 Nov)
- [INT-007](#int-007) Task 7 integrations, what was left (PR #195, 1 Nov)
- [MED-001](#med-001) Task 12b media formats and admin progress bar (PR #202, 1 Nov)
- [MED-002](#med-002) Known limits sweep: Media, Import and export, Fonts, Speed (PR #207, 1 Nov)
- [MED-003](#med-003) Task 5 srcset and account colours (PR #208, 1 Nov)
- [MEM-002](#mem-002) Task 5 portal search, later slices (PR #191, 1 Nov)
- [SEC-004](#sec-004) Password protection implementation notes folded in (1 Nov)
- [SEC-005](#sec-005) Task 17b password leftovers (PR #190, 1 Nov)
- [SEO-002](#seo-002) Task 2a and 2b, second PR (feat/task-2ab, commit d7510dc, 1 Nov)
- [SEO-003](#seo-003) Task 2a and 2b, first PR (PR #189, 1 Nov)
- [SEO-004](#seo-004) Task 10 SEO (PR #200, 1 Nov)
- [SEO-005](#seo-005) Known limits: SEO, redirects, consent, email, shop, ads (PR #205, 1 Nov)
- [SPD-004](#spd-004) Task 12 speed (PR #201, 1 Nov)
- [STY-003](#sty-003) Known limits sweep: Fonts (PR #209, 1 Nov)

### 31 Oct 2026

- [ADM-002](#adm-002) Accessibility and admin text
- [ADM-003](#adm-003) Task 16 and 3 polish (#180)
- [ADM-004](#adm-004) Task 5 tables and charts, slice 2 (PRs #173 and #174, 31 Oct)
- [ADM-005](#adm-005) Task 5 tables and charts, slice 1 (PR #171, 31 Oct)
- [BLD-020](#bld-020) Task 1a short links (#182, 31 Oct)
- [BLD-021](#bld-021) Task 1a AI guide cap (#178)
- [BLD-022](#bld-022) Task 1a legacy breadcrumbs and flaky spec (#179)
- [BLD-023](#bld-023) Task 1a leftovers (#155)
- [BLD-024](#bld-024) Task 2b templates hub (#153, #169, #161)
- [BLD-025](#bld-025) Task 2 duplicate starters (#153)
- [BLD-026](#bld-026) Task 2 template parts (#159, 31 Oct)
- [BLD-027](#bld-027) Task 1a short-link coverage (PR #184, 31 Oct)
- [BLD-028](#bld-028) Task 2 page and section templates CLOSED 31 Oct (PR #185)
- [BLD-029](#bld-029) Task 1a Visual builder CLOSED 31 Oct
- [FRM-001](#frm-001) Task 20 forms and embeds (31 Oct)
- [I18N-003](#i18n-003) Task 3 and 4 leftovers (31 Oct, PR #181)
- [I18N-004](#i18n-004) Task 3 languages closed (PR #186, 31 Oct)
- [MEM-001](#mem-001) Task 6 portal search, slice 1 (#152)
- [SEC-003](#sec-003) Task 13 privacy requests (#160, #164)
- [SEO-001](#seo-001) Task 2a blog builder, first slice (#154, 31 Oct)
- [SPD-002](#spd-002) Task 15 SITE_URL fallback removed (#158)
- [SPD-003](#spd-003) Task 13 CI workflow (#162)
- [STY-002](#sty-002) Design model step 4c, typed emitter removed (PR #183, 31 Oct)

### 30 Oct 2026

- [I18N-002](#i18n-002) Task 3 languages, locale links (#54 merged 30 Oct)
- [INT-003](#int-003) Task 19 API and webhooks (30 Oct)
- [INT-004](#int-004) Task 4 tracking (29 and 30 Oct)

### 29 Oct 2026

- [SEC-002](#sec-002) Task 6 admin hardening and multi-domain (29 Oct)

### 28 Oct 2026

- [BLD-019](#bld-019) Task 2b Templates hub (28 Oct)
- [I18N-001](#i18n-001) Task 3 languages (28 Oct)

### 27 Oct 2026

- [ADM-001](#adm-001) Task 2c (27 Oct)
- [BLD-018](#bld-018) Task 2 templates (through 27 Oct)

### 24 Oct 2026

- [SEC-001](#sec-001) Password protection and authentication

### 23 Oct 2026

- [BLD-015](#bld-015) Waves 70-71 (deployed 23 Oct)
- [BLD-016](#bld-016) Visual editor closed 23 Oct 2026, except Task 1a
- [BLD-017](#bld-017) Task 1a visual builder (18 to 23 Oct)

### 18 Oct 2026

- [BLD-014](#bld-014) Waves 43 to 48 (16 to 18 Oct) and waves 30 and 31

### Date not recorded

- [BLD-001](#bld-001) Waves 67-68 delivery
- [BLD-002](#bld-002) Export and assets
- [BLD-003](#bld-003) Build with AI
- [BLD-004](#bld-004) Editor usability
- [BLD-005](#bld-005) Page settings
- [BLD-006](#bld-006) Templates
- [BLD-007](#bld-007) Wave 69
- [BLD-008](#bld-008) Wave 68 fixes
- [BLD-009](#bld-009) Wave 68 other
- [BLD-010](#bld-010) Elements
- [BLD-011](#bld-011) Section display modes
- [BLD-012](#bld-012) Design panel
- [BLD-013](#bld-013) Foundation
- [INT-001](#int-001) Wave 68 social-feed
- [INT-002](#int-002) Wave 68 embeds
- [SPD-001](#spd-001) Fresh-install rules
- [STY-001](#sty-001) Design model steps 1 to 3 (#165, #166, #168); step 4 data side (#177)

---

## Appendices (unchanged)

## Appendix: Elementor-parity tweaks task list (closed, VE-01 to VE-15 built, PR #226)
### Visual editor – Elementor-parity tweaks (task list)

Review of `src/views/VisualEditor.tsx` + `src/views/visualEditor/*` against how Elementor's editor behaves.
The editor already covers most of Elementor's surface (section/column tree, responsive overrides, hover/focus
states, navigator with drag/rename/hide/anchor, element library with search/favourites/recents, "/" quick
insert, inline text editing, copy/paste + copy/paste style, undo/redo, context menu, templates, locks,
local draft recovery, translate mode). The tasks below are the gaps and bugs found. Each task is self-contained.

#### Conventions for every task

- Tree mutations go through `applyBlocks(change, key?)` in `src/views/VisualEditor.tsx`. It enforces the
  translate-mode guard, pushes undo history and sets `dirty`. Do not call `setBlocks` + `pushHistory` by hand.
- Lock checks: `lockedOut(path)` before editing a node, `insertBlocked(containerPath)` before inserting.
- Style edits require `userPermissions?.canEditStyle`.
- Paths: `NodePath` = number[]. Odd length = node, even length = column (`isColumnPath`).
- New UI text: add an English key to `src/features/uiStrings/keys.ts` and read it with `t('key')`
  (`useAdminT()`). Other locale dictionaries fall back to English; do not edit them.
- Keyboard shortcuts: `resolveShortcut()` in `src/views/visualEditor/useEditorShortcuts.ts`. Any key it
  resolves is automatically forwarded from the canvas iframe (`CanvasFrame.tsx` line ~156), so no frame change
  is needed for new shortcuts.
- Tests: vitest, `tests/int/*.int.spec.ts` (see `tests/int/visual-editor-history-clipboard.int.spec.ts`,
  `tests/int/responsive-editing.int.spec.ts`). Run one file: `pnpm vitest run --config ./vitest.config.mts tests/int/<file>`.
  Put pure logic in a pure helper module so it can be unit-tested without React.
- Before finishing: `pnpm lint` and the touched test files must pass.

Model hint per task: **Haiku** = mechanical, fully specified. **Sonnet** = needs reading surrounding code / design choices.

---

#### P0 – bugs

##### VE-01 · Paste style bypasses locks/translate/permissions and corrupts cross-device pastes — Haiku

**Elementor behaviour:** Right-click → Paste Style copies all style settings (every breakpoint) onto the target; it is one undo step and respects permissions.

**Problem** (`src/views/VisualEditor.tsx`, `pasteStyle`, ~line 905):
1. Calls `setBlocks` + `pushHistory` directly → skips `applyBlocks` (translate-mode guard), skips `lockedOut(path)`, skips `canEditStyle`.
2. When copy device ≠ current device it writes `design[sourceDevice] = sourceDesign` — e.g. copied on desktop, pasted while previewing mobile → stores a junk `design.desktop` key; copied on mobile, pasted on desktop → nests the *whole* design (incl. its own `tablet`/`mobile`) under `design.mobile`. `DeviceOverride` only accepts `RESPONSIVE_KEYS`.
3. History key `'pasteStyle'` coalesces two pastes on different nodes within 800 ms into one undo step.
4. Copies the source's `anchorId` → duplicate HTML ids.

**Do:**
1. Create pure helper `applyPastedStyle(target: BlockStyle | undefined, source: BlockStyle): BlockStyle` in `src/views/visualEditor/editorClipboard.ts`: returns `{ ...source, anchorId: target?.anchorId }` with `anchorId` removed when undefined. Ignore the clipboard `device` field entirely (the copied design already holds all breakpoints, same as Elementor).
2. Rewrite `pasteStyle`:
   ```ts
   if (!path || path.length === 0) return
   if (!userPermissions?.canEditStyle) { flashNotice('Your role cannot edit styles.'); return }
   if (lockedOut(path)) return
   const result = await readStyleClipboard(); if (result.ok === false) { flashNotice(result.error); return }
   const changed = applyBlocks((prev) => updateNode(prev, path, (node) => ({ ...node, design: applyPastedStyle(node.design, result.design as BlockStyle) })))
   if (changed) flashNotice('Style pasted')
   ```
   No history key (each paste = own undo step). Remove `device` from the deps if unused; add `userPermissions`, `lockedOut`, `applyBlocks`.
3. Keep `serializeStyle(design, device)` signature as is (backward-compatible clipboard format).

**Accept:** paste on locked node shows lock notice and changes nothing; paste in translate mode does nothing; paste across devices produces `design` equal to source design (plus target anchorId); two quick pastes = two undo steps.
**Tests:** add cases for `applyPastedStyle` to `tests/int/visual-editor-history-clipboard.int.spec.ts`.

##### VE-02 · Duplicate / paste / template insert duplicate `anchorId` (CSS ID) — Haiku

**Elementor behaviour:** CSS ID must be unique; Elementor warns. Duplicating here silently creates two elements with the same `id`, which breaks anchor links (`#contact`) and the scoped CSS that uses `#id`.

**Do:**
1. In `src/views/visualEditor/treeOps.ts` add pure `uniquifyAnchors(existing: SectionNode[], incoming: SectionNode[]): SectionNode[]`:
   - Collect every `design.anchorId` in `existing` (walk nodes, `columns[].blocks`, and column `design.anchorId`).
   - Walk `incoming` (deep, same shape); for any anchor already taken, rename to `${id}-2`, `-3`, … first free; add each final id to the taken set (so two incoming nodes don't collide either).
   - Return new objects; never mutate.
2. Apply it in `VisualEditor.tsx`: `duplicateBlock` (wrap the cloned node), `pasteAt` (the nodes from `withFreshIds`), `insertTemplateAt`, `importAppend`, `aiInsertAtEnd`. Pass the current tree (`prev`) as `existing`. Do **not** apply to `cutNode`→paste of the same node after it was removed (it is no longer in the tree, so it keeps its id naturally) or to `moveBlockTo`.
3. In `src/views/visualEditor/designWarnings.ts` add a warning "Duplicate CSS ID “x”" for any anchor used more than once (follow existing warning shape in that file).

**Accept:** duplicate a block with anchor `contact` → copy has `contact-2`; original unchanged; warnings list flags a hand-made duplicate.
**Tests:** `uniquifyAnchors` cases (nested section, column-level anchor, two incoming collide).

##### VE-03 · Legacy "hide on desktop / hide on mobile" makes blocks vanish in the editor — Haiku

**Elementor behaviour:** a widget hidden on the current device is shown faded in the editor so it can still be selected.

**Problem:** `blockStyleCss()` in `src/lib/blockStyle.ts` (~line 1291) honours `options.editor` (opacity 0.3) only for `tablet.hide` / `mobile.hide`. Legacy `hideOnMobile` and `hideOnDesktop` always emit `display:none`, so on the canvas the block disappears and cannot be clicked.

**Do:** compute `const hidden = options.editor ? 'opacity:0.3 !important' : 'display:none !important'` at the top of the function, and use it for both legacy rules (`hideOnMobile` inside `mobileDecls` → push `hidden` instead of `'display:none'`; `hideOnDesktop` rule → `${sel}{${hidden}}`). Leave non-editor output byte-identical except `!important` — check existing tests in `tests/int/responsive-editing.int.spec.ts`; if a test asserts the exact old string for the non-editor case, keep `display:none` (no `!important`) for the non-editor branch of the legacy rules.

**Accept:** in the editor at desktop width a block with `hideOnDesktop: true` is visible at 30 % opacity and selectable; live site still hides it.
**Tests:** `blockStyleCss({hideOnDesktop:true}, 'x', {editor:true})` contains `opacity:0.3`; without `editor` contains `display:none`.

##### VE-04 · No concurrent-edit protection in the visual editor — Sonnet

**Elementor behaviour:** "X is currently editing this page" takeover lock with heartbeat; prevents silent overwrites.

**Problem:** the normal admin edit form mounts `EditLockBanner` (`src/admin/views/EditLockBanner.tsx`, API `src/app/(engage)/api/admin-edit-lock/route.ts`), but the visual editor does not. `save()` (~line 1216) PATCHes blindly: two tabs/users overwrite each other.

**Do:**
1. Read `EditLockBanner.tsx` and the route to understand acquire/heartbeat/release/takeover. Mount `<EditLockBanner collectionSlug={surface.slug} id={route.id} … />` in the VE top area for `surface.kind === 'collection'` (match the props `DocumentPanel.tsx` passes). If the banner reports the doc is locked by someone else and not taken over, disable Save/Publish buttons and show the banner.
2. Optimistic check in `save()`: store `doc.updatedAt` on load in a ref (`loadedUpdatedAtRef`). Before the PATCH, `GET ${apiUrl}?depth=0` and compare `updatedAt`. If newer than the ref → `window.confirm('This page was changed by someone else since you opened it. Overwrite their changes?')`; cancel aborts the save with `setSaving('idle')`. After a successful PATCH set the ref from the response (`(await res.json()).doc?.updatedAt`) — note the form-mode branch already reads `res.json()`; read the body once and reuse it.
3. Globals (`surface.kind === 'global'`): only do step 2.

**Accept:** open same page in two tabs, save in tab A, save in tab B → B asks before overwriting. Second user sees lock banner.

---

#### P1 – Elementor parity

##### VE-05 · Missing Elementor keyboard shortcuts — Haiku

**Elementor:** Ctrl/Cmd+S save, Ctrl+Shift+C / Ctrl+Shift+V copy/paste style, Ctrl+I navigator, Ctrl+Shift+M responsive mode, Ctrl+P toggle panel. Today Ctrl+S opens the browser's "Save page as" dialog.

**Do** (`src/views/visualEditor/useEditorShortcuts.ts`):
1. Extend `ShortcutAction` with `'save' | 'copyStyle' | 'pasteStyle' | 'navigator' | 'cycleDevice' | 'togglePanel'`.
2. In `resolveShortcut`, inside `if (mod && !k.alt)`: before the `if (k.shift) return null` line add
   `if (key === 's' && !k.shift) return 'save'`, `if (k.shift && key === 'c') return 'copyStyle'`, `if (k.shift && key === 'v') return 'pasteStyle'`, `if (k.shift && key === 'm') return 'cycleDevice'`; after it add `if (key === 'i') return 'navigator'`, `if (key === 'p') return 'togglePanel'`.
3. Add `'copyStyle','pasteStyle'` to `NEEDS_SELECTION`.
4. In `handleKey`, `save` must work even while typing in an input: move the `isEditableTarget` check below `resolveShortcut` and skip it when `action === 'save'`.
5. Add rows to `SHORTCUT_LIST` + keys in `keys.ts` (`ve.shortcut.save`, `ve.shortcut.copyStyle`, `ve.shortcut.pasteStyle`, `ve.shortcut.navigator`, `ve.shortcut.device`, `ve.shortcut.panel`).
6. Wire handlers in `VisualEditor.tsx` (`useEditorShortcuts({... handlers})`, ~line 1056):
   `save: () => void save(false)`, `copyStyle: () => selectedPath && void copyStyle(selectedPath)`, `pasteStyle: () => void pasteStyle(selectedPath)`, `navigator: () => setDockTab((t) => (t === 'navigator' ? 'elements' : 'navigator'))`, `cycleDevice: () => setDevice((d) => (d === 'desktop' ? 'tablet' : d === 'tablet' ? 'mobile' : 'desktop'))`, `togglePanel: () => setDockCollapsed((c) => !c)`. `save` is declared after the hook — move the hook call below `save` or call through a ref (`saveRef.current = save`).
7. Context-menu hints: add `hint: \`${modLabel}+Shift+C\`` / `+Shift+V` to copy/paste style items (~line 1339).

**Accept:** each shortcut works from the parent page and from inside the canvas iframe; Ctrl+S in a text field saves and does not open browser dialog.
**Tests:** extend `resolveShortcut` tests for every new combo, and that Ctrl+Shift+Z still = redo.

##### VE-06 · Context menu: add Edit, Navigator, Reset style — Haiku

**Elementor:** right-click menu has Edit, Duplicate, Copy, Paste, Paste Style, Reset Style, Navigator, Save as Global, Delete.

**Do** (`VisualEditor.tsx`, items array ~line 1335 and the `onSelect` handler of `<ContextMenu>` ~line 1705):
- `{ id: 'edit', label: 'Edit' }` first → `setSelectedPath(path); setDockTab('settings')`.
- `{ id: 'navigator', label: 'Show in Navigator' }` → `setSelectedPath(path); setDockTab('navigator')`; ensure ancestors expanded via `setNavigatorExpandedState` (check `NavigatorPanel` key format, usually `pathKey(ancestorPath)` → `true`).
- `{ id: 'reset-style', label: 'Reset style', disabled: locked || !userPermissions?.canEditStyle }` after paste-style → `applyBlocks((prev) => updateNode(prev, path, (n) => ({ ...n, design: n.design?.anchorId ? { anchorId: n.design.anchorId } : undefined })))` after `lockedOut(path)` check. Then remove `design` key entirely when undefined (spread without it).
- Disable `paste-style` also when `!userPermissions?.canEditStyle`.

**Accept:** menu shows new items; Reset style is one undo step and keeps the CSS ID.

##### VE-07 · History panel (Actions) — Sonnet

**Elementor:** History panel (Ctrl+Shift+H) lists every action ("Heading – Edited", "Section – Added") and jumps to any point.

**Do:**
1. `src/views/visualEditor/history.ts`: add optional `label?: string` to `Snapshot`; `pushHistory(h, before, { key, label })` stores label on the pushed entry (and on coalesce, keep the existing entry). Export pure `jumpHistory(h, current, steps: number)` that applies undo (negative) / redo (positive) `|steps|` times and returns `{history, snapshot}` or null.
2. `applyBlocks(change, key?, label?)`: pass label. Give labels at call sites: Added <Type>, Deleted <Type>, Duplicated, Moved, Edited <Type> (in `updateSelected` – use `selectedDef?.label`), Pasted, Style pasted, Column change, Template inserted, Imported, AI insert. Type label: `getBlockDef(node.blockType)?.label` or element def label.
3. New `src/views/visualEditor/HistoryPanel.tsx`: list `past` (oldest → newest), a "Current" row, then `future` reversed; click row → `restoreSnapshot` from `jumpHistory`. Re-render on `historyFlags` change (add a counter to force refresh).
4. Add `'history'` to `DockTab` (`EditorDock.tsx`), tab button with clock icon, shortcut Ctrl+Shift+H (`resolveShortcut` → `'history'`).

**Accept:** 5 edits → 5 labelled rows; clicking row 2 restores that state; redo rows remain clickable.
**Tests:** `jumpHistory` and label storage in history tests.

##### VE-08 · Revisions tab (server versions) — Sonnet. Depends on VE-07 (shares the History panel).

**Elementor:** History → Revisions lists saved revisions with author/time; preview and Apply.

**Do:**
1. Second tab "Revisions" inside `HistoryPanel`. Load `GET /api/${surface.slug}/versions?where[parent][equals]=${route.id}&limit=50&sort=-updatedAt&depth=0` (globals: `/api/globals/${slug}/versions?limit=50&sort=-updatedAt&depth=0`), `credentials: 'include'`. Reference implementation: `src/admin/views/VersionsList.tsx` (author resolution, error handling). Hide the tab when the endpoint 404s (collection without versions).
2. Each row: relative time, author, status (draft/published).
3. "Apply" → `const raw = version.version[surface.blocksField]`; `applyBlocks(() => withIds(raw), undefined, 'Revision restored')`. It becomes an undoable edit; nothing is saved until the user saves (same as Elementor).
4. Refresh the list after each successful `save()`.

**Accept:** apply a revision → canvas shows old content, Undo returns to current, Save persists.

##### VE-09 · More properties responsive — Sonnet

**Elementor:** nearly every style control has per-device values. Here `RESPONSIVE_KEYS` (`src/lib/blockStyle.ts` line 57) omits position offsets, z-index, opacity, word spacing, transforms, font weight.

**Do:**
1. Add to `RESPONSIVE_KEYS`: `'position','posTop','posRight','posBottom','posLeft','zIndex','opacity','fontWeight','wordSpacing','tfRotate','tfScale','tfTranslateX','tfTranslateY'`.
2. `deviceOverrideDecls()` (~line 1230): emit `position`, `top/right/bottom/left` (same units logic as the base in `selfPositionCss`/`advancedCss` — read them first), `z-index`, `opacity`, `font-weight`, `word-spacing`, and `transform` built with the existing `transformValue()` over the merged style (`mergedU`) when any `tf*` key is in `own`. All with `!important` like the others.
3. Check sanitizers that whitelist override keys (`src/lib/design/storeDesign.ts`, `upgrade.ts`, `resolveDeviceOverride`) and extend them.
4. `DesignPanel.tsx`: switch the corresponding controls in Position / Typography / Effects-transform / Advanced groups to the responsive components (`RespNumber`, `RespSelect`, `ctl = makeResponsive(...)`) so they show the device icon + inherited value, exactly like padding does.
5. `designHelpers.ts` group reset must also clear these keys from `tablet`/`mobile`.

**Accept:** set z-index 5 desktop, 10 mobile → mobile canvas uses 10, desktop 5; reset group clears both.
**Tests:** add to `tests/int/responsive-editing.int.spec.ts`.

---

#### P2 – workflow polish

##### VE-10 · Preview / view page button — Haiku

**Elementor:** "Preview changes" eye icon in the top bar.

**Do:** in the top bar (`VisualEditor.tsx` ~line 1490, before Save) add an eye-icon button, collection pages only (`pageSettings` present). URL: `/${pageSettings.slug}` (`/` when slug is `home` — check how `src/app/(frontend)/[...slug]` resolves home and reuse its rule). On click: if `dirty`, `await save(false)` first; then `window.open(url, '_blank', 'noopener')`. Tooltip: if `status !== 'published'` say "Draft changes are only visible after publishing". Key `ve.top.preview`.

##### VE-11 · Save buttons reflect state — Haiku

**Elementor:** "Update" button is greyed when there are no changes and shows a dot when there are.

**Do:** "Save draft" button: `disabled={saving === 'saving' || !dirty}`. Publish button: add class `ve-btn--dirty` (small dot via `::after`, add CSS in `visualEditor.styles.ts`) when `dirty || status !== 'published'`. Keep `title`/tooltip explaining.

##### VE-12 · Finder (Ctrl+E) — Sonnet

**Elementor:** Finder jumps to pages, settings and commands.

**Do:** new `FinderPalette.tsx` modelled on `QuickInsertPalette.tsx` (reuse its CSS + `filterQuickInsert`-style ranking from `quickInsert.ts`). Sources: (a) every node in the tree by navigator name (`label` or type label) → select + scroll into view (send `selected` to frame); (b) commands: Save, Publish, Page settings (`setDockTab('settings')` with no selection), Navigator, History, Desktop/Tablet/Mobile, Import/Export, Keyboard shortcuts; (c) other pages: `GET /api/pages?limit=20&where[title][like]=<q>&depth=0` → navigate to `/admin/visual-editor/collection/pages/<id>` (confirm if `dirty`). Shortcut Ctrl+E (`'finder'` action).

##### VE-13 · Drag padding handles on canvas — Sonnet

**Elementor:** hover a section → drag top/bottom padding bars on canvas.

**Do:** in `Canvas.tsx` section render, add two thin handles (top/bottom edge, visible on hover/selected). Pointer-drag changes padding live (local preview state), on pointerup post a new bridge message `{ type: 'padding', path, side: 'top'|'bottom', value }` (add type + guard in `canvasBridge.ts`). Parent handler: `lockedOut` + `canEditStyle`, then `applyBlocks(...)` writing `design.paddingTop` on desktop or `design[device].paddingTop` on tablet/mobile (reuse logic in `makeResponsive` from `DesignPanel.tsx`), key `pad:${pathKey}`. Show px tooltip while dragging. Respect `paddingUnit`: only allow drag when unit is px/undefined.

##### VE-14 · Multi-select — Sonnet (largest)

**Elementor (Pro 3.x)** supports selecting several elements for delete/duplicate/copy.

**Do:** `selectedPaths: NodePath[]` alongside `selectedPath` (primary). Ctrl/Cmd-click (canvas: add `additive` flag to the `select` bridge message; navigator: same) toggles; Shift-click in navigator selects range within the same container. Bulk ops: delete (delete deepest/last index first so paths stay valid), duplicate, copy (serialize as multi-node clipboard – `serializeSelection` already handles a list? check; else extend), paste style to all. Settings panel shows "N elements selected" with only the bulk actions. All bulk ops = one `applyBlocks` call (one undo step). Locked nodes are skipped with a notice.

##### VE-15 · Global typography presets — Sonnet (needs product decision on data model)

**Elementor:** Site Settings → Global Fonts (Primary/Secondary/Text/Accent) selectable from any typography control, updates everywhere when changed.

**Today:** colours have theme tokens (`ColorRow` "Theme" button → `var(--…)`); typography has no global presets.

**Do:** add `typePresets: { id, name, fontFamily, fontSize, fontSizeUnit, fontWeight, lineHeight, letterSpacing, textTransform }[]` to theme settings (see `src/admin/views/ThemeStylesView.tsx` and the theme global), emitted as CSS classes `.tp-<id>` + custom properties in the site theme CSS. `BlockStyle.typePreset?: string` → wrapper gets class `tp-<id>`; per-block typography values still override. DesignPanel Typography group: preset dropdown at top ("Custom" = none). Admin UI to edit presets on Theme styles page.

## Appendix: Visual editor vs Elementor gap review (closed; items 3 and 4 moved to Tasks in `docs/remaining-work.md`)
### Visual editor vs Elementor: gap list (Task 3)

Task: evaluate Elementor (free + Pro, from general knowledge, not re-verified online) against the visual editor and list gaps, then build the agreed ones. Matt's clarifications (7 Nov 2026): no extra widget list; drag and drop of Elements panel items is a separate task (Task 2). Rule: the Catalogue principle in `docs/remaining-work.md` (one HTML primitive = one element; variations are options, Design effects, section display modes or templates; a new widget only for new markup, behaviour or data).

Already covered elsewhere, excluded here: the Elementor tweaks appendix above VE-01..VE-15 (paste style, CSS id duplicates, hidden blocks, edit lock, shortcuts, context menu, history/revisions, more responsive keys, preview, save state, finder, padding drag, multi-select, global fonts). Where a gap below touches one of those it is marked "see VE-xx" and not planned again.

Legend: exists / partial / missing. Effort S (under a day) / M (1-3 days) / L (a week or more). Value H/M/L. "Build now" = yes / later / no.

Scope of what was read: `src/lib/elements/registry.ts` and `wave*Defs.ts` (about 120 element types, 33 hidden legacy), `src/lib/sectionLayout.ts` (section display modes and flow), `src/lib/blockStyle.ts` (style keys), `src/views/visualEditor/DesignPanel.tsx` and `FieldPanel.tsx`, `src/lib/mergeTags.ts`, `src/features/siteTemplates/*`, `src/features/forms/*`, `src/lib/popupTriggers.ts`, `src/lib/visibilityRules.ts`.

---

#### 1. Widgets (catalogue)

Registry categories (`src/lib/elements/registry.ts` ELEMENT_CATEGORIES): text, media, interactive, marketing, layout, commerce, siteMeta, formFields. Deliberately not split Free/Pro. Per the clarification there is no new-widget wish list; only a coverage check against the Catalogue principle.

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Basic: heading, image, text editor, video, button, divider, spacer, icon, icon box, image box, star rating, counter, progress bar, tabs, accordion, toggle, alert, social icons, testimonial, HTML, anchor, shortcode, read more | exists: `heading`, `image`, `text-editor`, `video`, `divider`, `icon`, `icon-box`, `image-box`, `star-rating`, `counter`/`count-up`, `progress-bar`, `alert`, `social-icons`, `testimonial`, `html`, `anchor` (registry.ts, wave26Defs.ts, wave36Defs.ts); tabs, accordion, toggle as section display modes `tabs`/`accordion` (sectionLayout.ts SectionDisplay) with legacy `tabs`/`accordion`/`spacer`/`flip-box` hidden | none structural. Button is the `link` element (registry.ts) | - | - | no, covered |
| Pro: posts, portfolio, slides, form, login, nav menu, price list, price table, flip box, call to action, media carousel, testimonial carousel, countdown, share buttons, blockquote, Lottie, hotspot, progress tracker | exists: `post-list`, `slides`, `nav-menu`, `price-list`, `pricing-table`, `call-to-action`, `image-carousel`, `countdown`, `share-buttons`, `quote`, `hotspots`, `reading-progress` (wave*Defs.ts); carousel is also a section mode; forms via `src/features/forms/elementDefs.ts` | missing: Lottie / animated SVG player; login form element (accounts exist in `src/features/accounts`, not placed as an element) | M | L | later: Lottie needs a third-party player; login is a feature decision |
| Theme elements: site logo, site title, page title, post title, post excerpt, featured image, post content, author box, post navigation, post info, breadcrumbs, archive title, search form, nav menu, sitemap | exists: `site-logo`, `site-title`, `post-title`, `post-excerpt`, `post-featured-image`, `author-box`, `post-navigation`, `post-meta`, `auto-breadcrumbs`, `search-box`, `content-slot` (wave*Defs.ts) | missing: archive title/description element (archive template likely uses `dynamic-text`); sitemap | S | L | later |
| Woo: product title/price/image/add to cart/rating, cart, checkout, my account, product grid | exists: `product-price`, `product-rating`, `add-to-cart`, `cart-link`, `product-grid` block (src/blocks), `coupon-code` | checkout / my-account placement is page based, not an element | - | L | no (shop has its own pages) |
| Loop builder: loop grid, loop carousel, loop item template | exists: `loop-grid`, `archive-filter` (src/lib/elements/loopDefs.ts), site template kind `loop` (src/features/siteTemplates/kinds.ts) | missing: loop carousel (carousel is a section mode but a loop cannot render into it) | M | M | later |
| Marquee / scrolling text, animated headline, motion text | exists: `text-ticker`, `animated-headline`, `split-text`, `gradient-text`, `outline-text`, `highlight-text`, heading `effect` options | none | - | - | no |

Catalogue check: nothing in the registry duplicates a primitive in a way that needs merging; legacy duplicates are already hidden.

---

#### 2. Controls per widget (content / style / advanced)

Editor structure: per-element Content fields from `ElementDef.fields` (rendered in `FieldPanel.tsx`), Design panel accordions in `DesignPanel.tsx`: background, hover, spacing, border, layout, typography, position, dividers, effects, advanced, visibility rules, visibility (lines 135-456).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Background: classic colour/image/video, gradient, slideshow, overlay | exists: `BlockStyle.bgType` none/color/gradient/image/video/slideshow, overlay type/blend (src/lib/blockStyle.ts 18, 119-128) | gradient has two stops and an angle only (no multi-stop, radial); no hover/per-device background (see VE "more responsive keys") | M | L | later |
| Border, radius per corner, box shadow | exists: borderWidth/Style/Color, radiusTl..Bl, boxShadow presets (blockStyle.ts 141-154) | shadow is 4 presets only: no custom offset/blur/spread/colour, no inset | S | M | later |
| Typography (family, size, weight, line height, letter/word spacing, transform, style, decoration, shadow) | exists (blockStyle.ts 158-177); text FX gradient/outline/glow (textFx) | global fonts see VE-15; no `text-stroke` colour per element beyond textFx; no columns/drop cap | S | L | no |
| CSS filters, blend mode, opacity, transform (rotate/scale/translate/skew), hover transform | exists: filterBlur/Brightness/Contrast/Saturate/Grayscale/Hue, blendMode, opacity, `tf*` and `tfh*` keys (blockStyle.ts 348-394) | no backdrop-filter except `glass`; no transform origin; no mask image (only `maskShape` presets) | S | L | later |
| Hover/focus states | exists: hoverBgColor/TextColor/BorderColor/BoxShadow/Radius/Opacity/Transform, hoverTransitionMs, focusRing (blockStyle.ts 364-378) | no active/pressed state; hover overrides do not cover typography | S | L | later |
| Position: absolute/fixed/sticky, offsets, z-index | exists: position/posTop..posLeft/zIndex (blockStyle.ts 379-384) | offsets not per device | S | M | later (fold into VE responsive keys) |
| Custom CSS per element (Pro) | exists: `customCss`, `cssClasses`, `customClass`, `anchorId` (blockStyle.ts 343-398) | CSS id duplicates see VE-02 | - | - | covered |
| Custom attributes (Pro: `key|value` pairs on the wrapper; data-*, aria-*, role) | missing: no key in BlockStyle (grep for customAttr/attributes: none) | no way to set aria-label, role, data-* hooks for analytics, tabindex, title | S | H | **yes** (build item 1) |
| Custom width / flex child controls (align self, order, grow, basis) | exists: selfAlign/selfWidth/selfWidthPercent (blockStyle.ts 310-315), ColumnLayout grow/shrink/alignSelf/order/minWidth (sectionLayout.ts) | none significant | - | - | no |
| Element-level motion | see section 5 | | | | |
| Element tooltips / help text | exists: Tooltip + `helpText` on fields | none | - | - | no |

---

#### 3. Responsive options

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Breakpoints: up to 6 custom (mobile, mobile extra, tablet, tablet extra, laptop, widescreen) | partial: two site breakpoints, tablet and mobile, editable in Theme styles (src/admin/views/themeStyles/LayoutControls.tsx 113-116; defaults 900/600 in src/lib/sectionLayout.ts 142); desktop first, cascading | no laptop / widescreen / extra breakpoints | L | L | no: the three-device model is simple and consistent; extra breakpoints multiply every override |
| Every control per device | partial: `RESPONSIVE_KEYS` is a fixed list of 25 (padding, margin, textAlign, minHeight, self width/align, fontSize, lineHeight, letterSpacing, corner radii) (blockStyle.ts 57-84) | wide gap: colours, backgrounds, borders, position offsets, reveal, hover not per device | M | M | see VE "more responsive keys" (do not duplicate) |
| Hide per device | exists: desktop `hideOnDesktop`, tablet `tablet.hide`, mobile `mobile.hide`/legacy `hideOnMobile` (blockStyle.ts 88, 339-340, 1298-1315; DesignPanel.tsx 456-460) | none | - | - | no |
| Reverse columns / flow per device | exists: `SectionLayout.direction` per device incl. `row-reverse`/`column-reverse`, per-device gap, wrap/justify/align (sectionLayout.ts 26-31); column `order` per device | none | - | - | no |
| Grid per device | exists: gridColumns / Tablet / Mobile, gaps per device, gridMinWidth auto-fit, dense flow (sectionLayout.ts 74-90) | none | - | - | no |
| Preview per device in editor | exists (top bar device switch, `EditDevice` in DesignPanel.tsx 784) | custom preview width see VE preview task | - | - | covered |
| Container query / min-max width per device | partial: `minHeight` per device, `boxedWidth` single value (sectionLayout.ts) | boxed width and max width not per device | S | L | later |

---

#### 4. Flexbox / grid containers (section model)

The section is the container: a column tree with display modes. `SectionDisplay = 'columns' | 'tabs' | 'accordion' | 'carousel' | 'grid' | 'flex' | 'modal' | 'stack' | 'hscroll' | 'sticky-steps'` (src/lib/sectionLayout.ts line 24), edited in `FieldPanel.tsx` (modes list near line 458).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Flexbox container: direction, justify, align, wrap, gap, boxed width, min height | exists (sectionLayout.ts 35-60) | none | - | - | no |
| Grid container: columns/rows, gaps, auto flow, justify/align | exists (sectionLayout.ts 74-90); no explicit row count/row template | explicit rows and spanning cells (grid area) | M | L | no (columns + auto flow cover real use) |
| Nested containers | exists: sections nest (docs/remaining-work.md design model: "sections nest") | none | - | - | no |
| Carousel / tabs / accordion / popup / scroll story as modes | exists as `display` modes (variations are options, matches the Catalogue principle) | carousel lacks autoplay, loop, dots (only perView, gap, arrows: sectionLayout.ts 62-67) | S | M | later: see section 5 |
| Container shape dividers, background effects | exists: `dividerTop/Bottom` shapes + animation, `bgEffect`, particles, `maskShape` (blockStyle.ts 188-230) | none | - | - | no |

---

#### 5. Motion effects

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Entrance animation (fade, slide, zoom, bounce...) with duration, delay | exists: `reveal` fade/fade-up/fade-down/slide-left/slide-right/zoom/blur with distance, duration, delay, easing (blockStyle.ts 31, 268-273) | no repeat-on-scroll-out; presets fewer than Elementor (no rotate, flip, bounce) | S | L | no (Catalogue: add options only if asked) |
| Scrolling effects (vertical/horizontal scroll, transparency, blur, rotate, scale tied to scroll position) | partial: `parallax` background / float-up / float-down with strength, distance, direction (blockStyle.ts 211-232); element `draw-line`, `count-up` are scroll triggered | no scroll-linked opacity/scale/rotate/translate-X; no viewport range | M | M-H | **yes** (build item 4), product decision on browser support |
| Mouse effects (track, 3D tilt) | exists: `pointerFx` spotlight/tilt/magnetic with strength (blockStyle.ts 217, 283-285; src/components/blocks/PointerFx.tsx), custom cursor ring in `page-effects` (wave44Defs.ts 25) | no "mouse track" (element moves opposite/toward cursor) | S | L | later |
| Sticky (top/bottom, offset, per device, effects on scroll) | partial: `position: sticky` + offsets (blockStyle.ts 379-384), `sticky-bar` element (wave37Defs.ts 39), `sticky-steps` mode | no "sticky only on desktop", no shrink/transparent-on-scroll header | M | M | later |
| Hover animations | exists: `hover` lift/glow/zoom, `hoverTransform`, `kenBurns`, `borderFx` (blockStyle.ts 215-221) | none | - | - | no |
| Reduced motion | exists: `prefers-reduced-motion` handled in `src/components/blocks/effects.css` | none | - | - | no |

---

#### 6. Templates and kits

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Template library (blocks, pages), save as template | exists: TemplateBrowser.tsx, SaveAsTemplate.tsx, page_templates, template libraries/repos (src/features/templateLibraries, templateRepos), suggested templates hub (src/features/templatesHub) | none | - | - | no |
| Global widgets (edit once, update everywhere) | exists: `reusable-section` block (src/components/blocks/ReusableSectionBlock.tsx) and `template-part` element (src/lib/elements/templatePartDefs.ts) | none | - | - | no |
| Kit import/export (whole site: templates, global styles, settings) | exists: `engage-template` export (src/features/siteTemplates/templateIo.ts), settings transfer (src/features/settingsTransfer), starters (src/features/siteTemplates/starters.ts, src/features/starters.ts) | no single "kit" that bundles theme tokens + templates + pages in one file; not verified end to end | L | M | later (needs product decision) |
| Import/export JSON of a page | exists: ImportExportModal.tsx | none | - | - | no |
| Theme style presets | exists: StylePresets.tsx; theme tokens in src/features/themeStyles | style presets (not tokens) are per block only | - | - | no |

---

#### 7. Dynamic data

Mechanism: merge tags `{{title}}`, `{{field:name}}`, `{{option:site.phone}}` resolved by `src/lib/mergeTags.ts`; fields flagged `supportsMergeTags` get the `MergeTagPicker` (src/views/visualEditor/MergeTagPicker.tsx, lists custom field groups via `fetchFieldGroups`); dynamic widgets on templates (post-title, post-excerpt, post-featured-image, post-meta, `dynamic-text` in wave60Defs.ts with `{{post.title}} {{post.date}} {{page.title}} {{site.name}} {{product.price}}`); Loop grid + loop item templates (src/lib/elements/loopDefs.ts, src/features/siteTemplates/loopMergeTags.ts).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Dynamic tags on text (post title, date, excerpt, author, site title) | exists (above) | none | - | - | no |
| Custom fields (ACF-like) in tags | exists: `{{field:...}}` incl. repeater, gallery, group, link, map sub-keys (MergeTagPicker.tsx TYPE_HINT; src/features/customFields) | none | - | - | no |
| Dynamic links (post URL, custom field URL, author page, contact URL) on buttons/headings | partial: merge tags are allowed in text fields; the `link` field type (FieldPanel.tsx 1451, registry heading `link`) has no dynamic picker; `safeUrl` exists in mergeTags.ts for safe URLs | verify in the brief: whether `link` values already pass through merge-tag resolution on the public render | M | H | **yes, as build item 3** (needs a check first and a product decision) |
| Dynamic images (featured image, custom field image, site logo) on any image / background | partial: `post-featured-image` and `site-logo` elements, `{{image}}` tag for the loop item; generic `image` element and background image take a media pick only | image src / background from a tag | M | M | included in build item 3 |
| Dynamic visibility / conditions on dynamic values | partial: custom field value conditions exist for template location (`fieldValue` rule param, src/fields/customFields/types.ts) | not on element visibility | M | L | later |
| Request/URL parameters, cookies, user info as tags | missing: `{{...}}` tags are server-resolved and pages are edge cached for all visitors (docs/remaining-work.md Catalogue principle), so per-visitor tags need a browser resolver | `{{param:utm_source}}`, `{{user.name}}` with fallback text | M | M | later (needs product decision: privacy and flicker) |
| Archive tags (title, description, count) | partial: archive templates exist (below) and the loop uses the archive; no archive title/description tag in `dynamic-text` list | add `{{archive.title}}`, `{{archive.description}}` | S | M | later |

---

#### 8. Theme builder

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Template types: header, footer, single (post, page, custom post type), archive (posts, category, tag, author, CPT), search results, 404, loop item, sidebar | exists: `SITE_TEMPLATE_KINDS` header, footer, single-post, single-product, single-event, archive-blog, archive-shop, not-found, search-results, archive-category, archive-tag, archive-author, loop, sidebar-left, sidebar-right (src/features/siteTemplates/kinds.ts); dashboard tabs mirror Elementor (kinds.ts TEMPLATE_TYPE_TABS) | missing kinds: single-page (pages use their own content), archive-event, archive-faq, single-faq | M | M | later: each kind needs a route and resolver; no demand shown |
| Display conditions: include/exclude, all pages, specific pages, post type, category, author, date, etc. | exists: OR-of-AND groups, params templateKind, path, page, audience (members/guests/everyone), productCategory, productType, eventType, domain, language, postCategory, postTag; priority and specificity tie break (src/features/siteTemplates/conditions.ts 1-60, src/fields/customFields/types.ts 110) | include only: rules are equals / notEquals so exclude is expressible by notEquals; no "author" or "date" param | S | L | no |
| Template coverage checking | exists: src/features/siteTemplates/coverage.ts | none | - | - | no |
| Preview with sample item | exists: PreviewAsPicker.tsx | none | - | - | no |
| Sticky header, transparent header over hero | partial: position/sticky keys on a header section | no "scroll behaviour" preset; see section 5 sticky | M | M | later |
| Template export/import | exists: ExportTemplateLink.tsx, TemplateImport.tsx, templateIo.ts | none | - | - | no |

---

#### 9. Forms

Source: `src/features/forms` (types.ts, conditions.ts, submit.ts, notify.ts, webhooks.ts, layout.ts, spam.ts, upload.ts, pricing.ts, slots.ts) and the form block/field panels (FormBlockFieldsPanel.tsx, FormSettingsPanel.tsx).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Field types (text, email, textarea, url, tel, radio, select, checkbox, acceptance, number, date, time, file, password, html, hidden, recaptcha, step) | exists: FormFieldType text, textarea, email, phone, number, select, radio, checkbox, date, file, hidden, html, section, page (step), calculation, time, datetime, rating, nps, signature, matrix, appointment, address, consent, payment (src/features/forms/types.ts 16-41) | no `url` or `password` type (a `text` with a pattern covers url) | S | L | no |
| Multi-step with progress | exists: `page` field + `FormConfig.steps` progress bar/steps/text, back/next labels (types.ts 63-67) | none | - | - | no |
| Conditional logic (show/hide fields, all/any) | exists: ConditionalLogic with eight operators, evaluated on client and server (src/features/forms/conditions.ts) | notifications also conditional (FormNotificationRule.conditions, types.ts 97) | - | - | no |
| Actions after submit: email, email 2, redirect, webhook, Mailchimp, Slack, Zapier, etc. | exists: notification rules with conditions (notify.ts), auto-confirmation email, success message or redirect (types.ts 69-72), webhooks with secret (webhooks.ts), CSV export (csv.ts, exportEndpoint.ts), data retention | no named integrations (Mailchimp/Slack: webhook covers); redirect cannot depend on an answer | S-M | M | later (conditional redirect, product decision) |
| Spam: honeypot, reCAPTCHA | exists: src/features/forms/spam.ts | not verified which captcha providers | - | - | no |
| Submissions list, export | exists: collections/FormSubmissions.ts, submissionsApi.ts | none | - | - | no |
| Payments, appointments, calculation, save for later, prefill, embeds | exists (beyond Elementor: pricing.ts, slots.ts, expression.ts, saveForLater, prefill.ts, embeds.ts) | none | - | - | no |
| Form style (field/button/label typography, per field) | partial: presets theme/minimal/rounded/underline/card/dark, accent, custom CSS (types.ts 53-61) | no per-element style controls on fields | M | L | no |

---

#### 10. Popups

Popup = a section with display `modal` (src/lib/sectionLayout.ts 92-108; renderer src/components/blocks/PopupController.tsx; pure triggers src/lib/popupTriggers.ts; editor FieldPanel.tsx 606-681).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Trigger: on page load (delay) | exists: `popupDelay` 0..600 s | none | - | - | no |
| Trigger: on scroll depth | exists: `popupScroll` 1..100 % | none | - | - | no |
| Trigger: on click | exists: any link/button to `#popup-<anchorId>` (popupTriggers.ts `popupHref`, PopupController.tsx 132-142), plus the section's own trigger button/link (`modalLabel`, `modalStyle`) | none | - | - | no |
| Trigger: exit intent | exists: `popupExit` (popupTriggers.ts `isExitIntent`) | none | - | - | no |
| Trigger: inactivity / user idle | missing | no idle timer | S | M | **yes** (build item 2) |
| Trigger: scroll to element, after N page views | missing | | M | L | no |
| Frequency (once per session / N days / always) | exists: `popupFrequency` always/session/days + `popupDays` (sectionLayout.ts 28-30, popupTriggers.ts `frequencyAllows`) | no "never show again after interacting/submitting" | S | M | later |
| Bots never auto-open | exists: `isLikelyBot` (popupTriggers.ts) | none | - | - | no |
| Display conditions (which pages, audience, devices) | partial: popup lives in the page tree, so it appears where its section is; site-wide popup = a section in a header/footer template with its own conditions (kinds.ts, conditions.ts); element visibility rules `showAuth/showRoles/showUrl/showFrom/showUntil` apply (blockStyle.ts 330-336) | no dedicated popup template kind; fine under the Catalogue principle | - | - | no |
| Popup settings: overlay colour/opacity, close button position/style, close on overlay click/Esc, entrance and exit animation, prevent scroll, width/height/position | partial: `modalWidth` only (sectionLayout.ts 100-101); focus trap and scroll lock exist (PopupController.tsx header comment) | no overlay, close, animation, position options | S-M | M | **yes** (build item 2, same section) |
| Advanced rules (cookie, referrer, device) | missing | | M | L | no |

---

#### 11. Admin-level Elementor features

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Role manager (who can edit content / design) | exists: roles permissions + custom roles (src/features/roles/permissions.ts, resolve.ts), `canEditStyle` and per-element style key limits (roles/elementStyleKeys.ts), content edit guard, locks (roles/lockGuard.ts) | none | - | - | no |
| Maintenance / coming soon mode | exists: bypass field (src/admin/components/MaintenanceBypassField.tsx), `internalRouteGuard`, site health (src/admin/views/SiteHealthView.tsx), form maintenance (src/features/forms/maintenance.ts) | no visually built maintenance page (template kind) - not verified; check before planning | S | L | later |
| Custom fonts | exists: src/features/fonts (install.ts, selfHost.ts, catalog.ts, css.ts) | global fonts see VE-15 | - | - | no |
| Custom icons (icon library upload) | partial: SVG upload sanitising (src/features/media/svgSanitise.ts); `icon` element and `icon-list` use a fixed glyph set (registry.ts, wave*Defs.ts) | no custom icon set picker; media-SVG as icon is possible via `image` | M | L | later |
| Element caching / performance | exists: page edge cache and purge (src/features/speed: edgeCache.ts, pageCache.ts, purge.ts), prefetch rules, lazy-loaded controllers (`PopupControllerLazy`, `PointerFxLazy`, `ParticlesLazy`) | none | - | - | no |
| Accessibility | partial: heading tag independent of size (registry.ts heading), `focusRing`, reduced-motion CSS, popup focus trap, form labels | missing: aria-label / role / tabindex controls (see build item 1), alt text enforcement is a media concern | S | M-H | build item 1 |
| Global colours | exists: `globalColorId` tokens (src/lib/elements/colorResolver.ts), theme tokens (src/features/themeStyles) | global fonts see VE-15 | - | - | no |
| Navigator, finder, history, shortcuts, responsive preview | see VE-04..VE-14 | | | | covered |
| Display conditions on elements (Pro) | partial: showFrom/showUntil (dates), showAuth, showRoles, showUrl (blockStyle.ts 330-336, src/lib/visibilityRules.ts); decided in the browser | no weekday / time-of-day window, no language, no device-type | S | M | **yes** (build item 5) |

---

#### 12. Summary of confirmed gaps

High value: custom attributes (aria/data), dynamic links and images on non-text controls, scroll-linked motion, popup idle trigger and presentation options, extra visibility rules.
Medium/later: loop carousel, conditional redirect after form submit, archive tags, per-device background and position offsets (VE "more responsive keys"), custom icon library, sticky header behaviour, URL-param/user tags, kit bundle, extra template kinds.
No: extra breakpoints beyond tablet/mobile, Lottie, grid areas, new widgets (per Matt).

---

#### Recommended build set

Order is by value over effort. None overlaps VE-01..VE-15. All follow the Catalogue principle: no new element, only options on existing blocks. Common rules (from `docs/remaining-work.md`): additive JSON keys inside the stored `design` or `layout` (no column, so no migration unless stated); a new key goes into the style normaliser in `src/lib/blockStyle.ts` so unknown/unsafe values are dropped on read; ASCII source; English UI text keys in `src/features/uiStrings/keys.ts`; tests in `tests/int/*.int.spec.ts`; gates `pnpm exec tsc --noEmit`, related specs, `pnpm run build`. Design values are stored grouped (see "Design model" in remaining-work.md): check how `toStoredDesign` / `readFlatDesign` (src/lib/design) treat a new key, and add it to the group map if one exists.

##### 1. Custom attributes and ARIA (effort S, value H, no product decision)

- Stored key: `BlockStyle.customAttrs?: string` (one `name|value` pair per line, mirrors Elementor, max 10 lines, value max 200 chars). Keep it a string so it fits the flat/grouped design codec.
- Files: `src/lib/blockStyle.ts` (type, normaliser with a pure `sanitizeCustomAttrs(text): {name,value}[]`, and wherever the wrapper props are produced from a style, e.g. the function that returns `id`/`className`/style for `anchorId` and `customClass`); `src/components/blocks/StyledBlock.tsx` and the element wrapper path in `src/components/blocks/elements/elementUtil.ts` to spread the attributes; the editor canvas wrapper (`src/views/visualEditor/CanvasBlockPreview.tsx`) so the canvas matches; `src/views/visualEditor/DesignPanel.tsx` in the Advanced accordion (line ~448) add a textarea with a one-line help.
- Rules for `sanitizeCustomAttrs` (security, server and client use the same function): names must match `^[a-z][a-z0-9-]{0,39}$`; allow only `data-*`, `aria-*`, `role`, `title`, `tabindex` (-1/0 only), `lang`, `rel`, `target` is NOT allowed; reject anything starting with `on`, and `style`, `class`, `id`, `href`, `src`, `srcdoc`, `formaction`; values stripped of control characters and quotes handled by React (never use dangerouslySetInnerHTML); `role` limited to an allow list.
- Also add the key to `src/features/roles/elementStyleKeys.ts` so roles without full style access are handled consistently (check that file for how keys are grouped).
- Tests: unit tests for the sanitiser (accepts `aria-label|Open menu`, `data-track|cta`; rejects `onclick|x`, `style|x`, `href|javascript:x`, bad names, caps); a render test that the attribute reaches the wrapper; a round trip through readFlatDesign/toStoredDesign.
- Product decision: none. Note for the brief: duplicates with VE-02 (CSS id) are separate; do not touch `anchorId`.

##### 2. Popup: idle trigger and presentation options (effort S-M, value M)

- Stored keys (inside `SectionLayout`, src/lib/sectionLayout.ts, next to `popupDelay`): `popupIdle?: number` (seconds of no pointer/key/scroll/touch input, 5..600); `popupOverlay?: number` (overlay darkness 0..90, default today's value); `popupCloseOnOverlay?: boolean` (unset = true); `popupShowClose?: boolean` (unset = true); `popupAnim?: 'none' | 'fade' | 'slide-up' | 'zoom'` (unset = current behaviour); `popupPosition?: 'center' | 'top' | 'bottom' | 'right'`.
- Files: `src/lib/sectionLayout.ts` (types, sanitiser for the layout, `sectionLayoutProps` attributes/custom properties, and the static CSS in `sectionLayoutCss` which a test keeps in sync with styles.css: update both); `src/lib/popupTriggers.ts` add a pure `idleElapsed(lastActivityMs, nowMs, seconds)` helper; `src/components/blocks/PopupController.tsx` register the idle timer (reset on pointermove/keydown/scroll/touchstart, passive listeners, honour `frequencyAllows` and `isLikelyBot`, clear on unmount, do not auto-open if already open); `src/views/visualEditor/FieldPanel.tsx` (after line ~681, same pattern as `popupDelay`, clamp values like the neighbours); canvas preview must not auto-open in the editor (check how the existing triggers are suppressed there).
- Accessibility: keep focus trap and Esc to close; Esc must still close when "close on overlay" is off; the close button hidden only when `popupShowClose === false` AND Esc still works (decide with product whether to forbid hiding both overlay close and close button, recommended: when the close button is hidden, Esc and overlay close stay on).
- Tests: `tests/int` for `idleElapsed`, layout sanitiser clamps, CSS sync test (existing one for sectionLayoutCss), and a controller test if one exists for the delay trigger (search `popupTriggers` in tests/).
- Product decision: whether a popup may be made impossible to close by mouse (recommend no; keep Esc and one visible close path).

##### 3. Dynamic link and image sources (effort M, value H; needs a check and a product decision first)

- Step 0 (30 minutes): confirm whether `link`-type element fields and `button` links already resolve merge tags on the public render (`resolveMergeTags` and `safeUrl` in `src/lib/mergeTags.ts`; renderer helpers in `src/components/blocks/elements/elementUtil.ts`; the `link` field control at `src/views/visualEditor/FieldPanel.tsx` line ~1451). If they do, the work is only the picker; if not, the resolver too.
- Scope (recommended): allow merge tags in link URL and in image/background source on elements that appear in loop item templates, single templates and `template-part`. Tags offered: `{{url}}`, `{{image}}`, `{{field:name}}` (link subkeys `.url`), `{{option:...}}` (already defined in `src/lib/mergeTags.ts` lines 113-135 and `loopMergeTags.ts`).
- Files: `src/lib/elements/fieldTypes.ts` (`supportsMergeTags` flag already exists, line 59: set it on `link` and image fields in `registry.ts`/wave defs and make the editor honour it for those types); `FieldPanel.tsx` (show `MergeTagPicker` beside the `link` and `media` controls; for media allow a "use tag" toggle storing `{ tag: '{{image}}' }` or a plain string, decide shape in the brief before coding); renderers for `image`, `link`, `image-box`, `icon-box` etc. through one shared helper so each element does not re-implement it; `safeUrl` must be applied after resolution (block `javascript:` and `data:` except images); empty result falls back to the stored fallback (no broken link/image).
- Tests: resolver unit tests (tag resolves, unknown tag left as is or empty per mergeTags.ts convention, `javascript:` rejected after resolution, fallback image used), a snapshot render of a loop item with a dynamic link.
- Product decision: (a) which element fields get it (recommend: link and main image of image, image-box, hero/cta backgrounds); (b) fallback behaviour for empty values; (c) server resolution only (pages are edge cached, so no per-visitor tags here).

##### 4. Scroll-linked motion effects (effort M, value M-H; product decision)

- Stored keys (flat BlockStyle, Effects accordion): `scrollFx?: 'none' | 'fade' | 'scale' | 'rotate' | 'translate-x' | 'translate-y' | 'blur'` as a list is better but keep it simple: `scrollFx?: ScrollFx` (one effect, like `parallax`), `scrollFxStrength?: number` (0..100), `scrollFxStart?: number` and `scrollFxEnd?: number` (viewport range in percent, 0..100, default 0 and 60), `scrollFxDir?: 'in' | 'out'`.
- Renderer: progressive enhancement with CSS `animation-timeline: view()` and `animation-range` behind `@supports (animation-timeline: view())`, only transform/opacity/filter animate, off under `prefers-reduced-motion: reduce`. Browsers without support show the element in its normal state (no JS fallback; decide with product whether a small IntersectionObserver fallback is wanted: recommended no).
- Files: `src/lib/blockStyle.ts` (type, normaliser with clamps, a CSS emitter next to the `parallax`/`reveal` code that outputs a class plus custom properties, no inline keyframe strings from user data), `src/components/blocks/effects.css` or a new `src/components/blocks/effects-scroll.css` (own file per the lessons; the reduced-motion rule goes in it) and register it where `effects53.css` is imported, `DesignPanel.tsx` Effects accordion (line ~443) with the dot/Reset pattern used for the other FX rows, canvas injection so the editor preview matches (see how `effects.css` reaches the canvas frame, CanvasFrame.tsx).
- Conflicts to check: elements that already use `reveal` or `parallax` (decide: scrollFx and reveal both set `animation`; make them mutually exclusive in the editor with a one-line note, or compose via separate properties).
- Tests: normaliser clamps and unknown values dropped, emitted class/custom properties, reduced-motion CSS present (string test like the sectionLayoutCss sync test).
- Product decision: accept that Firefox ships `animation-timeline` later than Chromium/Safari (no effect there, page still fine)? If not, this becomes L with a JS scroll handler.

##### 5. Extra visibility rules: weekday, time of day, language (effort S, value M; small product decision)

- Stored keys (extend the visibility set, src/lib/blockStyle.ts `VIS_KEYS` line ~498 and `src/lib/visibilityRules.ts`): `showDays?: string` (comma list of weekday numbers 0-6, Sunday = 0, max 7), `showFromTime?: string` and `showUntilTime?: string` (`HH:MM`, 24 h; overnight windows allowed when from > until), `showLang?: string` (comma list of language codes, max 10, from the site's language list in src/features/multilingual).
- Evaluate in the browser like the existing rules (pages are edge cached and identical for all visitors): add the fields to `VisRules` and `evaluateRules` (`src/lib/visibilityRules.ts` line 139), to `needsClientGate` (line 111) so the gate is activated, and to the compact JSON form parsed by `parseRules` (line 117); `VisibilityGate.tsx` provides the context (`VisContext`, line 25) — add the current time and the page language there. Language can be decided on the server for a single-language-per-URL site, but keep it in the same gate for consistency unless the page already knows its locale (check `src/features/multilingual`).
- Editor: new rows in the "Visibility rules" accordion (DesignPanel.tsx line ~452), reusing the existing date inputs' pattern; summary chip text where rules are summarised (search `rulesFromStyle` callers).
- Tests: extend the existing visibility rules specs (search `visibilityRules` in tests/int) with weekday, overnight window, language match/mismatch, invalid values dropped.
- Product decision: which timezone the time window uses: the visitor's browser (simple, recommended) or the site timezone (needs a setting). Recommend visitor time and say so in the help text.

##### Not recommended now (reasons)

- More responsive keys, per-device background/position: already VE "more responsive keys".
- Extra breakpoints, grid areas, Lottie: cost exceeds value; the three-device model is a strength.
- Kit bundle, extra template kinds, loop carousel, conditional form redirect, URL-param tags: valuable but need product decisions or touch routes and resolvers; list them in `docs/remaining-work.md` as later items if Matt agrees.

##### Open questions for Matt

1. Build set: approve items 1 to 5, or choose a subset? (Items 1, 2, 5 are small and independent; 3 and 4 need the decisions above.)
2. Popup close rules (item 2) and time zone (item 5): as recommended?
3. Scroll effects (item 4): is "no effect in Firefox until it ships timeline support" acceptable?


## Appendix: Events and tickets audit (closed Task 1, moved from remaining-work.md 22 Nov 2026)
### Events and tickets audit (Task 5, 9 Nov 2026)

Checked against the code, not live.

#### What exists
- Ticket types: JSON `ticketTiers` on the event (name, description, price, capacity, sales end), ids for translation (`src/features/editScreens/tiers.ts`, `TicketTiersField.tsx`). Enforced on free RSVPs by `checkRsvpTier` (type required, on sale, room left).
- Capacity: event-level `capacity` enforced by `checkEventCapacity` on RSVP create; per-type capacity in `tierSales.ts`; page shows spots left.
- Free: public `RsvpForm` creates an `event-rsvps` row, sends the confirmation email (`rsvpConfirmation.ts`), fires the RSVP webhook, reminder cron, ICS file.
- Check-in: `EventCheckIn.tsx`, `/api/admin-event-checkin`, ticket code is the RSVP id (`#42`).
- Paid: event type `paid` plus one `ticketProduct`; page shows "Buy ticket" (AddToCartButton), normal shop checkout and order.

#### Gaps
1. Paid events have no link between order and RSVP: a paid order creates no `event-rsvps` row, so paid buyers get no booking confirmation, are not on the check-in list, and are not counted against capacity. (Needs a decision: create RSVPs from `order.paid`, plus order id column and migration.)
2. Price tiers are display-only on paid events: one product, one price. Selling per type needs one product or variant per tier. (Decision.)
3. Refunds: refunding an order does not cancel or free the RSVP (follows from 1). No cancel-RSVP action for free events.
4. Capacity check counts then inserts, so two simultaneous RSVPs can both pass (D1 has no row lock).
5. Confirmation email does not name the ticket type.
6. `EventTiers.tsx`, `RsvpForm.tsx` and the event page use Tailwind-style utility classes, against the one-style-system rule (Shine classes). Not converted here (visual change, needs a live look).
7. Public strings on the event page ("Ticket types", "Sold out") are English only.

#### Fixed in this change
- A sold-out event (no places left) showed the RSVP form or Buy ticket button; it now shows "Sold out" (`eventSaleMode`, tests in `tests/int/event-sale-mode.int.spec.ts`).
- **16h Definition list element and audit column order (built 23 Nov 2026).** New Definition list element (Text group, terms and descriptions, rendered as a `dl`; `DefinitionListElement` in `TextElements.tsx`, defined in `wave26Defs.ts`). The text block context menu offers Convert to definition list when every line is `Term: description`. 16p: audit table columns can be reordered by dragging a header or with the left and right arrows in the Columns list (`moveColumn` in `crawl/table.ts`); new columns are added at the end. No migration.
- **Fix: events pages kept their Event structured data (23 Nov 2026).** Adding Event as a rich page type for posts (16g) briefly made the events collection's own default Event a rich node; `jsonLdFor` now only treats a chosen rich type as the main entity when it is not that collection's default. Test in `tests/int/rich-schema.int.spec.ts`.
- **16p Rings of our own scores (built 23 Nov 2026).** The page card Snippets and page checks shows three rings (SEO, Accessibility, Technical) from the share of own checks passed per group, using the PageSpeed ring styles, so they work with no PageSpeed key (`OwnRings` in `PageChecksCard.tsx`). No migration.
- **16p Snippets and checks column on content lists (built 23 Nov 2026).** Pages, Posts, Products and Events lists have an optional Snippets and checks column (off until chosen under Columns). It shows the snippet types the last site audit detected for each row and its issue count (`crawlOverviewFor` in `crawl/store.ts`, a virtual column in `ListView.tsx`, no stored field and no migration). Rows not in the last crawl show a dash.
- **16l Site planner texts in all languages (built 23 Nov 2026).** Every text on the Site planner screen (plan list, brand voice and template pickers, Suggest sections, Move up and Move down, Plan diagram and its status labels, progress line, status messages, delete confirmation) and the Next planned page link in the editor dock now come from the shared UI strings (`planner.*`, 61 keys) and are translated into the 13 interface languages. Code: `SitePlannerPanel.tsx`, `EditorDock.tsx`, `src/features/uiStrings/keys.ts` and `dictionaries/*.ts`, regenerated `public/ui-strings/*.json`.
- **16b Pinterest tag events, Tag ID row and pin import (built 23 Nov 2026).** Pinterest is now a tracking platform: events set up in Tracking events are sent to the Pinterest tag when a Pinterest Tag ID is connected and marketing cookies are accepted (Purchase as checkout, AddToCart as addtocart, Lead and Contact as lead, CompleteRegistration as signup, Search as search, ViewContent as pagevisit, Custom as custom with the event name; PageView is left to the tag's own page call). The Tracking screen's Where events go list has a Pinterest tag row showing the Tag ID. Media has an Import from Pinterest section (shown when a Pinterest account is connected under Integrations): paste a pin address to import that picture, or leave it empty to import the latest pictures (up to 12) of the connected board; only pictures on pinimg.com are downloaded and each is saved like an upload (quota, duplicate check, folder rules, activity log). Code: `src/features/tracking/events.ts`, `runtime.ts`, `pinterestTagId.ts`, `editor/domainContext.ts`, `editor/TrackingDestinations.tsx`, `src/features/socialFeeds/pinterestImport.ts`, `src/features/dam/importSave.ts` (shared by both import routes), `/api/admin-media-pinterest`, `AssetManagerPanel.tsx`, tests `tracking-events.int.spec.ts` and `pinterest-import.int.spec.ts`.
- **16a Goal picker and traffic split slider (built 23 Nov 2026).** In the editor's A/B tests panel, creating a test lists the page's real wins to pick from (each button with a link is clicked, an internal link is visited, each form block is submitted) instead of typing a selector or path; typing one stays available. A slider sets the share Variant B gets (5 to 95 percent, original gets the rest) when creating a test, and each draft or stopped test has its own slider (refused while running). Code: `goalChoices` in `src/features/abTesting/suggestions.ts`, `AbIdeasPanel.tsx`, `/api/admin-ab-quick` (`split` action, `weightB`, form-submitted goal), `tests/int/ab-suggestions.int.spec.ts`.
- **16c Slider phone controls and video thumbnails (built 23 Nov 2026).** The Slides element has Arrows on phones and Dots on phones checkboxes (they follow the desktop Arrows and Dots choice until changed, so existing sliders look the same); controls hidden for a screen size get a CSS class and are hidden at 640px. The thumbnail strip shows a frame of a slide's video when the slide has no picture. Code: `slidesLogic.ts`, `wave65Defs.ts`, `Wave65Elements.tsx` (`deviceClass`), `wave65.css`, `tests/int/slides-settings.int.spec.ts`.
- **16e Blog address in the non-visitor places and recovery override (built 23 Nov 2026).** The admin View link, merge tag post links (Loop grid, Loop block, field tags), slug-change redirects, IndexNow, llms.txt, the visibility and password paths, PageSpeed targets, the tracking page picker and post breadcrumb structured data now follow the saved blog address. The environment variable `ENGAGE_BLOG_BASE` overrides the saved address for recovery (an invalid value falls back to /blog). Code: `readBlogBase`/`blogPath` in the files listed, `permalinkStore.ts`, `tests/int/blog-base-paths.int.spec.ts`.
- **16e Blog address with languages, pages and previews (built 23 Nov 2026).** A custom blog address now works under a language prefix (`/fr/news/hello` is served, `/fr/blog/hello` redirects to `/fr/news/hello`); the Translations documents list and the Templates hub blog archive preview use the address; and saving a top-level page whose slug is the blog address is refused (the same rule that stops saving the address when such a page exists). Code: `src/middleware.ts` (`blogAwareSecurity`), `documentRows.ts`, `templatesHub/rows.ts`, `src/collections/Pages.ts`, `tests/int/blog-base-permalinks.int.spec.ts`.
- **16c Slide layers, Spark effects and swipe-drag (built 23 Nov 2026).** Each slide can have up to 8 free-position layers (text, picture or button) placed by Left, Top and Width percentages, each with its own animation, start delay and Spark effect; a slide's text also has a Spark effect picker (effects from the catalog, running on the live page). The slider can be dragged with mouse or touch: a long drag or a short quick flick (momentum) moves to the next or previous slide, and a drag does not open a link under the pointer. Nested repeaters now start with an empty list. Code: `slidesLogic.ts` (`layersOf`, `swipeDirection`), `wave65Defs.ts`, `Wave65Elements.tsx` (`SlideLayerView`), `wave65.css`, `FieldPanel.tsx`, `tests/int/slides-settings.int.spec.ts`.
- **16a Whole-page tests, more variants, ideas from results and switching (built 23 Nov 2026).** The editor's A/B tests panel can create a whole-page test (a draft copy of the page becomes Variant B, shown through the existing page scope), add variants (up to 4 per test, even split, copied from Variant B), shows each test's outcome so far, and lists ideas built on this page's stopped tests (build on a winner, try a bolder change when the original held up or the result was unclear). Edit links reach every variant, and while editing a variant the dock names its test and links back to the original page. The split slider spreads the share across all variants. Code: `src/app/(engage)/api/admin-ab-quick/route.ts` (`addVariant`, `scope: 'page'`, `templateId` and `variantPageId` lookups, outcomes), `suggestions.ts` (`resultIdeas`), `AbIdeasPanel.tsx` (`AbVariantNotice`), `EditorDock.tsx`, `VisualEditor.tsx`, `tests/int/ab-suggestions.int.spec.ts`.
- **16e Shop and product category address (built 23 Nov 2026).** Permalinks has a Shop address (default `shop`, saved by an idempotent migration, 60 second cache, fails open to `/shop`, recovery override `ENGAGE_SHOP_BASE`). The middleware serves the custom address from the `/shop` folder (category pages included, also under a language prefix) and redirects the old `/shop` address with a 308 for page views; the blog address and the shop address cannot clash, and a page, the admin address or a sign-in address cannot take the shop address. Every place that builds a shop link now follows it: product cards, cart, mini cart, wishlist, recommendations, header default link, home page, search and suggestions, 404, checkout success, the shop, product and category pages (canonical, JSON-LD, breadcrumbs), loop grids, merge tags, feeds, sitemap, IndexNow, llms.txt, slug-change redirects, password and cache purge paths, affiliate short links, the abandoned-cart redirect, back-in-stock, waiting-list and review emails, the Stripe subscription cancel link, the Templates hub and Translations rows. Tests: `shop-base.int.spec.ts`, `shop-base-cart-recover.int.spec.ts` and the shop block in `blog-base-permalinks.int.spec.ts`.
