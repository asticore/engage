import { describe, expect, it } from 'vitest'

import { buildQuoteKey, checkQuoteFiles, deleteQuoteFiles, isQuoteKey, listQuoteFiles, MAX_QUOTE_FILES, quoteFilePrefix } from '@/features/quotes/attachments'
import { resolveUploadPolicy } from '@/features/media/fileTypes'

const policy = resolveUploadPolicy({ uploads: { allowedExtensions: 'pdf, png, txt' } })
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const file = (name: string, data: Uint8Array = png) => ({ name, type: 'image/png', size: data.byteLength, data })

describe('quote attachments (12c)', () => {
  it('builds keys under the request and recognises only those', () => {
    const key = buildQuoteKey('QR-ABC123', 'My Drawing.PNG', () => '00000000-0000-0000-0000-000000000000')
    expect(key.startsWith(quoteFilePrefix('QR-ABC123'))).toBe(true)
    expect(isQuoteKey('QR-ABC123', key)).toBe(true)
    expect(isQuoteKey('QR-OTHER1', key)).toBe(false)
    expect(isQuoteKey('QR-ABC123', 'form-uploads/1/2026-11/x.png')).toBe(false)
    expect(isQuoteKey('QR-ABC123', `${quoteFilePrefix('QR-ABC123')}../secret`)).toBe(false)
    expect(isQuoteKey('../x', 'quote-uploads/../x/a')).toBe(false)
  })
  it('accepts a real image, refuses a wrong type, a disguised file and too many files', () => {
    expect('ok' in checkQuoteFiles([file('a.png')], policy)).toBe(true)
    expect('error' in checkQuoteFiles([file('a.exe')], policy)).toBe(true)
    expect('error' in checkQuoteFiles([file('a.png', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))], policy)).toBe(true)
    expect('error' in checkQuoteFiles(Array.from({ length: MAX_QUOTE_FILES + 1 }, (_, i) => file(`a${i}.png`)), policy)).toBe(true)
  })
  it('lists and deletes a request files by prefix', async () => {
    const stored = new Map<string, number>([[`${quoteFilePrefix('QR-ABC123')}00000000-0000-0000-0000-000000000000-a.png`, 12], ['quote-uploads/QR-OTHER1/x-b.png', 3]])
    const bucket = {
      list: async ({ prefix }: { prefix: string }) => ({ objects: [...stored].filter(([k]) => k.startsWith(prefix)).map(([key, size]) => ({ key, size })) }),
      delete: async (keys: string | string[]): Promise<void> => {
        for (const k of [keys].flat()) stored.delete(k)
      },
    }
    expect(await listQuoteFiles(bucket, 'QR-ABC123')).toEqual([{ key: expect.stringContaining('QR-ABC123/'), name: 'a.png', size: 12 }])
    expect(await listQuoteFiles(bucket, 'bad')).toEqual([])
    expect(await deleteQuoteFiles(bucket, 'QR-ABC123')).toBe(1)
    expect([...stored.keys()]).toEqual(['quote-uploads/QR-OTHER1/x-b.png'])
  })
})
