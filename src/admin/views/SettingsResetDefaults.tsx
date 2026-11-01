'use client'

import React, { useMemo, useState } from 'react'
import type { Field } from '@/engine'
import { useFormSetValues } from '@/admin/context'
import { resetDefaultsFor } from '@/admin/settings/settingsFields'

/**
 * "Reset this section" for a settings section. Puts the config default of each
 * field back into the open form, after a confirm. Nothing is saved: the
 * section's own Save button stores it, so a reset can still be undone by
 * leaving the page.
 */
export const SettingsResetDefaults: React.FC<{ fields: Field[]; sectionTitle: string }> = ({ fields, sectionTitle }) => {
  const setValues = useFormSetValues()
  const defaults = useMemo(() => resetDefaultsFor(fields), [fields])
  const count = Object.keys(defaults).length
  const [confirming, setConfirming] = useState(false)
  if (count === 0) return null

  return (
    <div className="settings-reset" style={{ marginTop: 16 }}>
      {confirming ? (
        <div role="group" aria-label={`Reset ${sectionTitle}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span>
            Put the default values back in {sectionTitle}? {count === 1 ? 'One field' : `${count} fields`} will change. Fields with no default keep their values. Nothing is saved until you press Save.
          </span>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setValues(defaults)
              setConfirming(false)
            }}
          >
            Reset to defaults
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setConfirming(true)}>
          Reset this section
        </button>
      )}
    </div>
  )
}

export default SettingsResetDefaults
