/**
 * Server-only admin component registry: whole-screen views and the sidebar
 * nav/chrome components `engage.config.ts`'s `admin.components.*` originally
 * pointed the reference engine's generated importMap at.
 *
 * Deliberately separate from `./componentRegistry.ts` (field-level overrides
 * only) - see that file's own header for why: everything imported here
 * (directly or transitively) is free to touch the real engine/database,
 * because the ONLY consumer of this module is `./views/RootPage.tsx`, a
 * server component. Nothing in this file may be imported from a `'use
 * client'` file (`FieldRenderer.tsx` and everything under it).
 */

import { createElement, type ComponentType } from 'react'
import type { AdminViewServerProps } from '@/engine'
import { AdminNav } from '@/components/admin/nav/AdminNav'
import { ExtensionDomSafetyProvider } from '@/components/admin/ExtensionDomSafety'
import { AsticoreIcon } from '@/components/branding/AsticoreIcon'
import { AsticoreLogo } from '@/components/branding/AsticoreLogo'
import { SETTINGS_PAGE_VIEWS } from '@/admin/views/SettingsPageView'

/**
 * Each screen is loaded when its route is opened, so the admin page's first-load JavaScript holds the
 * client code of the open screen only, not of every screen. The wrapper is a server component, so a
 * view renders exactly as before.
 */
function lazyView(load: () => Promise<unknown>): ComponentType<AdminViewServerProps> {
  const LazyView = async (props: AdminViewServerProps) => {
    const View = (await load()) as ComponentType<AdminViewServerProps>
    return createElement(View, props)
  }
  return LazyView as unknown as ComponentType<AdminViewServerProps>
}

const Dashboard = lazyView(() => import('@/views/dashboard/Dashboard').then((mod) => mod.Dashboard))
const SettingsHubView = lazyView(() => import('@/admin/views/SettingsHubView').then((mod) => mod.SettingsHubView))
const HeaderFooterView = lazyView(() => import('@/admin/views/HeaderFooterView').then((mod) => mod.HeaderFooterView))
const TranslationsView = lazyView(() => import('@/features/multilingual/views/TranslationsView').then((mod) => mod.TranslationsView))
const DatabaseView = lazyView(() => import('@/features/cleanup/DatabaseView').then((mod) => mod.DatabaseView))
const UnusedTablesView = lazyView(() => import('@/features/cleanup/UnusedTablesView').then((mod) => mod.UnusedTablesView))
const ABResultsView = lazyView(() => import('@/features/abTesting/components/ABResultsView').then((mod) => mod.ABResultsView))
const VisualEditorView = lazyView(() => import('@/views/VisualEditor').then((mod) => mod.VisualEditorView))
const RolesView = lazyView(() => import('@/admin/views/RolesView').then((mod) => mod.RolesView))
const SettingsTransferView = lazyView(() => import('@/admin/views/SettingsTransferView').then((mod) => mod.SettingsTransferView))
const InterfaceLanguagesView = lazyView(() => import('@/admin/views/InterfaceLanguagesView').then((mod) => mod.InterfaceLanguagesView))
const FindReplaceView = lazyView(() => import('@/admin/views/FindReplaceView').then((mod) => mod.FindReplaceView))
const SeoAuditView = lazyView(() => import('@/admin/views/SeoAuditView').then((mod) => mod.SeoAuditView))
const ImportContentView = lazyView(() => import('@/admin/views/ImportContentView').then((mod) => mod.ImportContentView))
const SiteHealthView = lazyView(() => import('@/admin/views/SiteHealthView').then((mod) => mod.SiteHealthView))
const ScheduledTasksView = lazyView(() => import('@/admin/views/ScheduledTasksView').then((mod) => mod.ScheduledTasksView))
const CacheToolsView = lazyView(() => import('@/admin/views/CacheToolsView').then((mod) => mod.CacheToolsView))
const GoogleConnectionView = lazyView(() => import('@/admin/views/GoogleConnectionView').then((mod) => mod.GoogleConnectionView))
const ThemeStylesView = lazyView(() => import('@/admin/views/ThemeStylesView').then((mod) => mod.ThemeStylesView))
const EmailTestingView = lazyView(() => import('@/admin/views/EmailTestingView').then((mod) => mod.EmailTestingView))
const EmailSuppressionsView = lazyView(() => import('@/admin/views/EmailSuppressionsView').then((mod) => mod.EmailSuppressionsView))
const CategoriesView = lazyView(() => import('@/admin/views/CategoriesView').then((mod) => mod.CategoriesView))
const EmailDesignerView = lazyView(() => import('@/admin/views/EmailDesignerView').then((mod) => mod.EmailDesignerView))
const CookieConsentView = lazyView(() => import('@/admin/views/CookieConsentView').then((mod) => mod.CookieConsentView))
const ShopSettingsView = lazyView(() => import('@/admin/views/ShopSettingsView').then((mod) => mod.ShopSettingsView))
const StoreCreditView = lazyView(() => import('@/admin/views/StoreCreditView').then((mod) => mod.StoreCreditView))
const ShopReportsView = lazyView(() => import('@/admin/views/ShopReportsView').then((mod) => mod.ShopReportsView))
const PriceTiersView = lazyView(() => import('@/admin/views/PriceTiersView').then((mod) => mod.PriceTiersView))
const DisplayCurrenciesView = lazyView(() => import('@/admin/views/DisplayCurrenciesView').then((mod) => mod.DisplayCurrenciesView))
const AdsOverviewView = lazyView(() => import('@/features/ads/admin/AdsViews').then((mod) => mod.AdsOverviewView))
const AdsReportView = lazyView(() => import('@/features/ads/admin/AdsViews').then((mod) => mod.AdsReportView))
const OptionsView = lazyView(() => import('@/features/customFields/admin/OptionsView').then((mod) => mod.OptionsView))
const TwoFactorView = lazyView(() => import('@/admin/views/TwoFactorView').then((mod) => mod.TwoFactorView))
const SessionsView = lazyView(() => import('@/admin/views/SessionsView').then((mod) => mod.SessionsView))
const PasskeysView = lazyView(() => import('@/admin/views/PasskeysView').then((mod) => mod.PasskeysView))
const ApiKeysView = lazyView(() => import('@/admin/views/ApiKeysView').then((mod) => mod.ApiKeysView))
const ApiBuilderView = lazyView(() => import('@/admin/views/ApiBuilderView').then((mod) => mod.ApiBuilderView))
const WebhooksView = lazyView(() => import('@/admin/views/WebhooksView').then((mod) => mod.WebhooksView))
const ExternalEmbedsView = lazyView(() => import('@/admin/views/ExternalEmbedsView').then((mod) => mod.ExternalEmbedsView))
const PrivacyView = lazyView(() => import('@/admin/views/PrivacyView').then((mod) => mod.PrivacyView))
const ImpersonationView = lazyView(() => import('@/admin/views/ImpersonationView').then((mod) => mod.ImpersonationView))
const OrganizationsView = lazyView(() => import('@/admin/views/OrganizationsView').then((mod) => mod.OrganizationsView))
const PasswordGroupsView = lazyView(() => import('@/admin/views/PasswordGroupsView').then((mod) => mod.PasswordGroupsView))
const SecurityAuditView = lazyView(() => import('@/admin/views/SecurityAuditView').then((mod) => mod.SecurityAuditView))
const SocialView = lazyView(() => import('@/admin/views/SocialView').then((mod) => mod.SocialView))
const TemplatesHubView = lazyView(() => import('@/admin/views/TemplatesHubView').then((mod) => mod.TemplatesHubView))
const MyPreferencesView = lazyView(() => import('@/admin/views/MyPreferencesView').then((mod) => mod.MyPreferencesView))
const TemplateLibrariesView = lazyView(() => import('@/admin/views/TemplateLibrariesView').then((mod) => mod.TemplateLibrariesView))
const GoogleDashboardView = lazyView(() => import('@/features/google/dashboard/GoogleDashboardView').then((mod) => mod.GoogleDashboardView))
const TrackingConnectionsView = lazyView(() => import('./views/TrackingConnectionsView').then((mod) => mod.TrackingConnectionsView))

// Kept for parity with what `engage.config.ts`'s `admin.components` block
// still declares (Nav/providers/graphics overrides) even though nothing yet
// resolves them dynamically - AdminNav is used directly by RootLayout.tsx,
// not looked up by string, and Icon/Logo/providers have no runtime consumer
// of their own yet (a real gap, tracked in the plan doc, not something this
// registry split changes).
export { AdminNav, ExtensionDomSafetyProvider, AsticoreIcon, AsticoreLogo }

export const CUSTOM_ADMIN_VIEWS = [
  ...SETTINGS_PAGE_VIEWS,
  {
    key: 'settingsHub',
    Component: SettingsHubView,
    path: '/settings',
    meta: { title: 'Settings', description: 'Every settings screen in one place, with search.' },
  },
  {
    key: 'templates',
    Component: TemplatesHubView,
    path: '/templates',
    meta: { title: 'Templates', description: 'Site templates, page templates and reusable sections in one list.' },
  },
  {
    key: 'myPreferences',
    Component: MyPreferencesView,
    path: '/settings/my-preferences',
    meta: { title: 'My preferences', description: 'Your own interface language, theme and admin tour.' },
  },
  {
    key: 'templateLibraries',
    Component: TemplateLibrariesView,
    path: '/settings/template-libraries',
    meta: { title: 'Template libraries', description: 'Libraries of ready-made templates.' },
  },
  {
    key: 'dashboard',
    Component: Dashboard,
    path: '/',
  },
  {
    key: 'headerFooter',
    Component: HeaderFooterView,
    path: '/header-footer',
    meta: {
      title: 'Header and footer',
      description: 'Manage site header and footer content.',
    },
  },
  {
    key: 'interfaceLanguages',
    Component: InterfaceLanguagesView,
    path: '/interface-languages',
    meta: {
      title: 'Interface languages',
      description: 'Every admin string in every supported language, with gaps highlighted.',
    },
  },
  {
    key: 'translations',
    Component: TranslationsView,
    path: '/translations',
    meta: {
      title: 'Translations',
      description: 'Write every translation in one table.',
    },
  },
  {
    key: 'options',
    Component: OptionsView,
    path: '/options',
    meta: {
      title: 'Options pages',
      description: 'Site-wide custom field values.',
    },
  },
  {
    key: 'database',
    Component: DatabaseView,
    path: '/database',
    meta: {
      title: 'Database',
      description: 'Per-feature table usage and cleanup.',
    },
  },
  {
    key: 'unusedTables',
    Component: UnusedTablesView,
    path: '/unused-tables',
    meta: {
      title: 'Unused tables',
      description: 'Tables of sections that are switched off, with export and delete.',
    },
  },
  {
    key: 'abTestResults',
    Component: ABResultsView,
    path: '/ab-test-results',
    meta: {
      title: 'A/B test results',
      description: 'Per-variant visitors, conversions and confidence.',
    },
  },
  {
    key: 'visualEditor',
    Component: VisualEditorView,
    path: '/visual-editor/:mode/:slug/:id?',
    meta: {
      title: 'Visual Editor',
      description: 'Edit a page layout visually.',
    },
  },
  {
    key: 'roles',
    Component: RolesView,
    path: '/roles',
    meta: {
      title: 'Roles',
      description: 'Manage role permissions with a matrix grid.',
    },
  },
  {
    key: 'cookieConsent',
    Component: CookieConsentView,
    path: '/cookie-consent',
    meta: {
      title: 'Cookie consent',
      description: 'Customise the cookie banner, preview it and see the consent log.',
    },
  },
  {
    key: 'storeCredit',
    Component: StoreCreditView,
    path: '/store-credit',
    meta: { title: 'Store credit', description: 'Add or deduct store credit with a reason.' },
  },
  { key: 'shopReports', Component: ShopReportsView, path: '/shop-reports', meta: { title: 'Shop reports', description: 'Sales, refunds, customers, products, coupons, payments, locations, low stock and abandoned carts.' } },
  { key: 'displayCurrencies', Component: DisplayCurrenciesView, path: '/display-currencies', meta: { title: 'Display currencies', description: 'Show prices in other currencies. Shoppers always pay in the shop currency.' } },
  { key: 'priceTiers', Component: PriceTiersView, path: '/price-tiers', meta: { title: 'Price tiers', description: 'Wholesale prices and quantity breaks. Shoppers always pay in the shop currency.' } },
  {
    key: 'shopSettings',
    Component: ShopSettingsView,
    path: '/shop-settings',
    meta: { title: 'Shop settings', description: 'Currency and units, payments, shipping, invoices, gift cards, checkout and emails.' },
  },
  { key: 'adsOverview', Component: AdsOverviewView, path: '/ads-overview', meta: { title: 'Ads overview', description: 'Status, placeholders and generated ads.txt lines.' } },
  { key: 'adsReport', Component: AdsReportView, path: '/ads-report', meta: { title: 'Ads report', description: 'Viewable impressions per ad unit.' } },
  { key: 'googleDashboard', Component: GoogleDashboardView, path: '/google-dashboard', meta: { title: 'Google dashboard', description: 'Search, visitors, PageSpeed and AdSense numbers from Google.' } },
  {
    key: 'settingsTransfer',
    Component: SettingsTransferView,
    path: '/settings-transfer',
    meta: {
      title: 'Export and import',
      description: 'Export settings, content and users, or import them from another site.',
    },
  },
  {
    key: 'findReplace',
    Component: FindReplaceView,
    path: '/find-replace',
    meta: {
      title: 'Find and replace',
      description: 'Change a word or phrase across pages, posts, products and events.',
    },
  },
  {
    key: 'googleConnection',
    Component: GoogleConnectionView,
    path: '/google-connection',
    meta: { title: 'Google connection', description: 'Connect Google Analytics, Search Console, Tag Manager and AdSense with your own Google Cloud client.' },
  },
  {
    key: 'trackingConnections',
    Component: TrackingConnectionsView,
    path: '/tracking-connections',
    meta: { title: 'Tracking connections', description: 'Sign in with Google, Facebook or TikTok and pick your pixel or property, so the IDs fill in for you.' },
  },
  {
    key: 'themeStyles',
    Component: ThemeStylesView,
    path: '/theme-styles',
    meta: { title: 'Theming', description: 'Set the site colours, text styles, buttons and tables once and use them everywhere.' },
  },
  {
    key: 'cacheTools',
    Component: CacheToolsView,
    path: '/cache-tools',
    meta: { title: 'Cache tools', description: 'Clear the saved copies of your pages now, and switch Cloudflare development mode on or off.' },
  },
  {
    key: 'seoAudit',
    Component: SeoAuditView,
    path: '/seo-audit',
    meta: { title: 'SEO audit', description: 'Check every published page, post, product and event for SEO and readability problems.' },
  },
  {
    key: 'importContent',
    Component: ImportContentView,
    path: '/import-content',
    meta: { title: 'Import pages and posts', description: 'Bring pages and posts in from a WordPress export or a CSV file. Saved as drafts.' },
  },
  {
    key: 'emailTesting',
    Component: EmailTestingView,
    path: '/email-testing',
    meta: { title: 'Email testing', description: 'Check the email connection, send test emails and check the sending domain.' },
  },
  {
    key: 'categories',
    Component: CategoriesView,
    path: '/categories',
    meta: { title: 'Categories', description: 'Nested categories for the shop and the blog: add, move and reorder.' },
  },
  {
    key: 'emailSuppressions',
    Component: EmailSuppressionsView,
    path: '/email-suppressions',
    meta: { title: 'Email suppression list', description: 'Addresses that get no bulk or reminder email. Search them and remove an address.' },
  },
  {
    key: 'emailDesigner',
    Component: EmailDesignerView,
    path: '/email-designer',
    meta: { title: 'Email designer', description: 'Design the look of automatic emails: logo, colours, buttons and content blocks.' },
  },
  {
    key: 'siteHealth',
    Component: SiteHealthView,
    path: '/site-health',
    meta: { title: 'Site health', description: 'Storage, scheduled job health, versions and the main site settings, with warnings.' },
  },
  {
    key: 'twoFactor',
    Component: TwoFactorView,
    path: '/security/two-factor',
    meta: { title: 'Two-step sign-in', description: 'Set up an authenticator app and backup codes for your account.' },
  },
  {
    key: 'sessions',
    Component: SessionsView,
    path: '/security/sessions',
    meta: { title: 'Signed-in devices', description: 'See where your account is signed in and sign out any device.' },
  },
  {
    key: 'passkeys',
    Component: PasskeysView,
    path: '/security/passkeys',
    meta: { title: 'Passkeys', description: 'Sign in with a passkey on this device, if the site owner allows it.' },
  },
  {
    key: 'apiBuilder',
    Component: ApiBuilderView,
    path: '/api-builder',
    meta: { title: 'API builder', description: 'Build custom endpoints on the site API, choose their fields and keys, try them, and download the developer guide.' },
  },
  {
    key: 'externalEmbeds',
    Component: ExternalEmbedsView,
    path: '/external-embeds',
    meta: { title: 'External embeds', description: 'Forms shown on other websites: turn embedding on, choose the websites allowed, and copy the snippet.' },
  },
  {
    key: 'webhooks',
    Component: WebhooksView,
    path: '/webhooks',
    meta: { title: 'Webhooks', description: 'Send signed webhooks to other systems when content, orders, forms or accounts change, and check every delivery.' },
  },
  {
    key: 'privacy',
    Component: PrivacyView,
    path: '/privacy',
    meta: { title: 'Privacy requests', description: 'Customer requests to delete their data, with their 30-day deadlines. Approve or reject them, and erase the data.' },
  },
  {
    key: 'apiKeys',
    Component: ApiKeysView,
    path: '/security/api-keys',
    meta: { title: 'API keys', description: 'Create and revoke keys for scripts that call the site API. Admins see every key.' },
  },
  {
    key: 'impersonation',
    Component: ImpersonationView,
    path: '/security/impersonation',
    meta: { title: 'Sign in as customer', description: 'Admins: open a customer account for a short time, with a reason. The history of every session.' },
  },
  {
    key: 'organizations',
    Component: OrganizationsView,
    path: '/security/organizations',
    meta: { title: 'Organizations', description: 'Every customer organization with its member count. Administrators can delete one.' },
  },
  {
    key: 'passwordGroups',
    Component: PasswordGroupsView,
    path: '/security/password-groups',
    meta: { title: 'Password groups', description: 'Shared passwords that protect many pages, posts, products and events. Create, rotate, delete and see what each one protects.' },
  },
  {
    key: 'securityAudit',
    Component: SecurityAuditView,
    path: '/security/audit',
    meta: { title: 'Security audit', description: 'Every sign-in, failed attempt, lockout, password, two-step, passkey, API key, connected account and impersonation event. Administrators only.' },
  },
  {
    key: 'socialAccounts',
    Component: SocialView,
    path: '/security/social',
    meta: { title: 'Connected accounts', description: 'Connect or disconnect sign-in providers on your account.' },
  },
  {
    key: 'scheduledTasks',
    Component: ScheduledTasksView,
    path: '/scheduled-tasks',
    meta: { title: 'Scheduled tasks', description: 'Every timed job, its last result and the changes waiting to go live.' },
  },
] as const
