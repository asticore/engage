'use client'
import React from 'react'

import { ForgotPasswordForm, RegisterForm, SignInForm } from '@/features/accounts/components/AuthForms'

import { str } from './elementUtil'
import './wave71.css'

/** Wave 71 client elements (Task 10, 29b): login, registration and password reset forms. Defs: wave71Defs.ts. */

type P = Record<string, unknown>

/** Same rule as the sign-in screen: only paths inside the account area are followed after signing in. */
export function safeAccountNext(v: string): string {
  const t = v.trim()
  return t.startsWith('/account') && !t.startsWith('//') && !/[\s\\]/.test(t) ? t : '/account'
}

export function LoginFormElement(props: P): React.ReactElement {
  return <div className="w71-form"><SignInForm next={safeAccountNext(str(props.redirect))} /></div>
}

export function RegistrationFormElement(): React.ReactElement {
  return <div className="w71-form"><RegisterForm rules={{ minLength: 8, hint: '' }} /></div>
}

export function PasswordResetFormElement(): React.ReactElement {
  return <div className="w71-form"><ForgotPasswordForm /></div>
}

export const WAVE71_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'login-form': LoginFormElement,
  'registration-form': RegistrationFormElement,
  'password-reset-form': PasswordResetFormElement,
}
