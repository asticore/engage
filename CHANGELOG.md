# Changelog

Release notes for Engage. The update popup's Changelog link opens the matching GitHub release; keep the text of each release here too, newest first. Tag a release `vX.Y.Z` with the same number as `version` in `package.json`.

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
