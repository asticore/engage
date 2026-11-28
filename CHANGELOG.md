# Changelog

Release notes for Engage. The update popup's Changelog link opens the matching GitHub release; keep the text of each release here too, newest first. Tag a release `vX.Y.Z` with the same number as `version` in `package.json`.

## 1.5.4

- **Engage logo:** new logo at the top of the README and on the admin sign-in screen.
- **"Built with Engage" footer link:** every site shows a small link to the Engage project on GitHub under the footer. Turn it off in Admin > Settings > Footer ("Show built with Engage link").
- **Neutral defaults:** the footer blurb and address and the empty shop heading no longer ship boutique sample text. Sites that had saved their own footer text keep it. Test data, the Stripe app name and the password-check user agent no longer say Grace & Gatsby.

## 1.5.3

- **First login order fixed:** the start user was bounced forever between the profile screen and the two-step setup screen. Now the order is: change the start email and password, then set up two-step sign-in, then the setup questions. Each target screen is exempt from the other guard, so they cannot loop.
- **Super admin notice:** the first profile screen says this account is the super admin and what to do next. The admin tour waits until the start login is changed. New text is translated in every language.

## 1.5.2

- **First-run seed finishes:** a fresh install whose first request was cut off by the Worker time or CPU limit after creating the admin but before the Home page left the site with no pages and no retry. The seed now also re-runs when the site has no pages.
- **Blank fallback Home:** until a Home page exists, the built-in fallback shows only the site name, and shop and events blocks and buttons appear only when there are products or events.

## 1.5.1

- **First-run seed retries:** the start admin login and starter Home page are now seeded whenever the site has no users, even if an earlier first request migrated the database and then failed or timed out before seeding. The admin is created first so sign-in works even if the starter content fails, and seed errors go to the Error log.
- **Neutral empty Home:** the built-in fallback Home no longer shows demo copy.
- **README:** the installer notes now say the Workers Paid plan is required.

## 1.5.0

- **Start login:** a new install has one admin, `example@example.com` / `admin`; the admin sends that account to its profile until the email is changed. `reset-admin.mjs create` adds an admin to an existing site.
- **README:** install steps now include the Workers Paid plan and a reset table.

## 1.4.0

- **Blank starter site:** a new install now starts with an empty Home page instead of the Grace & Gatsby demo content.
- **Example picker in setup:** the setup questions end with a choice of example pages from the Engage templates library; the chosen one is installed as the Home page (or kept blank).
- **Lost login:** `node scripts/reset-admin.mjs` in the install repository lists admins and resets a password.

## 1.3.1

- **Lean install:** the first build now generates `ENGAGE_SECRET` and `INTERNAL_ROUTE_KEY` itself, so the Deploy form no longer needs them. Existing secrets are never changed.
- Release assets (`worker.js`, `assets.tar.gz`, `manifest.json`) are attached again; the empty v1.3.0 release made new installs fail with HTTP 404.

## 1.2.0

- **Lean install:** the Deploy button now installs a small repository (`installer/`) that downloads a release from GitHub instead of cloning the whole project. Releases carry a `manifest.json` (version, notes, migrations, checksums, Worker size); tag `vX.Y.Z` to publish one.
- **Updates from the admin:** the update popup shows the release notes and warns when a release changes existing data. **Update now** takes an R2 backup, then pins the new version in the install repository so Cloudflare rebuilds; a rollback pins the previous one. After an update a **Run migration** bar appears when the database needs it.
- **Configurable source:** `UPDATE_SOURCE` (or `source` in the install's `engage.config.json`) names the release repository, so it can move.

## 1.1.0

- **Update popup:** super admins see a popup when a newer Engage is released. A fork can set `UPDATE_REPO` (owner/name) and, with a fine-grained GitHub token limited to the fork with Contents read and write saved as the Worker secret `UPDATE_GITHUB_TOKEN`, update in one click.
- **Taskboard:** Kanban boards with assignees, comments, card archive and restore, an hourly "due soon" reminder, a My tasks page (`/admin/my-tasks`), and entries in the main Activity log. Task assigned, commented on and due soon are webhook events and notification triggers.
- **Protected downloads:** a signed-out browser that opens a company-only file is sent to sign in and back; company-limited videos are never copied to Cloudflare Stream.
- **Database:** emptying a section can restart the numbering, the section download comes in parts of 5000 rows a table, and emptying Media can delete the uploaded files from storage.
- **Languages:** the update popup and Taskboard are translated into all twelve admin languages.

## 1.0.0

First tracked version.
