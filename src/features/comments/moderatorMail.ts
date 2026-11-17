/** Email to the admins when a new comment is waiting for moderation (Task 22 leftover). Pure text; sending is best effort. */

export function moderatorMailText(c: { name: string; content: string; postId: number }, adminUrl: string): { subject: string; text: string } {
  const excerpt = c.content.length > 300 ? `${c.content.slice(0, 300)}...` : c.content
  return {
    subject: 'A new comment is waiting for approval',
    text: [`${c.name || 'Someone'} commented on blog post #${c.postId}:`, '', excerpt, '', `Review it here: ${adminUrl}`].join('\n'),
  }
}
