/** Where super admin feedback goes: the new issue page of the engage repository. */
export const FEEDBACK_REPO_URL = 'https://github.com/asticore/engage'

/** New issue link pre-filled with the portal version and the admin page the person was on. */
export const buildFeedbackUrl = (input: { version: string; path: string; language?: string }): string => {
  const body = [
    '**What happened or what would help?**',
    '',
    '',
    '---',
    `Portal version: ${input.version}`,
    `Admin page: ${input.path}`,
    ...(input.language ? [`Admin language: ${input.language}`] : []),
  ].join('\n')
  const params = new URLSearchParams({ title: '', body })
  return `${FEEDBACK_REPO_URL}/issues/new?${params.toString()}`
}
