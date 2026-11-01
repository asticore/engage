import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'
import { Tooltip } from '@/components/admin/shared/Tooltip'

describe('Tooltip', () => {
  afterEach(() => {
    cleanup()
  })

  it('links the tooltip text to the control with aria-describedby', () => {
    render(h(Tooltip, { text: 'Export CSV', children: h('button', { type: 'button' }, '↓') }))
    const button = screen.getByRole('button', { name: '↓' })
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('Export CSV')
    expect(button.getAttribute('aria-describedby')).toBe(tip.id)
  })

  it('renders the child unchanged when there is no text', () => {
    const { container } = render(h(Tooltip, { text: '', children: h('button', { type: 'button' }, 'Go') }))
    expect(container.querySelector('.admin-tip')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
