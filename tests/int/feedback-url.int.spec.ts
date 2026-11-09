import { describe, expect, it } from 'vitest'

import { buildFeedbackUrl, FEEDBACK_REPO_URL } from '@/admin/ui/feedbackUrl'

describe('buildFeedbackUrl', () => {
  it('opens the engage new issue page with version and page', () => {
    const url = new URL(buildFeedbackUrl({ version: '1.2.3', path: '/admin/pages', language: 'en' }))
    expect(`${url.origin}${url.pathname}`).toBe(`${FEEDBACK_REPO_URL}/issues/new`)
    const body = url.searchParams.get('body') ?? ''
    expect(body).toContain('Portal version: 1.2.3')
    expect(body).toContain('Admin page: /admin/pages')
    expect(body).toContain('Admin language: en')
  })
})
