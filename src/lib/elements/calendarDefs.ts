import type { ElementDef } from './registry'

const opt = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }))

/**
 * Calendar (34c): a public events calendar placeable on any page. Backed by the Events collection. Categories
 * come from keyword rules (no extra database field) and tags from #hashtags in the title or summary.
 */
export const CALENDAR_ELEMENTS: ElementDef[] = [
  {
    type: 'calendar', label: 'Calendar', icon: String.fromCodePoint(0x1f5d3), category: 'media',
    description: 'A calendar of your events with month, week, day, agenda and list views, category and tag filters, event popup with Add to calendar, and a subscribe link. Colours, fonts, density, first day of week and 12 or 24 hour time are set here.',
    fields: [
      { name: 'views', label: 'Views offered', type: 'textarea', helpText: 'One per line from: month, week, day, agenda, list.' },
      { name: 'defaultView', label: 'Opens in', type: 'select', width: 'half', options: opt([['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda'], ['list', 'List']]) },
      { name: 'firstDay', label: 'Week starts on', type: 'select', width: 'half', options: opt([['1', 'Monday'], ['0', 'Sunday'], ['6', 'Saturday']]) },
      { name: 'hours', label: 'Time format', type: 'select', width: 'half', options: opt([['12', '12 hour'], ['24', '24 hour']]) },
      { name: 'density', label: 'Density', type: 'select', width: 'half', options: opt([['comfortable', 'Comfortable'], ['compact', 'Compact']]) },
      { name: 'timeZone', label: 'Time zone', type: 'text', width: 'half', helpText: 'For example Australia/Sydney. Empty uses each visitor\'s own time zone.' },
      { name: 'categories', label: 'Categories', type: 'textarea', helpText: 'One rule per line: keyword | Category | #colour. An event whose title or summary has the keyword gets that category and colour.' },
      { name: 'defaultCategory', label: 'Category when no rule matches', type: 'text', width: 'half' },
      { name: 'accent', label: 'Accent colour', type: 'color', width: 'half' },
      { name: 'textColor', label: 'Text colour', type: 'color', width: 'half' },
      { name: 'background', label: 'Background', type: 'color', width: 'half' },
      { name: 'fontFamily', label: 'Font family', type: 'text', width: 'half', helpText: 'A CSS font family, for example Georgia, serif. Empty uses the site font.' },
      { name: 'colorByCategory', label: 'Colour events by category', type: 'checkbox' },
      { name: 'showFilters', label: 'Show category and tag filters', type: 'checkbox' },
      { name: 'showSubscribe', label: 'Show the Subscribe link (ICS feed)', type: 'checkbox' },
    ],
    defaultProps: () => ({ views: 'month\nweek\nagenda\nlist', defaultView: 'month', firstDay: '1', hours: '12', density: 'comfortable', timeZone: '', categories: '', defaultCategory: 'Events', accent: '#2e3192', textColor: '', background: '', fontFamily: '', colorByCategory: true, showFilters: true, showSubscribe: true }),
  },
  {
    type: 'timeline-feed', label: 'Timeline from events or posts', icon: String.fromCodePoint(0x1f4c6), category: 'media',
    description: 'A timeline filled automatically from your Events or blog posts, newest or soonest first. Same look options as the Timeline element.',
    fields: [
      { name: 'source', label: 'Fill from', type: 'select', width: 'half', options: opt([['events', 'Events (upcoming)'], ['past-events', 'Events (past)'], ['posts', 'Blog posts']]) },
      { name: 'count', label: 'How many', type: 'range', width: 'half', min: 1, max: 24, step: 1 },
      { name: 'layout', label: 'Layout', type: 'select', width: 'half', options: opt([['vertical', 'Vertical'], ['alternating', 'Alternating'], ['horizontal', 'Horizontal']]) },
      { name: 'linkLabel', label: 'Link text', type: 'text', width: 'half' },
      { name: 'lineColor', label: 'Line colour', type: 'color', width: 'half' },
      { name: 'dotColor', label: 'Dot colour', type: 'color', width: 'half' },
      { name: 'reveal', label: 'Reveal on scroll (Spark)', type: 'select', width: 'half', options: [{ label: 'None', value: '' }, ...opt([['fade', 'Fade'], ['fade-up', 'Fade up'], ['slide-left', 'Slide left'], ['slide-right', 'Slide right'], ['zoom', 'Zoom']])] },
      { name: 'schema', label: 'Add Event structured data', type: 'checkbox', helpText: 'For real events only.' },
    ],
    defaultProps: () => ({ source: 'events', count: 6, layout: 'vertical', linkLabel: 'Read more', lineColor: '', dotColor: '', reveal: '', schema: false }),
  },
]
