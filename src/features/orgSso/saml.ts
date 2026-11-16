import { DOMParser } from '@xmldom/xmldom'
import xpath from 'xpath'
import { SignedXml } from 'xml-crypto'

/**
 * Task 25a: SAML 2.0 service-provider side (Web Browser SSO: AuthnRequest by redirect, Response by POST).
 *
 * Signature checking is done by xml-crypto, a widely used library; nothing here parses signatures by hand. What this
 * file adds are the checks the standard puts around it, and the known defences:
 *   - documents with a DOCTYPE or entities are refused (XML external entity attacks);
 *   - only the identity provider's pinned keys are trusted, never a key inside the document;
 *   - weak algorithms (SHA-1) are refused;
 *   - everything is read from the XML that the signature actually covers (`getSignedReferences`), never from the
 *     original document, which closes signature-wrapping attacks;
 *   - issuer, audience, recipient, timing, request id and a one-time assertion id are checked.
 */

import { parsePem } from './pem'

const NS = {
  samlp: 'urn:oasis:names:tc:SAML:2.0:protocol',
  saml: 'urn:oasis:names:tc:SAML:2.0:assertion',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  md: 'urn:oasis:names:tc:SAML:2.0:metadata',
}
const select = xpath.useNamespaces(NS)

export const CLOCK_SKEW_MS = 120_000
export const MAX_RESPONSE_BYTES = 200_000
const STRONG_SIG = ['http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384', 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512', 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256', 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384']
const STRONG_DIGEST = ['http://www.w3.org/2001/04/xmlenc#sha256', 'http://www.w3.org/2001/04/xmldsig-more#sha384', 'http://www.w3.org/2001/04/xmlenc#sha512']

export type SamlRefusal = 'too-large' | 'not-xml' | 'doctype' | 'no-signature' | 'weak-algorithm' | 'bad-signature' | 'not-success' | 'no-assertion' | 'encrypted' | 'issuer' | 'audience' | 'recipient' | 'time' | 'request-id' | 'no-subject' | 'replay'

export type SamlAssertion = { subject: string; email: string | null; attributes: Record<string, string>; assertionId: string; notOnOrAfter: number }

const parse = (xml: string): { doc: Document } | { error: SamlRefusal } => {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { error: 'doctype' }
  let failed = false
  let doc: Document | null = null
  try {
    doc = new DOMParser({ onError: () => void (failed = true) }).parseFromString(xml, 'text/xml') as unknown as Document
  } catch {
    failed = true
  }
  if (failed || !doc || !doc.documentElement) return { error: 'not-xml' }
  return { doc }
}

const first = (expr: string, node: Node): Element | null => (select(expr, node) as Node[])[0] as Element | null ?? null
const all = (expr: string, node: Node): Element[] => select(expr, node) as Element[]
const text = (node: Node | null): string => (node?.textContent ?? '').trim()

/** Verifies the signatures in `xml` against the pinned keys. Returns the XML each valid signature covers. */
function verifySignatures(doc: Document, xml: string, keys: string[]): { signed: string[] } | { error: SamlRefusal } {
  const signatures = all("//ds:Signature[not(ancestor::ds:Signature)]", doc)
  if (signatures.length === 0) return { error: 'no-signature' }
  const signed: string[] = []
  for (const node of signatures) {
    // Only signatures directly on the Response or an Assertion count.
    const parent = node.parentNode as Element | null
    if (!parent || !['Response', 'Assertion'].includes(parent.localName)) continue
    const method = first('ds:SignedInfo/ds:SignatureMethod', node)?.getAttribute('Algorithm') ?? ''
    if (!STRONG_SIG.includes(method)) return { error: 'weak-algorithm' }
    for (const d of all('ds:SignedInfo/ds:Reference/ds:DigestMethod', node)) if (!STRONG_DIGEST.includes(d.getAttribute('Algorithm') ?? '')) return { error: 'weak-algorithm' }
    let valid = false
    for (const key of keys) {
      try {
        const sig = new SignedXml({ publicCert: key, getCertFromKeyInfo: () => null })
        sig.loadSignature(node)
        if (sig.checkSignature(xml)) {
          signed.push(...sig.getSignedReferences())
          valid = true
          break
        }
      } catch {
        // A key that does not fit this signature simply does not verify it.
      }
    }
    if (!valid) return { error: 'bad-signature' }
  }
  return signed.length > 0 ? { signed } : { error: 'bad-signature' }
}

export type SamlCheckArgs = {
  xml: string
  keys: string[]
  idpEntityId: string
  spEntityId: string
  acsUrl: string
  requestId: string
  now: number
  emailAttribute?: string
}

const EMAIL_ATTRIBUTES = ['email', 'mail', 'emailaddress', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'urn:oid:0.9.2342.19200300.100.1.3', 'http://schemas.xmlsoap.org/claims/emailaddress']

/** Validates a decoded SAMLResponse. Pure: no storage, so the replay check is done by the caller with `assertionId`. */
export function validateSamlResponse(args: SamlCheckArgs): { ok: true; assertion: SamlAssertion } | { ok: false; code: SamlRefusal } {
  if (args.xml.length > MAX_RESPONSE_BYTES) return { ok: false, code: 'too-large' }
  const parsed = parse(args.xml)
  if ('error' in parsed) return { ok: false, code: parsed.error }
  if (all('//saml:EncryptedAssertion', parsed.doc).length > 0) return { ok: false, code: 'encrypted' }
  const top = parsed.doc.documentElement
  if (top.localName === 'Response') {
    const status = first('samlp:Status/samlp:StatusCode', top)?.getAttribute('Value') ?? ''
    if (status !== 'urn:oasis:names:tc:SAML:2.0:status:Success') return { ok: false, code: 'not-success' }
  }
  const verified = verifySignatures(parsed.doc, args.xml, args.keys)
  if ('error' in verified) return { ok: false, code: verified.error }

  // Find the assertion in the signed content only.
  let assertion: Element | null = null
  let response: Element | null = null
  for (const piece of verified.signed) {
    const p = parse(piece)
    if ('error' in p) continue
    const root = p.doc.documentElement
    if (root.localName === 'Assertion' && root.namespaceURI === NS.saml) assertion = root
    else if (root.localName === 'Response' && root.namespaceURI === NS.samlp) {
      response = root
      const inner = all('saml:Assertion', root)
      if (inner.length === 1) assertion = inner[0]
    }
  }
  if (!assertion) return { ok: false, code: 'no-assertion' }
  if (response) {
    const status = first('samlp:Status/samlp:StatusCode', response)?.getAttribute('Value') ?? ''
    if (status !== 'urn:oasis:names:tc:SAML:2.0:status:Success') return { ok: false, code: 'not-success' }
  }

  if (text(first('saml:Issuer', assertion)) !== args.idpEntityId) return { ok: false, code: 'issuer' }

  const nbf = first('saml:Conditions', assertion)?.getAttribute('NotBefore')
  const noa = first('saml:Conditions', assertion)?.getAttribute('NotOnOrAfter')
  const t = (v: string | null | undefined): number => (v ? Date.parse(v) : NaN)
  if (!noa || !Number.isFinite(t(noa))) return { ok: false, code: 'time' }
  if (args.now >= t(noa) + CLOCK_SKEW_MS) return { ok: false, code: 'time' }
  if (nbf && Number.isFinite(t(nbf)) && args.now < t(nbf) - CLOCK_SKEW_MS) return { ok: false, code: 'time' }

  const audiences = all('saml:Conditions/saml:AudienceRestriction/saml:Audience', assertion).map(text)
  if (!audiences.includes(args.spEntityId)) return { ok: false, code: 'audience' }

  const confirmations = all("saml:Subject/saml:SubjectConfirmation[@Method='urn:oasis:names:tc:SAML:2.0:cm:bearer']/saml:SubjectConfirmationData", assertion)
  const good = confirmations.find((c) => {
    if (c.getAttribute('Recipient') !== args.acsUrl) return false
    const until = t(c.getAttribute('NotOnOrAfter'))
    return Number.isFinite(until) && args.now < until + CLOCK_SKEW_MS
  })
  if (!good) return { ok: false, code: 'recipient' }
  // IdP-initiated sign-in (no InResponseTo) is refused: only a response to our own request is accepted.
  if (good.getAttribute('InResponseTo') !== args.requestId) return { ok: false, code: 'request-id' }

  const subject = text(first('saml:Subject/saml:NameID', assertion))
  if (!subject || subject.length > 400) return { ok: false, code: 'no-subject' }
  const assertionId = assertion.getAttribute('ID') ?? ''
  if (!assertionId) return { ok: false, code: 'no-assertion' }

  const attributes: Record<string, string> = {}
  for (const a of all('saml:AttributeStatement/saml:Attribute', assertion)) {
    const name = a.getAttribute('Name') ?? ''
    const value = text(first('saml:AttributeValue', a))
    if (name && value && !(name in attributes)) attributes[name] = value.slice(0, 400)
  }
  const wanted = [args.emailAttribute, ...EMAIL_ATTRIBUTES].filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase())
  let email: string | null = null
  for (const [name, value] of Object.entries(attributes)) if (wanted.includes(name.toLowerCase()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) email = value.toLowerCase()
  if (!email) {
    const format = first('saml:Subject/saml:NameID', assertion)?.getAttribute('Format') ?? ''
    if (/emailAddress$/i.test(format) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)) email = subject.toLowerCase()
  }
  return { ok: true, assertion: { subject, email, attributes, assertionId, notOnOrAfter: t(noa) } }
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string)

export const newRequestId = (): string => `_${Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join('')}`

export function buildAuthnRequest(args: { id: string; now: number; destination: string; acsUrl: string; spEntityId: string }): string {
  return `<samlp:AuthnRequest xmlns:samlp="${NS.samlp}" xmlns:saml="${NS.saml}" ID="${esc(args.id)}" Version="2.0" IssueInstant="${new Date(args.now).toISOString()}" Destination="${esc(args.destination)}" AssertionConsumerServiceURL="${esc(args.acsUrl)}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer>${esc(args.spEntityId)}</saml:Issuer><samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/></samlp:AuthnRequest>`
}

/** Raw deflate then base64, as the HTTP-Redirect binding requires. */
export async function deflateBase64(xml: string): Promise<string> {
  const stream = new Blob([xml]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function spMetadata(args: { spEntityId: string; acsUrl: string }): string {
  return `<?xml version="1.0"?><md:EntityDescriptor xmlns:md="${NS.md}" entityID="${esc(args.spEntityId)}"><md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"><md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat><md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${esc(args.acsUrl)}" index="0" isDefault="true"/></md:SPSSODescriptor></md:EntityDescriptor>`
}

/** Reads the identity provider's metadata file: entity id, sign-in address (HTTP-Redirect) and signing keys. */
export function readIdpMetadata(xml: string): { entityId: string; ssoUrl: string; keys: string[] } | null {
  const parsed = parse(xml)
  if ('error' in parsed) return null
  const root = parsed.doc.documentElement
  const entityId = root.getAttribute('entityID') ?? ''
  const sso = all("md:IDPSSODescriptor/md:SingleSignOnService[@Binding='urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect']", root)[0]
  const keys = all("md:IDPSSODescriptor/md:KeyDescriptor[not(@use) or @use='signing']/ds:KeyInfo/ds:X509Data/ds:X509Certificate", root)
    .map((n) => parsePem(`-----BEGIN CERTIFICATE-----${text(n)}-----END CERTIFICATE-----`)[0])
    .filter(Boolean)
  if (!entityId || !sso || keys.length === 0) return null
  return { entityId, ssoUrl: sso.getAttribute('Location') ?? '', keys }
}
