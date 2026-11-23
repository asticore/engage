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
]
