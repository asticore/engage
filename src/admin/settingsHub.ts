/**
 * The settings screens that are not one of SETTINGS_PAGES, listed on the
 * Settings hub with a one-line description. `href` is relative to the admin
 * root. Globals with their own screen are listed by their /globals/<slug> route.
 *
 * Header and footer are left out on purpose: they are edited under Templates.
 */
export type HubScreen = {
  key: string
  label: string
  href: string
  description: string
}

export const HUB_SCREENS: HubScreen[] = [
  {
    key: 'theme-styles',
    label: 'Theming',
    href: '/theme-styles',
    description: 'Colours, text styles, buttons, tables, forms, layout and presets, set once and used everywhere.',
  },
  {
    key: 'roles',
    label: 'Roles',
    href: '/roles',
    description: 'Role permissions in a matrix grid.',
  },
  {
    key: 'interface-languages',
    label: 'Interface languages',
    href: '/interface-languages',
    description: 'The languages the admin screens can be shown in.',
  },
  {
    key: 'translations',
    label: 'Translations',
    href: '/translations',
    description: 'Every translation in one table, across all languages.',
  },
  {
    key: 'cookie-consent',
    label: 'Cookie consent',
    href: '/cookie-consent',
    description: 'Banner text, colours, preview and the consent log.',
  },
  {
    key: 'tracking-connections',
    label: 'Tracking connections',
    href: '/tracking-connections',
    description: 'Sign in with Facebook, TikTok or Google to pick a pixel, property or container.',
  },
  {
    key: 'ad-settings',
    label: 'Ads settings',
    href: '/globals/ad-settings',
    description: 'Google AdSense, ad placements and the consent that ads wait for.',
  },
  {
    key: 'shop-extra-settings',
    label: 'Shop switches',
    href: '/globals/shop-extra-settings',
    description: 'Switches for shop features such as pre-orders and subscriptions.',
  },
  {
    key: 'template-libraries',
    label: 'Template libraries',
    href: '/settings/template-libraries',
    description: 'Libraries of ready-made templates.',
  },
  {
    key: 'email-designer',
    label: 'Email design',
    href: '/email-designer',
    description: 'Lay out the look of emails: logo, colours, buttons and content blocks.',
  },
  {
    key: 'email-testing',
    label: 'Email testing',
    href: '/email-testing',
    description: 'Check the email connection, send test copies and check the sending domain.',
  },
]
