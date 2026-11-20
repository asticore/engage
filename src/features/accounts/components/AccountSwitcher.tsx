import React from 'react'

import { accountContext } from '../session'
import { RpcForm } from '@/features/rpc/RpcForm'
import { listOtherAccounts } from '../switcher'
import { accountTexts } from '../portalCopy'

/**
 * The account switcher (23h): who is signed in here, the other accounts this browser holds, and a
 * way to add another. Email addresses only. Renders nothing when accounts are off, or when there is
 * no one signed in and nothing parked. Any failure hides it rather than breaking the page.
 */
export const AccountSwitcher = async (): Promise<React.ReactElement | null> => {
  try {
    const context = await accountContext()
    if (!context.flags.accounts) return null
    const user = context.user as { id?: number | string; email?: string } | null
    const others = await listOtherAccounts(context.engine, user?.id !== undefined ? String(user.id) : null)
    if (!user && others.length === 0) return null

    const tx = await accountTexts()
    return (
      <section className="account-switcher" aria-label={tx('switcher.heading')}>
        <h2 className="account-switcher__heading">{tx('switcher.heading')}</h2>
        {user ? (
          <p className="account-switcher__active">
            {tx('switcher.active')} <strong>{user.email}</strong>
          </p>
        ) : null}
        {others.length > 0 ? (
          <ul className="account-switcher__list">
            {others.map((account) => (
              <li key={account.id}>
                <RpcForm rpcModule="features/accounts/switcherActions" rpcFn="switchAccountAction">
                  <input type="hidden" name="id" value={account.id} />
                  <button type="submit">
                    {tx('switcher.switchTo')} {account.email}
                  </button>
                </RpcForm>
              </li>
            ))}
          </ul>
        ) : null}
        {user ? (
          <RpcForm rpcModule="features/accounts/switcherActions" rpcFn="addAccountAction">
            <button type="submit">{tx('switcher.add')}</button>
          </RpcForm>
        ) : null}
      </section>
    )
  } catch {
    return null
  }
}
