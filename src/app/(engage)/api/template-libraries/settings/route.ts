import { libraryJson, librarySettingsAccess, recordLibraryAudit, storeEngine } from '@/features/templateLibraries/server'
import { loadLibraryManifest } from '@/features/templateLibraries/loader'
import { parseLibraryUrl } from '@/features/templateLibraries/url'
import { readLibraryState, writeLibraryState, writeLibraryToken } from '@/features/templateLibraries/store'
import { LIBRARY_LIMITS } from '@/features/templateLibraries/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/template-libraries/settings
 *   { action: 'add', url: string, label?: string }   add a library by its GitHub address
 *   { action: 'remove', id: string }                 remove a library
 *   { action: 'toggle', id: string, enabled: boolean }
 *   { action: 'token', token: string }              save the access token for private libraries ('' removes it)
 *
 * Administrators only. A new library is saved even when its folder cannot be read yet: its row then
 * shows the reason, so a temporary GitHub problem never blocks adding it.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const access = await librarySettingsAccess()
    if (!access.ok) return access.response
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const engine = storeEngine(access.context)
    const state = await readLibraryState(engine)
    const rows = state.rows.map((row) => ({ id: row.id, label: row.label, url: row.url, enabled: row.enabled }))
    const action = body?.action

    if (action === 'add') {
      const label = typeof body?.label === 'string' ? body.label.trim().slice(0, LIBRARY_LIMITS.labelMaxLength) : ''
      const parsed = parseLibraryUrl(body?.url, label)
      if (!parsed.ok) return libraryJson({ ok: false, error: parsed.error }, 400)
      if (rows.length >= LIBRARY_LIMITS.maxLibraries) {
        return libraryJson({ ok: false, error: `You can add up to ${LIBRARY_LIMITS.maxLibraries} libraries.` }, 400)
      }
      if (rows.some((row) => row.url.toLowerCase() === parsed.value.url.toLowerCase())) {
        return libraryJson({ ok: false, error: 'This library is already added.' }, 409)
      }
      const id = crypto.randomUUID()
      await writeLibraryState(engine, [...rows, { id, label: parsed.value.config.label, url: parsed.value.url, enabled: true }], state.imports, access.context.user)
      const check = await loadLibraryManifest(parsed.value.config, { bypassCache: true }, state.token)
      await recordLibraryAudit(access.context, request, `Template library added: ${parsed.value.config.label || parsed.value.url} (${parsed.value.url})`)
      return libraryJson({
        ok: true,
        id,
        message: check.ok ? `Added. ${check.value.items.length} items found in "${check.value.name}".` : `Added, but the library could not be read yet: ${check.error}`,
      })
    }

    if (action === 'token') {
      const token = typeof body?.token === 'string' ? body.token.trim() : ''
      if (token.length > LIBRARY_LIMITS.tokenMaxLength || /\s/.test(token)) {
        return libraryJson({ ok: false, error: 'The token must be one line with no spaces, up to 400 characters.' }, 400)
      }
      await writeLibraryToken(engine, token || null, access.context.user)
      await recordLibraryAudit(access.context, request, token ? 'Template library access token saved' : 'Template library access token removed')
      return libraryJson({ ok: true, message: token ? 'Token saved. Use Test token to check it.' : 'Token removed.' })
    }

    if (action === 'remove' || action === 'toggle') {
      const id = typeof body?.id === 'string' ? body.id : ''
      const index = rows.findIndex((row) => row.id === id)
      if (index < 0) return libraryJson({ ok: false, error: 'That library is not in the list.' }, 404)
      const changed = rows[index]
      if (action === 'remove' && state.rows[index]?.builtIn) {
        return libraryJson({ ok: false, error: 'This library comes with every install and cannot be removed. Switch it off instead.' }, 400)
      }
      if (action === 'remove') {
        rows.splice(index, 1)
      } else {
        rows[index] = { ...rows[index], enabled: body?.enabled === true }
      }
      await writeLibraryState(engine, rows, state.imports, access.context.user)
      await recordLibraryAudit(
        access.context,
        request,
        action === 'remove'
          ? `Template library removed: ${changed.label || changed.url} (${changed.url})`
          : `Template library ${rows[index].enabled ? 'switched on' : 'switched off'}: ${changed.label || changed.url}`,
      )
      return libraryJson({ ok: true })
    }

    return libraryJson({ ok: false, error: 'That action is not known.' }, 400)
  } catch (error) {
    console.error('template-libraries settings error:', error instanceof Error ? error.name : 'unknown')
    return libraryJson({ ok: false, error: 'The change could not be saved.' }, 500)
  }
}
