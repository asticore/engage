import React from 'react'

import { getFeatureFlags } from '@/utilities/features'

import { CommentsSection } from './CommentsSection'

/** Shows the comments block under a post only when the Comments section is switched on. */
export async function PostComments({ postId }: { postId: number }) {
  if (!(await getFeatureFlags()).comments) return null
  return <CommentsSection postId={postId} />
}
