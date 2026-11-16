import React from 'react'

import { getFeatureFlags } from '@/utilities/features'

import { ChatWidget } from './ChatWidget'

/** Mounted in the public layout. Renders the corner widget only while Chatbot is switched on (the widget itself checks "show on every page"). */
export async function SiteChatbot(): Promise<React.ReactElement | null> {
  const on = await getFeatureFlags().then((f) => Boolean(f.chatbot)).catch((): boolean => false)
  return on ? <ChatWidget /> : null
}
