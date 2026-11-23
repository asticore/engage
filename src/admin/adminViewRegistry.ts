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
const ReferencesView = lazyView(() => import('@/features/references/ReferencesView').then((mod) => mod.ReferencesView))
const UnusedTablesView = lazyView(() => import('@/features/cleanup/UnusedTablesView').then((mod) => mod.UnusedTablesView))
const ABResultsView = lazyView(() => import('@/features/abTesting/components/ABResultsView').then((mod) => mod.ABResultsView))
const VisualEditorView = lazyView(() => import('@/admin/ui/NoSsrVisualEditor').then((mod) => mod.NoSsrVisualEditor))
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
const OutboundClicksView = lazyView(() => import('@/admin/views/OutboundClicksView').then((mod) => mod.OutboundClicksView))
const ShopReportsView = lazyView(() => import('@/admin/views/ShopReportsView').then((mod) => mod.ShopReportsView))
const NotificationsView = lazyView(() => import('@/admin/views/NotificationsView').then((mod) => mod.NotificationsView))
const TaskboardView = lazyView(() => import('@/admin/views/TaskboardView').then((mod) => mod.TaskboardView))
const MyTasksView = lazyView(() => import('@/admin/views/MyTasksView').then((mod) => mod.MyTasksView))
const BulkCreateView = lazyView(() => import('@/admin/views/BulkCreateView').then((mod) => mod.BulkCreateView))
const BookingsView = lazyView(() => import('@/admin/views/BookingsView').then((mod) => mod.BookingsView))
const QuotesView = lazyView(() => import('@/admin/views/QuotesView').then((mod) => mod.QuotesView))
const PurchaseLimitsView = lazyView(() => import('@/admin/views/PurchaseLimitsView').then((mod) => mod.PurchaseLimitsView))
const AuthenticationView = lazyView(() => import('@/admin/views/AuthenticationView').then((mod) => mod.AuthenticationView))
const RateRulesView = lazyView(() => import('@/admin/views/RateRulesView').then((mod) => mod.RateRulesView))
const IpRulesView = lazyView(() => import('@/admin/views/IpRulesView').then((mod) => mod.IpRulesView))
const MapsWeatherView = lazyView(() => import('@/admin/views/MapsWeatherView').then((mod) => mod.MapsWeatherView))
const FrontendAssetsView = lazyView(() => import('@/admin/views/FrontendAssetsView').then((mod) => mod.FrontendAssetsView))
const CspBuilderView = lazyView(() => import('@/admin/views/CspBuilderView').then((mod) => mod.CspBuilderView))
const UserBansView = lazyView(() => import('@/admin/views/UserBansView').then((mod) => mod.UserBansView))
const WholesaleView = lazyView(() => import('@/admin/views/WholesaleView').then((mod) => mod.WholesaleView))
const AffiliatesView = lazyView(() => import('@/admin/views/AffiliatesView').then((mod) => mod.AffiliatesView))
const SsoView = lazyView(() => import('@/admin/views/SsoView').then((mod) => mod.SsoView))
const AgentAccessView = lazyView(() => import('@/admin/views/AgentAccessView').then((mod) => mod.AgentAccessView))
const LiveChatView = lazyView(() => import('@/admin/views/LiveChatView').then((mod) => mod.LiveChatView))
const ChatbotView = lazyView(() => import('@/admin/views/ChatbotView').then((mod) => mod.ChatbotView))
const DemosView = lazyView(() => import('@/admin/views/DemosView').then((mod) => mod.DemosView))
const ClientReportsView = lazyView(() => import('@/admin/views/ClientReportsView').then((mod) => mod.ClientReportsView))
const FranchisingView = lazyView(() => import('@/admin/views/FranchisingView').then((mod) => mod.FranchisingView))
const CommentsView = lazyView(() => import('@/admin/views/CommentsView').then((mod) => mod.CommentsView))
const SitePlannerView = lazyView(() => import('@/admin/views/SitePlannerView').then((mod) => mod.SitePlannerView))
const MediaTagsView = lazyView(() => import('@/admin/views/MediaTagsView').then((mod) => mod.MediaTagsView))
const MediaSearchView = lazyView(() => import('@/admin/views/MediaSearchView').then((mod) => mod.MediaSearchView))
const AssetManagerView = lazyView(() => import('@/admin/views/AssetManagerView').then((mod) => mod.AssetManagerView))
const PastDueMembersView = lazyView(() => import('@/admin/views/PastDueMembersView').then((mod) => mod.PastDueMembersView))
const PricingPreviewView = lazyView(() => import('@/admin/views/PricingPreviewView').then((mod) => mod.PricingPreviewView))
const ProductFeedsView = lazyView(() => import('@/admin/views/ProductFeedsView').then((mod) => mod.ProductFeedsView))
const SettingLocksView = lazyView(() => import('@/admin/views/SettingLocksView').then((mod) => mod.SettingLocksView))
const PriceTiersView = lazyView(() => import('@/admin/views/PriceTiersView').then((mod) => mod.PriceTiersView))
const DisplayCurrenciesView = lazyView(() => import('@/admin/views/DisplayCurrenciesView').then((mod) => mod.DisplayCurrenciesView))
const AdsOverviewView = lazyView(() => import('@/features/ads/admin/AdsViews').then((mod) => mod.AdsOverviewView))
const AdsReportView = lazyView(() => import('@/features/ads/admin/AdsViews').then((mod) => mod.AdsReportView))
const OptionsView = lazyView(() => import('@/features/customFields/admin/OptionsView').then((mod) => mod.OptionsView))
const TwoFactorView = lazyView(() => import('@/admin/views/TwoFactorView').then((mod) => mod.TwoFactorView))
const ConfirmIdentityView = lazyView(() => import('@/admin/views/ConfirmIdentityView').then((mod) => mod.ConfirmIdentityView))
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
const ActivityLogView = lazyView(() => import('@/admin/views/ActivityLogView').then((mod) => mod.ActivityLogView))
const SecurityAuditView = lazyView(() => import('@/admin/views/SecurityAuditView').then((mod) => mod.SecurityAuditView))
const SocialView = lazyView(() => import('@/admin/views/SocialView').then((mod) => mod.SocialView))
const SignInProvidersView = lazyView(() => import('@/admin/views/SignInProvidersView').then((mod) => mod.SignInProvidersView))
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
    key: 'references',
    Component: ReferencesView,
    path: '/references',
    meta: { title: 'Reference sources', description: 'The shared sources Engage follows (Shine, Spark), their pinned versions and whether a newer one exists.' },
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
  { key: 'outboundClicks', Component: OutboundClicksView, path: '/outbound-clicks', meta: { title: 'Outbound clicks', description: 'Clicks on external and affiliate product buttons.' } },
  { key: 'shopReports', Component: ShopReportsView, path: '/shop-reports', meta: { title: 'Shop reports', description: 'Sales, refunds, customers, products, coupons, payments, locations, low stock and abandoned carts.' } },
  { key: 'displayCurrencies', Component: DisplayCurrenciesView, path: '/display-currencies', meta: { title: 'Display currencies', description: 'Show prices in other currencies. Shoppers always pay in the shop currency.' } },
  { key: 'notifications', Component: NotificationsView, path: '/notifications', meta: { title: 'Notifications', description: 'Send an email or push when an order is paid, a form is sent, a booking is made and more.' } },
  { key: 'taskboard', Component: TaskboardView, path: '/taskboard', meta: { title: 'Taskboard', description: 'Kanban boards where tasks are given to admin and staff users.' } },
  { key: 'my-tasks', Component: MyTasksView, path: '/my-tasks', meta: { title: 'My tasks', description: 'Open tasks given to you on every taskboard you can open.' } },
  { key: 'settingLocks', Component: SettingLocksView, path: '/design-locks', meta: { title: 'Design locks', description: 'Lock design settings in the visual builder and the email builder.' } },
  { key: 'productFeeds', Component: ProductFeedsView, path: '/product-feeds', meta: { title: 'Product feeds', description: 'Feeds for Google, Meta, Pinterest and others, each with a secret address.' } },
  { key: 'bulkCreate', Component: BulkCreateView, path: '/bulk-create', meta: { title: 'Bulk create', description: 'Make many draft pages, posts or products from a list or CSV.' } },
  { key: 'bookings', Component: BookingsView, path: '/bookings', meta: { title: 'Bookings', description: 'Booking types, opening hours and the bookings made.' } },
  { key: 'quotes', Component: QuotesView, path: '/quotes', meta: { title: 'Quotes and requests', description: 'Quote, offer and item requests, and the quotes sent back.' } },
  { key: 'purchase-limits', Component: PurchaseLimitsView, path: '/purchase-limits', meta: { title: 'Purchase limits', description: 'Per-person limits, waits between orders and refused attempts.' } },
  { key: 'authentication', Component: AuthenticationView, path: '/authentication', meta: { title: 'Authentication', description: 'Every sign-in method with its status and a link to change it.' } },
  { key: 'rate-rules', Component: RateRulesView, path: '/security/rate-rules', meta: { title: 'Rate limit rules', description: 'Limit requests per address to a path.' } },
  { key: 'ip-rules', Component: IpRulesView, path: '/security/ip-lists', meta: { title: 'IP lists', description: 'Block or allow addresses and ranges.' } },
  { key: 'frontend-files', Component: FrontendAssetsView, path: '/frontend-files', meta: { title: 'Front-end files', description: 'Add Bootstrap, Tailwind, Font Awesome or other CSS and JavaScript files to the public site and portal.' } },
  { key: 'maps-weather', Component: MapsWeatherView, path: '/maps-weather', meta: { title: 'Maps and weather', description: 'Pick the map and weather providers, add keys and test them.' } },
  { key: 'csp-builder', Component: CspBuilderView, path: '/security/csp', meta: { title: 'Content-Security-Policy builder', description: 'Pick allowed sources per directive, test in report-only mode, and allow reported hosts.' } },
  { key: 'user-bans', Component: UserBansView, path: '/security/bans', meta: { title: 'Banned accounts', description: 'Ban and unban accounts.' } },
  { key: 'affiliates', Component: AffiliatesView, path: '/affiliates', meta: { title: 'Affiliates', description: 'Partners with referral links and the visits they bring.' } },
  { key: 'sso', Component: SsoView, path: '/sso', meta: { title: 'Single sign-on', description: 'Per-organisation OpenID Connect sign-in with verified domains.' } },
  { key: 'agent-access', Component: AgentAccessView, path: '/agent-access', meta: { title: 'AI agent access', description: 'Scoped, capped, revocable tokens for connected AI tools, with an activity log.' } },
  { key: 'livechat', Component: LiveChatView, path: '/livechat', meta: { title: 'Live chat', description: 'Reply to visitors in real time and read offline messages.' } },
  { key: 'chatbot', Component: ChatbotView, path: '/chatbot', meta: { title: 'Chatbot', description: 'Set up the site chat assistant and read its conversations.' } },
  { key: 'demos', Component: DemosView, path: '/demos', meta: { title: 'Agency demos', description: 'Save a demo copy, reset it, make view-only accounts and download a package.' } },
  { key: 'client-reports', Component: ClientReportsView, path: '/client-reports', meta: { title: 'Client reports', description: 'Read-only report links and scheduled report emails for clients.' } },
  { key: 'franchising', Component: FranchisingView, path: '/franchising', meta: { title: 'Franchising', description: 'Franchises on their own domain and roll-out of shared page templates.' } },
  { key: 'comments', Component: CommentsView, path: '/comments', meta: { title: 'Comments', description: 'Moderate reader comments on blog posts.' } },
  { key: 'site-planner', Component: SitePlannerView, path: '/site-planner', meta: { title: 'Site planner', description: 'Plan the pages of a whole site with briefs, then create draft pages.' } },
  { key: 'media-tags', Component: MediaTagsView, path: '/media-tags', meta: { title: 'Media tags', description: 'Parent and child tags with colours for media files.' } },
  { key: 'asset-manager', Component: AssetManagerView, path: '/asset-manager', meta: { title: 'Asset manager', description: 'Collections, custom details, licences and rules for media files.' } },
  { key: 'media-search', Component: MediaSearchView, path: '/media-search', meta: { title: 'Media search', description: 'Search media by words, type, folder, tag, collection, size, date, status, licence and custom details.' } },
  { key: 'past-due-members', Component: PastDueMembersView, path: '/past-due-members', meta: { title: 'Past due members', description: 'Members whose renewal payment failed, with retry and end controls.' } },
  { key: 'pricingPreview', Component: PricingPreviewView, path: '/pricing-preview', meta: { title: 'Pricing preview', description: 'What a customer would pay for a cart, using the real checkout calculation.' } },
  { key: 'wholesale', Component: WholesaleView, path: '/wholesale', meta: { title: 'Wholesale', description: 'Approve wholesale applications and tag customers.' } },
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
    key: 'confirmIdentity',
    Component: ConfirmIdentityView,
    path: '/security/confirm',
    meta: { title: 'Confirm it is you', description: 'Enter your password or a code again before adding an administrator.' },
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
    key: 'activityLog',
    Component: ActivityLogView,
    path: '/security/activity',
    meta: { title: 'Activity log', description: 'What people do: sign-ins, edits, publishes, setting changes and exports. Filter by person, event, collection and date; download or clear. Administrators only.' },
  },
  {
    key: 'securityAudit',
    Component: SecurityAuditView,
    path: '/security/audit',
    meta: { title: 'Security audit', description: 'Every sign-in, failed attempt, lockout, password, two-step, passkey, API key, connected account and impersonation event. Administrators only.' },
  },
  {
    key: 'signInProviders',
    Component: SignInProvidersView,
    path: '/security/sign-in-providers',
    meta: { title: 'More sign-in providers', description: 'Set up X, LinkedIn, TikTok, Slack, any OpenID Connect provider and Google One Tap. Administrators only.' },
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
