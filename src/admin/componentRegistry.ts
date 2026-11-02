/**
 * Hand-written replacement for the CLI-generated src/app/(engage)/admin/importMap.js
 * - FIELD-level component overrides only.
 *
 * Maps identifier strings (in the format '<module-path>#<ExportName>') to their actual
 * React components. These identifiers are referenced in field configs via their own
 * `admin.components.Field` override string, and resolved here by `FieldRenderer.tsx`
 * (`./fields/FieldRenderer.tsx`) - the ONLY caller of `resolveComponent`.
 *
 * That caller is a CLIENT component (`'use client'`), so this module - and everything
 * it imports - ends up in the browser bundle. It must therefore hold ONLY client-safe
 * field widgets, never a server admin view (Dashboard/TranslationsView/DatabaseView/
 * ABResultsView all read the database directly) or anything else that pulls in real
 * `engine`'s own Node-only internals (pino-pretty, migrations, `node:assert`, ...).
 * That split used to be a single file with everything in it, which - once EditForm.tsx
 * gave FieldRenderer a real path into an actual page's build graph - broke the client
 * bundle outright (`ABResultsView` -> `@/lib/engine` -> real `engine` -> Node-only
 * deps, none of which webpack can put in a browser bundle). See `./adminViewRegistry.ts`
 * for the server-only counterpart (`CUSTOM_ADMIN_VIEWS`, consumed only by the server
 * component `./views/RootPage.tsx`) - nothing in this file should ever import from it,
 * or from any other admin view/screen component that itself reads the engine.
 */

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

/**
 * Every widget is loaded on first use (next/dynamic keeps server rendering), so the admin shell ships only
 * the field widgets of the screen that is open, not all of them. The lookup below still returns one stable
 * reference per path.
 */
const SlugComponent = dynamic(() => import('@/fields/slug/SlugComponent').then((mod) => mod.SlugComponent))
const OpenVisualEditorButton = dynamic(() => import('@/fields/visualEditor/OpenVisualEditorButton').then((mod) => mod.OpenVisualEditorButton))
const DocumentLockControl = dynamic(() => import('@/fields/locks/DocumentLockControl').then((mod) => mod.DocumentLockControl))
const CustomFieldsPanel = dynamic(() => import('@/fields/customFields/CustomFieldsPanel').then((mod) => mod.CustomFieldsPanel))
const FieldGroupBuilderField = dynamic(() => import('@/features/customFields/admin/FieldGroupBuilderField').then((mod) => mod.FieldGroupBuilderField))
const FieldGroupLocationField = dynamic(() => import('@/features/customFields/admin/FieldGroupLocationField').then((mod) => mod.FieldGroupLocationField))
const BackupPanel = dynamic(() => import('@/features/backups/admin/BackupPanel').then((mod) => mod.BackupPanel))
const SendTestEmailButton = dynamic(() => import('@/features/email/admin/SendTestEmailButton').then((mod) => mod.SendTestEmailButton))
const ParentPicker = dynamic(() => import('@/fields/parentPicker/ParentPicker').then((mod) => mod.ParentPicker))
const OrderNotesPanel = dynamic(() => import('@/features/ecommerce/admin/OrderPanels').then((mod) => mod.OrderNotesPanel))
const OrderRefundsPanel = dynamic(() => import('@/features/ecommerce/admin/OrderPanels').then((mod) => mod.OrderRefundsPanel))
const OrderInvoicePanel = dynamic(() => import('@/features/ecommerce/admin/OrderPanels').then((mod) => mod.OrderInvoicePanel))
const OrderShippingPanel = dynamic(() => import('@/features/ecommerce/admin/OrderPanels').then((mod) => mod.OrderShippingPanel))
const StoreCreditPanel = dynamic(() => import('@/features/ecommerce/admin/StoreCreditPanel').then((mod) => mod.StoreCreditPanel))
const PriceInput = dynamic(() => import('@/features/ecommerce/admin/PriceInput').then((mod) => mod.PriceInput))
const WeightInput = dynamic(() => import('@/features/ecommerce/admin/UnitInput').then((mod) => mod.WeightInput))
const DimensionInput = dynamic(() => import('@/features/ecommerce/admin/UnitInput').then((mod) => mod.DimensionInput))
const GenerateVariationsField = dynamic(() => import('@/features/ecommerce/admin/GenerateVariationsField').then((mod) => mod.GenerateVariationsField))
const CloudflarePurgeOnPublishField = dynamic(() => import('@/admin/components/CloudflarePurgeOnPublishField').then((mod) => mod.CloudflarePurgeOnPublishField))
const ColorPickerField = dynamic(() => import('@/admin/components/ColorPickerField').then((mod) => mod.ColorPickerField))
const DomainPicker = dynamic(() => import('@/features/domains/admin/DomainPicker').then((mod) => mod.DomainPicker))
const DnsChecklist = dynamic(() => import('@/features/domains/admin/DnsChecklist').then((mod) => mod.DnsChecklist))
const UserPermissionOverridesField = dynamic(() => import('@/admin/components/UserPermissionOverridesField').then((mod) => mod.UserPermissionOverridesField))
const FontPickerField = dynamic(() => import('@/admin/components/FontPickerField').then((mod) => mod.FontPickerField))
const FontsManagerField = dynamic(() => import('@/admin/components/FontsManagerField').then((mod) => mod.FontsManagerField))
const MediaFocalPointField = dynamic(() => import('@/features/media/admin/MediaFocalPointField').then((mod) => mod.MediaFocalPointField))
const MediaCropField = dynamic(() => import('@/features/media/admin/MediaCropField').then((mod) => mod.MediaCropField))
const MediaEditPanel = dynamic(() => import('@/features/media/admin/MediaEditPanel').then((mod) => mod.MediaEditPanel))
const BiddersField = dynamic(() => import('@/features/ads/admin/BiddersField').then((mod) => mod.BiddersField))
const SiteFilesField = dynamic(() => import('@/features/seo/admin/SiteFilesField').then((mod) => mod.SiteFilesField))
const TicketTiersField = dynamic(() => import('@/features/editScreens/admin/TicketTiersField').then((mod) => mod.TicketTiersField))
const ExportTemplateLink = dynamic(() => import('@/features/siteTemplates/admin/ExportTemplateLink').then((mod) => mod.ExportTemplateLink))
const TrackingEventsListActions = dynamic(() => import('@/features/tracking/editor/TrackingEventsListActions').then((mod) => mod.TrackingEventsListActions))
const ConditionsField = dynamic(() => import('@/features/siteTemplates/admin/ConditionsField').then((mod) => mod.ConditionsField))
const TestConnectionField = dynamic(() => import('@/features/socialFeeds/admin/TestConnectionField').then((mod) => mod.TestConnectionField))
const DataViewEditorField = dynamic(() => import('@/features/dataViews/admin/DataViewEditorField').then((mod) => mod.DataViewEditorField))
const WriteWithAiPanel = dynamic(() => import('@/features/blogBuilder/admin/WriteWithAiPanel').then((mod) => mod.WriteWithAiPanel))

export const COMPONENT_REGISTRY: Record<string, ComponentType<any>> = {
  '@/features/blogBuilder/admin/WriteWithAiPanel#WriteWithAiPanel': WriteWithAiPanel,
  '@/features/siteTemplates/admin/ExportTemplateLink#ExportTemplateLink': ExportTemplateLink,
  '@/features/tracking/editor/TrackingEventsListActions#TrackingEventsListActions': TrackingEventsListActions,
  '@/features/siteTemplates/admin/ConditionsField#ConditionsField': ConditionsField,
  '@/features/socialFeeds/admin/TestConnectionField#TestConnectionField': TestConnectionField,
  '@/fields/slug/SlugComponent#SlugComponent': SlugComponent,
  '@/fields/visualEditor/OpenVisualEditorButton#OpenVisualEditorButton': OpenVisualEditorButton,
  '@/fields/locks/DocumentLockControl#DocumentLockControl': DocumentLockControl,
  '@/fields/customFields/CustomFieldsPanel#CustomFieldsPanel': CustomFieldsPanel,
  '@/features/customFields/admin/FieldGroupBuilderField#FieldGroupBuilderField': FieldGroupBuilderField,
  '@/features/customFields/admin/FieldGroupLocationField#FieldGroupLocationField': FieldGroupLocationField,
  '@/features/backups/admin/BackupPanel#BackupPanel': BackupPanel,
  '@/features/email/admin/SendTestEmailButton#SendTestEmailButton': SendTestEmailButton,
  '@/features/ecommerce/admin/PriceInput#PriceInput': PriceInput,
  '@/features/ecommerce/admin/UnitInput#WeightInput': WeightInput,
  '@/features/ecommerce/admin/UnitInput#DimensionInput': DimensionInput,
  '@/features/ecommerce/admin/GenerateVariationsField#GenerateVariationsField': GenerateVariationsField,
  '@/features/domains/admin/DomainPicker#DomainPicker': DomainPicker,
  '@/features/domains/admin/DnsChecklist#DnsChecklist': DnsChecklist,
  '@/features/ecommerce/admin/StoreCreditPanel#StoreCreditPanel': StoreCreditPanel,
  '@/features/ecommerce/admin/OrderPanels#OrderNotesPanel': OrderNotesPanel,
  '@/features/ecommerce/admin/OrderPanels#OrderRefundsPanel': OrderRefundsPanel,
  '@/features/ecommerce/admin/OrderPanels#OrderInvoicePanel': OrderInvoicePanel,
  '@/features/ecommerce/admin/OrderPanels#OrderShippingPanel': OrderShippingPanel,
  '@/fields/parentPicker/ParentPicker#ParentPicker': ParentPicker,
  '@/admin/components/CloudflarePurgeOnPublishField#CloudflarePurgeOnPublishField': CloudflarePurgeOnPublishField,
  '@/admin/components/ColorPickerField#ColorPickerField': ColorPickerField,
  '@/admin/components/UserPermissionOverridesField#UserPermissionOverridesField': UserPermissionOverridesField,
  '@/admin/components/FontPickerField#FontPickerField': FontPickerField,
  '@/admin/components/FontsManagerField#FontsManagerField': FontsManagerField,
  '@/features/media/admin/MediaFocalPointField#MediaFocalPointField': MediaFocalPointField,
  '@/features/media/admin/MediaCropField#MediaCropField': MediaCropField,
  '@/features/media/admin/MediaEditPanel#MediaEditPanel': MediaEditPanel,
  '@/features/seo/admin/SiteFilesField#SiteFilesField': SiteFilesField,
  '@/features/ads/admin/BiddersField#BiddersField': BiddersField,
  '@/features/editScreens/admin/TicketTiersField#TicketTiersField': TicketTiersField,
  '@/features/dataViews/admin/DataViewEditorField#DataViewEditorField': DataViewEditorField,
}

export function resolveComponent(path: string | undefined | null): ComponentType<any> | undefined {
  if (!path) return undefined
  return COMPONENT_REGISTRY[path]
}