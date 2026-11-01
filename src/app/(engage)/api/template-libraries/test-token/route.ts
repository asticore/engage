import { checkLibraryAccess } from '@/features/templateLibraries/loader'
import { libraryJson, librarySettingsAccess, storeEngine } from '@/features/templateLibraries/server'
import { readLibraryState } from '@/features/templateLibraries/store'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/template-libraries/test-token: checks the saved access token against each enabled library with a
 * HEAD request. Answers with one plain-English message per library. The token is never returned or logged.
 * Administrators only.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const access = await librarySettingsAccess()
    if (!access.ok) return access.response
    if (hit(`template-libraries-test-token:${clientKey(request)}`, 10).limited) {
      return libraryJson({ ok: false, error: 'Too many requests. Wait a minute and try again.' }, 429)
    }
    const state = await readLibraryState(storeEngine(access.context))
    const checks: Array<{ libraryId: string; libraryLabel: string; config: NonNullable<(typeof state.rows)[number]['config']> }> = []
    for (const row of state.rows) {
      if (row.enabled && row.config) checks.push({ libraryId: row.id, libraryLabel: row.label, config: row.config })
    }
    if (checks.length === 0) return libraryJson({ ok: false, error: 'Add and switch on at least one library first.' }, 400)
    const results = await Promise.all(
      checks.map(async (check) => {
        const checked = await checkLibraryAccess(check.config, state.token)
        return { libraryId: check.libraryId, libraryLabel: check.libraryLabel, ok: checked.ok, message: checked.ok ? checked.value : checked.error }
      }),
    )
    return libraryJson({ ok: true, hasToken: Boolean(state.token), results })
  } catch (error) {
    console.error('template-libraries test-token error:', error instanceof Error ? error.name : 'unknown')
    return libraryJson({ ok: false, error: 'The check could not be run.' }, 500)
  }
}
