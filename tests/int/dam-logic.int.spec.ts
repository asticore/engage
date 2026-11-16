import { describe, expect, it } from 'vitest'

import { exifForStorage, exifSearchWords, parseExif } from '@/features/dam/exif'
import { contentHash } from '@/features/dam/hash'
import { buildSearchText, fieldsFor, mediaGroup, parseMetaField, validateMetaValues, type MetaField } from '@/features/dam/metaFields'
import { canMoveStatus, checkRights, EMPTY_RIGHTS, parseRights } from '@/features/dam/rights'
import { parseCollection, parseSettings } from '@/features/dam/store'

const NOW = new Date('2027-03-10T12:00:00Z')

describe('asset rights', () => {
  it('validates the rights form', () => {
    expect(parseRights({ status: 'nope' }).ok).toBe(false)
    expect(parseRights({ licenceExpiry: '2027-02-30' }).ok).toBe(false)
    expect(parseRights({ licenceStart: '2027-05-01', licenceExpiry: '2027-04-01' }).ok).toBe(false)
    expect(parseRights({ credit: 'x'.repeat(201) }).ok).toBe(false)
    const ok = parseRights({ status: 'in_review', credit: ' Jo Smith ', licenceExpiry: '2027-06-30', embargoUntil: '' })
    expect(ok.ok && ok.value).toMatchObject({ status: 'in_review', credit: 'Jo Smith', licenceExpiry: '2027-06-30', embargoUntil: null })
  })
  it('flags expired, embargoed, not started, archived and unapproved files as unusable', () => {
    const check = (patch: Partial<typeof EMPTY_RIGHTS>, requireApproval = false) => checkRights({ ...EMPTY_RIGHTS, ...patch }, NOW, { requireApproval })
    expect(check({}).state).toBe('ok')
    expect(check({ licenceExpiry: '2027-03-09' })).toMatchObject({ state: 'expired', usable: false })
    expect(check({ licenceExpiry: '2027-03-10' })).toMatchObject({ state: 'expiring', usable: true, daysToExpiry: 0 })
    expect(check({ licenceExpiry: '2027-05-30' }).state).toBe('ok')
    expect(check({ licenceExpiry: '2027-03-25' })).toMatchObject({ state: 'expiring', daysToExpiry: 15 })
    expect(check({ embargoUntil: '2027-03-11' })).toMatchObject({ state: 'embargoed', usable: false })
    expect(check({ embargoUntil: '2027-03-10' }).usable).toBe(true)
    expect(check({ licenceStart: '2027-03-11' })).toMatchObject({ state: 'not_started', usable: false })
    expect(check({ status: 'archived' })).toMatchObject({ state: 'archived', usable: false })
    expect(check({ status: 'in_review' }).usable).toBe(true)
    expect(check({ status: 'in_review' }, true)).toMatchObject({ state: 'not_approved', usable: false })
  })
  it('lets only admins approve', () => {
    expect(canMoveStatus('draft', 'in_review', false).ok).toBe(true)
    expect(canMoveStatus('in_review', 'approved', false).ok).toBe(false)
    expect(canMoveStatus('in_review', 'approved', true).ok).toBe(true)
    expect(canMoveStatus('approved', 'draft', false).ok).toBe(false)
    expect(canMoveStatus('approved', 'approved', false).ok).toBe(true)
  })
})

const fields: MetaField[] = [
  { id: 1, label: 'Shoot', key: 'shoot', type: 'select', options: ['Spring', 'Summer'], required: true, searchable: true, appliesTo: 'image', sortOrder: 0 },
  { id: 2, label: 'Page count', key: 'pages', type: 'number', options: [], required: false, searchable: false, appliesTo: 'document', sortOrder: 1 },
  { id: 3, label: 'Source', key: 'source', type: 'link', options: [], required: false, searchable: true, appliesTo: 'all', sortOrder: 2 },
]

describe('custom metadata fields', () => {
  it('validates a field definition', () => {
    expect(parseMetaField({ label: '' }, fields, null).ok).toBe(false)
    expect(parseMetaField({ label: 'Shoot' }, fields, null).ok).toBe(false) // key clash
    expect(parseMetaField({ label: 'Shoot' }, fields, 1).ok).toBe(true) // editing itself
    expect(parseMetaField({ label: 'Mood', type: 'select' }, fields, null).ok).toBe(false) // no options
    const ok = parseMetaField({ label: 'Mood board', type: 'select', options: 'A\nB, C\nA' }, fields, null)
    expect(ok.ok && ok.value).toMatchObject({ key: 'mood_board', options: ['A', 'B', 'C'], searchable: true })
  })
  it('keeps only the fields that apply to a file type', () => {
    expect(mediaGroup('image/jpeg')).toBe('image')
    expect(mediaGroup('application/pdf')).toBe('document')
    expect(fieldsFor(fields, 'image/png').map((f) => f.key)).toEqual(['shoot', 'source'])
    expect(fieldsFor(fields, 'application/pdf').map((f) => f.key)).toEqual(['pages', 'source'])
  })
  it('validates values and builds search text', () => {
    expect(validateMetaValues(fields, 'image/png', {}).ok).toBe(false) // required
    expect(validateMetaValues(fields, 'image/png', { shoot: 'Autumn' }).ok).toBe(false)
    expect(validateMetaValues(fields, 'image/png', { shoot: 'Summer', source: 'javascript:alert(1)' }).ok).toBe(false)
    const ok = validateMetaValues(fields, 'image/png', { shoot: 'Summer', source: 'https://example.com/a', pages: '4' })
    expect(ok.ok && ok.value).toEqual({ shoot: 'Summer', source: 'https://example.com/a' }) // pages does not apply to images
    expect(buildSearchText(fields, { shoot: 'Summer', pages: '4' }, ['Beach  Day', null])).toBe('summer beach day')
  })
})

/** A minimal little-endian EXIF block: make, model, creator in IFD0; date, f-number in the Exif IFD; GPS north-east. */
function jpegWithExif(): Uint8Array {
  const parts: number[] = []
  // Build in a buffer with fixed offsets (from the TIFF start).
  const buf = new Uint8Array(400)
  const dv = new DataView(buf.buffer)
  const str = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) buf[offset + i] = s.charCodeAt(i) }
  dv.setUint16(0, 0x4949, true); dv.setUint16(2, 42, true); dv.setUint32(4, 8, true)
  // IFD0 at 8: 5 entries
  const entry = (at: number, tag: number, type: number, count: number, value: number) => { dv.setUint16(at, tag, true); dv.setUint16(at + 2, type, true); dv.setUint32(at + 4, count, true); dv.setUint32(at + 8, value, true) }
  dv.setUint16(8, 5, true)
  entry(10, 0x010f, 2, 6, 200) // make "Canon\0"
  entry(22, 0x0110, 2, 12, 210) // model "Canon EOS R5\0"... 13 chars with nul
  entry(34, 0x013b, 2, 9, 230) // artist "Jo Smith\0"
  entry(46, 0x8769, 4, 1, 100) // exif ifd
  entry(58, 0x8825, 4, 1, 140) // gps ifd
  dv.setUint32(70, 0, true)
  str(200, 'Canon\0'); str(210, 'Canon EOS R5\0'); str(230, 'Jo Smith\0')
  // Exif IFD at 100: date taken, f-number
  dv.setUint16(100, 2, true)
  entry(102, 0x9003, 2, 20, 300)
  entry(114, 0x829d, 5, 1, 330)
  dv.setUint32(126, 0, true)
  str(300, '2026:07:04 09:30:15\0')
  dv.setUint32(330, 28, true); dv.setUint32(334, 10, true) // f/2.8
  // GPS IFD at 140: N 51 30 0, E 0 7 30 -> 51.5, 0.125
  dv.setUint16(140, 4, true)
  entry(142, 1, 2, 2, 0x4e) // "N\0" in value field
  entry(154, 2, 5, 3, 340)
  entry(166, 3, 2, 2, 0x45)
  entry(178, 4, 5, 3, 370)
  dv.setUint32(190, 0, true)
  ;[[51, 1], [30, 1], [0, 1]].forEach(([n, d], i) => { dv.setUint32(340 + i * 8, n, true); dv.setUint32(344 + i * 8, d, true) })
  ;[[0, 1], [7, 1], [30, 1]].forEach(([n, d], i) => { dv.setUint32(370 + i * 8, n, true); dv.setUint32(374 + i * 8, d, true) })
  const exifBody = Array.from(buf.slice(0, 398))
  const header = [0x45, 0x78, 0x69, 0x66, 0, 0]
  const length = 2 + header.length + exifBody.length
  parts.push(0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255, ...header, ...exifBody, 0xff, 0xd9)
  return new Uint8Array(parts)
}

describe('camera data', () => {
  it('reads camera, date, exposure, creator and GPS from a JPEG', () => {
    const data = parseExif(jpegWithExif())
    expect(data).toMatchObject({ camera: 'Canon EOS R5', creator: 'Jo Smith', takenAt: '2026-07-04T09:30:15', exposure: 'f/2.8', gps: { lat: 51.5, lon: 0.125 } })
  })
  it('strips GPS for storage when asked and lists search words', () => {
    const data = parseExif(jpegWithExif())
    expect(exifForStorage(data, true).gps).toBeUndefined()
    expect(exifForStorage(data, false).gps).toBeDefined()
    expect(exifSearchWords(data)).toEqual(['Canon EOS R5', 'Jo Smith', '2026-07-04'])
  })
  it('returns nothing for damaged or non-JPEG bytes and never throws', () => {
    expect(parseExif(new Uint8Array([1, 2, 3]))).toEqual({})
    expect(parseExif(new Uint8Array(jpegWithExif().slice(0, 40)))).toEqual({})
  })
})

describe('content hash and settings', () => {
  it('hashes the same bytes to the same value', async () => {
    const a = await contentHash(new TextEncoder().encode('hello'))
    expect(a).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(await contentHash(new TextEncoder().encode('hellO'))).not.toBe(a)
  })
  it('validates collections and settings', () => {
    expect(parseCollection({ name: ' ' }, [], null).ok).toBe(false)
    expect(parseCollection({ name: 'Summer' }, [{ id: 1, name: 'summer', description: '', count: 0 }], null).ok).toBe(false)
    expect(parseCollection({ name: 'Summer' }, [{ id: 1, name: 'summer', description: '', count: 0 }], 1).ok).toBe(true)
    expect(parseSettings({ keepVersions: 99, expiryWarnDays: 30, quotaMb: 0 }).ok).toBe(false)
    expect(parseSettings({ keepVersions: 5, expiryWarnDays: 30, quotaMb: 0, duplicateAction: 'maybe' }).ok).toBe(false)
    const ok = parseSettings({ keepVersions: 5, expiryWarnDays: 14, quotaMb: 100, duplicateAction: 'block', stripGps: false })
    expect(ok.ok && ok.value).toMatchObject({ keepVersions: 5, expiryWarnDays: 14, quotaMb: 100, duplicateAction: 'block', stripGps: false, autoExtract: true })
  })
})
