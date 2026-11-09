# Remaining work

Payload fully removed. Kept on purpose: `UNSIGNED-PAYLOAD` (S3/R2 constant in `src/features/backups/destinations/s3Client.ts`) and `payload` words in wrangler-generated `cloudflare-env.d.ts`.

**How to clear a task:** when a task is done, move it to "Done" with its PR numbers and delete it from the to-do list ("Open now" and "Tasks").

## How this document is kept up to date
1. Read this doc (`docs/remaining-work.md` in the repo; Done list in `docs/remaining-work-done.md`) before starting work; the task numbers below are the order of work.
2. Update it ONCE per finished task (or at the end of a working session), never mid-task: the project tool has no patch, so each update is a full rewrite.
3. On each update: move the finished task into "Done" as one line with its PR numbers; for a partly done task, move its shipped history to "Done" and keep only its open items under "Tasks"; delete anything done or no longer needed; renumber the remaining tasks and fix the "task N" cross-references.
4. Anything built but not checked live goes into "Task 20" (not silently dropped). Known limits go into "Open now". Decisions made by you are written into the task they affect.
5. New requests become a numbered task in the right place (or appended at the bottom if you say "later"), with what exists today, what to build and what needs your decision.
6. Every feature, past and future, must work on a brand new single-click install: each new table or column is created by an idempotent migration registered in `src/migrations/index.ts` and covered by `tests/int/internal-migrate-fresh-install.int.spec.ts` and `tests/int/fresh-install-schema-coverage.int.spec.ts`, so the install builds the schema itself and nobody runs SQL by hand. Features already covered: site files, cookie consent (and banner settings), media library and file upload, ads, custom role rules and locks, shop catalogue and orders, extra fields import, content approval and approval workflows, custom fields v2, site fonts, redirects, roles, visibility and schedule, backups, forms, A/B tests.
7. Keep the Process and Lessons sections current; remove a lesson once it is enforced by a test.

## Open now (as of 2 Nov 2026)
- Fresh-account deploy not verified: Deploy button on a second Cloudflare account (see detail below).
- Activity log (closed Task 18): export audit covers the activity log, products, redirects and list CSV downloads; the event RSVP, form submission, shop report, manifest, data view and consent log downloads are not yet written to the log (add `auditExport` from `src/features/security/exportAudit.ts` to each). Shop orders and other records with their own history are left out of edit logging on purpose (see `ACTIVITY_LOGGED` in `src/localapi/registry.ts`).
- Known limits (what is left after the 1 Nov sweep: each is either "Permanent" with the reason, or waits on a live check in Task 20; everything fixable was fixed or moved into closed tasks 1 to 5):
  - Ads: Permanent: AdSense auto ads cannot be unloaded on client navigation (Google tag, vendor); Prebid price floors need the Price Floors module (Prebid vendor setup).
  - Media: Permanent: old binary .xls is not read (save as .xlsx or .ods); Permanent: re-optimising a picture keeps its file name because pages link to it (uploads take the right extension); Permanent: Cloudflare Stream makes MP4 only and Cloudflare Images cannot write JPEG XL, so a WebM or JPEG XL choice keeps the file as it is, and a video link is a URL with nothing to convert; Permanent: the Worker reads each request into memory once, so the 100 MB cap is the ceiling (larger files are written to R2 in parts).
  - Shop: Permanent: customer bulk actions and custom order statuses are not built (decided in closed Task 8: personal data, privacy request flow).
  - Import and export: Permanent: imported admin users become editors unless 'Allow admin accounts' is ticked (a deliberate security choice); Permanent: font files are not in the export, so a font whose files are not on this site is left out with a warning; Permanent: shop customers are exported for records and an import does not recreate them (personal data).
  - Email: Permanent: a complaint or bounce suppresses bulk mail only, so order and sign-in mail still go out (deliberate); Cloudflare Email has no bounce feed (vendor).
  - SEO: Permanent: a YouTube playlist link has no single video to describe.
  - Consent and tracking: Permanent: a tag with no consent signal or API here (GA4 or GTM with Consent Mode off, TikTok, custom code) is stopped only by a reload; these cannot be unloaded.
  - Admin: Permanent: Workers do not share memory, so the server header, blocked-path and llms.txt rules are held per isolate for up to 60 seconds; a save clears the saving isolate at once. Permanent: check-in keeps its own guard (events update and Event RSVPs read), so a volunteer on the door sees the guest list without View guest details.
  - Webhooks: Permanent: Workers cannot pin a fetch to the address the DNS check resolved, so a host name that changes its answer between the check and the connect is not caught; the check refuses private answers and narrows the window (the reason is in the header of src/features/webhooks/outbound.ts). Permanent: a redacted delivery cannot be replayed, by design. The inbound endpoint and retention strings (62 keys) are English in the twelve other languages until a translation pass is done.
  - Multi-domain: Permanent: the ecommerce plugin's own Products config is vendor code outside this repo, so it lacks the "Available on domains" field and slug check; the repo's shadow config (src/features/ecommerce/collections/Products.ts) has both.
  - Types: Permanent: 9 `any` and 15 eslint-disable remain (react-hooks fetch-on-mount and localStorage sync whose tests count the first request); the ratchet in tests/int/type-ratchet-baseline.json holds the line.
  - Visual editor limits are in its reference section below.
- Later integrations (build on request, not a task): Google Calendar, Business Profile, Merchant Center, Drive and Sheets (read-only scopes today); newsletter and CRM list sync (Mailchimp, Klaviyo, HubSpot, Brevo lists). Each needs Matt to pick it first.

### Fresh-account deploy check (detail)
Deploy button on a fresh Cloudflare account, not verified. Covers migrations `20261003_100000_visibility_schedule_lock_events_seo`, `20261005_100000_redirects`, `20261005_110000_pages_sort_order`, `20261006_100000_roles`, `20261007_100000_users_authorship`, `20261008_100000_integrations_expand`, `20261009_100000_user_permission_overrides`, `20261010_100000_site_fonts`, `20261011_100000_site_files`, `20261011_110000_cookie_consent`, `20261011_120000_media_library`, `20261011_130000_content_approval`, `20261011_140000_custom_fields_v2`; the `images` binding in `wrangler.jsonc` (Cloudflare Images transformations must be on the account, otherwise upload optimisation is skipped with a message); the cron trigger (`triggers.crons` in `wrangler.jsonc`, entry `cloudflare-worker.ts`).

## Tasks (in order)
Open: Tasks 1 and 2 (reference file, engage-templates library), then Tasks 3 to 16 (Task 17 is closed, numbers not shifted so parallel threads do not clash; renumber at the next sweep) (shop and pricing, regions and domains, API, cron, email, theming, company downloads, admin updates), Task 19 (speed up the portal and shrink the Worker bundle) and Task 20 (Matt's live checklist), remain, plus one parked decision for Matt (see "Decisions waiting on Matt"). More tasks from Matt to verify as already implemented go in before Task 1. Open tasks were renumbered from 1 on 8 Nov 2026 and again after the 8 Nov tasks 1 to 6 closed (PR #226). Finished work is referred to as "closed Task N": N is the number it had when it closed, as used in the Done list (`docs/remaining-work-done.md`), and is not the same as an open task with that number.

Order: 1, 2, 3 to 18 (features, in listed order), (new verify tasks), 19 Speed up, 20 Live checks (ends with the fresh-account deploy check).

### Task 1. Reference file for installs (shine and effix)
- [ ] Ship a reference file with every install (for example `reference.json` or `references.md` in the repo root) that the portal follows. Repos (Matt, 7 Nov 2026): https://github.com/asticore/shine and https://github.com/asticore/effix (default branch) to find shared reference material. It points to Matt's GitHub repositories "shine" and "effix" so portals use our reference files, alongside third-party references such as Tailwind. Design points: list each source with name, URL, type and version or branch; the portal reads the file on install and when updating; works on a fresh install with no setup (see Process item 8); fails safe when GitHub is unreachable. Effort M. (Added 7 Nov 2026.)

### Task 2. Include the engage-templates library by default (new, 7 Nov 2026)
- [ ] Matt's template library is https://github.com/asticore/engage-templates. Include it as a default library on every install, with no setup: listed in Templates next to the built-in starters, fetched from GitHub, fails safe if GitHub is unreachable, can be switched off in Settings. Check what the existing template library and repo fetch code (see the design inventory: libraries are fetched from GitHub) already does and reuse it. Add the source to the Task 1 reference file. Effort S to M.

### Task 3. Multi-currency support (new, 7 Nov 2026)
- [ ] Shop shows prices in several currencies with a currency dropdown for visitors. The admin sets the default currency and visitors can change theirs. Decide: manual rates or an automatic rates feed, rounding rules, which currency checkout charges in (payment provider support), and per region or domain defaults. Effort L.

### Task 4. Multi-level pricing (wholesale and quantity breaks) (new, 7 Nov 2026)
- [ ] Allow price tiers: wholesale prices tagged to a customer type or group, and prices by quantity (for example 1 to 9, 10 to 49, 50 plus). Works with products, variants and multi-currency (Task 3), shows correctly in the cart, checkout and orders, and can be set in bulk. Customer types come from companies (organisations; `listOrgsForUser` in `src/features/organizations/store.ts` gives a member's companies, closed Task 14). Effort L.

### Task 5. Selling events (tickets) (new, 7 Nov 2026)
- [ ] Check and make sure events can be sold: ticket types, capacity, price tiers, free and paid, checkout through the shop, order and RSVP link, confirmation email, check-in and refunds. Verify what exists today against the code first and list gaps. Effort M.

### Task 6. Promo icon on the shop archive (new, 7 Nov 2026)
- [ ] Let admins customise and add a promo icon or badge (for example Sale, New, Best seller) shown on products in the archive and cards; pick from an icon picker, set text, colour, position and rules (per product or by tag or category). Effort S to M.

### Task 7. Categories and sub categories (new, 7 Nov 2026)
- [ ] Allow categories with sub categories (nested to several levels) for the shop and check the same for blog and other content: admin tree to add, move and reorder, archive pages and breadcrumbs, URL slugs, filters, and the visual editor loops. Effort M.

### Task 8. Multi region and language report (new, 7 Nov 2026)
- [ ] Check and report how multi region and multi language work today (regions, locales, translated fields, fallbacks, hreflang, per region content and pricing, admin strings in the thirteen languages). Output: a short report with gaps, saved in this doc, then tasks for the gaps. Effort S to M.

### Task 9. Multi domain support check (new, 7 Nov 2026)
- [ ] Check multi domain support end to end: several domains on one install, per domain content, the Available on domains field and slug check, cookies and sign-in per domain, sitemap, robots, canonical and hreflang, email sender and Cloudflare routes. Output: report with gaps, then tasks. Effort S to M.

### Task 10. Easy API creation, API keys and data feeds (new, 7 Nov 2026)
- [ ] Let admins create an API or data feed by drag and drop (pick collections and fields, filters, format), or a webhook. Access works by category: admins define user categories (for example partner, customer, internal) and select in Settings what each person or group can reach. Admins can generate API keys for customers, and customers can generate their own keys in the members portal; the key is tied to that person's account and limited by their category. Add rate limits, key revoke and rotate, usage log, and docs shown to the customer. Builds on the API and webhooks work already done (Done: closed Task 19). Effort L.

### Task 11. Scheduled jobs (cron) in the portal (new, 7 Nov 2026)
- [ ] Find out whether the portal has easy cron jobs, for example scheduled pages, scheduled publish and unpublish, and recurring tasks. Check what the Worker cron trigger already runs. If there is no admin view, add a Scheduled jobs screen: list of jobs, last run, next run, run now, enable or disable, and logs. Effort M.

### Task 12. Email notifications on actions, push and Cloudflare sending (new, 7 Nov 2026)
- [ ] In Email, let admins set up notifications triggered by actions (order receipt, sign-up, form submit, booking, comment and others): choose the trigger, recipient, template, and channel (email through the connected tools, or push). Add push notifications (web push) as a channel. In Settings, allow connecting and sending email through Cloudflare (Cloudflare Email, see Known limits) as well as the third party email platforms already connectable. Effort L.

### Task 13. Style guide and theming: style preferences and uniqueness (new, 7 Nov 2026)
- [ ] In the style guide and theming screen, let owners pick website styles they like (for example from example sites or style cards), explain why each style suits (reasoning shown to the user), and use the picks to choose or generate a unique theme. Keeps one style system only (no v1 or v2) and effects chosen from pickers. Effort M to L.

### Task 14. Company-protected downloads (follow-up to closed Task 14, 9 Nov 2026)
- [ ] Companies (organisations) and company admin narrowing of pages, posts, products and events are built (see Done). Left: files. A media file or download linked from a company-only page is still reachable by its direct URL, because media is served as a public file. Add a gated download: a media file can be limited to a company (and narrowed to members or teams with the same grant table `eg_content_org_grants`, collection `media`), served through a route that checks the session with `viewerMayRead` and streams from R2 (private path), with the public URL never exposed in markup. Needs a decision on whether existing public media can be switched to private without breaking links (suggest: only newly flagged files move). Admin side: a "Visible to company" picker in the media edit panel, same pattern as `OrganizationVisibilitySection`. Effort M.

### Task 15. Admin settings: clean tables and install only when enabled (new, 7 Nov 2026)
- [ ] In admin settings, add a way to clean the tables of a section (delete its data after a confirmation and export offer) and make sure each section's tables are created only when its switch is turned on (builds on the lazy sections in PR #218). Add a migration and fresh-install tests for each. Effort M.

### Task 16. Update popup for super admins (new, 7 Nov 2026)
- [ ] A popup in the admin portal that checks the current version against the repo and tells super admins when their copy needs updating. Super admins click it to start the update, then it opens the repo changelog. Other admins see nothing. Decide update method (Deploy button sync, GitHub sync, or a pull request) and handle forks. Repo URL is now asticore/engage. Effort M to L.

### Task 19. Speed up the portal and shrink the Worker bundle (right before the live checks)
**Goals (Matt, 7 Nov 2026):**
1. Get the Cloudflare Worker bundle under the 3 MB limit of the Workers free plan (compressed size), so anyone can install the site for free with the Deploy button.
2. Make pages load faster (public pages and the admin and signed-in portal).
- [ ] Measure first: compressed and uncompressed Worker size from the build, bundle per route with `pnpm run bundle:size`, cold start, first admin load, D1 queries per screen, public page TTFB and LCP. List options with expected gain, then do the safe ones (lazy-load heavy admin and editor code, split optional features so they are not in the main Worker, drop unused dependencies, check duplicated packages).
- [ ] Done when the deployed Worker is under 3 MB and a before and after speed comparison is recorded here. Matt will also tweak the portal before this starts.

## Visual editor reference (moved from the closed visual-editor doc, 23 Oct 2026)

Editor code src/views/visualEditor/ and src/views/VisualEditor.tsx; renderers src/components/blocks/; element defs src/lib/elements/; AI builder src/features/ai/builder*.ts and src/app/(engage)/api/admin-ai-builder/route.ts.

## Design model: stored values inventory (step 4, 31 Oct 2026)

Status: steps 1 to 3 merged (#165, #166, #168). Step 4 data side merged (#177). Step 4c (typed emitter removal) merged as PR #183.

Reads go through readFlatDesign and upgradeDesign (src/lib/design). Writes go through toStoredDesign (src/lib/design/storeDesign.ts) and the write hooks listed here. Migration: `20270126_100000_design_grouped` (src/migrations/20270126_100000_design_grouped.ts, registered last), helper src/lib/design/storedGrouped.ts.

Where designs are stored:
- Block `design` column (JSON text) on every block table: pages, posts, products, page_templates, site_templates, reusable_sections, blog_settings, faq_settings, shop_settings, lessons, and their `_v` version twins. Block types that carry it (src/blocks/styleField.ts): section, element, loop, hero, faq, table_of_contents, event_grid, gallery, cta_banner, rich_text, image_text, product_grid, reusable_section, form. The migration finds these tables by their `design` column, so a new block table is covered without a list.
- Section `columns` JSON on every `*_blocks_section` table (and `_v`): each column has `design`, each nested block has `design`, sections nest.
- Forms: eg_forms.layout and eg_forms.published_layout (JSON, same column tree as sections).
- Not BlockStyle, not migrated: email designs (`*Design` JSON on the email-templates global, EmailBlock model in src/features/email/design); theme tokens (theming global, src/features/themeStyles); site fonts (site settings customFonts).
- Inputs that never store a design themselves: starters (src/features/siteTemplates/starters.ts), style presets and element defs in code, the legacy converter, the clipboard, template libraries and repos (fetched from GitHub), and the AI builder. Their output is stored through normal writes, so the write hooks group it on save; readers accept flat values too.

Write hooks (run on every save through the CMS): blockStyleField (src/blocks/styleField.ts), section `columns` (src/blocks/Section.ts), eg_forms layout and publishedLayout (src/features/forms/collections/Forms.ts). Each converts only v1 flat values that carry a grouped key (groupStoredV1Design); typed values and flat values with no grouped key are stored as they are.

Migration rules: v1 flat (no schemaVersion, or 1) with at least one grouped key becomes {schemaVersion: 2, groups} via upgradeV1; the migration refuses any row whose flat read-back changes; schemaVersion 2 values are never rewritten; a second run changes nothing (tests/int/design-grouped-migration.int.spec.ts).

Typed v2 (schemaVersion 2, no groups): no code path in src writes it (git history: only src/lib/design and tests mention it). The migration leaves any such value untouched, so it still renders through the typed emitter. Not checked against production D1 (no database access from the repo). Check before removing the typed path: count rows in the design tables and eg_forms where the JSON has "schemaVersion":2 and no "groups".

Step 4 (c), typed emitter: DONE (PR #183, branch feat/design-remove-typed-emitter). Production D1 had zero typed-v2 rows (schemaVersion 2, no groups). Removed the css*.ts, cascade.ts, customCss.ts and sanitize.ts modules and the design-v2-* int specs; withElementDesign and the design/scopeId arguments of renderElement are gone. A stray typed value reads as {} (readFlatDesign, asBlockStyle).

Step-3 rows with the applied dot and per-setting Reset (PR, 31 Oct): toggles (text transform, font style, decoration), ranges (background effect intensity, particles count, parallax strength, glass blur, divider speed, typography ranges), every FX slider (FxRange), selects for slideshow transition, background effect, particles, parallax direction, position, blend mode, mask, blob speed, reveal, hover effect, pointer effect, Ken Burns, animated border, and the custom rows (text, image, video loop, custom CSS, visibility sign-in). Left without a dot on purpose: the "Link all sides" checkbox (a UI helper, not a stored setting).

Column write path: section layout fields and the navigator hide toggle now store grouped values (FieldPanel, NavigatorPanel). ColumnPanel already did (9e8aa8c).

## Catalogue principle (decided 18 Oct)
One HTML primitive = one element. Variations are options on a base element, Design effects, section display modes, or templates built from base elements. Add a new widget only when it needs new markup, behaviour or data. Legacy types (accordion, tabs, flip-box, spacer, back-to-top and similar) are hidden but still render saved pages.

Skipped by default: PayPal/Stripe buttons, WebGL.

- Server-only elements (read data) use the SITE_ELEMENT_TYPES path (`wave38Defs.ts`, `SiteElement` in Wave38Elements.tsx), never `ELEMENT_COMPONENTS`. `loop` uses this.
- Published pages are edge cached and identical for all visitors: per-visitor logic (login, roles, query rules, consent) runs in the browser.
- Naming: nothing authored uses the old engine vendor name; engine only via `src/engine/`; export format `engage-template`. Migrations are additive and idempotent. Server components never call functions exported from 'use client' files.

## Done
Finished work is listed in `remaining-work-done.md` (same folder), one line per task or PR. Add new Done lines there, not here, so this file stays short.

## Process for every task

**Reply format (Matt, 31 Oct 2026):** every response to Matt has three bullet-point sections: **Done** (what was done), **Need from you** (what Matt must provide or decide), **Suggested next** (what to do next). Keep it short; details go in this document.

**Push and token rule (Matt, 9 Nov 2026):** after finishing the work, push all merges to GitHub in one go and avoid GitHub Actions wherever possible (they cost extra and the limit was hit). Use Haiku subagents as much as possible to save tokens.

**GitHub budget rule (Matt, 9 Nov 2026): one push per request.** Every push and every pull request runs GitHub Actions, so do all the work for one request locally (agents in worktrees, merged locally, all local checks green: tsc, the related specs, lint, and the build when it matters), then push ONCE and open ONE pull request. Never push work in progress, per-agent branches, per-file commits, fix-up commits after CI or "kick CI" commits. Run the full checks locally before the single push so CI passes first time. If CI still fails, batch every fix into one follow-up push. Do not use Codespaces, Git LFS, GitHub Packages or paid AI credit SKUs. Keep each live re-check to one deploy per request.

0. Model routing to save tokens (your instruction 16 Oct): the cheapest model that can do the job. Haiku (Haiku 4.5) for reading and locating code, pushing files, single-file mechanical edits, writing tests from a clear spec and doc updates; Sonnet only for multi-file feature builds and when Haiku is rate-limited; the main session (Opus) plans, writes briefs, reviews diffs and decides. Briefs name files and ownership so agents never edit the same file in parallel.
1. Scope lock with an acceptance checklist; read the code first (haiku Explore agents).
2. Slices, migrations first (idempotent, appended to `src/migrations/index.ts`); new collections or globals also go into `src/cms/db/schema`.
3. Tests with the code, including `tests/int/internal-migrate-fresh-install.int.spec.ts` (extend for every new table or column, run twice) and `tests/int/fresh-install-schema-coverage.int.spec.ts` (empty DB through `runInternalMigrate`, every schema table and column must exist, second run changes nothing). Not done unless both pass.
4. Gates: `pnpm exec tsc --noEmit`, related specs plus the structural smoke set before pushing, fresh-install specs alone when a migration changed, `pnpm run build` (catches ESLint errors that fail Workers Builds); the full suite in chunks with a timeout each, in the background after pushing (a single full run hangs on `version-delete-real-engine`).
5. Push once per request (see the GitHub budget rule above): merge all agent work locally, run the checks, then a single `git push` and a single pull request; after merge, `git fetch` and confirm `origin/main` has every file.
6. Independent review agent on the diff; fix real findings, add a test per fix.
7. Live check after the deploy (wait for `workers_list` modified_on after the last commit; D1 `SELECT name FROM eg_migrations ORDER BY id DESC`).
8. Fresh-install gate: works on an empty DB with no rows in globals and no new secret set; new Cloudflare resources declared in `wrangler.jsonc` and the README.
9. Update this doc (see "How this document is kept up to date") and report in plain words what changed, what was checked and what was not.

Lessons: migration-order specs use `migrations.length - N` offsets, so every new migration moves them: update the offsets in the same PR (or prefer name lookups). Agents alter files when copying (quotes, glyphs, regex escapes, trailing spaces and final newlines), push wrong files, create routes in a literal `src/app/(engage)` folder: cmp everything. Keep new CSS in its own file; avoid edits to `src/cms/db/schema/generate.ts` and `schema/index.ts` (both near 60KB); do not edit `src/engage-types.ts` (230KB, cannot be pushed through the tool: cast locally instead); no `ui` field in a global modelled by `src/cms/db`; never two agents on one file at once; the cloud session cannot `git push` this repo (GitHub MCP only); do not `pkill -f vitest`; the browser tool cannot type; mock `getAdminContext()` needs `can`; hooks must skip when there is no `req.user`; Next layouts cannot export extra names. Cloudflare Builds clones within seconds of the first push, so after a multi-file push, push one last marker commit. Haiku push agents turn backslash-u escapes into raw characters: keep source ASCII (use String.fromCharCode).

## Task 20. Matt's live checklist (FINAL: only live checks remain; all need Matt's own accounts)

**Live run 31 Oct 2026 (Claude, Brave, read-only):** PASS: Forms list has no Create; form page has Edit in visual editor and pages-using-form table; Templates has Header and footer tab; no separate Header/Footer admin pages; Pages list has Export CSV and sortable headers; Settings has no 404 picker; visual editor canvas loads. OPEN from this run: (a) dashboard Forms tile "+" links to /admin/content/forms/create (remove, forms are made in the visual editor); (b) form edit page shows Title/Submit label/Success message fields (confirm no field editing, decide if summary should be read-only); (c) External embeds not in any sidebar group, find route /external-embeds and add nav item; (d) audience and page-picker conditions not seen (need a draft row, test on a scratch template); (e) style panel applied dot/Reset not reached (hover selection shifted); (f) not yet run: short links, privacy, CSV with filter, revenue chart, migration, SITE_URL/ENGAGE_SECRET.

Only items not yet verified. Tick each, report failures. Grouped by area, each with how to check.

### Repo rename follow-ups (9 Nov 2026, Matt)
- [ ] Cloudflare dashboard > Workers & Pages > the worker > Settings > Builds: reconnect the Git repository to `asticore/engage` if it shows disconnected; confirm build and deploy commands unchanged. Pass = next push to `main` deploys.
- [ ] GitHub > Settings > Branches: confirm the `main` rule and required `test` check still apply on `engage`.
- [ ] Local clone: `git remote set-url origin https://github.com/asticore/engage` (folder rename optional).
- [ ] Claude project repo setting and any webhooks or GitHub App access: point at `asticore/engage`.

### Visual editor, walkthrough and setup (PR #226, 8 Nov 2026)
- [ ] Drag a card from the Elements bar onto the canvas (Chrome and Safari): it lands where the blue line shows. Templates drag too.
- [ ] Walkthrough: a new admin account sees it once on first sign-in; Skip, then sign in on another browser: it does not show again. Sidebar Help replays it.
- [ ] Setup questions: on a fresh install the dashboard opens "Set up your site"; answers show a summary; Apply switches the ticked sections on (sidebar updates); this existing site never shows it on its own (link "Run setup questions again" on the dashboard).
- [ ] Editor shortcuts: Ctrl/Cmd+S saves (no browser dialog), Ctrl/Cmd+E finder, Ctrl/Cmd+Shift+H history, Ctrl/Cmd+I navigator, Ctrl/Cmd+Shift+M device, also from inside the canvas.
- [ ] Two tabs on the same page: save in one, then the other asks before overwriting; a second user sees the edit lock banner.
- [ ] History tab lists named actions and jumps back; Revisions tab applies an old version (Undo returns), then Save.
- [ ] Duplicate a block with a CSS ID: the copy gets "-2". Right-click: Edit, Show in Navigator, Reset style. Paste style on a locked block is refused.
- [ ] Multi-select: Ctrl/Cmd-click several blocks, delete or duplicate in one undo step. Drag a section's top/bottom padding bar.
- [ ] Per-device: set z-index or opacity on mobile only; check the live page at phone width. Hidden-on-desktop blocks show faded in the editor and are gone on the live page.
- [ ] Text styles (Theme styles > Typography): edit "Primary", pick it on a block, check the live page.
- [ ] Custom attributes (Advanced): `aria-label|Open menu` appears on the live element; `onclick|x` is dropped.
- [ ] Popup: idle trigger opens after N seconds without input; Escape always closes; with the close button hidden, clicking outside closes.
- [ ] Visibility rules: weekday / time window / language hide and show on the live page.
- [ ] Preview button opens the live page (homepage opens "/").

### Webhooks (PR #214): needs a live site, a receiver you control and the admin
- [ ] Inbound page: Admin > Webhooks > Inbound webhooks > New inbound endpoint. Name "Test inbound", what it does "Create a page or post", kind Page, title field `title`, status Draft, window 5 minutes, enabled. Save and copy the signing secret shown once. Send a POST with a JSON body `{"title":"Live inbound check"}`, header `Content-Type: application/json`, header `Idempotency-Key: check-1`, and header `X-Engage-Signature: t=<unix seconds>,v1=<HMAC-SHA256 hex of "<t>.<body>" with the secret>`. Pass = answer 200 `{"status":"created"}`, a draft page titled "Live inbound check" under Pages, and the request log shows Created.
- [ ] Duplicate: send the same request again with the same Idempotency-Key. Pass = 200 `duplicate`, no second page, the log shows Duplicate.
- [ ] Refusal: send with a wrong secret. Pass = 401, and the log shows Refused with "The signature does not match."
- [ ] Event endpoint: make an inbound endpoint that sends the event "Content published". Subscribe an outgoing webhook to that event pointing at a receiver you control, then send a signed request. Pass = the receiver gets the event with only the fields that event allows, and the log shows Event sent.
- [ ] Booking made: subscribe an outgoing webhook to "Booking made". Book an event RSVP on the live site, then book a form appointment slot. Pass = two deliveries arrive with event `booking.made` (source `event-rsvp`, then `appointment`), and the delivery log shows OK.
- [ ] Redaction: subscribe a webhook to "Form submitted" and submit a form with a password-style field. Pass = the receiver got the real value, the delivery log shows `[redacted]` in its place, and Replay reports that the body was redacted and cannot be sent again.
- [ ] Retention: choose 7 days, Save retention, then "Remove old entries now" and confirm. Pass = the confirmation shows, and deliveries older than 7 days are gone from the logs.
- [ ] Rotate an inbound secret: rotate, then send with the old secret. Pass = 401.
- [ ] DNS guard on real receivers: press Test on an ordinary public webhook. Pass = OK, which shows the DNS-over-HTTPS lookup works from the live Worker. Optional: point a webhook at a host name you control that resolves to 127.0.0.1. Pass = Test reports that it resolves to a private or internal network.
- [ ] Migration on the live database: `SELECT name FROM eg_migrations ORDER BY id DESC` lists `20270304_100000_webhook_redaction_inbound` at the top.

### Accounts, sign-in and security (site: magic link, email code and passkeys ON since 25 Oct; "test 2" is "Visible to signed-in accounts"; anonymous visitors see the sign-in gate, verified 25 Oct)
- [ ] Sign-up and verify: private window, `/account/sign-up`, register a test customer, click the email link. Pass = account page opens.
- [ ] Password sign-in: `/account/sign-in` with that customer. Pass = lands on `/account`.
- [ ] Protected page: signed in, open `/gotcha/test-2` (content shows); private window (gate shows).
- [ ] Magic link: sign out, "email me a link", click it. Pass = signed in. Needs site email sending.
- [ ] Email code: sign out, "email me a code", enter it. Pass = signed in.
- [ ] Two-factor: Account > Security, turn on the authenticator app, scan, enter code, save backup codes. Sign out and in. Pass = code asked; a backup code works once.
- [ ] Passkey: Account > Security, add a passkey, sign out, sign in with it. Pass = signed in.
- [ ] API key: Account > API keys, create, copy, call `/api/pages` with it. Pass = authorised; delete it and the call fails.
- [ ] Organisation: create one, invite a second email, accept in a private window. Pass = member listed.
- [ ] Social login: admin Security > Social login, guided setup for one provider with your own app credentials (redirect URI shown), switch on, sign in. Pass = signed in; switch off and the button disappears.
- [ ] Sign in as: admin Security, tick "Allow admins to sign in as a customer"; in Users, "Sign in as customer". Pass = admin banner with Stop; Stop returns you. Audit log shows `impersonating` entries.
- [ ] Trusted device: tick "remember this device" at 2FA, sign out and in. Pass = no code asked.
- [ ] Rate limit: 6 or more wrong passwords in a row. Pass = "too many attempts" message.
- [ ] Trust after password groups: create a shared password group in Security, give a page that group, unlock with the group password. Pass = page opens; remove the group and it is public again.
- [ ] Organisation-only page: restrict a page to your organisation, open in a private window. Pass = "Members of <org> only" with a sign-in link and no password form; as a member it opens.
- [ ] Protected post and archives: set a password on a blog post; in a private window check the post (gate), `/blog` and its tag, category and author archives (post hidden), `/search` (hidden), `/sitemap.xml` (post missing). Remove the password afterwards.
- [ ] Content-editor password rights (PR #190): sign in as a role that has content update but not admin or the password permission. Set and clear a page password (pass). Try a post password with the same role (refused, 401).
- [ ] Anonymous REST: signed out, call `/api/pages` and `/api/posts`. Pass = protected items not in results (an admin session sees them; expected).
- [ ] Cosmetic: Visibility panel shows "Unsaved changes" after set or remove password (server already saved). Note whether it still does.
- [ ] Switch back off anything you do not want live (Security settings).
- [ ] PR #3 (products and events password protection): run the browser check on a protected product and event.

### Portal review and passkey setting (PR #216)
- [ ] Phone width (375 px) on the 19 account routes: sign-in, register, forgot password, reset password, verify email, sign-in link, account home, orders, one order, addresses, one address, bookings, profile, privacy, store credit, subscriptions, organisations, invite. Pass = no sideways scroll, a 16 px gutter, the menu button opens and closes the drawer, the search box fits. How: browser devtools device mode at 375 px width, each route once.
- [ ] Passkey two-step setting: Admin > Settings > Security > "A passkey that verified the user skips the authenticator-app code" is off. On an account with an authenticator app and a passkey, sign in with the passkey (PIN or fingerprint): pass = the code step appears. Switch it on and repeat: pass = signed in with no code step, and the Security audit log shows "user verified, two-step code skipped". A passkey that does not ask for the PIN still gets the code step.
- [ ] Live migration: `SELECT name FROM eg_migrations ORDER BY id DESC` lists `20270308_100000_passkey_skip_two_factor` at the top; `PRAGMA table_info(eg_security_settings)` has `passkeys_skip_two_factor` with default 0.
- [ ] Own confirmation with verification off: register a new customer address, open Bookings. Pass = the note "Bookings made with your email address appear here once you confirm that address." and a "Send a confirmation link" button. Press it, open the email link, press confirm. Pass = Profile says "Your email address is confirmed." and any bookings made with that address now show.
- [ ] Remove an address: pass = "Remove this address?" appears, Cancel keeps it, OK removes it.

### Operations (PR #199)
- [ ] Branch protection: GitHub, asticore/engage > Settings > Branches > rule for `main` > "Require status checks to pass before merging" > add the `test` check (the CI job) > save. Pass = a PR whose `test` job fails shows "Merging is blocked".
- [ ] Uptime: Cloudflare dashboard > Notifications > add a health check on the live home page with an email alert to you. Pass = pausing the site or pointing the check at a wrong path sends you an alert email.
- [ ] Error alert: after the deploy, Settings > Speed > Error alerts is on with threshold 10. Cause 10 new errors on a test site. Pass = one admin email arrives; a second burst within the hour sends none.
- [ ] Restore drill (monthly): Settings > Backups > run a backup now; restore that backup onto a copy (a scratch install or a copy of the D1 database) following the Backups screen; compare a page, a product and an order. Pass = the copy shows the same content.
- [ ] Privacy build: the account menu has Privacy; the JSON download includes store credit, store credit movements, carts and reviews, with no cart secret. On a test account after erase: its carts are gone, its review shows "Former customer" with no email, and its store credit is still there.
- [ ] Policy notice: the admin dashboard shows "Review your privacy policy and cookie notice"; Dismiss hides it in that browser; it shows again in another browser (known limit of per-browser dismissal).
- [ ] Migration `20270201_100000_error_alert_settings` ran on live D1 (`SELECT name FROM eg_migrations ORDER BY id DESC`).

### Privacy (#160, #164)
- [ ] Customer `/account/privacy` (URL only): download JSON (no hash, salt, secret or token); request deletion with password; confirmation email; link works once; second request refused. Pass = all true.
- [ ] Admin Settings > Privacy requests: approve, then Erase. Pass = account gone, devices signed out, orders kept with totals and no name or email, completion email sent; audit log `privacy.*` holds no personal data; blocked while impersonating.
- [ ] #164: erase a test account with a form entry and a booking. Pass = entries stay (rule decided in closed Task 11, PR #199, Done).
- [ ] Migration ran once on live D1 (`eg_migrations`).

### Design (#165, #166, #168, #177)
- [ ] Open a page and a template at desktop, tablet and phone widths. Pass = same look at each.
- [ ] Style panel: applied dot and Reset on border, radius, shadow, spacing and typography.

### Forms (#167, #170, #175, #176, #213)
- [ ] Form element: New form, Design the fields, Choose existing. Pass = works; admin Forms list has no Create button.
- [ ] Form fields panel on a Form block in the page editor (#175). Pass = fields edit in the editor.
- [ ] Forms screens: the "Pages using this form" list shows the page (#175).
- [ ] RSVP: an RSVP with verification on requires a verified email (#170). Settings 404 page shows (#170).
- [ ] External embeds (#176, #213): Forms > External embeds, create an embed and pick a colour, a font and corners. Open its hosted address: the form shows those picks. Put its script snippet on a test page on another site: the form appears, and a website not in its list cannot show it. Pass = both.
- [ ] Legacy snippet (#213): a snippet placed before this deploy still shows its form on the other site after deploy:migrate (migration 20270306_100000_form_embeds). Pass = the form shows, and External embeds lists that embed with its old websites.
- [ ] Embed submissions (#213): send the form through an embed, then open its submissions in Forms. Pass = the entry's Source shows the embed's name.
- [ ] Draft-only page (#213): a page that uses a form only in an unpublished draft is listed on that form's row in Forms with the draft label. Pass = listed as a draft.
- [ ] Form block on a page (#204): after deploy:migrate, add a Form block to a page, pick a form, save and reload. Pass = it saves with no "no such column: form_id" error.

### Templates and pages (#153, #159, #169, #179)
- [ ] Blog builder slice 2a (feat/task-2ab, d7510dc), needs a real AI key: saved prompts and brand voice save and apply; sources list appears at the end of a post and [n] citations match it; featured image match offers gallery items before upload; per-post AI limit blocks at its count.
- [ ] Template libraries hub (feat/task-2ab, d7510dc): Library tab search and filter; add, remove, switch and token test each appear in the audit log without the token; a library pinned to a /tree/<tag> address loads that version.
- [ ] Migration 20270128 (blog builder settings) applied on live D1: `SELECT name FROM eg_migrations ORDER BY id DESC` lists it.
- [ ] Private library (#189): in Settings > Template libraries, save a token, press Test token, and check a private library shows its items.
- [ ] `/admin/templates` (Templates hub, #169): header and footer tab, audience and page picker all work.
- [ ] Sidebar template (#159): make a sidebar-left or right template; it shows beside page content on desktop (phone stacks); not on maintenance or portal pages. Add a "Template part" element; it draws the template.
- [ ] Header and footer conditions on the live site, including a `/fr/` page (#153).
- [ ] Import a template JSON: draft off, opens in the visual builder. Export of a site template works.
- [ ] Blog post in a Loop shows date, author and category (#153).
- [ ] Every template kind opens in the visual builder (header, footer, page templates, sections, loops).
- [ ] Preview-as on a sample post, product or event in the template editor.
- [ ] Old breadcrumbs (#179): a saved template built with the old breadcrumbs renders auto breadcrumbs (prod has one header draft).
- [ ] Single-product template: add to cart works (#185 render test passes; click it on a live product page).
- [ ] Template part picker (#185): the Template field lists enabled site templates; a part saved before the change still draws.
- [ ] Preview as on a blog, shop, category, tag, author or sidebar template (#185): picks a sample item, and the Audience choice (guest or member) is kept. The canvas does not change for the audience yet (it rides in the preview only).
- [ ] `?page=` pagination on `/blog`, `/shop` and the archives.
- [ ] Tag and author archives and byline, with real published posts (none exist yet).
- [ ] Visual editor draft recovery (#155): after a real session expiry, the unsaved tree is offered back and never applied automatically.

### Visual editor, embeds and AI (#154, #155, #158, #178, #182)
- [ ] Short links (#182): a page with a vm.tiktok.com link shows the video; a pin.it pin and an on.soundcloud.com track render; a bad short link stays a link card.
- [ ] Embeds with real data: embed-code with a real widget; social-feed with a real token; page audio.
- [ ] Lighthouse on a page with three effects.
- [ ] AI builder builds a whole page with the `ai-builder-v2` guide (#178). Pass = no cap error.
- [ ] AI usage: `ai_builder_usage.estimated` is populated in D1 after the deploy (column exists; set since 23 Oct).
- [ ] Blog builder (#154, needs a real AI key): Blog list > Write with AI: questions, five titles, outline, section by section, meta, slug, tags, category, Create draft. Pass = unpublished draft saved; spend shows in the AI usage line; spend cap blocks; an editor without post-create rights does not see the button.
- [ ] SITE_URL (#158): confirm `SITE_URL` is set in the production Worker (Cloudflare > Workers > Settings > Variables). If not, abandoned-cart reminders and back-in-stock alerts stop, and canonical falls back to the request host.
- [ ] Blog wizard placeholder (#180): the placeholder reads correctly in the admin.
- [ ] README deploy checklist (#180): follow it on a clean copy; check each step.

### Admin text and accessibility (#134, #181)
- [ ] In a non-English admin language open Export and import, Theme styles preview, Import content, Form settings panel and Domains checklist. Pass = no English except sample data.
- [ ] Screen reader pass on the editor and list screens (icon-only buttons; #181).
- [ ] Keyboard and screen reader pass on the admin tables (#173, #174).
- [ ] Tables and charts (#171 to #174): CSV download from pages and orders with a filter applied, opened in a spreadsheet; shop revenue chart axis fits a phone width; sort buttons work by keyboard.
- [ ] Tables and charts (#188): Dashboard shows the 30-day Orders and Form submissions cards with Shop and Forms on, and hides them when each is off. A list export of 5000 or more rows shows Exporting… while it loads and then the truncation message. The PageSpeed trend and the consent acceptance chart show their axis labels on a phone width.
- [ ] Account colours and srcset (PR #208): dark theme, sign in, open `/account` and the nav on a phone width, and search: no white cards, dark text readable, nav drawer fades to the background. A page with a gallery or team card: view source shows `srcset` and `sizes` on its pictures. Light theme: unchanged.
- [ ] Task 20 colour sweep (#192): in dark theme open Settings, Shop orders, SEO audit, Theme styles, Visibility, Find and replace, Edit tabs, Email testing and the Visual editor chrome: no white or light cards, no dark text on dark surfaces, every status badge readable. Light theme: nothing visibly changed.
- [ ] Task 20 dark mode (#192): dark theme, check each for readable text and no white-on-dark: Password groups (banner, error, form, badge), Visibility > Access (label, input, OK and error), Blog builder "Write with AI" error, Pages tree (Draft and Homepage badges, alert), API keys scopes, Orders filter bar, Order refunds, Two-factor trusted devices list, Ads placeholder on a public page with ads on.
- [ ] Task 20 tree keys (#192): Pages tree, keyboard only (no mouse): Tab to a row, Down and Up move between rows, Home and End jump, Right expands a parent, Left collapses it or goes to the parent row, Alt+Down moves a page. Screen reader announces the expanded state and the tooltip text on the toggle and handle.
- [ ] Task 17 feedback button: sign in as an admin, click Feedback in the sidebar (under Help): a popup offers Bug or Feature request; picking one opens that GitHub new issue form in a new tab (matching template and label) with the version, admin page and language in the body. Sign in as a non-admin role: no Feedback button.
- [ ] Task 20 tooltips (#192): touch device: tap a column arrow in the list toolbar and the tree drag handle; the tooltip appears and goes away on the next tap elsewhere. Desktop: hover and Tab to the save-default button; tooltip shows.
- [ ] Task 20 SEO dots (#192): SEO audit and SEO analysis in light and dark: good circle, ok diamond, bad square are told apart at a glance.
- [ ] Task 20 company content access (closed Task 14): turn on Customer organisations in Security settings, create a company with two members and a team, limit a page to it in the page's visibility panel, then as the company owner open the account's company page, Company content access: tick one member, save; that member and the owner read the page, the other member sees the locked screen, an outsider and a signed-out visitor see the locked screen; untick all and every member reads it again.

### Languages and tracking (#54, #134, #135 to #145, #151)
- [ ] Languages: Settings > Languages: enable a language, add Google or DeepL key, Test connection. Translations page: one row per page, filters, bulk approve. Builder: language switch and translate mode. `/fr/` loads in French with correct hreflang. Clear inactive works. Admin language picker changes admin text. Email arrives in the customer's language. Storefront override table changes storefront text.
- [ ] Translated slugs (#54, merged): translate a page slug to fr; `/fr/<translated>` renders and `/fr/<source>` redirects; same for a post and a product; menu, block and rich-text links on fr pages keep `/fr/`; canonical, hreflang and sitemap show translated URLs; a duplicate fr slug is refused on overlapping domains; untranslated sites unchanged.
- [ ] Tracking (#135): Integrations Meta and TikTok switches. Fresh private window before consent = no fbq, ttq or gtag requests; after accepting marketing the TikTok snippet loads (verify in TikTok Events Manager); a click event fires once and reaches Meta Test Events; PageView goes only to dataLayer; nothing runs under /admin or /preview.
- [ ] Tracking picker (#138): public page with admin session and `?eg-event-picker=1`: hover outlines, click picks, match count shows, head has robots noindex, copied definition works, signed-in admin fires no events, GA4 and GTM switches off means no requests, Meta and TikTok consent is respected.
- [ ] Add tags (#141): Settings > Tracking > Add tags opens the homepage. Browse: nav links navigate, Add to cart does nothing (blocked notice), forms blocked. Page finder: type a product name, URL bar updates. Select: click Add to cart, suggestion says Add to cart, Save, badge appears and the events table has the row (URL rule without language prefix). `/fr/` version still shows the badge; click badge, rename, save, delete. Test mode toast, no network call. Set X-Frame-Options DENY and the editor shows a load-failed message.
- [ ] Tags follow-up (#142): events list Add tags and Back to Tracking settings; row Open in editor loads that page with the event outlined (no tags or event in the address bar after). Multi-domain: Tracking page and editor show the current host; Open the editor on `<domain>` links; text changes when that domain has admin access off.
- [ ] Tracking connections (#143, #187; needs your developer consoles and production secret). Open Settings > Tracking connections and read the Setup status first: each row must say Done. 1) Production secret: in the Cloudflare dashboard for the Worker, confirm `ENGAGE_SECRET` is listed under Variables and Secrets; if it is missing, add it and redeploy. Pass = the screen shows no ENGAGE_SECRET warning. 2) Google: Connect with Google, load the Analytics list, save a property (Integrations shows G-...); repeat for Tag Manager. 3) Meta: in developers.facebook.com create an app (Facebook Login), add the shown redirect address to Valid OAuth Redirect URIs, paste App ID and App secret on the screen, Connect with Facebook, load pixels, save one; Meta needs App Review and Advanced Access for business_management and ads_read for non-testers; Graph v21.0; tokens last about 60 days with no refresh. 4) TikTok: in TikTok for Business create the app, add the shown redirect address, paste ID and secret, Connect, load pixels, save one; confirm the saved pixel_code is what ttq.load needs. 5) Check a non-admin with the tracking permission can connect and pick but does not see the app secret field. The pixel loads only after marketing consent. The TikTok and Meta API shapes were written from docs and not tested live.
- [ ] Editor tools (#144): mode switch shows Navigate and Select with explanation and tooltips, first-open hint once; Suggestions on the homepage lists add to cart, checkout link, phone link, newsletter form with right event names; Add makes a tag; hover outlines the element; Add all asks to confirm. Japanese and Arabic layouts.
- [ ] Values and Add all (#145): Add all shows progress, result count and errors; a tag's Value dropdown (fixed, cart total, product price, order total, quantity, element text or attribute, data layer variable) with smart defaults; test-mode toast shows value and currency; cart total units confirmed on the live shop (assumed cents, currency from payment settings, default AUD); GA4 receives value and currency.
- [ ] GA4 and GTM consent (#151): private window, accept Analytics only: `googletagmanager.com/gtm.js` and `gtag/js` load, `fbq` and `ttq` do not. Marketing only: GA4 and GTM do not load. Check GTM container Marketing tags (they now run on Analytics-only without Consent Mode).

### Portal search (#152)
- [ ] `/account` signed in, type `ord`: Orders appears. Type a product name: site results link to the product. Switch to French or Japanese: placeholder and labels translate.
- [ ] (PR #191) `/account` signed in, type `#` and one of your order numbers (for example `#12`): that order appears under "Your orders" and opens its detail page. Type part of a booking's event name: it appears under "Your bookings". Type part of a subscription's product name: it appears under "Your subscriptions".
- [ ] (PR #191) Type `purchase` in the site search on a public page: a page about orders appears (synonym).
- [ ] (PR #191) Type `password`: "Password" appears under "Settings" and opens the password section of `/account/profile`. Type `default address`: it appears once, linking to `/account/addresses`. Type `purchase`: Orders appears (synonym).
- [ ] (PR #191) Switch to Japanese: the new headings ("Your orders", "Settings", "Default address") show in Japanese.

### Commerce and API (#147 to #150)
- [ ] API gaps (#212): (1) Admin > API builder: edit an endpoint on a collection with a custom field, tick Allow DELETE, save. (2) With a key whose owner may delete pages, DELETE a page: 200 with mode "trash", and the page sits in the trash. (3) DELETE a product (or other non-trashable record) with the same key: 200 with mode "deleted", record gone. (4) Same key, owner without delete permission: 403 and nothing changes. (5) Security audit log has one delete line per call with the endpoint path, and no key. (6) GET the endpoint: the custom field shows its value; POST a value outside the field's range: 400 with the field's message. (7) Download the PDF guide and open it; "Email developer" opens a mail draft with the guide and PDF links; "Copy message" pastes the same text.
- [ ] API builder (#147, #148): (1) Products endpoint (title, price; filter title; sort price; POST on) via Try it = 200 with only exposed fields. (2) Key not on the key list = 403; key without products:read = 403; no key = 401. (3) Over the per-minute limit = 429 with Retry-After. (4) POST to an unexposed field = 403; `passwordHash` in body = 403. (5) Domain-locked customer sees only their domain; a locked POST cannot save unscoped content. (6) Download all 5 formats; import OpenAPI or Postman and run one request. (7) Public link works in a private window; "New link" makes the old one 404; off = 404. (8) Call log shows status, no bodies. (9) Remove the `api` permission from a role: screen and actions refuse.
- [ ] Webhooks (#149): create a webhook on a test receiver (https only; http, private IP and redirects refused); secret shown once; Test sends a signed payload and verifies with the JS, Python or PHP snippet; edit content and see the delivery; place a real checkout and confirm order.created and order.paid fire; a failing receiver retries with backoff then marks failed; replay works; removing the `webhooks` permission blocks the screen.
- [ ] Webhook gap-fill (#150): a receiver returning 500 turns the webhook off after 5 failed deliveries and an admin email arrives; re-enable works; editing a tracking event fires `tracking-event.saved`; a real Stripe and PayPal checkout fires `order.created` then `order.paid`, once each.
- [ ] Shop and checkout: order statuses, refunds, invoices and shipping labels on a test order.

### Admin hardening and domains (closed Task 1)
- [ ] Custom admin URL (Settings > Security; bookmark it first; recovery is env var ENGAGE_ADMIN_PATH). Pass = new URL works, `/admin` 404s when signed out, admin pages send noindex (robots meta or X-Robots-Tag), robots.txt disallows admin and /api.
- [ ] Domains (Settings > Domains): add a second domain (attach it to the Worker in Cloudflare first, follow the DNS checklist). Pass = site loads on both hosts; canonical and og:url use the host you visit; hreflang lists both; redirect-to-primary works; allow-admin off blocks admin on that host.
- [ ] Per-domain overrides: set a site name, logo, contact or social on one domain. Pass = header, footer and page title show them only on that host.
- [ ] Separate pages per domain: set a page's "Site (domain)" to one domain and create a second page with the same slug on the other. Pass = each host shows its own content; a page scoped to another domain 404s; each domain can have its own home page; menus hide links to other-domain pages; sitemap lists each address once.
- [ ] User domain lockdown: give a test user "Allowed domains" for one host. Pass = they see and edit only that host's content; changing allowed domains needs the domains permission.
- [ ] Site switcher (sidebar, shown with two or more sites): pick the second site. Pass = pages, posts and products lists show its content plus shared content, a reload keeps the choice, and "All sites" appears only for an account with no domain limit. A limited test user sees only its own sites.
- [ ] Connect domain (Settings > Integrations > Cloudflare): save the account ID, Worker name, zone ID and an API token with Workers Scripts (edit) and Zone (read) permission, then on Settings > Domains press Connect domain for the second domain. Pass = "attached to the Worker" shows and the domain serves the site once DNS is live. Without the four values the button stays hidden and the manual steps show. Check the domain in Cloudflare under Workers & Pages > the Worker > Settings > Domains & Routes.
- [ ] Settings export and import with relations (PR #211): export pages, posts and products, then import into a second site. Pass = a child page keeps its parent, a post keeps its author and featured picture, a product keeps its images; the import check warns for each name missing on that site.
- [ ] Options page rules (PR #211): create a field group with rule "Editor role is editor" and another with "Options page is <slug>" plus "Field value (options page) <field> is <value>". Pass = the editor-role group shows on the options page to editors only; the value group shows only while that field holds the value, and it appears and hides as the value is changed on the form, before saving.

### Fresh install and deploy (Open now item 1)
- [ ] Fresh install baseline (PR #222): the same new-account deploy as the next line. Pass = it finishes noticeably faster than before, Settings > General > Features shows the same sections, and `SELECT COUNT(*) FROM eg_migrations` in D1 is about 142.
- [ ] Lazy sections, fresh install (PR #218): deploy to a new Cloudflare account (or a new D1 database). Pass = the site and admin load, the sidebar shows no Shop, Events, Blog or Forms entries, and Settings > Data and System > Unused tables is empty (the tables do not exist yet).
- [ ] Lazy sections, switching on: Settings > General > Features, tick Events and save. Pass = the save succeeds (it can take several seconds), Events appears in the sidebar, you can create an event and open /events, and an "Events landing" template exists. Repeat with Shop (a "Shop landing" template) and Forms. Fail = a save error mentioning tables, or a "no such table" page.
- [ ] Lazy sections, existing site (production): after the deploy and migrate, Settings > Features shows the same switches as before and every page, product, post and event is still there. Pass = nothing lost or hidden.
- [ ] Unused tables (super admin): untick a section that is not needed (for example Ads), save, open Settings > Data and System > Unused tables. Pass = its tables are listed with rows and a size estimate; Download JSON export saves a file; Delete asks you to type the table name, the button stays disabled until it matches, then the row disappears and Audit log shows "database.table-dropped". Order, transaction and refund tables of an off Shop show "Payment record, kept" with no delete. Tick the section again and save: its tables come back.
- [ ] Deploy on a second Cloudflare account (see Open now). Pass = migrations run, cron trigger present, upload optimisation works or skips with a message.
- [ ] CI (#162): Actions tab shows the `test` job green on PRs and main.

### Closed Task 9c settings checks (PR #198)
- [ ] Maps key: Integrations, Google group. Save a real browser key and press Check Maps key. Pass = "has the shape Google uses". Type `AIza-bad`, Save, press again. Pass = "does not have the shape Google uses". Put the real key back and Save. (Shape only: a website-restricted key is not called.)
- [ ] PageSpeed key: save the real PageSpeed Insights key and press Check PageSpeed key. Pass = "PageSpeed Insights key accepted." with no test run. Save a wrong key (starts AIza, 39 characters, not real), press again. Pass = Google's refusal shows. Put the real key back. Also check the PageSpeed Insights API is enabled for the key's project.
- [ ] reCAPTCHA: save the site key and secret key of this site and press Check reCAPTCHA keys. Pass = the site key line is accepted and "reCAPTCHA secret key accepted." appears. Save `abc` as the secret, press again. Pass = "Google does not recognise this reCAPTCHA secret key." Put the real secret back. Check a form with reCAPTCHA still submits.
- [ ] Search Console code: paste the content value of the google-site-verification meta tag and press Check code format. Pass = "The code looks right." Google itself is only asked when you press Verify in Search Console.
- [ ] Stale tab, Tracking connections: sign in as admin and open Tracking connections in two tabs. In tab A save the Meta app ID. In tab B change the TikTok app ID and Save. Pass = tab B shows "These settings changed in another tab or by another admin..." and TikTok is not saved. Reload, and tab A's Meta value is there. Then save the Meta app ID twice in one tab. Pass = no conflict message.
- [ ] Stale tab, pixel picker: in tab A change any Integrations field and Save. In tab B (Tracking connections, Meta, a connected account) pick a pixel and Save. Pass = tab B shows the conflict message and the Integrations pixel ID is unchanged. Reload and pick again. Pass = saved.
- [ ] Stale tab, Google connection: in tab A press Save client (no change needed). In tab B press Disconnect and confirm. Pass = tab B shows the conflict message and the sign-in is kept. Reload and disconnect again. Pass = disconnected.

### Closed Task 9a settings safety (PR #197)
- [ ] Stale tab: sign in as admin, open Integrations in two browser tabs. In tab A change a field and Save. In tab B change a different field and Save. Pass = tab B shows "These settings changed in another tab or by another admin..." and nothing is overwritten. Reload, and tab A's value is there.
- [ ] Custom CSP: Security, Headers, Content-Security-Policy, type `img-src https://example.com` and Save. Pass = saved. Then type `scrpt-src 'self'` and Save. Pass = refused with a message naming "scrpt-src". Clear the field and Save. On a public page, DevTools, Network, the page response headers: the policy still contains `fonts.gstatic.com` and the site still loads its fonts.
- [ ] Admin notice: needs two admin accounts with real inboxes. Security, change Admin URL (or switch "Two-factor required for admins") and Save. Pass = both admins get "Security change on this site: ..." with the old and new values, and Email log shows the send (Task 20 email first). Change it back afterwards.
- [ ] Domain notice: Domains, switch "Allow admin" on one domain and Save. Pass = both admins get "Security change on this site: Domains and admin access". Switch it back.
- [ ] Check ID format: Integrations, type `UA-12345-1` as the GA4 measurement ID and press Check ID format. Pass = the message names GA4 measurement ID. Put back the real ID.
- [ ] Check AI keys: Integrations, save the real Claude and OpenAI keys, press Check AI keys. Pass = "Claude key accepted." and "OpenAI key accepted." A wrong key shows "refused this key (HTTP 401)". Nothing is generated and nothing is charged.
- [ ] Check Cloudflare zone: save the zone ID and API token, press Check Cloudflare zone. Pass = "Connected to the zone <your domain>." The check changes nothing and purges nothing.

### Closed Task 7 integrations (PR #193, PR #195)
- [ ] Resend: Webhooks, Add endpoint `https://<your site host>/api/email-events/resend`. Tick Email bounced and Email complained. Copy the signing secret into a secret named `RESEND_WEBHOOK_SECRET`. Pass = Resend's test send to `bounced@resend.dev` shows that address in `SELECT * FROM eg_email_suppressions` with source `resend:Permanent`.
- [ ] SendGrid: Settings, Mail Settings, Event Webhook. HTTP POST URL `https://<your site host>/api/email-events/sendgrid`. Tick Bounced and Spam Reports. Turn on Signed Event Webhook Requests and copy the verification key into a secret named `SENDGRID_WEBHOOK_PUBLIC_KEY`. Pass = Test Integration returns 200.
- [ ] Mailgun: Sending, Webhooks, add `https://<your site host>/api/email-events/mailgun` for Permanent Failure and Complaint. Copy the HTTP webhook signing key (API security page) into `MAILGUN_WEBHOOK_SIGNING_KEY`. Pass = a post with a wrong signature gets 401 and a real test event is recorded.
- [ ] Mandrill: Settings, Webhooks, add `https://<your site host>/api/email-events/mandrill` with Hard bounce and Spam ticked. The URL must match exactly, since the signature covers it. Copy the webhook key into `MANDRILL_WEBHOOK_KEY`. Pass = Mandrill's test returns 200.
- [ ] Brevo: Transactional, Settings, Webhooks, add `https://<your site host>/api/email-events/brevo?key=<EMAIL_EVENTS_KEY>` with Hard bounce, Blocked contact, Invalid email and Spam ticked. Brevo does not sign posts, so the key in the URL is the only check. Pass = posting without the key gets 401.
- [ ] SES: in SNS create a topic, add an HTTPS subscription to `https://<your site host>/api/email-events/ses`. The route confirms it itself. In SES, the configuration set gets an SNS event destination for Bounce and Complaint on that topic. Pass = subscription Confirmed, and a send to `bounce@simulator.amazonses.com` appears in `eg_email_suppressions` with source `ses:Permanent`.
- [ ] Cloudflare Email: no bounce feed exists; nothing to set up.
- [ ] Shipped text: Integrations, Email and text messages, Text messages, switch on "Text the customer when an order ships" (Twilio details filled in). Buy a label for a test order whose phone is in international format, such as +61400000000. Pass = the text arrives with the order number and tracking. With the switch off, no text is sent.
- [ ] Migration check after deploy: `SELECT communications_sms_shipped_order_text FROM eg_integrations` returns 0. Pass = column present, switch off.
- [ ] Set the new secret: generate with `openssl rand -hex 24`, then add it as a secret named `EMAIL_EVENTS_KEY` (Cloudflare dashboard: Workers and Pages, the site, Settings, Variables and secrets, Add, Secret; or `wrangler secret put EMAIL_EVENTS_KEY`). Pass = secret listed.
- [ ] Check `SITE_URL` and `ENGAGE_SECRET` are set on the live site. Pass = reminders are not refused. Without them, event and cart reminders now stop with a message.
- [ ] Postmark: Server, Settings, Webhooks, Add webhook. URL `https://<your site host>/api/email-events/postmark?key=<EMAIL_EVENTS_KEY>`. Tick Bounce, Spam complaint and Subscription change. Save. Pass = Postmark's "Test" returns 200.
- [ ] Bounce test: send an event reminder to Postmark's hard-bounce test address (hardbounce@simulator.postmarkapp.com). Pass = that address appears in `SELECT * FROM eg_email_suppressions` and the next reminder to it shows Skipped in the email log.
- [ ] Unsubscribe: send a reminder to a test address you control. Open the mail's Unsubscribe link in a private window, click Unsubscribe. Pass = "You are unsubscribed" page, the next reminder is Skipped, and the raw source shows `List-Unsubscribe` and `List-Unsubscribe-Post`.
- [ ] Wrong key: open the webhook URL without `key`. Pass = 401.
- [ ] Google: Settings, Google connection, Disconnect, then Connect with Google. The consent screen must ask to manage Search Console data. Pass = connected.
- [ ] Sitemap: on the Search Console card, click Submit sitemap. Pass = success message; Google Search Console, Sitemaps shows `/sitemap.xml` as Success after a few days. Before reconnecting it shows the "reconnect" message.

### Closed Task 8 shop (PR #194)
- [ ] Bank transfer: Shop settings, Payments, Offline payment methods. Switch on Bank transfer and add the account details. At checkout with a test cart, choose "Place order to pay by bank transfer". Pass = the order is Pending payment with method Bank transfer, the customer's email has the details, and the order shows the Offline payment box.
- [ ] Mark paid: on that order press Mark payment received. Pass = status Processing, invoice number set, the processing email is sent, and the notes say "Payment received by Bank transfer".
- [ ] Review request: Shop settings, Shop switches, switch on "Ask for a review after an order is completed" and save. Complete a test order. Pass = the customer's email has a link per product to /shop/<slug>#reviews. Needs SITE_URL set to the full site address.
- [ ] Bulk tags and brands: create a tag under Product tags and a brand under Product brands. On Products, select two items, Add tag, then Set brand. Pass = both products show the tag and the brand.
- [ ] Bulk status: on Orders, select one paid order and one pending order, Change status to Completed. Pass = the pending one is refused with its reason and the paid one changes.
- [ ] Verified buyer: approve a review left from an email that bought the product. Pass = the product page shows the Verified buyer badge.
- [ ] Brand and tags: on a product with a brand and tags, the product page shows "Brand: ..." and "Tags: ..." under the short description, in the storefront language.
- [ ] Shop list filters: on /shop, the Brand and Tag rows show the brands and tags of the products. Pick a brand, then a tag: only matching products show, the links keep both, and paging keeps them. Pass = the counts agree with the product pages.
- [ ] Search by brand or tag: /search?q=<brand name> and /search?q=<tag name> list the products, each once.

### Settings UX (PR #196)
- [ ] Hub and search: Settings > All settings lists every settings page and screen. Type "cookie banner" in the search: results such as "Banner title" show under General > Integrations (and Tracking > Integrations), and each opens its page and section. Pass = the links land on the field's section.
- [ ] Last changed: save any setting on General. Reload /settings/site as an admin: the line "Last changed by <your email> on <date> UTC" shows under the description. Sign in as an editor who is not an admin: the line does not show.
- [ ] Reset this section: on Blog (Content), change a field that has a default (for example Posts Per Page), press Reset this section, then Reset to defaults. Pass = the field returns to its default on screen and the page does not save until Save is pressed. Cancel on the confirm leaves values as they were.

### Closed Task 10 SEO (PR #200)
- [ ] Cornerstone: open a published page, tick Cornerstone content on the SEO card, Save. Pass = the SEO audit row shows "Cornerstone", and the Cornerstone only filter keeps it. Untick and Save. Pass = it drops out.
- [ ] Bulk SEO edit: SEO audit, change the SEO title of two rows and the meta description of a third, press Save. Pass = "Saved 3 rows." and the new values are on the pages. Then sign in as an editor with no update rights on pages, change one row. Pass = "You cannot edit this." on that row.
- [ ] Links: SEO audit, Pages with no links to them. Pass = a page nothing links to carries "No links to this page", and a page with related titles lists up to five suggestions. Check one flagged page is linked from the menu (known limit: menus are not counted).
- [ ] Sitemap images: open the live /sitemap.xml. Pass = a post, product or event with a picture has image:image entries. Google Search Console, Sitemaps: the sitemap is read with no errors.
- [ ] Rich results: Google Rich Results Test on a page with an FAQ block and a YouTube video element, and on /faq. Pass = FAQ questions found on each, and Video found on the page with the YouTube element. No errors.
- [ ] Slug redirect: change the slug of a published post, save. Pass = Redirects lists a 301 from /blog/old-slug to /blog/new-slug with the note "Created when the address changed", and the old address redirects.

### Known limits sweep (PR #205)
- [ ] SES List-Unsubscribe: set the email provider to SES, send a test order email to a Gmail account, open it and choose Show original. Pass = a List-Unsubscribe header with the unsubscribe link is present.
- [ ] Suppression list: Email, Suppression list, remove a test address that was suppressed. Pass = the row goes, and a bulk send to that address is allowed again.
- [ ] 404 log: open a made-up address on the live site (for example /test-missing-page), then Redirects, 404s. Pass = the path is listed with a hit count. Create redirect to a real page: the old address now redirects. Dismiss removes a row.
- [ ] Course slug: change the slug of a published course and save. Pass = Redirects lists a 301 from the old course path. For a page with child pages, change the parent slug. Pass = the children get 301s too.
- [ ] Coupon limit: create a coupon with a usage limit of 1. Start two checkouts with it at the same time in two browsers. Pass = the second one is refused with "Coupon ... has reached its usage limit."
- [ ] Consent withdrawal, Meta and Clarity (needs your Meta Pixel and Clarity accounts): accept marketing, confirm the pixel and Clarity load, then withdraw in the banner. Pass = the page does not reload, and Meta Events Manager and Clarity stop receiving events from that visit.
- [ ] Banner logo: Integrations, Consent logo, pick an image from the media library, save. Pass = the banner shows it. Change the logo in the form without saving: the banner preview shows the change.
- [ ] Ads.txt: Ads settings: the AdSense publisher id must be 16 digits after ca-pub-. Confirm the ads.txt line `google.com, pub-<your 16 digits>, DIRECT, f08c47fec0942fa0` against Google's current AdSense ads.txt guide (the certification id was written from memory). Pass = /ads.txt shows that line.
- [ ] VideoObject: in Google's Rich Results Test, run one page with a Vimeo embed and one with an uploaded video. Pass = a VideoObject with a thumbnail and contentUrl (uploaded) or embedUrl (Vimeo) is detected.
- [ ] Migrations: on the fresh account, confirm the three new migrations ran (20270223_100000_not_found_log, 20270223_110000_coupon_reservations, 20270223_120000_consent_logo) and the 404s tab and banner logo field appear.

### Known limits sweep: media, import, fonts (PR #207)
- [ ] Large upload: Media settings, Largest upload, set 60 MB and save. Upload a file of about 60 MB to the library. Pass = it appears and opens or downloads at the same size.
- [ ] New file types: upload a .heic, .ico, .json and .ods file. Pass = each is accepted, and the .json downloads instead of opening in the browser tab. On a site saved before 1 Nov, Media settings, Allowed file types, must list ico, heic, bmp, tiff, ods, json, rtf, ogg and m4a.
- [ ] Self-hosted fonts: Speed, Fonts, tick Host built-in fonts, save, reload a page that uses Cormorant or Inter. Pass = the font files load from /font-files/ in the Network tab and the text shows the font. Untick it to go back to jsDelivr.
- [ ] Removed local font: remove a font hosted locally, save. Pass = in Cloudflare R2 the bucket no longer lists font-<id>-... files for it.
- [ ] Export with shop customers: Settings transfer, tick Shop customers (admin only), export. Pass = the file has a content.customers list and no password or hash fields.
- [ ] Settings import with pictures: import a settings file exported from another site (logo or favicon). Pass = the logo shows this site's copy of the picture.
- [ ] Spreadsheets: the custom fields spreadsheet import and the data view file picker accept a .ods file. Pass = its rows appear.

### Media formats, video links and admin progress bar (PR #202)
- [ ] Picture format: Media settings, Optimisation, Output format for pictures: WebP, save. Publish a page with an Image block. In DevTools Network the picture URL has `/cdn-cgi/image/` and `format=webp`. Pass = both. (Needs the Images or Image Resizing setup from closed Task 12.)
- [ ] File override: Media gallery, open a PNG, set Output format to Original, save. Its URL no longer has `format=`. Pass = yes.
- [ ] Video link: Media gallery, Add video link, paste a YouTube link, give it a title. Open it, set Poster image, save. In the visual editor add a Video element and choose this item under Video from the media library, publish. The poster shows and the video plays after the usual consent. Pass = yes.
- [ ] Stream: Cloudflare dashboard, Stream, turn it on (it is billed). Create an API token with Stream edit permission. Copy the account ID from the dashboard side panel. Media settings, Video: paste both, set Output format for videos to MP4, save. Media gallery: Optimise an uploaded MOV or large MP4, then press Optimise again every minute or two until the gallery reports it replaced. Pass = the file is MP4 and smaller, and the Stream dashboard has no leftover copy.
- [ ] Admin progress bar: sign in to /admin, follow a few sidebar links and save a page. A thin gold bar shows at the top while each page loads and goes when the page changes. Pass = yes.
- [ ] Portal weight: after the next deploy, paste the Workers Builds route table (see closed Task 12 below) and check the home and pages list rows; the tag editor and visual editor field panel must not be in the first-load list. Pass = table pasted.

### Speed (closed Task 12, PR #201)
- [ ] Bundle size: open the Cloudflare Workers Builds log for the latest deploy, find the route table that `next build` prints (First Load JS per route) and paste it under this heading. Pass = the table is pasted; compare the home, post and product rows with the next deploy.
- [ ] Compression: run `curl -sI -H 'Accept-Encoding: br' https://YOUR-SITE/` and look for `content-encoding: br` (or gzip). If missing, Cloudflare dashboard, your zone, Speed, Optimization, Content Optimization: turn Brotli on. Pass = header present.
- [ ] Video poster: visual editor, add a Video element with a .mp4 link, pick a Poster image, publish. In a private window with DevTools Network open, the poster shows and no .mp4 request appears until you press play. Pass = both.
- [ ] Theme fonts: Design, set heading to Cinzel and body to Montserrat, publish. DevTools Network, filter "font": files come from cdn.jsdelivr.net/npm/@fontsource/ and text uses the chosen faces. Set the theme back afterwards. Pass = both.
- [ ] Priority: DevTools Network on the home page: the header logo and, on a post with a featured picture, that picture show Priority High. Pass = yes.

### Editing, approval and locks (PR #206)
- Sign in as an editor who cannot publish, open a published page, change the text and save: the live page stays as it was and the change is kept as a draft.
- With "clear saved copies on publish" on, publish a page from the editor: the public page shows the change within seconds.
- In a workflow with a document in review, change the workflow steps and save: the offer to move the document to step 1 appears; accept it and check the history row.
- Edit an approved page as an editor: it goes back to review and the history shows "Edited after approval. Review starts again."

### Media SVG, Openverse hosts and RSVP guest details (PR #210)
- [ ] SVG switch: Media settings > Uploads, tick Allow SVG uploads, save. Upload a plain SVG logo. Pass = it appears in the library and its link shows the picture, with Content-Security-Policy containing sandbox in the Network tab. Upload an SVG containing `<script>alert(1)</script>` and an onload attribute. Pass = it is stored with the script removed and no alert appears when its link opens. Upload an SVG with a DOCTYPE. Pass = refused with a message. Untick the switch and save, then upload an SVG. Pass = refused with 'SVG pictures are not allowed on this site'.
- [ ] Openverse hosts: Media settings > Stock photo search > Openverse picture hosts: delete the line upload.wikimedia.org, save. Search Openverse for a Wikimedia picture and import it. Pass = refused with 'not served from a library this site can import from'. Put the line back, save, import again. Pass = imported.
- [ ] Guest details, counts only: Settings > Roles, make a test role with Event RSVPs read and no View guest details, and no Edit on Events. Give it to a test admin-panel user. Open an event with RSVPs as that user, RSVPs tab. Pass = the counts show, the note 'Guest names and emails are hidden' shows, there is no name table and no Export CSV button.
- [ ] Guest details, granted: tick View guest details on that role and save. Reload the same tab. Pass = names, emails and Export CSV appear. Untick it again.
- [ ] Editors unchanged: an existing editor account opens an event's RSVPs tab and Check in. Pass = names and emails show as before and the check-in list loads and saves a check-in.

### Next 16 (closed Task 4, PR #220)
- 4 Nov 2026 incident: after #220 every request failed with Cloudflare Error 1101 (`Unexpected loadManifest(/.next/server/preview-props.json) call!`): OpenNext 1.18.1 and 1.20.x only inline `*-manifest`, `required-server-files` and `prefetch-hints` JSON, Next 16 also loads `preview-props.json`. Fix: PR #223 pnpm patch (`patches/@opennextjs__cloudflare.patch`) adds it to the glob. Remove the patch when OpenNext supports it. Live check after deploy: `/` and `/api/health` return 200.
- [ ] Production deploy on Next 16 (second account first): `pnpm run deploy:app` (no unsafe flag). Pass = the OpenNext build finishes and the Worker deploys. Then smoke test: public home, a blog page, `/shop`, `/checkout`; log in to the admin (including a non-default Admin URL), open Pages and the Visual editor, save a page and publish one. Pass = page loads, the edge page cache serves it and a publish purges it, host routing and locale prefixes still work, no console errors. If anything fails, roll back to the previous Worker version in the Cloudflare dashboard.

### Architecture (closed Task 4, PR #215)
- [ ] Setup script on a fresh account or a fork (never the production account): `pnpm run setup:cloudflare -- --dry-run`, then `pnpm run setup:cloudflare -- --replace --worker <name>`, review the diff of `wrangler.jsonc`, then `pnpm run deploy:full`. Pass = the D1 database and the R2 bucket with that name exist in the account; a second run of the script says "reuse" and writes nothing; the Worker deploys, migrations run and the Home page exists; the header shows "My website" until the name is set in Site Settings.
- [ ] Bundle size on the live build: `pnpm run build && pnpm run bundle:size -- --require` on the production branch. Pass = per-route sizes print with no missing files. Then set `defaultRouteGzipKB` in `bundle-budget.json` to the largest route's gzip size plus about 10%, commit, and the next run reports "Within budget".
- [ ] Brand on live: open the home page, `/checkout` and an order confirmation (or the checkout success page). Pass = the browser tab title ends with the site name saved in Site Settings (not "My website") and the header and footer show it.

### Decisions waiting on Matt (live)
- Closed Task 7: which later integration to build next (Google services or newsletter and CRM sync, both in Open now).
- Bookings (8 Nov Task 6, `docs/bookings-plan.md`): pick the first phase (proposed Phase 1, appointments) and answer the 14 questions at the end of the plan; it then becomes a numbered task.
- Visual editor gap builds left for later (`docs/visual-editor-elementor-gaps.md` items 3 and 4): dynamic link and image sources (which fields, fallback), scroll-linked motion (accept no effect in Firefox?).
- Security check to run: the preferences collection declares no access rules; confirm a signed-in user cannot read or change another user's preference rows through `/api/preferences` (suggested as a separate task on 8 Nov).
- Closed Task 4 (parked): publish the framework as a package with thin site repos. Risk high, effort L (several weeks): the deploy button still clones the whole repo (about 13.6 MB, 424 test files) until done, and every fork would then be upgraded through a versioned package with a release process for two repos. Recommendation: defer until a second real site needs it. The Next 16 upgrade is done (PR #220).
- Passkey and RSVP decisions were made in closed Task 5 (PR #216). Blog builder decisions are in closed Task 2a. Privacy rule is in Done (closed Task 11, PR #199).

## Shipped (reference)
Waves 43 to 48 and waves 30 and 31: see "Done". The visual editor reference and the design model inventory above are the reference for code paths.

### Activity log (closed Task 18, PR pending)
- [ ] Settings, Security, Activity log (`/admin/security/activity`): edit and publish a page, delete a post, save a setting, download a list CSV; each shows with your email and the right event (publish, update, delete, settings.update, export). Click a person's name: only their rows remain. Use From and To dates and the Collection filter.
- [ ] Same screen, Clear activity log: pick "older than 90 days", Count entries, type CLEAR, Clear now; the old rows go and one `activity.cleared` row names you and the count. Cookie consent entries and privacy records stay. The CSV link downloads the current view.
- [ ] Erase a test customer through the privacy flow; their activity rows keep the event but lose email, address and browser.

### Fresh-account deploy and setup script (last live check)
- [ ] Fresh-account deploy check and the setup script on a new Cloudflare account (the "Fresh-account deploy check (detail)" section and the Setup script item under "Architecture (closed Task 4, PR #215)"). Runs after Task 19, so it also proves the free-plan size limit on a fresh account.
