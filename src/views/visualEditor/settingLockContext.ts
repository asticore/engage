import { createContext, useContext } from 'react'

import type { LockUser } from '@/features/roles/locks'
import type { SettingLock } from '@/features/roles/settingLocks'

/** The setting locks and the signed-in person, shared with every panel of the visual editor. */
export type SettingLockState = { locks: SettingLock[]; user: LockUser; templateId?: string }

export const SettingLockCtx = createContext<SettingLockState>({ locks: [], user: null })
export const useSettingLocks = (): SettingLockState => useContext(SettingLockCtx)
