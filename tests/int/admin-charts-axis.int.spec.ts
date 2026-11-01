/* @vitest-environment jsdom */
import { createElement as h } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdminBarChart } from '@/admin/charts/AdminBarChart'
import { AdminLineChart } from '@/admin/charts/AdminLineChart'
import { lastDays } from '@/views/dashboard/dashboardData'

const axisText = (container: HTMLElement) => Array.from(container.querySelectorAll('text.admin-chart__axis')).map((node) => node.textContent)

describe('admin charts carry their axis text', () => {
  it('bar chart prints its value-axis ticks and fixed percentage axis', () => {
    const { container } = render(
      h(AdminBarChart, {
        data: [
          { key: 'a', value: 40, label: '10-01', tip: 'a' },
          { key: 'b', value: 0, label: '10-02', tip: 'b' },
        ],
        ariaLabel: 'Rate',
        formatTick: (tick: number) => `${Math.round(tick)}%`,
        emptyText: 'none',
        axisMax: 100,
      }),
    )
    expect(axisText(container)).toEqual(['0%', '50%', '100%', '10-01', '10-02'])
  })

  it('line chart prints each grid line and breaks the line at a missing value', () => {
    const { container } = render(
      h(AdminLineChart, {
        points: [
          { key: '1', value: 80, label: 'Jan 1', tip: '80' },
          { key: '2', value: null, label: 'Jan 2', tip: 'none' },
          { key: '3', value: 95, label: 'Jan 3', tip: '95' },
          { key: '4', value: 70, label: 'Jan 4', tip: '70' },
        ],
        ariaLabel: 'Performance',
        axisMin: 0,
        axisMax: 100,
        ticks: [0, 50, 90, 100],
        formatTick: (tick: number) => String(tick),
        emptyText: 'none',
      }),
    )
    expect(axisText(container).slice(0, 4)).toEqual(['0', '50', '90', '100'])
    // One gap splits the data into two runs: the first point alone, then points 3 and 4.
    expect(container.querySelectorAll('path.admin-chart__line')).toHaveLength(2)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
  })
})

describe('dashboard trend days', () => {
  it('lists the last 30 UTC days, oldest first, ending today', () => {
    const days = lastDays(30, new Date('2026-11-01T12:00:00.000Z'))
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-10-03')
    expect(days[29]).toBe('2026-11-01')
  })
})
