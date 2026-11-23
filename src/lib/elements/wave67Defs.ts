import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Wave 67: social feed. Server rendered (registered in SITE_ELEMENT_TYPES) from an account connected under
 * Integrations > Social accounts. The renderer is src/components/blocks/elements/Wave67Server.tsx.
 */

const check = (name: string, label: string): EditorField => ({ name, label, type: 'checkbox' })
const choices = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }))

export const SOCIAL_FEED_LIMIT = 24

export const WAVE67_ELEMENTS: ElementDef[] = [
  {
    type: 'social-feed', label: 'Social feed', icon: String.fromCodePoint(0x1f4f7), category: 'media',
    description: 'Recent posts from an Instagram, Facebook, Pinterest, TikTok, YouTube, Vimeo, Twitch, Spotify, Google Business or RSS account, or embedded X and LinkedIn posts, connected under Integrations. Grid, masonry, highlight or slider, with moderation, load more, lightbox and a follow button.',
    fields: [
      {
        name: 'account', label: 'Account', type: 'select', optionsUrl: '/api/admin-social-accounts', options: [],
        helpText: 'Connect accounts under Settings > Integrations > Social accounts.',
      },
      { name: 'layout', label: 'Layout', type: 'select', width: 'half', options: choices([['grid', 'Grid'], ['masonry', 'Masonry wall'], ['highlight', 'Highlight (first post large)'], ['list', 'List'], ['carousel', 'Slider']]) },
      { name: 'columns', label: 'Columns', type: 'range', width: 'half', min: 1, max: 6, step: 1, showIf: { field: 'layout', in: ['grid', 'carousel', 'masonry', 'highlight'] } },
      { name: 'limit', label: 'Number of posts', type: 'range', width: 'half', min: 1, max: SOCIAL_FEED_LIMIT, step: 1 },
      { name: 'aspect', label: 'Image shape', type: 'select', width: 'half', options: choices([['square', 'Square'], ['portrait', 'Portrait'], ['landscape', 'Landscape']]) },
      check('showCaption', 'Show the caption'),
      check('showDate', 'Show the date'),
      check('showLikes', 'Show likes (where the provider shares them)'),
      check('newTab', 'Open posts in a new tab'),
      { name: 'lightbox', label: 'Open pictures in a popup', type: 'checkbox', helpText: 'A popup shows the picture and caption with a link to the original post.' },
      { name: 'initial', label: 'Show first (then a Load more button)', type: 'range', width: 'half', min: 0, max: SOCIAL_FEED_LIMIT, step: 1, helpText: '0 shows every post at once.' },
      { name: 'loadMoreLabel', label: 'Load more button text', type: 'text', width: 'half' },
      { name: 'refresh', label: 'Refresh every (minutes)', type: 'select', width: 'half', options: choices([['5', '5'], ['15', '15'], ['30', '30'], ['60', '60'], ['360', '360 (6 hours)'], ['1440', '1440 (1 day)']]), helpText: 'How long fetched posts are reused. Longer saves provider quota.' },
      { name: 'followUrl', label: 'Follow button address', type: 'text', helpText: 'Your profile address. Leave empty for no button.' },
      { name: 'followLabel', label: 'Follow button text', type: 'text', width: 'half' },
      { name: 'consent', label: 'Ask for marketing cookies before showing pictures', type: 'checkbox', helpText: 'Pictures load from the provider, so a visitor who has not accepted sees a notice first. Embedded X and LinkedIn posts are always gated.' },
      { name: 'hide', label: 'Hide posts', type: 'textarea', helpText: 'Post addresses or ids, one per line.' },
      { name: 'pin', label: 'Pin posts to the top', type: 'textarea', helpText: 'Post addresses or ids, one per line, in the order to show them.' },
      { name: 'include', label: 'Only posts containing', type: 'textarea', helpText: 'Hashtags or words, one per line. Empty shows all.' },
      { name: 'exclude', label: 'Hide posts containing', type: 'textarea', helpText: 'Hashtags or words, one per line.' },
    ],
    defaultProps: () => ({ account: '', layout: 'grid', columns: 3, limit: 9, aspect: 'square', showCaption: true, showDate: false, showLikes: false, newTab: true, lightbox: false, initial: 0, loadMoreLabel: 'Load more', refresh: '30', followUrl: '', followLabel: 'Follow', consent: false, hide: '', pin: '', include: '', exclude: '' }),
  },
]
