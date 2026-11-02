import { resolveD1Binding } from '@/cms/db/connect'

import { decideEmbedFrame, type EmbedFrameDecision } from './embedFrame'

/**
 * One small read for the middleware, which has no engine: the embed's switch and websites, and its form's
 * status, by the embed's public key. Held in isolate memory for a minute per key. Fails closed (not
 * frameable), so a database problem never opens an embed to be framed anywhere.
 */
const TTL_MS = 60_000
const cache = new Map<string, { at: number; value: EmbedFrameDecision }>()

export async function readEmbedFrameDecision(key: string): Promise<EmbedFrameDecision> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL_MS) return hit.value
  let value: EmbedFrameDecision = { frameable: false }
  try {
    const d1 = await resolveD1Binding()
    const row = await d1
      .prepare(
        'SELECT e.enabled AS enabled, e.allowed_origins AS allowed_origins, f.form_status AS form_status FROM `eg_form_embeds` e JOIN `eg_forms` f ON f.id = e.form_id WHERE e.embed_key = ? LIMIT 1',
      )
      .bind(key)
      .first<{ enabled: number; allowed_origins: string | null; form_status: string | null }>()
    value = decideEmbedFrame(
      row
        ? { enabled: row.enabled === 1, allowedOrigins: parseOrigins(row.allowed_origins), formStatus: row.form_status }
        : null,
    )
  } catch {
    value = { frameable: false }
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, { at: now, value })
  return value
}

function parseOrigins(text: string | null): unknown {
  if (!text) return []
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}
