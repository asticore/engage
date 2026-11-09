import { describe, expect, it } from 'vitest'

import { buildFeedbackUrl, FEEDBACK_REPO_URL } from '@/admin/ui/feedbackUrl'

describe('buildFeedbackUrl', () => {
  it('opens the engage new issue page with version and page', () => {
    const url = new URL(buildFeedbackUrl({ kind: 'bug', version: '1.2.3', path: '/admin/pages', language: 'en' }))
    expect(`${url.origin}${url.pathname}`).toBe(`${FEEDBACK_REPO_URL}/issues/new`)
    const body = url.searchParams.get('body') ?? ''
    expect(body).toContain('Portal version: 1.2.3')
    expect(body).toContain('Admin page: /admin/pages')
    expect(body).toContain('Admin language: en')
    expect(url.searchParams.get('template')).toBe('bug_report.md')
    expect(url.searchParams.get('labels')).toBe('bug')
  })

  it('uses the feature request template and label for a feature request', () => {
    const url = new URL(buildFeedbackUrl({ kind: 'feature', version: '1.2.3', path: '/admin' }))
    expect(url.searchParams.get('template')).toBe('feature_request.md')
    expect(url.searchParams.get('labels')).toBe('enhancement')
    expect(url.searchParams.get('body')).not.toContain('Admin language')
  })
})
