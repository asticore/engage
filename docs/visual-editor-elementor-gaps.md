# Visual editor vs Elementor: gap list (Task 3)

Task: evaluate Elementor (free + Pro, from general knowledge, not re-verified online) against the visual editor and list gaps, then build the agreed ones. Matt's clarifications (7 Nov 2026): no extra widget list; drag and drop of Elements panel items is a separate task (Task 2). Rule: the Catalogue principle in `docs/remaining-work.md` (one HTML primitive = one element; variations are options, Design effects, section display modes or templates; a new widget only for new markup, behaviour or data).

Already covered elsewhere, excluded here: `docs/visual-editor-elementor-tweaks.md` VE-01..VE-15 (paste style, CSS id duplicates, hidden blocks, edit lock, shortcuts, context menu, history/revisions, more responsive keys, preview, save state, finder, padding drag, multi-select, global fonts). Where a gap below touches one of those it is marked "see VE-xx" and not planned again.

Legend: exists / partial / missing. Effort S (under a day) / M (1-3 days) / L (a week or more). Value H/M/L. "Build now" = yes / later / no.

Scope of what was read: `src/lib/elements/registry.ts` and `wave*Defs.ts` (about 120 element types, 33 hidden legacy), `src/lib/sectionLayout.ts` (section display modes and flow), `src/lib/blockStyle.ts` (style keys), `src/views/visualEditor/DesignPanel.tsx` and `FieldPanel.tsx`, `src/lib/mergeTags.ts`, `src/features/siteTemplates/*`, `src/features/forms/*`, `src/lib/popupTriggers.ts`, `src/lib/visibilityRules.ts`.

---

## 1. Widgets (catalogue)

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

## 2. Controls per widget (content / style / advanced)

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

## 3. Responsive options

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

## 4. Flexbox / grid containers (section model)

The section is the container: a column tree with display modes. `SectionDisplay = 'columns' | 'tabs' | 'accordion' | 'carousel' | 'grid' | 'flex' | 'modal' | 'stack' | 'hscroll' | 'sticky-steps'` (src/lib/sectionLayout.ts line 24), edited in `FieldPanel.tsx` (modes list near line 458).

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Flexbox container: direction, justify, align, wrap, gap, boxed width, min height | exists (sectionLayout.ts 35-60) | none | - | - | no |
| Grid container: columns/rows, gaps, auto flow, justify/align | exists (sectionLayout.ts 74-90); no explicit row count/row template | explicit rows and spanning cells (grid area) | M | L | no (columns + auto flow cover real use) |
| Nested containers | exists: sections nest (docs/remaining-work.md design model: "sections nest") | none | - | - | no |
| Carousel / tabs / accordion / popup / scroll story as modes | exists as `display` modes (variations are options, matches the Catalogue principle) | carousel lacks autoplay, loop, dots (only perView, gap, arrows: sectionLayout.ts 62-67) | S | M | later: see section 5 |
| Container shape dividers, background effects | exists: `dividerTop/Bottom` shapes + animation, `bgEffect`, particles, `maskShape` (blockStyle.ts 188-230) | none | - | - | no |

---

## 5. Motion effects

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Entrance animation (fade, slide, zoom, bounce...) with duration, delay | exists: `reveal` fade/fade-up/fade-down/slide-left/slide-right/zoom/blur with distance, duration, delay, easing (blockStyle.ts 31, 268-273) | no repeat-on-scroll-out; presets fewer than Elementor (no rotate, flip, bounce) | S | L | no (Catalogue: add options only if asked) |
| Scrolling effects (vertical/horizontal scroll, transparency, blur, rotate, scale tied to scroll position) | partial: `parallax` background / float-up / float-down with strength, distance, direction (blockStyle.ts 211-232); element `draw-line`, `count-up` are scroll triggered | no scroll-linked opacity/scale/rotate/translate-X; no viewport range | M | M-H | **yes** (build item 4), product decision on browser support |
| Mouse effects (track, 3D tilt) | exists: `pointerFx` spotlight/tilt/magnetic with strength (blockStyle.ts 217, 283-285; src/components/blocks/PointerFx.tsx), custom cursor ring in `page-effects` (wave44Defs.ts 25) | no "mouse track" (element moves opposite/toward cursor) | S | L | later |
| Sticky (top/bottom, offset, per device, effects on scroll) | partial: `position: sticky` + offsets (blockStyle.ts 379-384), `sticky-bar` element (wave37Defs.ts 39), `sticky-steps` mode | no "sticky only on desktop", no shrink/transparent-on-scroll header | M | M | later |
| Hover animations | exists: `hover` lift/glow/zoom, `hoverTransform`, `kenBurns`, `borderFx` (blockStyle.ts 215-221) | none | - | - | no |
| Reduced motion | exists: `prefers-reduced-motion` handled in `src/components/blocks/effects.css` | none | - | - | no |

---

## 6. Templates and kits

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Template library (blocks, pages), save as template | exists: TemplateBrowser.tsx, SaveAsTemplate.tsx, page_templates, template libraries/repos (src/features/templateLibraries, templateRepos), suggested templates hub (src/features/templatesHub) | none | - | - | no |
| Global widgets (edit once, update everywhere) | exists: `reusable-section` block (src/components/blocks/ReusableSectionBlock.tsx) and `template-part` element (src/lib/elements/templatePartDefs.ts) | none | - | - | no |
| Kit import/export (whole site: templates, global styles, settings) | exists: `engage-template` export (src/features/siteTemplates/templateIo.ts), settings transfer (src/features/settingsTransfer), starters (src/features/siteTemplates/starters.ts, src/features/starters.ts) | no single "kit" that bundles theme tokens + templates + pages in one file; not verified end to end | L | M | later (needs product decision) |
| Import/export JSON of a page | exists: ImportExportModal.tsx | none | - | - | no |
| Theme style presets | exists: StylePresets.tsx; theme tokens in src/features/themeStyles | style presets (not tokens) are per block only | - | - | no |

---

## 7. Dynamic data

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

## 8. Theme builder

| Elementor capability | Here | Gap | Effort | Value | Build now? |
|---|---|---|---|---|---|
| Template types: header, footer, single (post, page, custom post type), archive (posts, category, tag, author, CPT), search results, 404, loop item, sidebar | exists: `SITE_TEMPLATE_KINDS` header, footer, single-post, single-product, single-event, archive-blog, archive-shop, not-found, search-results, archive-category, archive-tag, archive-author, loop, sidebar-left, sidebar-right (src/features/siteTemplates/kinds.ts); dashboard tabs mirror Elementor (kinds.ts TEMPLATE_TYPE_TABS) | missing kinds: single-page (pages use their own content), archive-event, archive-faq, single-faq | M | M | later: each kind needs a route and resolver; no demand shown |
| Display conditions: include/exclude, all pages, specific pages, post type, category, author, date, etc. | exists: OR-of-AND groups, params templateKind, path, page, audience (members/guests/everyone), productCategory, productType, eventType, domain, language, postCategory, postTag; priority and specificity tie break (src/features/siteTemplates/conditions.ts 1-60, src/fields/customFields/types.ts 110) | include only: rules are equals / notEquals so exclude is expressible by notEquals; no "author" or "date" param | S | L | no |
| Template coverage checking | exists: src/features/siteTemplates/coverage.ts | none | - | - | no |
| Preview with sample item | exists: PreviewAsPicker.tsx | none | - | - | no |
| Sticky header, transparent header over hero | partial: position/sticky keys on a header section | no "scroll behaviour" preset; see section 5 sticky | M | M | later |
| Template export/import | exists: ExportTemplateLink.tsx, TemplateImport.tsx, templateIo.ts | none | - | - | no |

---

## 9. Forms

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

## 10. Popups

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

## 11. Admin-level Elementor features

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

## 12. Summary of confirmed gaps

High value: custom attributes (aria/data), dynamic links and images on non-text controls, scroll-linked motion, popup idle trigger and presentation options, extra visibility rules.
Medium/later: loop carousel, conditional redirect after form submit, archive tags, per-device background and position offsets (VE "more responsive keys"), custom icon library, sticky header behaviour, URL-param/user tags, kit bundle, extra template kinds.
No: extra breakpoints beyond tablet/mobile, Lottie, grid areas, new widgets (per Matt).

---

## Recommended build set

Order is by value over effort. None overlaps VE-01..VE-15. All follow the Catalogue principle: no new element, only options on existing blocks. Common rules (from `docs/remaining-work.md`): additive JSON keys inside the stored `design` or `layout` (no column, so no migration unless stated); a new key goes into the style normaliser in `src/lib/blockStyle.ts` so unknown/unsafe values are dropped on read; ASCII source; English UI text keys in `src/features/uiStrings/keys.ts`; tests in `tests/int/*.int.spec.ts`; gates `pnpm exec tsc --noEmit`, related specs, `pnpm run build`. Design values are stored grouped (see "Design model" in remaining-work.md): check how `toStoredDesign` / `readFlatDesign` (src/lib/design) treat a new key, and add it to the group map if one exists.

### 1. Custom attributes and ARIA (effort S, value H, no product decision)

- Stored key: `BlockStyle.customAttrs?: string` (one `name|value` pair per line, mirrors Elementor, max 10 lines, value max 200 chars). Keep it a string so it fits the flat/grouped design codec.
- Files: `src/lib/blockStyle.ts` (type, normaliser with a pure `sanitizeCustomAttrs(text): {name,value}[]`, and wherever the wrapper props are produced from a style, e.g. the function that returns `id`/`className`/style for `anchorId` and `customClass`); `src/components/blocks/StyledBlock.tsx` and the element wrapper path in `src/components/blocks/elements/elementUtil.ts` to spread the attributes; the editor canvas wrapper (`src/views/visualEditor/CanvasBlockPreview.tsx`) so the canvas matches; `src/views/visualEditor/DesignPanel.tsx` in the Advanced accordion (line ~448) add a textarea with a one-line help.
- Rules for `sanitizeCustomAttrs` (security, server and client use the same function): names must match `^[a-z][a-z0-9-]{0,39}$`; allow only `data-*`, `aria-*`, `role`, `title`, `tabindex` (-1/0 only), `lang`, `rel`, `target` is NOT allowed; reject anything starting with `on`, and `style`, `class`, `id`, `href`, `src`, `srcdoc`, `formaction`; values stripped of control characters and quotes handled by React (never use dangerouslySetInnerHTML); `role` limited to an allow list.
- Also add the key to `src/features/roles/elementStyleKeys.ts` so roles without full style access are handled consistently (check that file for how keys are grouped).
- Tests: unit tests for the sanitiser (accepts `aria-label|Open menu`, `data-track|cta`; rejects `onclick|x`, `style|x`, `href|javascript:x`, bad names, caps); a render test that the attribute reaches the wrapper; a round trip through readFlatDesign/toStoredDesign.
- Product decision: none. Note for the brief: duplicates with VE-02 (CSS id) are separate; do not touch `anchorId`.

### 2. Popup: idle trigger and presentation options (effort S-M, value M)

- Stored keys (inside `SectionLayout`, src/lib/sectionLayout.ts, next to `popupDelay`): `popupIdle?: number` (seconds of no pointer/key/scroll/touch input, 5..600); `popupOverlay?: number` (overlay darkness 0..90, default today's value); `popupCloseOnOverlay?: boolean` (unset = true); `popupShowClose?: boolean` (unset = true); `popupAnim?: 'none' | 'fade' | 'slide-up' | 'zoom'` (unset = current behaviour); `popupPosition?: 'center' | 'top' | 'bottom' | 'right'`.
- Files: `src/lib/sectionLayout.ts` (types, sanitiser for the layout, `sectionLayoutProps` attributes/custom properties, and the static CSS in `sectionLayoutCss` which a test keeps in sync with styles.css: update both); `src/lib/popupTriggers.ts` add a pure `idleElapsed(lastActivityMs, nowMs, seconds)` helper; `src/components/blocks/PopupController.tsx` register the idle timer (reset on pointermove/keydown/scroll/touchstart, passive listeners, honour `frequencyAllows` and `isLikelyBot`, clear on unmount, do not auto-open if already open); `src/views/visualEditor/FieldPanel.tsx` (after line ~681, same pattern as `popupDelay`, clamp values like the neighbours); canvas preview must not auto-open in the editor (check how the existing triggers are suppressed there).
- Accessibility: keep focus trap and Esc to close; Esc must still close when "close on overlay" is off; the close button hidden only when `popupShowClose === false` AND Esc still works (decide with product whether to forbid hiding both overlay close and close button, recommended: when the close button is hidden, Esc and overlay close stay on).
- Tests: `tests/int` for `idleElapsed`, layout sanitiser clamps, CSS sync test (existing one for sectionLayoutCss), and a controller test if one exists for the delay trigger (search `popupTriggers` in tests/).
- Product decision: whether a popup may be made impossible to close by mouse (recommend no; keep Esc and one visible close path).

### 3. Dynamic link and image sources (effort M, value H; needs a check and a product decision first)

- Step 0 (30 minutes): confirm whether `link`-type element fields and `button` links already resolve merge tags on the public render (`resolveMergeTags` and `safeUrl` in `src/lib/mergeTags.ts`; renderer helpers in `src/components/blocks/elements/elementUtil.ts`; the `link` field control at `src/views/visualEditor/FieldPanel.tsx` line ~1451). If they do, the work is only the picker; if not, the resolver too.
- Scope (recommended): allow merge tags in link URL and in image/background source on elements that appear in loop item templates, single templates and `template-part`. Tags offered: `{{url}}`, `{{image}}`, `{{field:name}}` (link subkeys `.url`), `{{option:...}}` (already defined in `src/lib/mergeTags.ts` lines 113-135 and `loopMergeTags.ts`).
- Files: `src/lib/elements/fieldTypes.ts` (`supportsMergeTags` flag already exists, line 59: set it on `link` and image fields in `registry.ts`/wave defs and make the editor honour it for those types); `FieldPanel.tsx` (show `MergeTagPicker` beside the `link` and `media` controls; for media allow a "use tag" toggle storing `{ tag: '{{image}}' }` or a plain string, decide shape in the brief before coding); renderers for `image`, `link`, `image-box`, `icon-box` etc. through one shared helper so each element does not re-implement it; `safeUrl` must be applied after resolution (block `javascript:` and `data:` except images); empty result falls back to the stored fallback (no broken link/image).
- Tests: resolver unit tests (tag resolves, unknown tag left as is or empty per mergeTags.ts convention, `javascript:` rejected after resolution, fallback image used), a snapshot render of a loop item with a dynamic link.
- Product decision: (a) which element fields get it (recommend: link and main image of image, image-box, hero/cta backgrounds); (b) fallback behaviour for empty values; (c) server resolution only (pages are edge cached, so no per-visitor tags here).

### 4. Scroll-linked motion effects (effort M, value M-H; product decision)

- Stored keys (flat BlockStyle, Effects accordion): `scrollFx?: 'none' | 'fade' | 'scale' | 'rotate' | 'translate-x' | 'translate-y' | 'blur'` as a list is better but keep it simple: `scrollFx?: ScrollFx` (one effect, like `parallax`), `scrollFxStrength?: number` (0..100), `scrollFxStart?: number` and `scrollFxEnd?: number` (viewport range in percent, 0..100, default 0 and 60), `scrollFxDir?: 'in' | 'out'`.
- Renderer: progressive enhancement with CSS `animation-timeline: view()` and `animation-range` behind `@supports (animation-timeline: view())`, only transform/opacity/filter animate, off under `prefers-reduced-motion: reduce`. Browsers without support show the element in its normal state (no JS fallback; decide with product whether a small IntersectionObserver fallback is wanted: recommended no).
- Files: `src/lib/blockStyle.ts` (type, normaliser with clamps, a CSS emitter next to the `parallax`/`reveal` code that outputs a class plus custom properties, no inline keyframe strings from user data), `src/components/blocks/effects.css` or a new `src/components/blocks/effects-scroll.css` (own file per the lessons; the reduced-motion rule goes in it) and register it where `effects53.css` is imported, `DesignPanel.tsx` Effects accordion (line ~443) with the dot/Reset pattern used for the other FX rows, canvas injection so the editor preview matches (see how `effects.css` reaches the canvas frame, CanvasFrame.tsx).
- Conflicts to check: elements that already use `reveal` or `parallax` (decide: scrollFx and reveal both set `animation`; make them mutually exclusive in the editor with a one-line note, or compose via separate properties).
- Tests: normaliser clamps and unknown values dropped, emitted class/custom properties, reduced-motion CSS present (string test like the sectionLayoutCss sync test).
- Product decision: accept that Firefox ships `animation-timeline` later than Chromium/Safari (no effect there, page still fine)? If not, this becomes L with a JS scroll handler.

### 5. Extra visibility rules: weekday, time of day, language (effort S, value M; small product decision)

- Stored keys (extend the visibility set, src/lib/blockStyle.ts `VIS_KEYS` line ~498 and `src/lib/visibilityRules.ts`): `showDays?: string` (comma list of weekday numbers 0-6, Sunday = 0, max 7), `showFromTime?: string` and `showUntilTime?: string` (`HH:MM`, 24 h; overnight windows allowed when from > until), `showLang?: string` (comma list of language codes, max 10, from the site's language list in src/features/multilingual).
- Evaluate in the browser like the existing rules (pages are edge cached and identical for all visitors): add the fields to `VisRules` and `evaluateRules` (`src/lib/visibilityRules.ts` line 139), to `needsClientGate` (line 111) so the gate is activated, and to the compact JSON form parsed by `parseRules` (line 117); `VisibilityGate.tsx` provides the context (`VisContext`, line 25) — add the current time and the page language there. Language can be decided on the server for a single-language-per-URL site, but keep it in the same gate for consistency unless the page already knows its locale (check `src/features/multilingual`).
- Editor: new rows in the "Visibility rules" accordion (DesignPanel.tsx line ~452), reusing the existing date inputs' pattern; summary chip text where rules are summarised (search `rulesFromStyle` callers).
- Tests: extend the existing visibility rules specs (search `visibilityRules` in tests/int) with weekday, overnight window, language match/mismatch, invalid values dropped.
- Product decision: which timezone the time window uses: the visitor's browser (simple, recommended) or the site timezone (needs a setting). Recommend visitor time and say so in the help text.

### Not recommended now (reasons)

- More responsive keys, per-device background/position: already VE "more responsive keys".
- Extra breakpoints, grid areas, Lottie: cost exceeds value; the three-device model is a strength.
- Kit bundle, extra template kinds, loop carousel, conditional form redirect, URL-param tags: valuable but need product decisions or touch routes and resolvers; list them in `docs/remaining-work.md` as later items if Matt agrees.

### Open questions for Matt

1. Build set: approve items 1 to 5, or choose a subset? (Items 1, 2, 5 are small and independent; 3 and 4 need the decisions above.)
2. Popup close rules (item 2) and time zone (item 5): as recommended?
3. Scroll effects (item 4): is "no effect in Firefox until it ships timeline support" acceptable?
