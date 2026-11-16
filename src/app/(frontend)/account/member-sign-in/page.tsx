import React from 'react'
import type { Metadata } from 'next'

import { accountTitle } from '@/features/accounts/portalCopy'

import { SignInScreen, accountMetadata } from '@/features/accounts'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return accountMetadata(await accountTitle('auth.signIn'))
}

/**
 * The member sign-in. Same screen and same accounts as `/account/sign-in`, but its own place in
 * Authentication, Who can sign in with what, so the owner can allow different methods for members
 * than for shop customers. Organisation-only pages send visitors here.
 */
export default async function MemberSignInRoute({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string; reset?: string; social_error?: string; social?: string }>
}) {
  const { next: nextParam, redirect, reset, social_error: socialError, social } = await searchParams
  const next = nextParam ?? redirect
  return <SignInScreen next={next} justReset={reset === '1'} socialError={socialError} social={social} place="members" />
}
