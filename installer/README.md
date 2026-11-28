# Engage site (lean install)

This repository is the whole install. It holds a configuration file and a build step that downloads an Engage release
from the source repository. The admin, the editor and every feature come from that release, so updating never means
pulling code.

- `engage.config.json`: `source` (the Engage repository, `owner/repo`) and `version` (`latest` or a pinned `1.2.3`).
- The admin shows one popup, to super admins only, and only when something needs doing. **Update site code** (shown when a release
  changes the Worker) takes a backup to R2, then writes the new version into `engage.config.json`; Cloudflare rebuilds. **Update tables**
  (shown when the database is behind) creates and updates the tables, and runs separately because either can be needed without the other.
  The first time, paste a fine-grained GitHub token for this repository (Contents read and write); it is stored encrypted on the site.
  Releases that only change static files never prompt.
- **Roll back** writes the previous version back. Restore the backup from Backups if data needs to go back too.
- No `UPDATE_GITHUB_TOKEN`? Retry the build in Cloudflare (Workers & Pages, Deployments); with `"version": "latest"` it installs the newest release.
- Source repository private? Set `ENGAGE_SOURCE_TOKEN` as a build variable and a Worker secret.
- Moving the Engage repository: change `source` here (or set `ENGAGE_SOURCE`).

**Where updates come from.** Only from GitHub *releases* of the source repository (`releases/latest/download/...`), never from the `main` branch. Merging to `main` changes nothing for customers; tagging `vX.Y.Z` does. With `"version": "latest"`, a site picks up the newest release the next time its build runs (a retry in Cloudflare, or the admin's Update button); a pinned version stays put.
- Cloudflare account: needs the $5 Workers Paid plan. The free Workers plan stops a request after 10 ms of processor time, which an Engage page can exceed. The Worker is under the 64 MiB limit, D1 and R2 free tiers are enough (R2 needs a one-time plan activation), and no paid-only binding is used.
- Lost admin login: `node scripts/reset-admin.mjs list` and `node scripts/reset-admin.mjs reset you@example.com` (needs `npx wrangler login`).

To work on Engage itself, clone the source repository instead; it deploys the same way it always has.
