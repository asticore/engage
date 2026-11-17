import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Image from 'next/image'
import React from 'react'
import type { Metadata } from 'next'
import { RichText } from '@/engine/editor/react'

import { AddToCartButton } from '@/components/AddToCartButton'
import { EventSeries } from '@/components/EventSeries'
import { EventTiers } from '@/components/EventTiers'
import { RsvpForm, type RsvpTierOption } from '@/components/RsvpForm'
import { loadTierViews } from '@/features/editScreens/tierLoad'
import { eventSaleMode } from '@/features/editScreens/eventSales'
import { tierOptionLabel } from '@/features/editScreens/tierSales'
import { formatPriceInAUD } from '@/lib/formatCurrency'
import { priceLocale } from '@/features/uiStrings/publicFormat'
import { publicLocale, storeTexts } from '@/features/uiStrings/storeTextsServer'
import { translateWith } from '@/features/uiStrings/t'
import type { UiStringKey } from '@/features/uiStrings/keys'
import { setBlockContext, setRequestQuery } from '@/lib/blockContext'
import { eventBlockContext } from '@/lib/blockContextFrom'
import { PasswordGate } from '@/components/PasswordGate'
import { getPasswordGateState } from '@/features/visibility/gate'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'
import { currentRequestLocale, applyTranslations, applyTranslationsToDocs } from '@/features/multilingual/applyTranslations'
import { buildMetadata } from '@/utilities/seo'
import { PageJsonLd } from '@/features/seo'
import { loadSiteDetails } from '@/features/site/details'
import { formatDate, formatDateTime } from '@/features/site/format'
import { renderWithTemplate } from '@/features/siteTemplates/render'
import type { Event, EventRsvp, Media, Product } from '@/engage-types'

export const dynamic = 'force-dynamic'

async function getEvent(slug: string) {
  const engine = await getEngine()
  const { docs } = (await engine.find({
    collection: 'events',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
  })) as unknown as { docs: Event[] }
  return docs[0] || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = await applyTranslations(await getEvent(slug), 'events', await currentRequestLocale())
  if (!event) return {}

  // When password protected and locked, use generic metadata and keep it out of the index.
  const lockedMeta = await getPasswordGateState({ collection: 'events', id: event.id, cookies: await cookies() })
  if (lockedMeta === 'locked') {
    return { title: 'Password Protected', robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
  }

  const details = await loadSiteDetails()
  return buildMetadata({
    title: event.title,
    // Event's generated type predates the seo group; the field exists at runtime.
    seo: (event as Event & { seo?: Parameters<typeof buildMetadata>[0]['seo'] }).seo,
    path: `/events/${slug}`,
    featuredImage: event.coverImage,
    kind: 'article',
    publishedAt: event.createdAt,
    updatedAt: event.updatedAt,
    contentType: 'event',
    tokens: {
      excerpt: event.summary,
      date: formatDate(event.startDate, details),
    },
  })
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  setRequestQuery(sp)
  const locale = await publicLocale()
  const flags = await getFeatureFlags()
  if (!flags.events) notFound()

  const { slug } = await params
  const event = await applyTranslations(await getEvent(slug), 'events', await currentRequestLocale())
  const details = await loadSiteDetails()

  if (!event) {
    notFound()
  }

  const gateState = await getPasswordGateState({ collection: 'events', id: event.id, cookies: await cookies() })
  if (gateState === 'locked') {
    return <PasswordGate collection="events" currentPath={`/events/${slug}`} id={event.id} wrongPassword={sp.pw === 'wrong'} />
  }
  const engine = await getEngine()
  const storeDict = await storeTexts()
  const tx = (key: UiStringKey, vars?: Record<string, string | number>) => translateWith(storeDict, key, vars)
  const leftText = (count: number) => tx('events.left', { count })
  const tierText = {
    heading: tx('events.ticketTypes'),
    soldOut: tx('events.soldOut'),
    placesAvailable: tx('events.placesAvailable'),
    left: leftText,
    pricesInfoPaid: tx('events.pricesInfoPaid'),
    pricesInfoFree: tx('events.pricesInfoFree'),
    buyTicket: tx('events.buyTicket'),
  }
  const rsvpText = {
    heading: tx('events.rsvp.heading'),
    ticketType: tx('events.rsvp.ticketType'),
    chooseTicket: tx('events.rsvp.chooseTicket'),
    name: tx('events.rsvp.name'),
    email: tx('events.rsvp.email'),
    guests: tx('events.rsvp.guests'),
    notes: tx('events.rsvp.notes'),
    submit: tx('events.rsvp.submit'),
    sending: tx('events.rsvp.sending'),
    successTitle: tx('events.rsvp.successTitle'),
    successBody: tx('events.rsvp.successBody'),
    error: tx('events.rsvp.error'),
  }

  const cover = event.coverImage && typeof event.coverImage === 'object' ? (event.coverImage as Media) : null
  const ticket =
    event.ticketProduct && typeof event.ticketProduct === 'object' ? (event.ticketProduct as Product) : null

  const guestsSoFar =
    event.rsvps?.docs?.reduce((sum: number, doc: number | EventRsvp) => {
      if (typeof doc === 'object' && (doc as { status?: unknown }).status === 'cancelled') return sum
      const guestCount = typeof doc === 'object' ? doc.guestCount : undefined
      return sum + (typeof guestCount === 'number' ? guestCount : 1)
    }, 0) || 0

  const spotsRemaining =
    typeof event.capacity === 'number' ? Math.max(event.capacity - guestsSoFar, 0) : null

  const tierViews = await loadTierViews(engine, event)
  const isPaid = event.eventType === 'paid'
  const saleMode = eventSaleMode({
    eventType: event.eventType,
    externalRegistrationUrl: event.externalRegistrationUrl,
    spotsRemaining,
    hasTicketProduct: Boolean(ticket) || tierViews.some((view) => view.productId),
  })
  const tierOptions: RsvpTierOption[] = isPaid
    ? []
    : tierViews.map((view) => ({ name: view.name, label: tierOptionLabel(view, { soldOut: tierText.soldOut, left: leftText }), soldOut: view.soldOut }))

  const body = (
    <div className="page-shell">
      <PageJsonLd collection="events" doc={event} path={`/events/${slug}`} />
      {cover?.url && (
        <div className="relative mb-12 w-full bg-surface-2 aspect-video">
          <Image src={cover.url} alt={cover.alt || event.title} fill style={{ objectFit: 'cover' }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <span className="text-xs uppercase text-accent">
            {formatDateTime(event.startDate, details)}
          </span>
          <h1 className="text-4xl">{event.title}</h1>
          {event.location?.venueName && <p className="font-medium">{event.location.venueName}</p>}
          {event.location?.address && <p className="text-muted">{event.location.address}</p>}

          {event.description && (
            <div className="mt-6">
              <RichText data={event.description} />
            </div>
          )}
          <EventSeries event={event} />
        </div>

        <aside className="card card-body self-start">
          {tierViews.length > 0 && <EventTiers tiers={tierViews} paid={isPaid} text={tierText} />}
          {event.externalRegistrationUrl ? (
            <a
              className="btn btn--primary"
              href={event.externalRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tx('events.register')}
            </a>
          ) : saleMode === 'sold-out' ? (
            <p className="empty-state">{tx('events.soldOut')}.</p>
          ) : event.eventType === 'paid' ? (
            ticket ? (
              <div>
                <p className="mb-4 text-2xl">
                  {formatPriceInAUD(ticket.priceInAUD, 'AUD', priceLocale(locale))}
                </p>
                <AddToCartButton productID={ticket.id} label={tx('events.buyTicket')} />
              </div>
            ) : tierViews.some((view) => view.productId) ? null : (
              <p className="empty-state">{tx('events.salesSoon')}</p>
            )
          ) : (
            <RsvpForm eventID={event.id} tiers={tierOptions} text={rsvpText} />
          )}

          {spotsRemaining !== null && (
            <p className="mt-4 text-sm text-muted">{tx('events.spotsRemaining', { count: spotsRemaining })}</p>
          )}

          <p className="mt-4 text-sm">
            <a className="underline" href={`/api/events/${encodeURIComponent(slug)}/ics`}>
              {tx('events.addToCalendar')}
            </a>
          </p>
        </aside>
      </div>
    </div>
  )
  setBlockContext(eventBlockContext(event as unknown as Record<string, unknown>, `/events/${slug}`))
  return renderWithTemplate({ kind: 'single-event', ctx: { path: `/events/${slug}`, eventType: event.eventType }, content: body })
}
