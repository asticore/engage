import { RootLayout } from '@/engine/next/layouts'
import { headers } from 'next/headers'
import React from 'react'

import { RpcProvider } from '@/features/rpc/RpcProvider'

// The admin's one font is Open Sans from the jsDelivr CDN (no font package is bundled): see buildBuiltInFontCss.
import { buildBuiltInFontCss } from '@/features/fonts/builtIn'
import './admin.css'
import '@/styles/public-components.css'

const ADMIN_FONT_CSS = buildBuiltInFontCss(['opensans'])

export const generateViewport = async () => {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') ?? ''
  const isIPhone = /iPhone/i.test(userAgent)

  return {
    initialScale: 1,
    width: 'device-width',
    ...(isIPhone ? { maximumScale: 1 } : {}),
  }
}

type Args = {
  children: React.ReactNode
}

const Layout = ({ children }: Args) => (
  <RootLayout>
    <style dangerouslySetInnerHTML={{ __html: ADMIN_FONT_CSS }} />
    <RpcProvider />
    {children}
  </RootLayout>
)

export default Layout
