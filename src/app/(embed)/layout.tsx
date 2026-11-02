import React from 'react'

import { buildBuiltInFontCss } from '@/features/fonts/builtIn'
import { buildFontCss, remoteStylesheetUrls, resolveThemeFont } from '@/features/fonts/css'
import { sanitizeInstalledFonts } from '@/features/fonts/installed'
import { readSelfHostBuiltInFonts } from '@/features/fonts/selfHost'
import { BODY_FONT_VARS, FONT_FACE_VARS, HEADING_FONT_VARS } from '@/features/fonts/siteFontVars'
import type { InstalledFont } from '@/features/fonts/types'
import { buildThemeStylesCss } from '@/features/themeStyles/css'
import { loadThemeStyles } from '@/features/themeStyles/store'
import { getEngine } from '@/lib/engine'
import type { SiteSetting } from '@/engage-types'

/**
 * A bare root layout for pages meant to sit inside another website's iframe:
 * no header, footer, cookie banner, ads or analytics. An embed uses the same
 * theme styles, fonts and font variables as the rest of the site (the design
 * model in features/themeStyles), so a form in an embed looks like it belongs
 * to this site. Each embed then picks its own colour, font and radius from
 * those (see features/forms/embeds.ts).
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

export default async function EmbedLayout({ children }: { children: React.ReactNode }) {
  const engine = await getEngine()
  const settings = (await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): null => null)) as SiteSetting | null
  const theme = settings?.theme
  const customFonts = sanitizeInstalledFonts((theme as { customFonts?: unknown } | null | undefined)?.customFonts)
  const heading = resolveThemeFont(theme?.headingFont, HEADING_FONT_VARS, 'cormorant', customFonts)
  const body = resolveThemeFont(theme?.bodyFont, BODY_FONT_VARS, 'jost', customFonts)
  const fontsInUse = [heading.installed, body.installed]
    .filter((font): font is InstalledFont => font !== null)
    .filter((font, index, all) => all.findIndex((other) => other.id === font.id) === index)
  const builtInHeading = Object.hasOwn(HEADING_FONT_VARS, theme?.headingFont || '') ? theme?.headingFont : 'cormorant'
  const builtInBody = Object.hasOwn(BODY_FONT_VARS, theme?.bodyFont || '') ? theme?.bodyFont : 'jost'
  const builtInFontsCss = buildBuiltInFontCss([heading.installed ? null : builtInHeading, body.installed ? null : builtInBody], { selfHost: await readSelfHostBuiltInFonts() })
  const fontCss = [builtInFontsCss, buildFontCss(fontsInUse)].filter(Boolean).join('\n')
  const googleStylesheets = remoteStylesheetUrls(fontsInUse)
  const rootVars = `${FONT_FACE_VARS} --font-display: ${heading.stack}; --font-body: ${body.stack};`

  // The same global theme styles as the site (colours, text, buttons, form fields and scales). A failure here must never break the embed.
  let themeStylesCss = ''
  try {
    const { styles, saved } = await loadThemeStyles()
    themeStylesCss = buildThemeStylesCss(
      styles,
      {
        saved,
        legacy: {
          primaryColor: theme?.primaryColor || undefined,
          accentColor: theme?.accentColor || undefined,
          backgroundColor: theme?.backgroundColor || undefined,
        },
      },
      { fonts: customFonts },
    )
  } catch {
    themeStylesCss = ''
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {googleStylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {fontCss && <style dangerouslySetInnerHTML={{ __html: fontCss }} />}
        <style dangerouslySetInnerHTML={{ __html: `:root { ${rootVars} }` }} />
        {themeStylesCss && <style id="eg-theme-styles" dangerouslySetInnerHTML={{ __html: themeStylesCss }} />}
        <style dangerouslySetInnerHTML={{ __html: 'body { margin: 0; background: transparent; color: var(--eg-c-text, #1f2230); }' }} />
      </head>
      <body className="eg-embed-body">{children}</body>
    </html>
  )
}
