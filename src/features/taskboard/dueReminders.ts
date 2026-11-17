import type { Card } from './logic'
import * as store from './store'

export type DueDeps = {
  d1: store.D1
  now: Date
  siteName: () => Promise<string>
  sendEmail: (args: { to: string; subject: string; html: string; text: string; template: string }) => Promise<unknown>
  textToHtml: (text: string) => string
  emit: (event: 'task.due', data: Record<string, unknown>) => Promise<void>
  hasRule: (event: 'task.due') => Promise<boolean>
}

/** The day after `now`, as YYYY-MM-DD (UTC): cards due on or before it are due soon or overdue. */
export const dueSoonCutoff = (now: Date): string => new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

/** The built-in reminder, used only when no notification rule is switched on for "Task due soon". Plain text. */
export function dueReminderEmail(args: { siteName: string; boardName: string; card: Pick<Card, 'title' | 'dueDate'>; overdue: boolean }): { subject: string; text: string } {
  const site = args.siteName || 'the site'
  const lines = [args.overdue ? `A task given to you on ${args.boardName} is overdue.` : `A task given to you on ${args.boardName} is due soon.`, '', `Task: ${args.card.title}`, `Due: ${args.card.dueDate}`, '', `Open the taskboard in the ${site} admin to see it.`]
  return { subject: `${args.overdue ? 'Overdue' : 'Due soon'}: ${args.card.title}`.replace(/[\r\n]+/g, ' '), text: lines.join('\n') }
}

/**
 * Reminds the person each open card is given to, once per due date, when the card is due today or tomorrow or is
 * overdue. Cards in a board's last column (done) and archived cards are skipped. Best effort per card.
 */
export async function runTaskDueReminders(deps: DueDeps): Promise<{ reminded: number }> {
  const today = deps.now.toISOString().slice(0, 10)
  const cards = await store.cardsDueForReminder(deps.d1, dueSoonCutoff(deps.now))
  const ruleOwnsEmail = await deps.hasRule('task.due').catch((): boolean => false)
  let reminded = 0
  for (const card of cards) {
    try {
      const person = card.assigneeId ? await store.getPerson(deps.d1, card.assigneeId) : null
      if (!person?.email || !card.dueDate) {
        // Nobody to tell: mark it so the next run does not look again.
        if (card.dueDate) await store.markDueNotified(deps.d1, card.id, card.dueDate)
        continue
      }
      await deps.emit('task.due', { id: card.id, boardId: card.boardId, title: card.title, assigneeId: card.assigneeId, dueDate: card.dueDate, priority: card.priority, createdAt: deps.now.toISOString(), email: person.email, boardName: card.boardName, person: '' }).catch((): void => undefined)
      if (!ruleOwnsEmail) {
        const mail = dueReminderEmail({ siteName: await deps.siteName(), boardName: card.boardName, card, overdue: card.dueDate < today })
        await deps.sendEmail({ to: person.email, subject: mail.subject, text: mail.text, html: deps.textToHtml(mail.text), template: 'taskboard.due' })
      }
      await store.markDueNotified(deps.d1, card.id, card.dueDate)
      reminded += 1
    } catch {
      // Left unmarked: the next run tries this card again.
    }
  }
  return { reminded }
}
