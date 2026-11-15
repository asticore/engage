import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Task 21j: no em dashes in user-facing text. Text for visitors and admins is read from source here, so a new one in
 * a string, a translation or an element definition fails the test. The one allowed use is a pattern that strips a
 * trailing separator from a page title (it matches the character, it does not show it).
 */
const ALLOWED = new Set([join('src', 'features', 'seo', 'resolve.ts')])
const EM_DASH = '—'

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* sources(full)
    else if (/\.(ts|tsx)$/.test(name)) yield full
  }
}

describe('em dashes', () => {
  it('none in source text', () => {
    const hits: string[] = []
    for (const file of sources('src')) {
      if (ALLOWED.has(file)) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes(EM_DASH)) hits.push(`${file}:${i + 1}`)
      })
    }
    expect(hits, 'replace with a full stop, colon, comma or brackets').toEqual([])
  })
})
