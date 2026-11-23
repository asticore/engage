import React from 'react'

import { loadCalendarEvents } from '@/features/calendar/feed'
import { CAL_VIEWS, clampFirstDay, dayKeyIn, parseRules, type CalView } from '@/features/calendar/model'

import { CalendarClient } from './CalendarClient'
import { cssColour, flag, pick, str } from './elementUtil'

type P = Record<string, unknown>

const TZ_OK = /^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/

/** Calendar element (def: src/lib/elements/calendarDefs.ts). Events are read on the server; views run in the browser. */
export async function CalendarElement(props: P): Promise<React.ReactElement | null> {
  const views = str(props.views).split(/[\s,]+/).filter((v): v is CalView => (CAL_VIEWS as readonly string[]).includes(v))
  const rules = parseRules(props.categories)
  const fallback = { category: str(props.defaultCategory).trim() || 'Events', color: cssColour(props.accent) || '#2e3192' }
  const now = Date.now()
  const events = await loadCalendarEvents({ from: new Date(now - 90 * 86_400_000).toISOString(), to: new Date(now + 400 * 86_400_000).toISOString(), rules, fallback })
  const timeZone = TZ_OK.test(str(props.timeZone).trim()) ? str(props.timeZone).trim() : ''
  const accent = cssColour(props.accent)
  const text = cssColour(props.textColor)
  const bg = cssColour(props.background)
  const font = /^[\w\s,'"-]{1,80}$/.test(str(props.fontFamily)) ? str(props.fontFamily) : ''
  const style = { ...(accent ? { '--cal-accent-set': accent } : {}), ...(text ? { '--cal-text-set': text } : {}), ...(bg ? { '--cal-bg-set': bg } : {}), ...(font ? { '--cal-font': font } : {}) } as React.CSSProperties
  return (
    <div style={style}>
      <CalendarClient
        events={events}
        views={views.length ? views : ['month']}
        defaultView={pick(props.defaultView, CAL_VIEWS, 'month')}
        firstDay={clampFirstDay(props.firstDay)}
        hour12={str(props.hours, '12') !== '24'}
        timeZone={timeZone}
        density={pick(props.density, ['comfortable', 'compact'] as const, 'comfortable')}
        showFilters={flag(props.showFilters, true)}
        colorByCategory={flag(props.colorByCategory, true)}
        feedUrl={flag(props.showSubscribe, true) ? '/api/events/feed' : ''}
        today={dayKeyIn(new Date(now).toISOString(), timeZone)}
      />
    </div>
  )
}
