import type { ElementDef } from './registry'

/**
 * Wave 71 (Task 10, 29b): account form elements that work on any page. They reuse the account forms (`AuthForms.tsx`),
 * so every rule (blocked methods, spam challenge, two-step codes, password rules, verify first) still runs on the
 * server through the same actions. Renderers: Wave71Elements.tsx. Icons are String.fromCodePoint escapes.
 */

export const WAVE71_ELEMENTS: ElementDef[] = [
  {
    type: 'login-form', label: 'Login form', icon: String.fromCodePoint(0x1f511), category: 'interactive',
    description: 'An email and password sign-in form for customers, with the two-step code step. Other sign-in methods stay on the account sign-in page.',
    fields: [
      { name: 'redirect', label: 'After signing in go to', type: 'text', helpText: 'A path inside the account area, like /account/orders. Empty means /account.' },
    ],
    defaultProps: () => ({ redirect: '' }),
  },
  {
    type: 'registration-form', label: 'Registration form', icon: String.fromCodePoint(0x1f4dd), category: 'interactive',
    description: 'A create-account form. The server applies the password rules, verification and spam checks.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'password-reset-form', label: 'Password reset form', icon: String.fromCodePoint(0x1f510), category: 'interactive',
    description: 'Asks for an email address and sends a reset link.',
    fields: [],
    defaultProps: () => ({}),
  },
]
