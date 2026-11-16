import React from 'react'

import { authCaptchaConfig } from '@/features/security/authCaptcha'
import { getEngine } from '@/engine'
import { getFeatureFlags } from '@/utilities/features'

import { CommentsSection } from './CommentsSection'

/** Shows the comments block under a post only when the Comments section is switched on. Adds the spam challenge when Form settings have it on. */
export async function PostComments({ postId }: { postId: number }) {
  if (!(await getFeatureFlags()).comments) return null
  const captcha = await authCaptchaConfig((await getEngine()) as never, 'comments')
  return <CommentsSection postId={postId} captcha={captcha} />
}
