'use client'

import React, { useEffect, useState } from 'react'

import { sendChallengeEmailAction, twoFactorChallengeOptionsAction, type TwoFactorChallengeOptions } from '../twoFactorActions.client'
import { secondStepPasskeyAvailable, secondStepWithPasskey } from '@/features/passkeys/client'
import { usePortalText } from '@/features/accounts/components/PortalText'
import './twoFactorExtras.css'

/**
 * The extras on the second-step sign-in screen, shared by the admin login and the customer
 * sign-in: switch between the authenticator code and an emailed code, and tick "remember this
 * device". It only draws and reports choices; the server decides what is allowed (it re-checks the
 * settings when the code is sent, when it is verified, and when a device is remembered).
 *
 * Inside a <form> the hidden `method` input and the `trustDevice` checkbox travel with the submit;
 * the admin screen, which posts JSON, reads the same choices through the callbacks.
 */

export type SecondFactorMethod = 'app' | 'email'

type Props = {
  pendingToken: string
  method: SecondFactorMethod
  onMethod: (method: SecondFactorMethod) => void
  trust: boolean
  onTrust: (trust: boolean) => void
  disabled?: boolean
  /** Where to go after a passkey finishes the sign-in. */
  next?: string
  area?: 'account' | 'admin'
}

export const SecondFactorChoice: React.FC<Props> = ({ pendingToken, method, onMethod, trust, onTrust, disabled, next = '/account', area = 'account' }) => {
  const [options, setOptions] = useState<TwoFactorChallengeOptions>({ emailAvailable: false, trustAvailable: false, trustDays: 30 })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyOn, setPasskeyOn] = useState(false)
  const tx = usePortalText()

  useEffect(() => {
    let cancelled = false
    twoFactorChallengeOptionsAction()
      .then((result) => {
        if (!cancelled) setOptions(result)
      })
      .catch((): undefined => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    secondStepPasskeyAvailable(pendingToken, area)
      .then((ok) => {
        if (!cancelled) setPasskeyOn(ok)
      })
      .catch((): undefined => undefined)
    return () => {
      cancelled = true
    }
  }, [pendingToken, area])

  const answerWithPasskey = async () => {
    setBusy(true)
    setNote('')
    const result = await secondStepWithPasskey(pendingToken, next, area, trust)
    if (result.redirect) {
      window.location.assign(result.redirect)
      return
    }
    setNote(result.message || tx('common.passkeyFailed'))
    setBusy(false)
  }

  const sendEmailCode = async () => {
    setBusy(true)
    setNote('')
    try {
      const result = await sendChallengeEmailAction(pendingToken)
      setNote(result.message ?? '')
      if (result.ok) onMethod('email')
    } catch {
      setNote(tx('common.somethingWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tf-choice">
      <input type="hidden" name="method" value={method} />
      {options.emailAvailable && (
        <div className="tf-methods">
          {method === 'app' ? (
            <button type="button" className="btn btn--ghost" disabled={disabled || busy} onClick={() => void sendEmailCode()}>
              {tx('auth.emailCodeInstead')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" disabled={disabled || busy} onClick={() => void sendEmailCode()}>
                {tx('auth.sendNewCode')}
              </button>
              <button type="button" className="btn btn--ghost" disabled={disabled || busy} onClick={() => { onMethod('app'); setNote('') }}>
                {tx('auth.useAuthenticatorApp')}
              </button>
            </>
          )}
        </div>
      )}
      {passkeyOn && (
        <div className="tf-methods">
          <button type="button" className="btn btn--ghost" disabled={disabled || busy} onClick={() => void answerWithPasskey()}>
            {busy ? tx('common.waitingDevice') : tx('auth.usePasskeyInstead')}
          </button>
        </div>
      )}
      {note && (
        <p role="status" aria-live="polite" className="tf-choice__note">
          {note}
        </p>
      )}
      {options.trustAvailable && (
        <label className="tf-choice__remember">
          <input type="checkbox" name="trustDevice" checked={trust} onChange={(event) => onTrust(event.target.checked)} disabled={disabled} />
          {options.trustDays === 1 ? tx('auth.rememberDeviceOne') : tx('auth.rememberDeviceMany', { days: options.trustDays })}
        </label>
      )}
    </div>
  )
}
