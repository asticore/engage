'use client'

import React, { useState } from 'react'

/** Lets an affiliate say how they want to be paid. The site owner pays outside the site and sees this next to the payout. English only. */
export const PayoutDetailsForm: React.FC<{ token: string; initial: string }> = ({ token, initial }) => {
  const [details, setDetails] = useState(initial)
  const [message, setMessage] = useState('')
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setMessage('')
        const res = await fetch('/api/affiliate-payout-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, details }) })
        const data = (await res.json().catch((): null => null)) as { error?: string } | null
        setMessage(res.ok ? 'Saved.' : (data?.error ?? 'That did not work. Please try again.'))
      }}
    >
      <label>
        How should we pay you? (for example your PayPal email, or bank transfer details)
        <br />
        <textarea rows={2} maxLength={300} value={details} onChange={(e) => setDetails(e.target.value)} style={{ width: '100%' }} />
      </label>
      <button type="submit">Save payout details</button>
      {message && <span role="status"> {message}</span>}
    </form>
  )
}
