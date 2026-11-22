// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'
import { describe, expect, it, vi } from 'vitest'

let current: unknown = undefined
const setValue = vi.fn()

vi.mock('@/engine/ui', () => ({
  FieldLabel: ({ htmlFor, label }: { htmlFor: string; label: string }) => h('label', { htmlFor }, label),
  useField: () => ({ value: current, setValue }),
}))

import { BidTermsField } from '@/features/quotes/components/BidTermsField'

const field = {} as never

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(cleanup)

describe('BidTermsField', () => {
  it('shows blank inputs when no terms are saved', () => {
    current = undefined
    render(h(BidTermsField, { field, path: 'bidTerms' }))
    expect((screen.getByLabelText('Lowest offer taken') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Offers close') as HTMLInputElement).value).toBe('')
  })

  it('shows saved terms', () => {
    current = { minimum: 25, endsAt: '2027-01-02T03:04:00.000Z' }
    render(h(BidTermsField, { field, path: 'bidTerms' }))
    expect((screen.getByLabelText('Lowest offer taken') as HTMLInputElement).value).toBe('25')
    expect((screen.getByLabelText('Offers close') as HTMLInputElement).value).toBe('2027-01-02T03:04')
  })

  it('writes the minimum and keeps the end time', () => {
    setValue.mockClear()
    current = { endsAt: '2027-01-02T03:04:00.000Z' }
    render(h(BidTermsField, { field, path: 'bidTerms' }))
    fireEvent.change(screen.getByLabelText('Lowest offer taken'), { target: { value: '40' } })
    expect(setValue).toHaveBeenCalledWith({ endsAt: '2027-01-02T03:04:00.000Z', minimum: 40 })
  })

  it('clears the minimum when the box is emptied', () => {
    setValue.mockClear()
    current = { minimum: 40, endsAt: null }
    render(h(BidTermsField, { field, path: 'bidTerms' }))
    fireEvent.change(screen.getByLabelText('Lowest offer taken'), { target: { value: '' } })
    expect(setValue).toHaveBeenCalledWith({ minimum: null, endsAt: null })
  })

  it('stores the end time as ISO and clears it when emptied', () => {
    setValue.mockClear()
    current = { minimum: 5, endsAt: '2027-01-02T03:04:00.000Z' }
    render(h(BidTermsField, { field, path: 'bidTerms' }))
    fireEvent.change(screen.getByLabelText('Offers close'), { target: { value: '' } })
    expect(setValue).toHaveBeenCalledWith({ minimum: 5, endsAt: null })
  })

  it('makes the inputs read-only when asked', () => {
    current = {}
    render(h(BidTermsField, { field, path: 'bidTerms', readOnly: true }))
    expect((screen.getByLabelText('Lowest offer taken') as HTMLInputElement).readOnly).toBe(true)
  })
})
