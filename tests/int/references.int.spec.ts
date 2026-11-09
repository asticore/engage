import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { checkReferenceUpdates, loadReferences, parseReferences, referenceById } from '@/features/references/references'

describe('reference file', () => {
  it('ships shine, effix and engage-templates, all valid', () => {
    const ids = loadReferences().sources.map((s) => s.id)
    expect(ids).toEqual(['shine', 'effix', 'engage-templates'])
  })

  it('has the vendored shine copy in the repo', () => {
    const shine = referenceById('shine')!
    expect(shine.vendored).toBeTruthy()
    expect(readFileSync(join(process.cwd(), shine.vendored!), 'utf8')).toContain('@layer shine.tokens')
  })

  it('drops sources that are not https GitHub addresses', () => {
    const file = parseReferences({ sources: [{ id: 'bad', url: 'http://evil.example/x/y' }, { id: 'ok', url: 'https://github.com/a/b' }, null, 5] })
    expect(file.sources.map((s) => s.id)).toEqual(['ok'])
    expect(parseReferences(null).sources).toEqual([])
  })

  it('fails safe when GitHub is unreachable', async () => {
    const out = await checkReferenceUpdates(loadReferences(), async () => {
      throw new Error('offline')
    })
    expect(out).toHaveLength(3)
    expect(out.every((r) => r.outdated === false && r.error)).toBe(true)
  })

  it('flags a newer commit', async () => {
    const latest = 'a'.repeat(40)
    const out = await checkReferenceUpdates(loadReferences(), async () => ({ ok: true, json: async () => ({ sha: latest }) }))
    expect(out.find((r) => r.id === 'shine')?.outdated).toBe(true)
    expect(out.find((r) => r.id === 'engage-templates')?.outdated).toBe(false)
  })
})
