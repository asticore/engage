# Changelog

Release notes for Engage. The update popup's Changelog link opens the matching GitHub release; keep the text of each release here too, newest first. Tag a release `vX.Y.Z` with the same number as `version` in `package.json`.

## 1.1.0

- **Update popup:** super admins see a popup when a newer Engage is released. A fork can set `UPDATE_REPO` (owner/name) and, with a fine-grained GitHub token limited to the fork with Contents read and write saved as the Worker secret `UPDATE_GITHUB_TOKEN`, update in one click.
- **Taskboard:** Kanban boards with assignees, comments, card archive and restore, an hourly "due soon" reminder, a My tasks page (`/admin/my-tasks`), and entries in the main Activity log. Task assigned, commented on and due soon are webhook events and notification triggers.
- **Protected downloads:** a signed-out browser that opens a company-only file is sent to sign in and back; company-limited videos are never copied to Cloudflare Stream.
- **Database:** emptying a section can restart the numbering, the section download comes in parts of 5000 rows a table, and emptying Media can delete the uploaded files from storage.
- **Languages:** the update popup and Taskboard are translated into all twelve admin languages.

## 1.0.0

First tracked version.
