import React from 'react'

import { getBlockContext, getRequestQuery } from '@/lib/blockContext'
import { describeCode } from '@/features/weather/openMeteo'
import { loadConfiguredWeather } from '@/features/weather/providers'
import { readMapsWeather } from '@/features/mapsWeather/store'
import { getEngine } from '@/lib/engine'

import './wave70.css'

/** Wave 70 sitemap (Task 10): a tree of published, public pages. Renders nothing when the read fails. */

type P = Record<string, unknown>
export type MapPage = { id: number; title: string; slug: string; parent: number | null; isHomepage?: boolean }
export type MapNode = { page: MapPage; href: string; children: MapNode[] }

/** Builds the tree. Excluded slugs drop their whole branch. Depth 1 is the top level. Cycles and orphans are cut. */
export function buildSitemap(pages: MapPage[], exclude: string[], maxDepth: number): MapNode[] {
  const skip = new Set(exclude.map((s) => s.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean))
  const depth = Math.min(Math.max(Math.trunc(maxDepth) || 3, 1), 6)
  const byParent = new Map<number | null, MapPage[]>()
  const ids = new Set(pages.map((p) => p.id))
  for (const p of pages) {
    const key = p.parent !== null && ids.has(p.parent) ? p.parent : null
    byParent.set(key, [...(byParent.get(key) ?? []), p])
  }
  const walk = (parent: number | null, level: number, path: string, seen: Set<number>): MapNode[] => {
    if (level > depth) return []
    const out: MapNode[] = []
    for (const page of byParent.get(parent) ?? []) {
      if (seen.has(page.id) || skip.has(page.slug)) continue
      const href = page.isHomepage ? '/' : `${path}/${page.slug}`
      out.push({ page, href, children: walk(page.id, level + 1, href, new Set([...seen, page.id])) })
    }
    return out.sort((a, b) => (a.page.isHomepage ? -1 : b.page.isHomepage ? 1 : a.page.title.localeCompare(b.page.title)))
  }
  return walk(null, 1, '', new Set())
}

function List({ nodes }: { nodes: MapNode[] }): React.ReactElement {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.page.id}>
          <a href={n.href}>{n.page.title}</a>
          {n.children.length ? <List nodes={n.children} /> : null}
        </li>
      ))}
    </ul>
  )
}

export async function SitemapElement(props: P): Promise<React.ReactElement | null> {
  try {
    const engine = await getEngine()
    const { docs } = (await engine.find({ collection: 'pages', where: { _status: { equals: 'published' } }, limit: 0, depth: 0 })) as unknown as { docs: Array<Record<string, unknown>> }
    const pages: MapPage[] = docs
      .filter((d) => d.membersOnly && typeof d.membersOnly === 'object' ? (d.membersOnly as { enabled?: boolean }).enabled !== true : true)
      .filter((d) => !(d.seo && typeof d.seo === 'object' && (d.seo as { noIndex?: boolean }).noIndex === true))
      .filter((d) => typeof d.id === 'number' && typeof d.title === 'string' && (d.isHomepage === true || (typeof d.slug === 'string' && d.slug)))
      .map((d) => ({ id: d.id as number, title: d.title as string, slug: (d.slug as string) ?? '', parent: typeof d.parent === 'number' ? d.parent : null, isHomepage: d.isHomepage === true }))
    const tree = buildSitemap(pages, String(props.exclude ?? '').split('\n'), Number(props.maxDepth) || 3)
    return tree.length ? <nav className="w70-sitemap" aria-label="Sitemap"><List nodes={tree} /></nav> : null
  } catch {
    return null
  }
}

/** Which kind of archive a path belongs to, from its address. */
export function archiveKind(path: string, q: string): 'category' | 'tag' | 'author' | 'search' | 'other' {
  if (/\/category\//.test(path)) return 'category'
  if (/\/tag\//.test(path)) return 'tag'
  if (/\/author\//.test(path)) return 'author'
  if (q) return 'search'
  return 'other'
}

const PREFIX: Record<string, string> = { category: 'Category: ', tag: 'Tag: ', author: 'Author: ', search: 'Search results for ' }

export async function ArchiveTitleElement(props: P): Promise<React.ReactElement | null> {
  const c = getBlockContext()
  const rawQ = getRequestQuery().q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim().slice(0, 80) ?? ''
  const kind = archiveKind(c.path ?? '', q)
  const base = kind === 'search' ? q : typeof c.page?.title === 'string' ? c.page.title : ''
  if (!base) return null
  const prefix = props.showPrefix !== false ? PREFIX[kind] ?? '' : ''
  const tag = ['h1', 'h2', 'h3', 'h4'].includes(String(props.level)) ? String(props.level) : 'h1'
  return React.createElement(tag, { className: 'w70-archive-title' }, `${prefix}${base}`)
}

export async function WeatherElement(props: P): Promise<React.ReactElement | null> {
  const place = typeof props.place === 'string' ? props.place : ''
  const config = await readMapsWeather()
  const w = await loadConfiguredWeather(config, place, props.units === 'imperial' ? 'imperial' : props.units === 'metric' ? 'metric' : undefined, Number(props.cacheMinutes) || undefined)
  if (!w) return null
  const units = w.units
  const deg = units === 'imperial' ? '\u00b0F' : '\u00b0C'
  const spd = units === 'imperial' ? 'mph' : 'km/h'
  const now = describeCode(w.now.code)
  return (
    <section className="w70-weather" aria-label={`Weather in ${w.place}`}>
      <p className="w70-weather__now">
        <span className="w70-weather__icon" aria-hidden="true">{now.icon}</span>
        <span className="w70-weather__temp">{w.now.temp}{deg}</span>
        <span>{w.place}: {now.label}, wind {w.now.wind} {spd}</span>
      </p>
      {props.view === 'hourly' && w.hours && w.hours.length > 0 ? (
        <ul className="w70-weather__hours" aria-label="Next hours">
          {w.hours.map((h, i) => {
            const c = describeCode(h.code)
            return (<li key={`${h.label}-${i}`}><span>{h.label}</span><span aria-hidden="true">{c.icon}</span><span className="w70-sr">{c.label}</span><span>{h.temp}{deg}</span></li>)
          })}
        </ul>
      ) : null}
      {props.view === 'current' || props.view === 'hourly' ? null : (
        <ul className="w70-weather__days">
          {w.days.map((d) => {
            const c = describeCode(d.code)
            const day = new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' })
            return (<li key={d.date}><span>{day}</span><span aria-hidden="true">{c.icon}</span><span className="w70-sr">{c.label}</span><span>{d.max}{deg} / {d.min}{deg}</span></li>)
          })}
        </ul>
      )}
    </section>
  )
}

export const WAVE70_COMPONENTS: Record<string, React.ComponentType<P>> = {
  sitemap: SitemapElement as never,
  'archive-title': ArchiveTitleElement as never,
  weather: WeatherElement as never,
}
