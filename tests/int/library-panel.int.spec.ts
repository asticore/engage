import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { ElementLibrary, parseCollapsed, parseView } from '@/views/visualEditor/ElementLibrary'

const mount = (onPickBlock = vi.fn()) =>
  render(<ElementLibrary targetLabel="Page" onPickBlock={onPickBlock} onPickTemplate={vi.fn()} formMode />)

describe('Elements panel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))
    window.localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('migrates stored views: comfortable and junk mean compact', () => {
    expect(parseView('comfortable')).toBe('compact')
    expect(parseView(null)).toBe('compact')
    expect(parseView('list')).toBe('list')
    expect(parseCollapsed('not json')).toEqual([])
    expect(parseCollapsed('["a",1]')).toEqual(['a'])
  })

  it('has exactly two view buttons and no density toggle', () => {
    window.localStorage.setItem('ve-library-density', 'comfortable')
    const { container } = mount()
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getAllByRole('button')).toHaveLength(2)
    expect(screen.getByLabelText('Compact view').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.ve-library--compact')).not.toBeNull()
    fireEvent.click(screen.getByLabelText('List view'))
    expect(container.querySelector('.ve-library--list')).not.toBeNull()
    expect(container.querySelector('.ve-library__card-desc')).not.toBeNull()
    expect(screen.queryByTestId('ve-lib-density')).toBeNull()
  })

  it('toolbar: search on its own row, view toggle and filter share the next row', () => {
    mount()
    const search = screen.getByRole('searchbox')
    const row = screen.getByTestId('ve-lib-filter').parentElement as HTMLElement
    expect(row.contains(search)).toBe(false)
    expect(row.contains(screen.getByRole('group', { name: 'View' }))).toBe(true)
  })

  it('groups collapse by header, remember it, and open while searching', () => {
    const { container } = mount()
    const toggle = container.querySelector('.ve-library__group-toggle') as HTMLButtonElement
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(toggle.getAttribute('aria-controls') as string) as HTMLElement
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hidden).toBe(true)
    expect(JSON.parse(window.localStorage.getItem('ve-library-collapsed') ?? '[]')).toHaveLength(1)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'text' } })
    expect(container.querySelectorAll('.ve-library__card').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    expect(container.querySelector('.ve-library__group-toggle')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('click inserts a block', () => {
    const pick = vi.fn()
    const { container } = mount(pick)
    fireEvent.click(container.querySelector('.ve-library__card') as HTMLElement)
    expect(pick).toHaveBeenCalledTimes(1)
  })
})
