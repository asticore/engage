# Additions to docs/TEMPLATE_SPEC.md (draft)

## 1b. New kinds (add to the `kind` row of section 1)

| `kind` | Holds | Authoring path | Engage target |
| --- | --- | --- | --- |
| `section` | one section | `templates/sections/<category>/<slug>.json` | unchanged |
| `page` | a whole page | `templates/pages/<slug>.json` | unchanged |
| `site-template` | a template that shows on the live site | `templates/site-templates/<siteKind>/<slug>.json` | Templates hub, site template of that kind |
| `loop` | one card drawn once per item | `templates/loops/<slug>.json` | Templates hub, kind `loop` |
| `popup` | a popup, banner or drawer | `templates/popups/<slug>.json` | popup preset |

`siteKind` (required for `site-template`) must be one of: `header`, `footer`, `single-post`, `single-product`, `single-event`, `archive-blog`, `archive-shop`, `not-found`, `search-results`, `archive-category`, `archive-tag`, `archive-author`, `sidebar-left`, `sidebar-right`. These are exactly the kinds in Engage `src/features/siteTemplates/kinds.ts`.

A `site-template` of kind `archive-blog` or `archive-shop` may carry its loop by reference: `{"$loop": "<slug>"}` in the tree, resolved at build like `{"$section": "<slug>"}`. The built item then contains both the template and the loop, and Engage inserts both.

Loop trees use merge tags: `{{title}}`, `{{price}}`, `{{image}}`, `{{url}}`, `{{field:<name>}}`.

## 1c. Bundled pictures (B)

- Pictures live next to the source: `templates/<path>/<slug>/images/<name>.<jpg|png|webp|svg>`.
- The build copies them to `items/<slug>/images/` and lists them in the item as `assets: [{ "path": "images/hero.jpg", "alt": "...", "bytes": 123456 }]`.
- Rules: at most 20 pictures per item, each at most 5 MB (Engage refuses more), referenced in the tree as `{"$asset": "images/hero.jpg"}`, no remote image URLs, alt text required, licence recorded in `docs/IMAGES.md`.

## 1d. Theme pair and colour set (C)

- `theme`: `light`, `dark` or `both` (already in the catalog; becomes a source field).
- `pairWith`: slug of the same design in the other theme. Both slugs must exist and point at each other. Engage shows a light and dark switch and inserts the one matching the site's theme.
- `colourSet`: id from `taxonomy/styles.json` → `colourSets` (primary, secondary, accent, surface, text, border, success, warning, error). The template uses only Shine tokens (`var(--sh-primary)` and so on) so Engage can map it onto the site's theme.

## 1e. Parameters (D) and schema version (E)

- `parameters`: up to 12 entries `{ "name": "headline", "type": "text|link|image|colour|number|choice", "label": "Headline", "default": "...", "targets": ["tree.0.columns.0.blocks.0.props.text"] }`. Engage shows them as a small form on insert (Task 37c).
- `schemaVersion` becomes `2` in `items/*.json`, `library.json` and `catalog.json`. Version 1 files stay valid. The build fails if a v2 field appears in a file that declares version 1.
- `npm run check` must fail on: unknown `siteKind`, `pairWith` that does not point back, an asset over 5 MB or more than 20 assets, a remote image URL, a `$loop` or `$section` that does not exist, a parameter target that does not resolve, and any raw HTML, script or iframe element (existing rule 7).
