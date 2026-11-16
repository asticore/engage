import { describe, expect, it } from 'vitest'

import { disposableRefusal } from '@/features/security/emailPolicy'

const engineWith = (registration: Record<string, unknown> | null) => ({ findGlobal: async () => (registration ? { registration } : null) })

describe('disposable email by surface', () => {
  it('blocks only the surfaces switched on', async () => {
    const e = engineWith({ blockDisposableForms: true })
    expect(await disposableRefusal(e, 'forms', 'a@mailinator.com')).toContain('permanent')
    expect(await disposableRefusal(e, 'checkout', 'a@mailinator.com')).toBeNull()
    expect(await disposableRefusal(e, 'customers', 'a@mailinator.com')).toBeNull()
  })
  it('lets real addresses through and fails open', async () => {
    expect(await disposableRefusal(engineWith({ blockDisposableCheckout: true }), 'checkout', 'a@gmail.com')).toBeNull()
    expect(await disposableRefusal(engineWith(null), 'forms', 'a@mailinator.com')).toBeNull()
    expect(await disposableRefusal({ findGlobal: async () => { throw new Error('x') } }, 'forms', 'a@mailinator.com')).toBeNull()
  })
})
