import { blogPath } from '@/features/seo/permalinks'
import { readBlogBase } from '@/features/seo/permalinkStore'
import React from 'react'

import { switcherLabel, switcherOptions } from '@/features/multilingual/switcherStyle'
import { getBlockContext } from '@/lib/blockContext'
import { getEngine } from '@/lib/engine'

import { getMultilingualSettings, localisedHref, localeNativeName } from '@/features/multilingual'
import { availableLocalesForPath } from '@/features/multilingual/applyTranslations'
import { localizedPathsFor } from '@/features/multilingual/slugIndex'
import { localesFor } from '@/features/seo/localeSeo'
import { requestContentLocale } from '@/features/multilingual/portalLocaleServer'

import { mediaOf, str } from './elementUtil'
import './wave65.css'

/** Wave 65 server elements (defs: src/lib/elements/wave65Defs.ts). Public data only; failures render nothing. */

type P = Record<string, unknown>
type Neighbour = { title: string; href: string }

export async function AuthorBoxElement(props: P): Promise<React.ReactElement | null> {
  const name = str(props.name).trim() || str(getBlockContext().post?.author).trim()
  const bio = str(props.bio).trim()
  const avatar = mediaOf(props.avatarUrl)
  if (!name && !bio) return null
  return (
    <aside className="be-el-65-author">
      {avatar?.url ? <img decoding="async" src={avatar.url} alt="" /> : null}
      <div>
        {str(props.label) ? <p className="be-el-65-author__label">{str(props.label)}</p> : null}
        {name ? <p className="be-el-65-author__name">{name}</p> : null}
        {bio ? <p className="be-el-65-author__bio">{bio}</p> : null}
      </div>
    </aside>
  )
}

/** The blog slug from a /blog/<slug> path, or ''. */
export const blogSlug = (path: unknown, base = 'blog'): string => {
  const p = typeof path === 'string' ? path : ''
  for (const b of new Set([base, 'blog'])) {
    if (p.startsWith(`/${b}/`) && !p.slice(b.length + 2).includes('/') ) return p.slice(b.length + 2).replace(/[?#].*$/, '')
  }
  return ''
}

async function neighbour(date: string, dir: 'prev' | 'next', base: string): Promise<Neighbour | null> {
  try {
    const engine = await getEngine()
    const r = (await engine.find({
      collection: 'posts',
      where: { and: [{ _status: { equals: 'published' } }, { publishedDate: dir === 'prev' ? { less_than: date } : { greater_than: date } }] },
      sort: dir === 'prev' ? '-publishedDate' : 'publishedDate',
      limit: 1, depth: 0,
    } as never)) as unknown as { docs?: { title?: unknown; slug?: unknown }[] }
    const d = r?.docs?.[0]
    return d && str(d.slug) ? { title: str(d.title) || str(d.slug), href: blogPath(base, `/${encodeURIComponent(str(d.slug))}`) } : null
  } catch {
    return null
  }
}

export async function PostNavigationElement(props: P): Promise<React.ReactElement | null> {
  const ctx = getBlockContext()
  const date = typeof ctx.post?.date === 'string' ? ctx.post.date : ''
  const base = await readBlogBase()
  if (!blogSlug(ctx.path, base) || !date) return null
  const [prev, next] = await Promise.all([neighbour(date, 'prev', base), neighbour(date, 'next', base)])
  if (!prev && !next) return null
  const link = (n: Neighbour | null, cls: string, label: string) =>
    n ? <a className={cls} href={n.href} rel={cls.endsWith('next') ? 'next' : 'prev'}><small>{label}</small>{n.title}</a> : null
  return (
    <nav className="be-el-65-postnav" aria-label="Post navigation">
      {link(prev, 'be-el-65-postnav__prev', str(props.prevLabel) || 'Previous post')}
      {link(next, 'be-el-65-postnav__next', str(props.nextLabel) || 'Next post')}
    </nav>
  )
}

async function languageData() {
  try {
    const settings = await getMultilingualSettings((await getEngine()) as never)
    if (!settings.enabled || settings.activeLocales.length < 2) return null
    // The middleware strips the locale prefix, so the path is the page and the header carries the language.
    const current = (await requestContentLocale(settings)) ?? settings.defaultLocale
    const rest = getBlockContext().path || '/'
    // Languages this page has no publishable translation in are left out, the default always stays.
    const offered = localesFor(settings, await availableLocalesForPath(rest))
    // Each language's own URL for this page: a translated slug where there is one (localizedSlugs.ts).
    const paths = (await localizedPathsFor(rest)) ?? {}
    return { settings, rest, current, offered, paths }
  } catch {
    return null
  }
}

export async function LanguageSwitcherElement(props: P): Promise<React.ReactElement | null> {
  const d = await languageData()
  if (!d) return null
  const o = switcherOptions(props)
  const items = d.offered.map((code) => {
    const name = localeNativeName(code)
    const { text, flag } = switcherLabel(code, name, o.display)
    return { code, name, text, flag }
  })
  const link = (item: (typeof items)[number]) => (
    <a href={localisedHref(d.paths[item.code] ?? d.rest, item.code, d.settings)} hrefLang={item.code} lang={item.code} aria-current={item.code === d.current ? 'true' : undefined} aria-label={item.text ? undefined : item.name} title={item.name}>
      {item.flag ? <span aria-hidden="true">{item.flag}</span> : null}{item.flag && item.text ? ' ' : ''}{item.text}
    </a>
  )
  // The dropdown is a native details element: no script, opens with the keyboard, and the current language is the button.
  if (o.layout === 'dropdown') {
    const current = items.find((item) => item.code === d.current) ?? items[0]
    return (
      <nav aria-label={str(props.label) || 'Language'}>
        <details className={`be-el-65-lang-dd hover-${o.hover} align-${o.align}`}>
          <summary aria-label={`${str(props.label) || 'Language'}: ${current?.name ?? ''}`}>
            {current?.flag ? <span aria-hidden="true">{current.flag}</span> : null}{current?.flag && current.text ? ' ' : ''}{current?.text || current?.name}
          </summary>
          <ul>
            {items.map((item) => (
              <li key={item.code}>{link(item)}</li>
            ))}
          </ul>
        </details>
      </nav>
    )
  }
  return (
    <nav aria-label={str(props.label) || 'Language'}>
      <ul className={`be-el-65-lang is-${o.layout} hover-${o.hover} align-${o.align}`}>
        {items.map((item) => (
          <li key={item.code}>{link(item)}</li>
        ))}
      </ul>
    </nav>
  )
}

export const WAVE65_SERVER_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'author-box': AuthorBoxElement as never,
  'post-navigation': PostNavigationElement as never,
  'language-switcher': LanguageSwitcherElement as never,
}
