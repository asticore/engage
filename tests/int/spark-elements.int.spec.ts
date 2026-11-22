import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { renderElement } from '@/components/blocks/elements/renderElement'
import { TableElement } from '@/components/blocks/elements/Wave36Elements'
import { legacyRowsToCsv, parseCsv, sparkAttrs, sparkColors } from '@/components/blocks/elements/sparkData'

const table = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(TableElement, props))

describe('sparkData', () => {
  it('parses CSV with quotes, doubled quotes, CRLF and blank lines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n3,4')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['3', '4']])
  })
  it('converts "label | value" rows to CSV and leaves CSV alone', () => {
    expect(legacyRowsToCsv('A | 1\nB | 2')).toBe('Item,Value\nA,1\nB,2')
    expect(legacyRowsToCsv('K,V\nA,1')).toBe('K,V\nA,1')
    expect(legacyRowsToCsv('A | x')).toBe('')
  })
  it('keeps only theme tones and valid colours, and builds attributes without empty values', () => {
    expect(sparkColors('#fff|nope|primary|rgb(1,2,3)|url(x)')).toBe('#fff|primary|rgb(1,2,3)')
    expect(sparkAttrs({ o_t_a: true, o_t_b: 3, o_t_c: '', o_t_d: 'x', 'o_t_Bad': 'y', other: 'z' }, 'o_t_')).toEqual({ 'data-spark-a': 'true', 'data-spark-b': '3', 'data-spark-d': 'x' })
  })
})

describe('table element on Shine and Spark', () => {
  const rows = 'Name,Score\nAda,10\nBo,7'
  it('renders Shine classes and no Spark class when no behaviour is on', () => {
    const html = table({ rows, headerRow: true, striped: true, hover: true })
    expect(html).toContain('class="table-wrap"')
    expect(html).toContain('class="table table-striped table-hover"')
    expect(html).not.toContain('spark-table')
    expect(html).toContain('<th scope="col">Name</th>')
    expect(html).toContain('data-label="Score"')
  })
  it('adds the Spark behaviour layer and its options when switched on', () => {
    const html = table({ rows, o_table_sort: true, o_table_search: true, 'o_table_page-size': 10, o_table_stack: true })
    expect(html).toContain('spark-table')
    expect(html).toContain('table-stack')
    expect(html).toContain('data-spark-search="true"')
    expect(html).toContain('data-spark-page-size="10"')
    expect(html).toContain('data-spark-sort="true"')
  })
  it('still reads the first version\'s pipe rows', () => {
    expect(table({ rows: 'Day | Hours\nMon | 9', headerRow: true })).toContain('<td data-label="Hours">9</td>')
  })
  it('takes 500 rows and 24 columns and cuts the rest', () => {
    const big = ['h1,h2', ...Array.from({ length: 600 }, (_, i) => `r${i},${i}`)].join('\n')
    expect(table({ rows: big }).split('<tr>').length - 1).toBe(500)
  })
  it('renders nothing without data and escapes text', () => {
    expect(table({ rows: '' })).toBe('')
    expect(table({ rows: 'a,b\n<script>x</script>,2' })).not.toContain('<script>')
  })
})

describe('second batch on Spark and Shine', () => {
  const html = (type: string, props: Record<string, unknown>) => renderToStaticMarkup(renderElement(type, props) as React.ReactElement)
  it('image carousel uses Shine carousel and Spark carousel options', () => {
    const out = html('image-carousel', { urls: 'https://cdn.example.com/a.jpg\nhttps://cdn.example.com/b.jpg', visible: 2, autoplay: 4000, fade: true, dots: false })
    expect(out).toContain('class="carousel spark-carousel"')
    expect(out).toContain('data-spark-per-view="2"')
    expect(out).toContain('data-spark-autoplay="4000"')
    expect(out).toContain('data-spark-dots="false"')
  })
  it('text ticker uses Spark marquee', () => {
    const out = html('text-ticker', { items: 'A\nB', speed: 30, direction: 'right', pauseOnHover: false })
    expect(out).toContain('class="spark-marquee"')
    expect(out).toContain('data-spark-speed="100"')
    expect(out).toContain('data-spark-direction="right"')
    expect(out).toContain('data-spark-pause="false"')
  })
  it('pagination list carries the Shine class', () => {
    expect(html('pagination', { current: 2, total: 5 })).toContain('class="pagination be-el-48-pagination__list"')
  })
  it('gallery lightbox is the Spark lightbox wrapper', () => {
    expect(html('gallery', { urls: 'https://cdn.example.com/a.jpg', lightbox: true })).toContain('class="spark-lightbox"')
  })
})

describe('Data view as a source', () => {
  it('turns a view into CSV for the Chart and Table elements', async () => {
    const { modelToCsv } = await import('@/features/dataViews/csv')
    const model = { view: {}, data: { columns: [{ label: 'Month' }, { label: 'Sales, total' }], rows: [['Jan', 120], ['Feb, late', null]], truncated: false } } as never
    expect(modelToCsv(model)).toBe('Month,"Sales, total"\nJan,120\n"Feb, late",')
  })
  it('the other switched elements render Spark and Shine markup', () => {
    expect(renderToStaticMarkup(renderElement('flip-box', { frontTitle: 'A', backTitle: 'B' }) as React.ReactElement)).toContain('spark-flip__back')
    expect(renderToStaticMarkup(renderElement('tooltip', { text: 'Hi', tip: 'Tip', position: 'bottom' }) as React.ReactElement)).toContain('data-tooltip="Tip" data-tooltip-pos="bottom"')
    expect(renderToStaticMarkup(renderElement('count-up', { end: 5 }) as React.ReactElement)).toContain('spark-counter')
  })
})
