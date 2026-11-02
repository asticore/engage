/**
 * External embeds, the admin side: pure helpers shared by the screen and its tests.
 *
 * An embed is one way of showing a form on other websites (see ./embeds.ts). Each has its own hosted address
 * (/embed/<key>), its two snippets, a source name for its submissions, the websites allowed, and a theme. This
 * module turns stored embeds into what the screen shows, and reads the websites box.
 */

import { cleanOrigin } from './config'
import { embedUrl, iframeSnippet, scriptSnippet } from './embedScript'
import type { EmbedRecord, EmbedTheme } from './embeds'

export type EmbedAdminRow = {
  id: number
  formId: number
  formTitle: string
  formPublished: boolean
  name: string
  embedKey: string
  enabled: boolean
  allowedOrigins: string[]
  theme: EmbedTheme
}

/** Reads the websites box. One website per line; a bare host such as example.com is taken as https. */
export function parseAllowedOrigins(text: string): { origins: string[]; invalid: string[] } {
  const origins: string[] = []
  const invalid: string[] = []
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const candidate = /^https?:\/\//i.test(line) ? line : `https://${line}`
    const clean = cleanOrigin(candidate)
    if (clean && !origins.includes(clean)) origins.push(clean)
    else if (!clean) invalid.push(line)
  }
  return { origins, invalid }
}

/** One embed as the screen shows it, with the title and status of the form it shows. */
export function embedAdminRow(embed: EmbedRecord, form: { title?: unknown; formStatus?: unknown }): EmbedAdminRow {
  return {
    id: embed.id,
    formId: embed.formId,
    formTitle: typeof form.title === 'string' && form.title ? form.title : `Form #${embed.formId}`,
    formPublished: form.formStatus !== 'draft',
    name: embed.name,
    embedKey: embed.embedKey,
    enabled: embed.enabled,
    allowedOrigins: embed.allowedOrigins,
    theme: embed.theme,
  }
}

/** Hosted address and the two snippets for one embed, for the given site origin. */
export function embedOutputs(key: string, origin: string): { hostedUrl: string; scriptSnippet: string; iframeSnippet: string } {
  return { hostedUrl: embedUrl(origin, key), scriptSnippet: scriptSnippet(origin, key), iframeSnippet: iframeSnippet(origin, key) }
}
