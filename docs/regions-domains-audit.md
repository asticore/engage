# Regions, languages and domains audit (Tasks 5 and 6, 15 Nov 2026)

Checked by reading the code, not live. Paths are under `src/`.

## Task 5. Languages and regions

### What exists
- World locale list (`features/multilingual/locales.ts`), including regional written variants (en-AU, en-GB, en-US, pt-BR, pt-PT, zh-Hans, zh-Hant, es-ES, es-MX, fr-CA). Active locales, default locale, fallback to default, switcher in header, footer or both (`features/multilingual/settings.ts`).
- URL prefix per language (default unprefixed), locale cookie, `Accept-Language` detection with q-weights (`detect.ts`, `routing.ts`, `middleware.ts`). A domain can serve its own language unprefixed (`features/domains`).
- Translations in a table keyed by locale, source and field; approval workflow (a translation shows only when approved and current), outdated detection, machine translation providers, translated slugs per locale (`localizedSlugs.ts`).
- SEO: hreflang with `x-default`, self referencing canonical, `og:locale`, sitemap variants only for locales with a publishable translation (`features/seo/localeSeo.ts`, `sitemap.ts`). Hreflang also across registered domains (`features/domains/alternates.ts`).
- Admin text in thirteen languages (dictionaries in `features/uiStrings`); public store text with owner overrides (`storeTextsServer.ts`); built-in emails follow the recipient's locale (`email/recipientLocale.ts`, `builtInTemplates.ts`).
- Translatable fields (`translatableFields.ts`): pages (title, slug, SEO, block text), posts (title, slug, excerpt, body, SEO), products (title, slug, description, SEO, tier text), events (title, summary, description, venue, address), reusable sections, FAQs, ticket tier names.

### Regions
There is no region concept. What stands in for it: regional language tags, shipping zones and tax rates by country, display currencies with a manual switcher and daily rates, and a registered domain with a default language and a stored `currencyHint`.

### Gaps (new tasks below)
1. No region entity: content, prices and promotions cannot differ per region. The only per-market lever is a domain (content `availableDomains`, language), and prices are one shop currency.
2. Domain `currencyHint` is stored and shown but nothing reads it: a visitor on the .co.uk domain still opens in the default display currency (`features/domains/model.ts`).
3. Not translatable: category names in the tree, navigation and menu labels, header and footer text, form labels and messages, site title and tagline, product short fields and variation attributes, post category and tag names, event SEO fields, custom fields.
4. Owner-edited email wording (Email templates) is one language: the built-in wording translates, the owner's version does not.
5. Public strings added by features outside the store text table (event page was fixed in Task 1) need a check page by page; there is no test that fails on a hard coded English string in a public component.
6. No language report screen: coverage per language per collection exists in the translation overview but not per region or domain.

## Task 6. Multiple domains

### What exists
- Domain registry (Settings > Domains): host, label, default language, primary flag, active or disabled, redirect to primary, allow admin, per-domain site name, tagline, logo, contact details and socials (`features/domains/model.ts`). Hosts are normalised, headers are set only by the edge middleware after removing client copies (`middleware.ts`).
- Per-domain content: an "Available on domains" field on pages, posts and products with a slug uniqueness check across domains (`features/domains/field.ts`, `slugs.ts`, `hooks.ts`, `access.ts`). Unscoped content shows everywhere; unknown hosts (workers.dev, preview) are never narrowed.
- Sitemap, robots, canonical and base URL follow the request's domain (`features/seo/settings.ts` `originFor`, `robots.ts`, `sitemap.ts`); hreflang lists the same page on other active domains.
- Connect domain attaches a domain to the Worker through the Cloudflare custom-domains API (`features/domains/cloudflareAttach.ts`), with a manual steps fallback.

### Gaps (new tasks below)
1. Events, FAQs, reusable sections, forms and media have no "Available on domains" field (only pages, posts and products), so an event cannot be limited to one domain.
2. The sign-in cookie is host only (no Domain attribute, `features/accounts/session.ts`): a customer signed in on one domain is signed out on another. That is the safe default; there is no switch for shared sign-in across a family of subdomains.
3. Email sender is site wide (`features/email/index.ts` reads one `fromEmail`): mail from domain B arrives from domain A. Per-domain contact email exists but not per-domain sender or reply-to.
4. Header, footer and navigation are shared across domains except for the name, logo and contact overrides; no per-domain menu (the domain menu helper exists in `features/domains/menu.ts` but is not an editor setting).
5. Per-domain analytics and consent: tracking IDs are site wide.
6. Cloudflare routes: attaching a domain needs a token with Workers Scripts edit and Zone read for that zone; there is no check screen that confirms DNS and certificate state after attaching.
7. Cache: page caching and the admin cache purge are not scoped per domain; a purge clears all domains.
