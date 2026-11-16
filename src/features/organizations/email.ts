import type { SendEmailResult } from '@/features/email'

import type { InviteMail, TransferMail } from './service'

/**
 * The invitation email. Wording comes from the `organizationInvite` template
 * (src/features/email/templateDefaults.ts); a template tag the sender does not
 * fill is removed. The Email feature reaches for the engine, so it is imported
 * at call time, like the account emails (src/features/accounts/emails.ts).
 */
const escapeHtml = (value: string): string => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] as string)

export const sendOrganizationInviteEmail = async (mail: InviteMail): Promise<SendEmailResult> => {
  const { renderEmailTemplate } = await import('@/features/email/templateLoad')
  const days = Math.max(1, Math.round((Date.parse(mail.expiresAt) - Date.now()) / 86_400_000))
  const rendered = await renderEmailTemplate('organizationInvite', {
    organization: mail.organizationName,
    inviter: mail.inviterEmail,
    role: mail.role,
    days: String(days),
    link: mail.link,
  })
  const { sendEmail } = await import('@/features/email')
  return sendEmail({
    to: mail.to,
    template: 'organization.invite',
    subject: rendered.subject,
    text: rendered.text,
    html: `${rendered.html}\n<p><a href="${escapeHtml(mail.link)}">View the invitation</a></p>`,
  })
}

/** The ownership transfer confirmation. Plain wording kept in code: the link is the only thing that matters and it is single use. */
export const sendOrganizationTransferEmail = async (mail: TransferMail): Promise<SendEmailResult> => {
  const days = Math.max(1, Math.round((Date.parse(mail.expiresAt) - Date.now()) / 86_400_000))
  const text = `${mail.fromEmail} wants to make you the owner of ${mail.organizationName}.\n\nOpen this link while signed in to accept or decline. It works for ${days} days and once only:\n${mail.link}\n\nIf you did not expect this, ignore the email and nothing changes.`
  const { sendEmail } = await import('@/features/email')
  return sendEmail({
    to: mail.to,
    template: 'organization.transfer',
    subject: `Confirm ownership of ${mail.organizationName}`,
    text,
    html: `<p>${escapeHtml(mail.fromEmail)} wants to make you the owner of <strong>${escapeHtml(mail.organizationName)}</strong>.</p><p><a href="${escapeHtml(mail.link)}">Review the ownership transfer</a></p><p>The link works for ${days} days and once only. If you did not expect this, ignore this email and nothing changes.</p>`,
  })
}
