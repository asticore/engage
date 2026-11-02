import { describe, expect, it } from 'vitest'

import { pinLegacyFontEntries } from '@/features/fonts/install'
import { fontsourceFileUrl } from '@/features/fonts/css'

const legacy = { id: 'lato', family: 'Lato', source: 'fontsource', weights: [400], italic: false, local: false, files: {} }

describe('pinning Fontsource fonts installed before versions were recorded', () => {
  it('gives an unpinned remote Fontsource entry the latest version and leaves its other fields alone', async () => {
    const { entries, pinned } = await pinLegacyFontEntries([legacy], async () => '5.3.1')
    expect(pinned).toBe(1)
    expect(entries).toEqual([{ ...legacy, version: '5.3.1' }])
    expect(fontsourceFileUrl(entries[0] as { id: string; version: string }, 400, 'normal')).toBe(
      'https://cdn.jsdelivr.net/npm/@fontsource/lato@5.3.1/files/lato-latin-400-normal.woff2',
    )
  })

  it('looks each family up once, however many entries share it', async () => {
    let calls = 0
    const { entries, pinned } = await pinLegacyFontEntries([legacy, { ...legacy, id: 'lato', weights: [700] }], async () => {
      calls += 1
      return '5.3.1'
    })
    expect(calls).toBe(1)
    expect(pinned).toBe(2)
    expect(entries.every((e) => (e as { version?: string }).version === '5.3.1')).toBe(true)
  })

  it('skips entries that need nothing: already pinned, local, Google, uploads and junk', async () => {
    const lookup = async () => {
      throw new Error('should not look up')
    }
    const input = [
      { ...legacy, version: '5.2.6' },
      { ...legacy, id: 'lora', local: true, files: { '400-normal': '/api/media/file/font-lora-400-normal.woff2' } },
      { ...legacy, id: 'lora', source: 'google' },
      { ...legacy, id: 'my-brand', source: 'upload' },
      'not an object',
      null,
    ]
    const { entries, pinned } = await pinLegacyFontEntries(input, lookup)
    expect(pinned).toBe(0)
    expect(entries).toEqual(input)
  })

  it('keeps the old entry when the version cannot be read, and reads a failed lookup as unknown', async () => {
    const { entries, pinned } = await pinLegacyFontEntries([legacy], async () => null)
    expect(pinned).toBe(0)
    expect(entries).toEqual([legacy])
    const failed = await pinLegacyFontEntries([legacy], async () => Promise.reject(new Error('offline')))
    expect(failed.entries).toEqual([legacy])
  })

  it('is registered after the newest font migration in timestamp order', async () => {
    const { migrations } = await import('@/migrations/index')
    const names = migrations.map((x) => x.name)
    const at = names.indexOf('20270302_100000_font_versions_pinned')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeGreaterThan(names.indexOf('20270224_100000_block_form_id'))
    expect(names.slice(at + 1).every((name) => name > names[at])).toBe(true)
  })
})
