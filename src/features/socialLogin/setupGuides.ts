import { PROVIDER_IDS, redirectUriFor, type ProviderId } from './providers'

/**
 * Step-by-step setup text for each provider, as plain data so the settings
 * screen renders it and a test can prove nothing is missing. No credentials are
 * shipped with the install: every site owner creates their own app.
 */

export type SetupGuide = {
  id: ProviderId
  label: string
  /** Where in the provider's developer console to start. */
  consoleUrl: string
  consoleLabel: string
  /** Suggested name for the app in the provider's console. */
  appName: string
  scopes: string[]
  steps: string[]
  /** Extra notes: domain verification, review requirements, quirks. */
  notes: string[]
}

export const SETUP_GUIDES: Record<ProviderId, SetupGuide> = {
  google: {
    id: 'google',
    label: 'Google',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    consoleLabel: 'Google Cloud Console - Credentials',
    appName: 'Your site name (shown to people on the consent screen)',
    scopes: ['openid', 'email', 'profile'],
    steps: [
      'Open the Google Cloud Console and pick or create a project.',
      'Go to APIs & Services > OAuth consent screen. Choose External, enter the app name and your support email, and save. The scopes openid, email and profile need no review.',
      'Go to APIs & Services > Credentials > Create credentials > OAuth client ID.',
      'Application type: Web application. Name it after your site.',
      'Under Authorised redirect URIs, add the redirect URL shown on this page exactly.',
      'Create it, then copy the Client ID and Client secret into the fields here and save.',
      'While the consent screen is in Testing, only listed test users can sign in. Publish the app when you are ready for everyone.',
    ],
    notes: ['The redirect URL must match exactly, including https and no trailing slash.'],
  },
  github: {
    id: 'github',
    label: 'GitHub',
    consoleUrl: 'https://github.com/settings/developers',
    consoleLabel: 'GitHub - Developer settings - OAuth Apps',
    appName: 'Your site name',
    scopes: ['read:user', 'user:email'],
    steps: [
      'Open GitHub > Settings > Developer settings > OAuth Apps > New OAuth App (use an organisation account for a business site).',
      'Application name: your site name. Homepage URL: your site address.',
      'Authorization callback URL: the redirect URL shown on this page exactly.',
      'Register the application, then copy the Client ID.',
      'Choose Generate a new client secret, copy it straight away (it is shown once) and paste both into the fields here.',
    ],
    notes: ['Only an email GitHub marks as verified and primary is trusted. People with no verified primary email are told to verify it on GitHub.'],
  },
  apple: {
    id: 'apple',
    label: 'Apple',
    consoleUrl: 'https://developer.apple.com/account/resources/identifiers/list/serviceId',
    consoleLabel: 'Apple Developer - Identifiers - Services IDs',
    appName: 'A Services ID such as com.yoursite.web',
    scopes: ['name', 'email'],
    steps: [
      'You need a paid Apple Developer Program membership.',
      'Under Certificates, Identifiers & Profiles > Identifiers, make sure you have an App ID with Sign in with Apple switched on.',
      'Create a Services ID (Identifiers > + > Services IDs). Its identifier is your Client ID (Services ID) - paste it here.',
      'Open the Services ID, tick Sign in with Apple > Configure. Pick the primary App ID, add your site domain under Domains, and add the return URL shown on this page under Return URLs. Save.',
      'Go to Keys > + , name it, tick Sign in with Apple, configure it with your App ID, and register. Download the .p8 file once - Apple will not show it again.',
      'Paste the Key ID, your Team ID (top right of the developer page, or Membership details) and the full contents of the .p8 file, including the BEGIN and END lines, into the fields here and save.',
    ],
    notes: [
      'Domain verification: Apple asks you to host a small file at /.well-known/apple-developer-domain-association.txt on your domain before the domain is accepted. Download it from the Services ID configuration and place it in your site public folder at that path.',
      'Return URLs must be https. Apple does not accept localhost.',
      'Apple may hand over a private relay address (privaterelay.appleid.com). That is a real, verified address, but it will not match an existing account email.',
    ],
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    consoleUrl: 'https://developers.facebook.com/apps/',
    consoleLabel: 'Meta for Developers - My Apps',
    appName: 'Your site name',
    scopes: ['email', 'public_profile'],
    steps: [
      'Open Meta for Developers > My Apps > Create App. Choose the use case Authenticate and request data from users with Facebook Login.',
      'Name the app after your site and add a contact email.',
      'In the app, open Facebook Login > Settings and add the redirect URL shown on this page under Valid OAuth Redirect URIs.',
      'Open App settings > Basic and copy the App ID and App secret into the fields here, and save.',
      'Add your privacy policy URL under App settings > Basic, then switch the app from Development to Live so everyone can use it.',
    ],
    notes: [
      'Facebook does not say whether an email is verified, so this site does not trust it for new accounts or for linking by email. A Facebook sign-in only works for people who first connected Facebook from their profile while signed in.',
    ],
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    consoleUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    consoleLabel: 'Microsoft Entra admin centre - App registrations',
    appName: 'Your site name',
    scopes: ['openid', 'email', 'profile'],
    steps: [
      'Open Microsoft Entra admin centre > Applications > App registrations > New registration.',
      'Name it after your site. Supported account types: choose "Accounts in any organizational directory and personal Microsoft accounts" for the widest sign-in (tenant: common), or a single directory (enter its tenant ID here).',
      'Redirect URI: platform Web, and the redirect URL shown on this page exactly. Register.',
      'Copy the Application (client) ID into the field here.',
      'Go to Certificates & secrets > New client secret. Copy the secret Value (not the Secret ID) straight away into the client secret field.',
      'Leave the Tenant field as common unless you chose a single directory.',
    ],
    notes: [
      'Client secrets expire (up to 24 months). Put a reminder in your calendar to create a new one.',
      'Work and school accounts do not always prove ownership of their email, so only addresses Microsoft confirms are used for linking by email.',
    ],
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    consoleUrl: 'https://discord.com/developers/applications',
    consoleLabel: 'Discord Developer Portal - Applications',
    appName: 'Your site name',
    scopes: ['identify', 'email'],
    steps: [
      'Open the Discord Developer Portal > Applications > New Application and name it after your site.',
      'Go to OAuth2 > Redirects > Add Redirect and enter the redirect URL shown on this page exactly. Save changes.',
      'On the same OAuth2 page copy the Client ID. Use Reset Secret to show the Client Secret, copy it straight away.',
      'Paste both into the fields here and save.',
    ],
    notes: ['Only a Discord email flagged verified is trusted. The scopes identify and email are requested and need no review.'],
  },
  x: {
    id: 'x',
    label: 'X',
    consoleUrl: 'https://developer.x.com/en/portal/dashboard',
    consoleLabel: 'X Developer Portal - Projects and apps',
    appName: 'Your site name',
    scopes: ['users.read', 'tweet.read', 'users.email'],
    steps: [
      'Open the X Developer Portal and create (or pick) a project and an app.',
      'Open the app > User authentication settings > Set up. App permissions: Read. Type of app: Web App, Automated App or Bot (a confidential client).',
      'Callback URI / Redirect URL: the redirect URL shown on this page exactly. Website URL: your site address. Save.',
      'Copy the OAuth 2.0 Client ID and Client Secret (shown once) into the fields here and save.',
      'To receive the email address, open the app settings and turn on "Request email from users" (and give a privacy policy and terms address).',
    ],
    notes: [
      'Only an email that X marks as confirmed is trusted. If the app cannot request email, people can still connect their X account from their profile, but cannot be matched or created by email.',
      'X changes its API plans from time to time: sign-in uses the free OAuth 2.0 user lookup, so check your plan still allows it.',
    ],
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    consoleUrl: 'https://www.linkedin.com/developers/apps',
    consoleLabel: 'LinkedIn Developers - My apps',
    appName: 'Your site name',
    scopes: ['openid', 'profile', 'email'],
    steps: [
      'Open LinkedIn Developers > Create app. Link it to a LinkedIn Page for your business and upload a logo.',
      'On the app, open Products and request Sign In with LinkedIn using OpenID Connect (usually approved at once).',
      'Open Auth. Under OAuth 2.0 settings > Authorized redirect URLs for your app, add the redirect URL shown on this page exactly.',
      'Copy the Client ID and the Primary Client Secret into the fields here and save.',
    ],
    notes: ['LinkedIn sends an email_verified flag; only a verified address is used to match or create accounts.'],
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    consoleUrl: 'https://developers.tiktok.com/apps/',
    consoleLabel: 'TikTok for Developers - Manage apps',
    appName: 'Your site name',
    scopes: ['user.info.basic'],
    steps: [
      'Open TikTok for Developers > Manage apps > Connect an app. Fill in the name, icon, category and your site address.',
      'Add the product Login Kit. Under Login Kit > Redirect URI, add the redirect URL shown on this page exactly.',
      'Add the scope user.info.basic, then submit the app for review. Until it is approved only the test users you add under Sandbox can sign in.',
      'Copy the Client key and Client secret into the fields here and save.',
    ],
    notes: [
      'TikTok never shares an email address. People sign in with TikTok only after connecting it from their profile (or the staff Connected accounts page); it never creates an account or links by email.',
      'The redirect URL must be https and registered exactly. TikTok does not accept localhost.',
    ],
  },
  slack: {
    id: 'slack',
    label: 'Slack',
    consoleUrl: 'https://api.slack.com/apps',
    consoleLabel: 'Slack API - Your apps',
    appName: 'Your site name',
    scopes: ['openid', 'email', 'profile'],
    steps: [
      'Open Slack API > Your apps > Create New App > From scratch. Name it and pick a workspace to develop in.',
      'Open OAuth & Permissions. Under Redirect URLs, add the redirect URL shown on this page exactly and save.',
      'Under User Token Scopes add openid, email and profile.',
      'Open Basic Information, copy the Client ID and Client Secret into the fields here and save.',
      'To let people from any workspace sign in, open Manage Distribution and activate public distribution.',
    ],
    notes: ['This is Sign in with Slack (OpenID Connect). Only an email Slack marks verified is used to match or create accounts.'],
  },
  oidc: {
    id: 'oidc',
    label: 'Single sign-on',
    consoleUrl: 'https://openid.net/developers/how-connect-works/',
    consoleLabel: 'OpenID Connect - how it works',
    appName: 'Your site name',
    scopes: ['openid', 'email', 'profile'],
    steps: [
      'In your identity provider (Okta, Auth0, Keycloak, Authentik, Entra, Google Workspace and so on), create a new OpenID Connect or OAuth 2.0 web application.',
      'Add the redirect URL shown on this page exactly as an allowed redirect (callback) URL.',
      'Copy the discovery address (it ends in /.well-known/openid-configuration) into the Discovery URL field. For a provider that has none, fill in the authorize, token and user info addresses instead.',
      'Copy the Client ID and Client secret into the fields here, choose the button text people see, and save.',
      'Press Test sign-in. If your provider uses different claim names, fill in the claim fields.',
    ],
    notes: [
      'Addresses must be https on a public host name. ID tokens must be signed with RS256 (the usual default); they are checked against the provider keys, the issuer, the audience and a one-time nonce.',
      'The email is trusted only when the provider says it is verified (claim email_verified). If your provider never says so, tick "Trust the email address" only when you control who can have an account there.',
    ],
  },
}

/** Guide plus the exact callback URL for one site origin. */
export const guideFor = (id: ProviderId, origin: string): SetupGuide & { redirectUri: string } => ({
  ...SETUP_GUIDES[id],
  redirectUri: redirectUriFor(origin, id),
})

/** Every provider has a guide with a console link, steps, scopes and an app name. Used by the tests. */
export const incompleteGuides = (): ProviderId[] =>
  PROVIDER_IDS.filter((id) => {
    const g = SETUP_GUIDES[id]
    return !g || !g.consoleUrl.startsWith('https://') || g.steps.length < 3 || g.scopes.length === 0 || !g.appName
  })
