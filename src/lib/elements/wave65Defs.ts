import { EFFECT_CATALOG } from '@/features/effects/catalog'

import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Wave 65: business-hours, slides (client, Wave65Elements.tsx) and author-box, post-navigation, language-switcher
 * (server, Wave65Server.tsx, registered as site elements). Styles: wave65.css. Icons are String.fromCodePoint escapes.
 */

const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })
const area = (name: string, label: string, helpText?: string): EditorField => ({ name, label, type: 'textarea', helpText })
const check = (name: string, label: string, helpText?: string): EditorField => ({ name, label, type: 'checkbox', helpText })
const labelled = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }))
const SPARK_OPTIONS = [{ label: 'None', value: '' }, ...EFFECT_CATALOG.map((e) => ({ label: `${e.group}: ${e.label}`, value: e.id }))]
const DAYS = labelled([['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']])

const hoursRow = (day: string, open = '09:00', close = '17:00', closed = false) => ({ day, open, close, closed })

export const WAVE65_ELEMENTS: ElementDef[] = [
  {
    type: 'business-hours', label: 'Business hours', icon: String.fromCodePoint(0x1f552), category: 'interactive',
    description: 'Opening hours by day. Today is highlighted, and an "Open now" note shows when the time zone is set.',
    fields: [
      text('title', 'Title'),
      {
        name: 'rows', label: 'Days', type: 'repeater',
        repeater: { fields: [
          { name: 'day', label: 'Day', type: 'select', width: 'half', options: DAYS },
          text('open', 'Opens', { width: 'half', helpText: '24 hour time, like 09:00.' }),
          text('close', 'Closes', { width: 'half', helpText: '24 hour time, like 17:30.' }),
          check('closed', 'Closed all day'),
        ] },
      },
      text('timezone', 'Time zone', { helpText: 'Optional, like Australia/Sydney. Used to find today and the Open now note. Leave empty to use the visitor time.' }),
      check('showStatus', 'Show Open now / Closed note'),
    ],
    defaultProps: () => ({
      title: 'Opening hours',
      rows: [hoursRow('mon'), hoursRow('tue'), hoursRow('wed'), hoursRow('thu'), hoursRow('fri'), hoursRow('sat', '10:00', '14:00'), hoursRow('sun', '', '', true)],
      timezone: '', showStatus: true,
    }),
  },
  {
    type: 'slides', label: 'Slides', icon: String.fromCodePoint(0x1f3a0), category: 'media',
    description: 'A hero slider of 2 to 10 slides, each with a heading, text, button and a background picture or video. Animated text, arrows, dots, thumbnails, loop and keyboard keys. Only the slide in view and its neighbours load. Autoplay is off by default and stops on hover.',
    fields: [
      {
        name: 'items', label: 'Slides (2 to 10)', type: 'repeater',
        repeater: { fields: [
          text('heading', 'Heading'),
          area('text', 'Text'),
          text('buttonLabel', 'Button label', { width: 'half' }),
          text('buttonUrl', 'Button link', { width: 'half' }),
          { name: 'image', label: 'Background picture', type: 'media' },
          text('imageUrl', 'Or picture address', { helpText: 'Used when no picture is chosen above.' }),
          text('videoUrl', 'Background video (.mp4 or .webm)', { helpText: 'Plays muted and looped behind the text. The picture shows until it loads, and for visitors who prefer reduced motion.' }),
          { name: 'textAnimation', label: 'Text animation', type: 'select', width: 'half', options: [{ label: 'Fade up', value: 'fade-up' }, { label: 'Slide in', value: 'slide-left' }, { label: 'Zoom', value: 'zoom' }, { label: 'None', value: 'none' }] },
          { name: 'sparkEffect', label: 'Spark effect on the text', type: 'select', width: 'half', options: SPARK_OPTIONS, helpText: 'Added on top of the text animation. Runs on the live page.' },
          {
            name: 'layers', label: 'Layers (free position)', type: 'repeater',
            repeater: { fields: [
              { name: 'layerType', label: 'Kind', type: 'select', width: 'half', options: labelled([['text', 'Text'], ['image', 'Picture'], ['button', 'Button']]) },
              text('text', 'Text or button label', { width: 'half' }),
              text('url', 'Link or picture address', { helpText: 'For a button, where it goes. For a picture, used when none is chosen below.' }),
              { name: 'image', label: 'Picture', type: 'media' },
              { name: 'x', label: 'Left (%)', type: 'number', width: 'half' },
              { name: 'y', label: 'Top (%)', type: 'number', width: 'half' },
              { name: 'width', label: 'Width (%)', type: 'number', width: 'half' },
              { name: 'delay', label: 'Starts after (seconds)', type: 'number', width: 'half' },
              { name: 'animation', label: 'Animation', type: 'select', width: 'half', options: [{ label: 'Fade up', value: 'fade-up' }, { label: 'Slide in', value: 'slide-left' }, { label: 'Zoom', value: 'zoom' }, { label: 'None', value: 'none' }] },
              { name: 'sparkEffect', label: 'Spark effect', type: 'select', width: 'half', options: SPARK_OPTIONS },
            ] },
          },
        ] },
      },
      check('loop', 'Loop', 'Off stops at the first and last slide.'),
      check('arrows', 'Arrows'),
      check('dots', 'Dots'),
      check('arrowsMobile', 'Arrows on phones', 'Follows the Arrows choice until you change it.'),
      check('dotsMobile', 'Dots on phones', 'Follows the Dots choice until you change it.'),
      check('thumbnails', 'Thumbnails', 'Small pictures under the slider.'),
      check('autoplay', 'Autoplay', 'Off by default. Always stops on hover, on focus and for visitors who prefer reduced motion.'),
      { name: 'interval', label: 'Seconds per slide', type: 'number', width: 'half' },
      { name: 'height', label: 'Height (px)', type: 'number', width: 'half' },
      { name: 'heightMobile', label: 'Height on phones (px)', type: 'number', width: 'half' },
    ],
    defaultProps: () => ({
      items: [
        { heading: 'Welcome', text: 'A short line about what you do.', buttonLabel: 'Learn more', buttonUrl: '/about' },
        { heading: 'Our work', text: 'Show off a project or an offer.', buttonLabel: 'See more', buttonUrl: '/contact' },
      ],
      autoplay: false, interval: 6, height: 420, heightMobile: 320, loop: true, arrows: true, dots: true, arrowsMobile: true, dotsMobile: true, thumbnails: false,
    }),
  },
  {
    type: 'author-box', label: 'Author box', icon: String.fromCodePoint(0x1f464), category: 'siteMeta',
    description: 'Author name, short bio and picture. On a post the name fills in from the post author; anything you type overrides it.',
    fields: [
      text('name', 'Name', { helpText: 'Leave empty to use the post author.' }),
      area('bio', 'Bio'),
      text('avatarUrl', 'Picture address'),
      text('label', 'Label', { width: 'half' }),
    ],
    defaultProps: () => ({ name: '', bio: '', avatarUrl: '', label: 'Written by' }),
  },
  {
    type: 'post-navigation', label: 'Post navigation', icon: String.fromCodePoint(0x2194), category: 'siteMeta',
    description: 'Links to the previous and next published blog post. Hidden on other pages.',
    fields: [text('prevLabel', 'Previous label', { width: 'half' }), text('nextLabel', 'Next label', { width: 'half' })],
    defaultProps: () => ({ prevLabel: 'Previous post', nextLabel: 'Next post' }),
  },
  {
    type: 'language-switcher', label: 'Language switcher', icon: String.fromCodePoint(0x1f310), category: 'siteMeta',
    description: 'Links to this page in each active language. Hidden when Multilingual is off or only one language is active.',
    fields: [
      text('label', 'Accessible label', { width: 'half' }),
      { name: 'display', label: 'Show', type: 'select', width: 'half', options: [{ label: 'Language name', value: 'name' }, { label: 'Short code (EN)', value: 'code' }, { label: 'Flag and name', value: 'flag-name' }, { label: 'Flag only', value: 'flag' }], helpText: 'Flags show a country, not a language: the name stays as the accessible label.' },
      { name: 'layout', label: 'Layout', type: 'select', width: 'half', options: [{ label: 'In a row', value: 'row' }, { label: 'As a list', value: 'list' }, { label: 'As a dropdown', value: 'dropdown' }] },
      { name: 'hover', label: 'Hover effect', type: 'select', width: 'half', options: [{ label: 'Underline', value: 'underline' }, { label: 'Background', value: 'background' }, { label: 'None', value: 'none' }] },
      { name: 'align', label: 'Align', type: 'select', width: 'half', options: [{ label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' }] },
    ],
    defaultProps: () => ({ label: 'Language', display: 'name', layout: 'row', hover: 'underline', align: 'start' }),
  },
]

/** Types rendered on the server by SiteElement. */
export const WAVE65_SERVER_TYPES = ['author-box', 'post-navigation', 'language-switcher']
