'use client'

import React from 'react'
import { useField } from '@/engine/ui'
import type { Field } from '@/engine'

import { IconPickerField } from '@/admin/fields/IconPickerField'
import { fieldLabel } from '@/admin/fields/shared'

/** The promo badge icon: the built-in icon picker, stored as a plain icon name (blank means text only). */
export function BadgeIconField({ field, path }: { field: Field; path: string }) {
  const { value, setValue } = useField<string | undefined | null>({ path })
  const label = fieldLabel(field)
  const description = (field as { admin?: { description?: string } }).admin?.description
  return <IconPickerField source="builtin" value={value} onChange={(v) => setValue(typeof v === 'string' ? v : null)} label={typeof label === 'string' ? label : field.name} helpText={description} />
}
