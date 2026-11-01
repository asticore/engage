import type { GlobalConfig } from '@/engine'

import { adminOnlyFieldAccess, isAdmin } from '../../access/ecommerceAccess'
import { decryptSecretHook, encryptSecretHook } from '../../utilities/secretField'

export const TEMPLATE_LIBRARIES_SLUG = 'template-libraries'
export const TEMPLATE_LIBRARIES_TABLE = 'eg_template_libraries'

/**
 * Settings > Template libraries: the GitHub folders added by address, and the picture records that
 * stop the same picture being saved to the media gallery twice. Written by the settings route only.
 */
export const TemplateLibraries: GlobalConfig = {
  slug: TEMPLATE_LIBRARIES_SLUG,
  dbName: TEMPLATE_LIBRARIES_TABLE,
  label: 'Template libraries',
  admin: {
    group: 'Settings',
    description: 'Libraries of ready-made sections and pages from public GitHub folders. Managed from Settings > Template libraries.',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      label: 'Access token (private libraries only)',
      access: { read: adminOnlyFieldAccess, update: adminOnlyFieldAccess },
      hooks: { beforeChange: [encryptSecretHook], afterRead: [decryptSecretHook] },
      admin: {
        description: 'Fine-grained read-only token from GitHub. Needed only for private libraries. Stored encrypted at rest, visible only to admins.',
      },
    },
    {
      name: 'libraries',
      type: 'array',
      labels: { singular: 'Library', plural: 'Libraries' },
      fields: [
        { name: 'label', type: 'text', admin: { description: 'Shown next to the library. Leave empty to use the repository name.' } },
        { name: 'url', type: 'text', required: true, admin: { description: 'The GitHub address of the library folder.' } },
        { name: 'enabled', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'imports',
      type: 'array',
      admin: { hidden: true },
      fields: [
        { name: 'sha256', type: 'text' },
        { name: 'mediaId', type: 'number' },
        { name: 'sourceUrl', type: 'text' },
      ],
    },
  ],
}
