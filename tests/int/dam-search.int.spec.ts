// @vitest-environment node
import { deflateRawSync, deflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { docPart, headPart, joinSearchText } from '@/features/dam/metaFields'
import { buildSearch, EMPTY_FILTERS, filtersFromParams, isEmpty, parseFilters } from '@/features/dam/search'
import { extractDocxText, extractPdfText, readZipEntry, textFromPdfContent, textFromWordXml } from '@/features/dam/textExtract'

const ctx = { todayIso: '2027-03-10', warnUntilIso: '2027-04-09' }

describe('search filters', () => {
  it('cleans anything it is given', () => {
    const f = parseFilters({ q: '  beach  ', type: 'spreadsheet', sizeMinKb: -5, sizeMaxKb: '200', from: '2027-13-01x', orientation: 'wide', sort: 'nope', meta: { shoot: 'Summer', 'Bad Key': 'x', empty: ' ' } })
    expect(f).toMatchObject({ q: 'beach', type: '', sizeMinKb: 0, sizeMaxKb: 200, from: '', orientation: '', sort: 'newest', meta: { shoot: 'Summer' } })
    expect(isEmpty(EMPTY_FILTERS)).toBe(true)
    expect(isEmpty(f)).toBe(false)
  })
  it('reads filters and custom fields from a query string', () => {
    const f = filtersFromParams(new URLSearchParams('q=sun&type=image&meta.shoot=Summer&collectionId=4'))
    expect(f).toMatchObject({ q: 'sun', type: 'image', collectionId: 4, meta: { shoot: 'Summer' } })
  })
})

describe('search query', () => {
  it('selects everything newest first when there is no filter', () => {
    const q = buildSearch(EMPTY_FILTERS, ctx, 1, 48)
    expect(q.sql).toContain('ORDER BY m.created_at DESC')
    expect(q.sql).toContain('LIMIT 48 OFFSET 0')
    expect(q.args).toEqual([])
    expect(q.countSql).not.toContain('WHERE')
  })
  it('puts every value in as a parameter, never in the SQL text', () => {
    const evil = "x'; DROP TABLE eg_media; --"
    const q = buildSearch(parseFilters({ q: evil, folder: evil, meta: { shoot: evil } }), ctx, 2, 10)
    expect(q.sql).not.toContain('DROP TABLE')
    expect(q.args.some((a) => String(a).includes('DROP TABLE'))).toBe(true)
    expect(q.sql).toContain('LIMIT 10 OFFSET 10')
  })
  it('matches each word anywhere and escapes wildcards', () => {
    const q = buildSearch(parseFilters({ q: '50%_off sale' }), ctx, 1, 48)
    expect(q.args).toEqual(['%50\\%\\_off%', '%sale%'])
    expect((q.sql.match(/search_text/g) ?? []).length).toBe(2)
  })
  it('filters by type, size, shape, status and licence state', () => {
    const q = buildSearch(parseFilters({ type: 'image', sizeMinKb: 10, orientation: 'portrait', status: 'in_review', licence: 'expiring', minWidth: 800 }), ctx, 1, 48)
    expect(q.sql).toContain('m.mime_type LIKE')
    expect(q.sql).toContain('m.height > m.width')
    expect(q.args).toEqual(['image/%', 10240, 800, 'in_review', '2027-03-10', '2027-04-09'])
    expect(buildSearch(parseFilters({ type: 'document' }), ctx, 1, 48).sql).toContain("NOT LIKE 'image/%'")
  })
  it('filters by tag only when the tag ids are resolved', () => {
    const f = parseFilters({ tagId: 3 })
    expect(buildSearch(f, ctx, 1, 48).sql).not.toContain('eg_media_tag_links')
    const q = buildSearch(f, { ...ctx, tagIds: [3, 4] }, 1, 48)
    expect(q.sql).toContain('eg_media_tag_links')
    expect(q.args).toEqual([3, 4])
  })
  it('caps the page size', () => {
    expect(buildSearch(EMPTY_FILTERS, ctx, 1, 9999).sql).toContain('LIMIT 200')
  })
})

describe('words inside documents', () => {
  it('keeps document words when the details part is rebuilt', () => {
    const joined = joinSearchText('summer beach', 'Quarterly Report  text')
    expect(headPart(joined)).toBe('summer beach')
    expect(docPart(joined)).toBe('quarterly report text')
    expect(joinSearchText('new head', docPart(joined))).toContain('quarterly report text')
    expect(docPart('no marker')).toBe('')
    expect(joinSearchText('only head', '')).toBe('only head')
  })
  it('reads Word xml', () => {
    expect(textFromWordXml('<w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>')).toBe('Hello & welcome\nSecond')
  })
  it('reads text from a docx (a zip with a deflated document.xml)', async () => {
    const xml = Buffer.from('<w:document><w:p><w:r><w:t>Brand guidelines</w:t></w:r></w:p></w:document>')
    const body = deflateRawSync(xml)
    const name = Buffer.from('word/document.xml')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42)
    const centralAt = local.length + name.length + body.length
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(centralAt, 16)
    const zip = new Uint8Array(Buffer.concat([local, name, body, central, name, end]))
    expect(await readZipEntry(zip, 'missing.xml')).toBeNull()
    expect(await extractDocxText(zip)).toBe('Brand guidelines')
    expect(await extractDocxText(new Uint8Array([1, 2, 3]))).toBe('')
  })
  it('reads text from PDF content, plain and compressed', async () => {
    const content = 'BT /F1 12 Tf (Annual \\(draft\\) report) Tj [(Sum) -20 (mary)] TJ ET'
    expect(textFromPdfContent(content)).toBe('Annual (draft) report Summary')
    const plain = new TextEncoder().encode(`%PDF-1.4\n1 0 obj\n<< /Length 50 >>\nstream\n${content}\nendstream\nendobj\n`)
    expect(await extractPdfText(plain)).toBe('Annual (draft) report Summary')
    const packed = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n'), deflateSync(Buffer.from(content)), Buffer.from('\nendstream\nendobj\n')])
    expect(await extractPdfText(new Uint8Array(packed))).toBe('Annual (draft) report Summary')
    expect(await extractPdfText(new Uint8Array([1, 2, 3]))).toBe('')
  })
})
