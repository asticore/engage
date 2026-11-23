import React from 'react'

import { FEED_SOURCES, loadFeedItems } from '@/features/calendar/timelineFeed'

import { num, pick, str } from './elementUtil'
import { TimelineElement } from './Wave36Elements'

type P = Record<string, unknown>

/** `timeline-feed`: items are read on the server from Events or blog posts, then drawn by the normal Timeline. */
export async function TimelineFeedElement(props: P): Promise<React.ReactElement | null> {
  const source = pick(props.source, FEED_SOURCES, 'events')
  const items = await loadFeedItems(source, Math.round(num(props.count, 6, 1, 24)), str(props.linkLabel, 'Read more'))
  if (items.length === 0) return null
  return <TimelineElement {...props} items={items} schema={props.schema === true && source !== 'posts'} />
}
