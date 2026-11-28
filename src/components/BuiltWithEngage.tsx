import React from 'react'

export const ENGAGE_REPO_URL = 'https://github.com/asticore/engage'

/** Small "Built with Engage" credit under the footer. The Footer settings page can switch it off. */
export const BuiltWithEngage: React.FC = () => (
  <p
    className="built-with-engage"
    style={{ margin: 0, padding: '0.75rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', opacity: 0.7 }}
  >
    <a href={ENGAGE_REPO_URL} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
      Built with Engage
    </a>
  </p>
)
