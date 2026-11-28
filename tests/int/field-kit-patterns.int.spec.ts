// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { UNIT_OPTIONS } from '@/views/visualEditor/DesignPanel'
import { NormalHoverTabs, PopoverGroup } from '@/views/visualEditor/fieldKit'


describe('field kit patterns (31h)', () => {
  it('Normal | Hover tabs switch with a click and with arrow keys', () => {
    render(React.createElement(NormalHoverTabs, { normal: React.createElement('p', null, 'normal body'), hover: React.createElement('p', null, 'hover body') }))
    expect(screen.getByText('normal body')).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(screen.getByText('hover body')).toBeTruthy()
    expect(screen.queryByText('normal body')).toBeNull()
    fireEvent.click(tabs[0]!)
    expect(screen.getByText('normal body')).toBeTruthy()
  })
  it('a popover opens, and Escape closes it and returns focus to its button', () => {
    render(React.createElement(PopoverGroup, { label: 'Edit' } as never, React.createElement('p', null, 'inside')))
    const btn = screen.getByRole('button', { name: /Edit/ })
    fireEvent.click(btn)
    expect(screen.getByText('inside')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByText('inside')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
  it('the unit list has all six units', () => {
    expect(UNIT_OPTIONS.map((o) => o.value)).toEqual(['px', '%', 'em', 'rem', 'vw', 'vh'])
  })
})
