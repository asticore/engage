import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { chartSummary, ChartElement } from '@/components/blocks/elements/Wave48Elements'
import { chartFields } from '@/lib/elements/sparkChartFields'
import { WAVE48_ELEMENTS } from '@/lib/elements/wave48Defs'

const render = (props: Record<string, unknown>): string => renderToStaticMarkup(React.createElement(ChartElement, props))
const SALES = [
  ['Month', 'Sales', 'Costs'],
  ['Jan', '120', '80'],
  ['Feb', '95', '70'],
]

describe('chart series, stacked and mixed options', () => {
  it('exposes stacked for bar, line and combo charts, and the per-type series types for combo', () => {
    const names = chartFields().map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['o_chart-bar_stacked', 'o_chart-line_stacked', 'o_chart-combo_stacked', 'o_chart-combo_types']))
    expect(names).toEqual(expect.arrayContaining(['o_chart-bar_colors', 'o_chart-combo_colors']))
  })

  it('keeps the data editor for tabular charts and says CSV holds one column per series', () => {
    const data = chartFields().find((f) => f.name === 'data')
    expect(data?.helpText).toMatch(/series names/)
  })

  it('passes every CSV series to Spark, so a second and third series need no new attribute', () => {
    const html = render({ chartType: 'chart-combo', title: 'Mixed', data: 'Month,Sales,Costs,Margin\nJan,1,2,3\nFeb,4,5,6', o_combo_types: 'bar|bar|line' })
    expect(html).toContain('data-spark-names="Sales|Costs|Margin"')
    expect(html).toContain('data-spark-data="1,4|2,5|3,6"')
  })

  it('drops colours that fail the Spark colour check, keeping the valid series colours in order', () => {
    const html = render({ chartType: 'chart-bar', data: 'Month,Sales,Costs\nJan,1,2', 'o_chart-bar_colors': '#e11d48|var(--primary)|javascript:alert(1)' })
    expect(html).toContain('data-spark-colors="#e11d48|var(--primary)"')
    expect(html).not.toContain('javascript')
  })
})

describe('chart text summary (role=img)', () => {
  it('names the kind, the series, and each row with its values', () => {
    const s = chartSummary(SALES, 'bar', { title: 'Sales by month' })
    expect(s).toBe('Bar chart: Sales by month. 2 series: Sales, Costs. Jan: Sales 120, Costs 80; Feb: Sales 95, Costs 70.')
  })

  it('says stacked and horizontal when those options are on, and singular for one series', () => {
    expect(chartSummary([['Month', 'Sales'], ['Jan', '1']], 'line', { stacked: true, horizontal: true })).toBe(
      'Line chart. 1 series: Sales. Stacked. Horizontal. Jan: Sales 1.',
    )
  })

  it('caps the rows and points to the table for the rest', () => {
    const rows = [['Day', 'Hits'], ...Array.from({ length: 15 }, (_, i) => [`D${i + 1}`, String(i)])]
    const s = chartSummary(rows, 'bar')
    expect(s).toContain('D12: Hits 11.')
    expect(s).not.toContain('D13:')
    expect(s).toContain('3 more rows are in the table.')
  })

  it('names unnamed series and unlabelled rows so nothing reads blank', () => {
    expect(chartSummary([['', ''], ['', '5']], 'pie')).toBe('Pie chart. 1 series: Series 1. Item: Series 1 5.')
  })

  it('renders role=img with the summary on the Spark container, and keeps the hidden data table', () => {
    const html = render({ chartType: 'chart-bar', title: 'Sales by month', data: SALES.map((r) => r.join(',')).join('\n'), 'o_chart-bar_stacked': true })
    expect(html).toContain('role="img" aria-label="Bar chart: Sales by month. 2 series: Sales, Costs. Stacked. Jan: Sales 120, Costs 80; Feb: Sales 95, Costs 70."')
    expect(html).toContain('<table class="be-el-48-sr">')
    expect(html).toContain('<th scope="col">Costs</th>')
  })

  it('leaves diagrams and other non-tabular charts without a role or summary', () => {
    const html = render({ chartType: 'viz-map', d_viz_map: '' })
    expect(html).not.toContain('role="img"')
  })

  it('escapes names and values in the label', () => {
    const html = render({ chartType: 'chart-bar', title: '<b>x</b>', data: 'Month,"A<i>"\nJan,"1"' })
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<i>')
  })
})

describe('chart default still registers', () => {
  it('keeps the chart element defaults valid', () => {
    const chart = WAVE48_ELEMENTS.find((e) => e.type === 'chart')
    expect(chart?.defaultProps()).toMatchObject({ chartType: 'chart-bar' })
  })
})
