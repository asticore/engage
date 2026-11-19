import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { DICTIONARY_LOADERS } from '@/features/uiStrings/loaders'

describe('static ui-strings JSON', () => {
  it('matches the dictionaries (run `node scripts/gen-ui-strings.mjs` when this fails)', () => {
    expect(() => execFileSync('node', ['scripts/gen-ui-strings.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('loads each locale through the loader', async () => {
    for (const load of Object.values(DICTIONARY_LOADERS)) {
      const { default: dict } = await load()
      expect(Object.keys(dict).length).toBeGreaterThan(100)
    }
  })
})
