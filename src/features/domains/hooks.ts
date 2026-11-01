import { normaliseDomains } from './model'
import { resolveAdminSite } from './adminSite'

/**
 * Saves the domain registry only when it is valid, and in its normalised form (lower-case hosts, blank rows
 * dropped, the currency upper-cased). A refused save names every problem, so the admin fixes them in one pass.
 * Language membership is checked against the enabled languages when the registry is read at the edge.
 */
export const domainSettingsBeforeChange = ({ data }: { data?: { domains?: unknown } }): { domains?: unknown } | undefined => {
  if (!data || !Array.isArray(data.domains)) return data

  const { domains, errors } = normaliseDomains(data.domains)
  if (errors.length > 0) throw new Error(`Domains: ${errors.join(' ')}`)

  data.domains = domains.map((domain) => ({
    host: domain.host,
    label: domain.label,
    defaultLocale: domain.defaultLocale,
    currencyHint: domain.currencyHint,
    isPrimary: domain.isPrimary,
    status: domain.status,
    redirectToPrimary: domain.redirectToPrimary,
    allowAdmin: domain.allowAdmin,
    siteName: domain.overrides.siteName,
    tagline: domain.overrides.tagline,
    logoUrl: domain.overrides.logoUrl,
    contactEmail: domain.overrides.contactEmail,
    contactPhone: domain.overrides.contactPhone,
    instagramUrl: domain.overrides.socials.instagram,
    facebookUrl: domain.overrides.socials.facebook,
    linkedinUrl: domain.overrides.socials.linkedin,
    xUrl: domain.overrides.socials.x,
  }))
  return data
}

/**
 * New pages, posts and products take the admin's chosen site when the admin left "Available on domains" empty: the
 * content becomes specific to that site (the switcher, adminSite.ts). Only on create, only for a signed-in account, and
 * only when a site is chosen; "All sites" and an unregistered site leave the field empty (shared).
 */
export const domainSiteDefault = async ({
  data,
  req,
  originalDoc,
}: {
  data?: { availableDomains?: unknown }
  req?: { engine?: unknown; user?: unknown }
  originalDoc?: unknown
}): Promise<{ availableDomains?: unknown } | undefined> => {
  if (!data || originalDoc || (typeof data.availableDomains === 'string' && data.availableDomains.trim() !== '')) return data
  if (!req?.engine || !req.user) return data
  const { host } = await resolveAdminSite(req.engine as Parameters<typeof resolveAdminSite>[0], req.user as Parameters<typeof resolveAdminSite>[1])
  if (host) data.availableDomains = `,${host},`
  return data
}
