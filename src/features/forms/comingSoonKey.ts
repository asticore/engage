/**
 * The built-in "Coming soon" form. Its public key is fixed, so the email
 * signup on the coming soon screen posts to the same address on every site
 * (/api/forms/comingsoon/submit) and the entries land in the form's normal
 * submissions, with email forwarding, the data API and webhooks.
 *
 * Kept in its own file with no imports: the Forms collection's create hook
 * reads the key, and that hook loads with the collection config.
 */
export const COMING_SOON_FORM_KEY = 'comingsoon'
export const COMING_SOON_FORM_TITLE = 'Coming soon'
