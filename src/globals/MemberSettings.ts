import type { GlobalConfig } from '@/engine'

import { isAdmin } from '../access/ecommerceAccess'
import { validateSignInPathField } from '../features/security/signInPathValidate'

/**
 * Paid membership behaviour - who can sign up, what non-members see, and how
 * billing is handled.
 *
 * `defaultTier` is a plain text field holding a tier slug rather than a
 * relationship, because the Membership tiers collection does not exist in this
 * project yet. A relationship pointing at a collection the CMS cannot find
 * fails config validation at boot, which would take the whole admin down. Swap
 * this for `{ type: 'relationship', relationTo: 'membership-tiers' }` in the
 * same breath as adding that collection.
 *
 * The teaser mode is the setting people get wrong most often: "blur" looks
 * like protection but the full text is still in the page source and can be
 * read by anyone who looks. Only "hide" actually withholds the content.
 */
export const MemberSettings: GlobalConfig = {
  slug: 'member-settings',
  label: 'Members',
  dbName: 'eg_member_settings',
  admin: {
    group: 'Settings',
    description:
      'How memberships work on your site - signing up, what is locked, and how billing behaves. Tiers and prices are set up separately.',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // The member sign-in URL (src/features/security/signInPath.ts, Task 19l). Column sign_in_path, see
    // src/migrations/20270317_280000_sign_in_paths.ts. Lives here because the Security table is out of columns.
    {
      name: 'signInPath',
      type: 'text',
      label: 'Member sign-in URL',
      validate: validateSignInPathField('member', '__customerNotHere'),
      admin: {
        placeholder: '/account/member-sign-in',
        description:
          'The address of the member sign-in, one segment such as /members-in (lowercase letters, digits and hyphens, 3 to 40 characters). Leave empty to keep /account/member-sign-in. The old address redirects to the new one. It can never be the admin URL, a word the site uses, or the customer sign-in URL (a clash is skipped and the default is used). Recovery: set ENGAGE_MEMBER_SIGN_IN_PATH in Cloudflare, and it overrides this field. The customer sign-in URL is on the Security screen.',
      },
    },
    {
      type: 'group',
      name: 'registration',
      label: 'Registration',
      admin: { description: 'How new members join.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'allowSignup',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                width: '50%',
                description: 'Turn off to make membership invitation-only - existing members keep their access.',
              },
            },
            {
              name: 'blockDisposableEmail',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                width: '50%',
                description: 'Refuse sign-ups from throwaway email services (such as Mailinator or 10 Minute Mail).',
              },
            },
            {
              name: 'blockDisposableCustomers',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '50%', description: 'Also refuse throwaway email services when a customer creates a shop account.' },
            },
            {
              name: 'blockDisposableForms',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '50%', description: 'Also refuse throwaway email services in email fields on forms.' },
            },
            {
              name: 'blockDisposableCheckout',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '50%', description: 'Also refuse throwaway email services at checkout.' },
            },
            {
              name: 'requireEmailVerification',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '50%',
                description:
                  'Make people confirm their address before they get access. Worth keeping on - it is the cheapest way to stop junk sign-ups.',
              },
            },
          ],
        },
        {
          name: 'defaultTier',
          type: 'text',
          admin: {
            description:
              'The tier new members start on, entered as its short name. Leave blank to make people choose during sign-up.',
          },
        },
      ],
    },
    {
      type: 'group',
      name: 'access',
      label: 'Access',
      admin: { description: 'Where members are sent, and what everyone else sees in place of locked content.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'redirectAfterLogin',
              type: 'text',
              defaultValue: '/account',
              admin: { width: '50%', description: 'The page a member lands on straight after signing in.' },
            },
            {
              name: 'membersOnlyRedirect',
              type: 'text',
              defaultValue: '/membership',
              admin: {
                width: '50%',
                description: 'Where a non-member is sent when they try to open something locked. Usually your join page.',
              },
            },
          ],
        },
        {
          name: 'teaserMode',
          type: 'select',
          defaultValue: 'excerpt',
          admin: {
            description:
              'What a non-member sees on a locked page. Hide gives nothing away. Excerpt shows an opening taste, which usually converts best. Blur only looks locked - the full text is still present in the page and can be read by anyone determined enough, so do not use it for anything genuinely private.',
          },
          options: [
            { label: 'Hide the content completely', value: 'full-hide' },
            { label: 'Show a short excerpt', value: 'excerpt' },
            { label: 'Blur the content (appearance only, not secure)', value: 'blur' },
          ],
        },
      ],
    },
    {
      type: 'group',
      name: 'billing',
      label: 'Billing',
      admin: { description: 'Currency and the rules around changing or ending a membership.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'currency',
              type: 'select',
              defaultValue: 'AUD',
              admin: { width: '33%' },
              options: [
                { label: 'Australian dollar (AUD)', value: 'AUD' },
                { label: 'US dollar (USD)', value: 'USD' },
                { label: 'British pound (GBP)', value: 'GBP' },
                { label: 'Euro (EUR)', value: 'EUR' },
                { label: 'New Zealand dollar (NZD)', value: 'NZD' },
              ],
            },
            {
              name: 'allowCancellation',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '33%',
                description:
                  'Let members cancel themselves from their account page. Turning this off means every cancellation becomes a support email.',
              },
            },
            {
              name: 'proration',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '33%',
                description:
                  'When someone switches tier mid-cycle, charge only the difference for the days remaining rather than a full new period.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'dunningRetryDays',
              type: 'text',
              defaultValue: '1,3,5,7',
              admin: {
                width: '33%',
                description: 'After a failed renewal, days after the first failure to retry the card and email the member, such as 1,3,5,7. Blank sends nothing.',
              },
            },
            {
              name: 'dunningGraceDays',
              type: 'number',
              defaultValue: 10,
              min: 0,
              admin: {
                width: '33%',
                description: 'Days from the first failure that the member keeps access while the card is chased. 0 locks content straight away.',
              },
            },
            {
              name: 'dunningEndAction',
              type: 'select',
              defaultValue: 'expire',
              admin: { width: '33%', description: 'What happens when the grace period ends and the payment is still unpaid.' },
              options: [
                { label: 'End the membership', value: 'expire' },
                { label: 'Move to the free tier (the default tier above)', value: 'free-tier' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'group',
      name: 'emails',
      label: 'Emails',
      admin: {
        description:
          'Messages sent to members. Which service actually delivers them is set in Email settings.',
      },
      fields: [
        {
          name: 'welcomeSubject',
          type: 'text',
          defaultValue: 'Welcome aboard',
          admin: { description: 'The subject line of the first email a new member receives.' },
        },
        {
          name: 'welcomeBody',
          type: 'textarea',
          admin: { description: 'The body of that welcome email. Keep it short and tell them where to go next.' },
        },
        {
          name: 'expiryReminderDays',
          type: 'number',
          defaultValue: 7,
          admin: {
            description:
              'How many days before a membership ends to send a reminder. Set to 0 to send no reminder at all.',
          },
        },
      ],
    },
  ],
}
