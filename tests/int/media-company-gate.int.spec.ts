import { describe, expect, it } from 'vitest'

import { decideMediaAccess, isBrowserNavigation, mediaSignInRedirect, restrictedMediaId } from '@/features/organizations/mediaGate'
import { isOrgGateCollection, isOrgVisibleCollection } from '@/features/organizations/visibility'

type Row = Record<string, unknown> | null

/** A tiny D1 stand in answering the gate's queries from fixed data. */
function fakeD1(opts: { restrictedFile?: string; orgId?: string; members?: Record<string, string>; grants?: { subject_type: string; subject_id: string }[]; broken?: boolean }) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const run = {
        bind(...a: unknown[]) {
          args = a
          return run
        },
        async first(): Promise<Row> {
          if (opts.broken && sql.includes('eg_media')) throw new Error('no such table')
          if (sql.includes('JOIN `eg_content_org_visibility`')) return args[0] === opts.restrictedFile ? { id: 7 } : null
          if (sql.includes('SELECT organization_id FROM `eg_content_org_visibility`')) return { organization_id: opts.orgId ?? 'org1' }
          if (sql.includes('eg_organization_members')) {
            const role = opts.members?.[String(args[1])]
            return role ? { role } : null
          }
          return null
        },
        async all() {
          if (sql.includes('eg_content_org_grants')) return { results: opts.grants ?? [] }
          return { results: [] }
        },
      }
      return run
    },
  } as never
}

describe('company gated downloads', () => {
  it('lets anyone fetch a file that is not limited to a company', async () => {
    const d1 = fakeD1({ restrictedFile: 'secret.pdf' })
    expect(await decideMediaAccess(d1, 'public.png', { userId: null, isAdmin: false })).toEqual({ allow: true, restricted: false })
  })
  it('asks a visitor to sign in, and refuses a signed in non member', async () => {
    const d1 = fakeD1({ restrictedFile: 'secret.pdf', members: { '5': 'member' } })
    expect(await decideMediaAccess(d1, 'secret.pdf', { userId: null, isAdmin: false })).toEqual({ allow: false, status: 401 })
    expect(await decideMediaAccess(d1, 'secret.pdf', { userId: 9, isAdmin: false })).toEqual({ allow: false, status: 403 })
  })
  it('serves a member, narrowed by grants, and always serves an admin', async () => {
    const d1 = fakeD1({ restrictedFile: 'secret.pdf', members: { '5': 'member', '6': 'member' }, grants: [{ subject_type: 'member', subject_id: '5' }] })
    expect(await decideMediaAccess(d1, 'secret.pdf', { userId: 5, isAdmin: false })).toEqual({ allow: true, restricted: true })
    expect(await decideMediaAccess(d1, 'secret.pdf', { userId: 6, isAdmin: false })).toEqual({ allow: false, status: 403 })
    expect(await decideMediaAccess(d1, 'secret.pdf', { userId: 1, isAdmin: true })).toEqual({ allow: true, restricted: true })
  })
  it('treats a missing table as unrestricted, and media as limitable only through the gate list', async () => {
    expect(await restrictedMediaId(fakeD1({ broken: true }), 'x.pdf')).toBeNull()
    expect(isOrgGateCollection('media')).toBe(true)
    expect(isOrgVisibleCollection('media')).toBe(false)
  })
})

describe('browser navigation to a gated file', () => {
  it('detects a page request by its Accept header', () => {
    expect(isBrowserNavigation('text/html,application/xhtml+xml,*/*;q=0.8')).toBe(true)
    expect(isBrowserNavigation('image/avif,image/webp,*/*')).toBe(false)
    expect(isBrowserNavigation(null)).toBe(false)
  })
  it('sends the person to sign in and back, site paths only', () => {
    expect(mediaSignInRedirect('/api/media/file/a%20b.pdf')).toBe('/account/sign-in?redirect=%2Fapi%2Fmedia%2Ffile%2Fa%2520b.pdf')
    expect(mediaSignInRedirect('//evil.example')).toBe('/account/sign-in?redirect=%2F')
  })
})
