import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'

import { MapElement } from '@/components/blocks/elements/LayoutElements'

afterEach(cleanup)

describe('map element', () => {
  it('shows a placeholder and no third-party frame until asked', () => {
    const { container } = render(h(MapElement, { address: 'Trafalgar Square, London' }))
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show map: Trafalgar Square, London' })).toBeTruthy()
  })

  it('loads the map when the button is pressed', () => {
    const { container } = render(h(MapElement, { address: 'Trafalgar Square, London', title: 'Our office' }))
    fireEvent.click(screen.getByRole('button'))
    const frame = container.querySelector('iframe')
    expect(frame?.getAttribute('src')).toContain('Trafalgar')
    expect(frame?.getAttribute('title')).toBe('Our office')
  })

  it('keeps the address prompt when there is nothing to show', () => {
    render(h(MapElement, {}))
    expect(screen.getByText('Enter an address for the map')).toBeTruthy()
  })
})
