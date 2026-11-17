import React from 'react'

import { getFeatureFlags } from '@/utilities/features'

import { CommentsSection } from './CommentsSection'

/** Shows the comments block under a post only when the Comments section is switched on. The spam challenge is drawn by the form itself when the Comments place asks for it. */
export async function PostComments({ postId }: { postId: number }) {
  if (!(await getFeatureFlags()).comments) return null
  return <CommentsSection postId={postId} />
}
