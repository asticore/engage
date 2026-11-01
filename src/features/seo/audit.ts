import { adminCollectionPath } from '@/admin/adminPaths'
/**
 * The SEO audit: one row per published page, post, product or event with its
 * SEO and readability scores, the problems found and the noindex flag. Pure:
 * no I/O. The loader that reads the documents is in ./auditLoader.ts.
 */

import { analyze } from './analysis/analyze'
import { extractForAnalysis } from './analysis/extract'
import type { AnalysisInput, Status } from './analysis/types'

export const AUDIT_COLLECTIONS = ['pages', 'posts', 'products', 'events'] as const
export type AuditCollection = (typeof AUDIT_COLLECTIONS)[number]

export type AuditRow = {
  collection: AuditCollection
  id: number | string
  title: string
  slug: string
  editHref: string
  seoScore: Status
  readabilityScore: Status
  hasKeyphrase: boolean
  hasMetaDescription: boolean
  /** The SEO title and meta description as saved (empty when not set). The audit list edits them. */
  metaTitle: string
  metaDescription: string
  /** Messages of every check that scored 'bad', SEO first, then readability. */
  problems: string[]
  noIndex: boolean
  /** Marked as cornerstone content on the SEO tab (pages and posts). */
  cornerstone: boolean
  /** A published page that no content links to. Set by the loader; always false for other places. */
  orphan: boolean
  /** Up to five other pages to link to from this one. Set by the loader; pages only. */
  linkSuggestions: { title: string; href: string }[]
}

export type AuditSummary = {
  total: number
  good: number
  ok: number
  bad: number
  missingKeyphrase: number
  missingMetaDescription: number
  noIndex: number
  cornerstone: number
  orphans: number
}

export const ORPHAN_PROBLEM = 'No other content on this site links to this page. Link to it from a related page or post.'

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Builds one audit row from a document as the database returns it (nested `seo` group). Pure. */
export function buildAuditRow(doc: Record<string, unknown>, collection: AuditCollection): AuditRow {
  const seo: Record<string, unknown> = doc.seo && typeof doc.seo === 'object' ? (doc.seo as Record<string, unknown>) : {}
  const title = asText(doc.title) || asText(doc.name)
  const slug = asText(doc.slug)
  const metaDescription = asText(seo.metaDescription)
  const keyphrase = asText(seo.focusKeyphrase)
  const body = extractForAnalysis(doc)
  const cornerstone = seo.cornerstone === true
  const input: AnalysisInput = {
    title,
    slug,
    metaTitle: asText(seo.metaTitle) || title,
    metaDescription,
    keyphrase,
    text: body.text,
    headings: body.headings,
    links: body.links,
    images: body.images,
    cornerstone,
  }
  const result = analyze(input)
  const problems = [...result.seo, ...result.readability].filter((check) => check.status === 'bad').map((check) => check.message)

  return {
    collection,
    id: doc.id as number | string,
    title,
    slug,
    editHref: `${adminCollectionPath(collection)}/${String(doc.id)}`,
    seoScore: result.seoScore,
    readabilityScore: result.readabilityScore,
    hasKeyphrase: keyphrase.trim().length > 0,
    hasMetaDescription: metaDescription.trim().length > 0,
    metaTitle: asText(seo.metaTitle),
    metaDescription,
    problems,
    noIndex: seo.noIndex === true,
    cornerstone,
    orphan: false,
    linkSuggestions: [],
  }
}

/** Counts for the summary cards at the top of the audit. Pure. */
export function summariseAuditRows(rows: AuditRow[]): AuditSummary {
  const summary: AuditSummary = { total: rows.length, good: 0, ok: 0, bad: 0, missingKeyphrase: 0, missingMetaDescription: 0, noIndex: 0, cornerstone: 0, orphans: 0 }
  for (const row of rows) {
    if (row.seoScore === 'good') summary.good += 1
    else if (row.seoScore === 'ok') summary.ok += 1
    else if (row.seoScore === 'bad') summary.bad += 1
    if (!row.hasKeyphrase) summary.missingKeyphrase += 1
    if (!row.hasMetaDescription) summary.missingMetaDescription += 1
    if (row.noIndex) summary.noIndex += 1
    if (row.cornerstone) summary.cornerstone += 1
    if (row.orphan) summary.orphans += 1
  }
  return summary
}
