'use client'

import React, { useState } from 'react'

import { PlaceCaptcha } from '@/features/security/PlaceCaptcha'

/** One ticket type as the form shows it. Built on the server from the event's tiers and their sales. */
export type RsvpTierOption = {
  name: string
  /** Shown in the list, e.g. "VIP - $25.00 - 4 left". */
  label: string
  soldOut: boolean
}

/** The words the form shows, passed in already translated by the page. */
export type RsvpFormText = {
  heading: string
  ticketType: string
  chooseTicket: string
  name: string
  email: string
  guests: string
  notes: string
  submit: string
  sending: string
  successTitle: string
  successBody: string
  error: string
}

export const RsvpForm: React.FC<{ eventID: string | number; tiers?: RsvpTierOption[]; text: RsvpFormText }> = ({ eventID, tiers = [], text }) => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const tokens: Record<string, string> = {}
    for (const field of ['cf-turnstile-response', 'g-recaptcha-response']) {
      const value = formData.get(field)
      if (typeof value === 'string' && value) tokens[`x-${field}`] = value
    }

    try {
      const res = await fetch('/api/event-rsvps', {
        body: JSON.stringify({
          email: formData.get('email'),
          event: eventID,
          guestCount: Number(formData.get('guestCount')) || 1,
          name: formData.get('name'),
          notes: formData.get('notes') || undefined,
          ticketTier: tiers.length > 0 ? formData.get('ticketTier') : undefined,
        }),
        headers: { 'Content-Type': 'application/json', ...tokens },
        method: 'POST',
      })

      if (!res.ok) {
        const body = (await res.json().catch((): null => null)) as {
          errors?: { message: string }[]
        } | null
        throw new Error(body?.errors?.[0]?.message || text.error)
      }

      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setAttempts((n) => n + 1)
      setError(err instanceof Error ? err.message : text.error)
    }
  }


  if (status === 'success') {
    return (
      <div className="stack">
        <h3 className="mb-2">{text.successTitle}</h3>
        <p>{text.successBody}</p>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <h3>{text.heading}</h3>
      {tiers.length > 0 && (
        <label className="field">
          {text.ticketType}
          <select name="ticketTier" required defaultValue="" className="select">
            <option value="" disabled>
              {text.chooseTicket}
            </option>
            {tiers.map((tier) => (
              <option key={tier.name} value={tier.name} disabled={tier.soldOut}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        {text.name}
        <input name="name" type="text" required className="input" />
      </label>
      <label className="field">
        {text.email}
        <input name="email" type="email" required className="input" />
      </label>
      <label className="field">
        {text.guests}
        <input name="guestCount" type="number" min={1} defaultValue={1} className="input" />
      </label>
      <label className="field">
        {text.notes}
        <textarea name="notes" rows={3} className="textarea" />
      </label>
      <PlaceCaptcha place="rsvp" refreshKey={attempts} />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn--primary" disabled={status === 'submitting'}>
        {status === 'submitting' ? text.sending : text.submit}
      </button>
    </form>
  )
}
