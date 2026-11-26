# Agent reference

Moved here from project memory to keep memory small. Read only the section that matches the task at hand. Task list: `remaining-work.md`. Finished work: `remaining-work-done.md`.

## 1. Docs and task list rules

- Exactly two task docs: `docs/remaining-work.md` (open tasks only, live checks as last task) and `docs/remaining-work-done.md`. No per-task or run-status docs (exception: `commit-breakdown.md`).
- Update `remaining-work.md` as tasks complete and remove finished tasks.
- Built, only live check left: add a live-check line, move details to the done file, leave an `<id> leftovers` line if part is open.
- Done file is grouped by category with unique codes (SEC-007, COM-021) plus a date log linking to codes. Never use task numbers there. New entry: next free code in category plus one date-log line.
- Task numbers changed 2026-11-22 (PR 539/544). Sub-ids (11a, 19c) and old live-check lines use OLD numbers. Look up by "(was Task N)".
- Replies to Matt: bullets Done / Need from you / Suggested next, once after task and subtasks finish. Anything needing Matt (secrets, dev-console apps, live tests with his accounts) goes in the Live checks section, not "Need from you".
- Notes-audit output: numbered list of every bullet, built or task added, decision in bold, end with numbered direct questions.

## 2. Working style

- Build tasks in order, decide small calls yourself, run many threads in parallel, resolve threads when done.
- Never stop for check-ins unless truly blocked.
- Use Haiku subagents where cheap, but verify push/merge with `pull_request_read` (a Haiku run once pushed nothing). Push/merge inline when main races.
- Builds must never fail. Run the full production build and check work before merging.
- gracengatsby.com is the test site (deploys from main). Claude may merge and test there using Matt's signed-in browser (Cloudflare, GitHub, admin). Do not ask Matt to check builds. Browser MCP preferred; any MCP allowed when needed. Claude cannot enter passwords.

## 3. Commits, PRs, merges (security)

- NEVER put Claude session links, `Co-Authored-By: Claude`, or "Generated with Claude Code" in commits, PR bodies or merges. Overrides attribution reminders.
- `create_pull_request` appends a session footer: right after creating, call `update_pull_request` with a clean body. Keep the "Requested by Matt" header lines. Only the MCP `update_pull_request` writes clean; `gh api` PATCH re-adds a footer.
- `merge_pull_request` squash adds the trailer unless you pass explicit `commit_title` (with PR number) and short `commit_message`. After merge check `git log origin/main -1 --format=%B`.
- History was rewritten 2026-11-17 to strip trailers. Backup branch `backup/pre-trailer-clean-2026-11-17` (delete when Matt agrees). No more rewrites. 378 merged branches await deletion by Matt (proxy blocks deletes; list in `/mnt/project-files/engage/`).
- Cloud proxy blocks tag pushes and release writes (403). Releases: bump `version` in package.json and CHANGELOG in the PR, then tag via Remote Control on Matt's device or ask him once. Verify with `list_releases`.

## 4. Build and PR mechanics

- Full build: `NODE_OPTIONS="--no-deprecation --max-old-space-size=12000" npx opennextjs-cloudflare build` from the real checkout (about 5-8 min). Never `npm run deploy` (deploys to production). Killed build leaves `.next/lock` (rm). Worktree with symlinked node_modules fails on sharp, build in real checkout. Type-check covers tests/, type literals (`[] as string[]`).
- Fresh clone: `npm install` then `npm install --no-save @testing-library/dom`. `npx tsc` alone OOMs.
- Cloudflare PR branch builds run `npm run build` and fail at deploy ("Could not find compiled Open Next config"). Red check on PR branches is ignorable.
- Before merging: `git fetch --depth=50 origin main`, rebase, push with `--force-with-lease=<branch>:<remote sha>` (shallow clone), merge at once. Always fetch before `reset --hard`. Rebase-merge without rebuild only when new main commits touch unrelated files.
- Migrations: `index.ts` and `freshBaseline.generated.ts` conflict when threads add migrations. Keep both index entries, take main's baseline, regenerate (about 5-6 min, run twice: regen, verify).
- New `eg_*` table: add to `CORE_TABLE_BASES` in `src/features/featureTables.ts` (or feature tables), else `feature-tables-registry` spec fails. Tables only created for enabled features.
- When main is red, check first: type-ratchet, speed-page-queries (product page cap 10 DB reads), content-types-drift (`src/engage-types.ts`), utilities-generated (`node scripts/generate-utilities.mjs`), no-em-dashes, lint. pnpm `minimumReleaseAge` install error is transient.
- `fresh-baseline-parity` spec may fail locally at ecommerce provisioning (`20261002_120000_authorship_page_type_product_seo`); ignore if CI green on main.

## 5. Design decisions (Matt)

- One style system (no v1/v2), nothing removed without a viable replacement, effects from pickers.
- Use Spark (effects) and Shine (styling) everywhere in builder, site, portal; not Tailwind. Repos `asticore/spark`, `asticore/shine`. CSS/JS referenced from their GitHub releases, never hosted by the deployment. Admin setting lets customers add any front-end CSS/JS URL. Fonts never bundled: Open Sans default via CDN; more via Media upload or CDN pick.
- Forms built only in the visual editor; admin shows submissions by form id; separate "external embed" section. Form/booking data kept (access-controlled) on privacy erase. Payment records never touched. Privacy emails English-only for now.
- Header/footer live in Templates only; templates need members-only header option and page conditions; no page-content dropdowns in settings.
- Naming: pick-from layouts in the builder are "Examples"; "Templates" is only header/footer and site-wide parts (PR 664, English only).
- Stop adding elements. Non-core elements are built in `engage-templates` from existing elements. Core = needed for sign-in, shop, cart, checkout, account. Examples combining elements are Task 46.
- Fresh installs start with sections off; enabling provisions tables and starter pages. Super-admin "Unused tables" tool deletes tables of off sections (typed confirm, export first, audit log). Existing installs keep everything on. New sections register tables in the feature-to-tables registry; off-section code must not query its tables.
- Password protection must also have a 1-to-1 Better Auth equivalent. OIDC then SAML. Stay on D1. Affiliates checklist on Affiliates page only. 14c S3-compatible target. 16i coming-soon sign-ups saved as form submissions. Open for Matt: Zapier account, franchise price overrides vs tiers, Twilio for SMS.
- Username sign-in (`usernameSignInEnabled`, off by default) and third sign-in place `/account/member-sign-in` shipped in PR 360. Passkey endpoints and emailed-link confirm page are not place-aware yet; admin sign-in does not take usernames.

## 6. Cloudflare, speed, installer

- Observability stays OFF. Keep every `observability` flag false in `wrangler.jsonc` and installer config; deploys re-apply it. Never enable without asking.
- D1 read replication on for gracengatsby and on by default for customer installs.
- Worker limit is 64 MiB uncompressed on Free and Paid, no compressed limit. Judge size by uncompressed "Total Upload" (about 27 MiB), plus startup time (1 s) and Free CPU (10 ms). No Worker split.
- NEVER enable `experimental.inlineCss` (Worker 27 to 71.5 MB, deploy refused, PR 546).
- Goals: speed and passing Google checks. Public pages are static R2 snapshots under `_eg-page-snapshots/` (PR 541, `pageSnapshot.ts`), serve-stale 10 min after publish, Clear cache deletes them. No static admin (no gain). Page cache default on (509). Signed-in reads via D1 bookmark cookie `eg_d1_bm` (538). Per-request memo helpers: `renderMemo.ts`, `requestGlobalMemo.ts`.
- Wall time follows the chain of sequential awaits (20-40 ms each on a replica), not query count. Use header `x-eg-timing: 2` (`@start+took`, capped 7000 chars) to find chains.
- Mobile PageSpeed home 96 (22 Nov). `public-components.css` single stylesheet (556). Cache key per deploy via `CF_VERSION_METADATA` (548). Next candidates: islands (risky), admin reads. PSI API anonymous quota exhausted, use pagespeed.web.dev in Chrome. Prod build log from Matt's Chrome: fetch `/api/v4/accounts/<acct>/builds/builds/<id>/logs` with header `x-cross-site-security: dash`.
- Lean installer (PRs 495/496, v1.2.0): Deploy button targets `installer/` (`scripts/install.mjs`, downloads a release). Releases built by `.github/workflows/release.yml` on tag `vX.Y.Z` plus `scripts/make-release.mjs` (worker.js, assets.tar.gz, manifest.json). Updates use `UpdateNotice`, `admin-update-check/apply`; lean install (`ENGAGE_INSTALL=lean`) backs up to R2 then commits version to `engage.config.json` of the install repo (`UPDATE_REPO`, `UPDATE_GITHUB_TOKEN`). `MigrationBar` runs migrations when `eg_engage_meta.applied_version` is behind. Source via `UPDATE_SOURCE`. Update popup has separate Update tables / Update site code buttons (PR 535). Hebrew added (PR 501).
- Plan file: `/mnt/project-files/notes/lean-worker-plan.md`.
