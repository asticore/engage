import type { AuditEntry } from '@/features/security/auditLog'

import type { Activity } from './store'

/** Taskboard entries show in the main Activity log under the collection name `taskboard`. */
export const TASKBOARD_AUDIT_COLLECTION = 'taskboard'

/** One taskboard activity row as an Activity log entry: created and deleted map to create and delete, everything else to update. */
export function taskboardAuditEntry(row: Pick<Activity, 'action' | 'detail' | 'cardId'> & { boardId: number }, actor: { id: number; email?: string | null }): AuditEntry {
  const action = row.action.endsWith('.created') ? 'create' : row.action.endsWith('.deleted') ? 'delete' : 'update'
  const verb = row.action.replace(/^(card|board)\./, '')
  const kind = row.action.startsWith('board.') ? 'board' : 'task'
  return {
    action,
    actorId: actor.id,
    actorEmail: actor.email ?? null,
    collectionSlug: TASKBOARD_AUDIT_COLLECTION,
    documentId: row.cardId ?? row.boardId,
    detail: `${kind} ${verb}${row.detail ? `: ${row.detail}` : ''} (board ${row.boardId})`,
  }
}
