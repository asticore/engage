/** Where super admin feedback goes: the new issue page of the engage repository. */
export const FEEDBACK_REPO_URL = 'https://github.com/asticore/engage'

export type FeedbackKind = 'bug' | 'feature'

/** Issue template file (.github/ISSUE_TEMPLATE) and label per feedback type. */
const KINDS: Record<FeedbackKind, { template: string; label: string; prompt: string }> = {
  bug: {
    template: 'bug_report.md',
    label: 'bug',
    prompt: '**Describe the bug**\nWhat happened, what you expected, and the steps to reproduce it.',
  },
  feature: {
    template: 'feature_request.md',
    label: 'enhancement',
    prompt: '**Describe the feature**\nWhat would help, and what problem it solves.',
  },
}

/** New issue link for the chosen type, pre-filled with the portal version, admin page and language. */
export const buildFeedbackUrl = (input: {
  kind: FeedbackKind
  version: string
  path: string
  language?: string
}): string => {
  const kind = KINDS[input.kind]
  const body = [
    kind.prompt,
    '',
    '',
    '---',
    `Portal version: ${input.version}`,
    `Admin page: ${input.path}`,
    ...(input.language ? [`Admin language: ${input.language}`] : []),
  ].join('\n')
  const params = new URLSearchParams({ template: kind.template, labels: kind.label, title: '', body })
  return `${FEEDBACK_REPO_URL}/issues/new?${params.toString()}`
}
