// @vitest-environment node
// Task 25a: SAML 2.0 response checks. Responses are signed here with xml-crypto and a throwaway RSA key.
import { generateKeyPairSync } from 'node:crypto'
import { SignedXml } from 'xml-crypto'
import { describe, expect, it } from 'vitest'

import { parsePem } from '@/features/orgSso/pem'
import { buildAuthnRequest, readIdpMetadata, spMetadata, validateSamlResponse } from '@/features/orgSso/saml'
import { validateSamlInput } from '@/features/orgSso/core'

const IDP = 'https://idp.example.com/entity'
const SP = 'https://shop.example.com/api/sso/saml/metadata/c1'
const ACS = 'https://shop.example.com/api/sso/saml/acs'
const NOW = Date.parse('2027-03-01T12:00:00Z')
const REQ = '_req123'
const iso = (ms: number): string => new Date(ms).toISOString()

const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
const good = pair()
const other = pair()

type Opts = { audience?: string; recipient?: string; inResponseTo?: string; notOnOrAfter?: number; issuer?: string; id?: string; status?: string; email?: string }
const assertionXml = (o: Opts = {}): string =>
  `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${o.id ?? '_a1'}" Version="2.0" IssueInstant="${iso(NOW)}"><saml:Issuer>${o.issuer ?? IDP}</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${o.email ?? 'ann@acme.example.com'}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData Recipient="${o.recipient ?? ACS}" InResponseTo="${o.inResponseTo ?? REQ}" NotOnOrAfter="${iso(NOW + 300_000)}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${iso(NOW - 60_000)}" NotOnOrAfter="${iso(o.notOnOrAfter ?? NOW + 300_000)}"><saml:AudienceRestriction><saml:Audience>${o.audience ?? SP}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AttributeStatement><saml:Attribute Name="mail"><saml:AttributeValue>${o.email ?? 'ann@acme.example.com'}</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`

const sign = (xml: string, privateKey: string, ref: string, algo = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', digest = 'http://www.w3.org/2001/04/xmlenc#sha256'): string => {
  const sig = new SignedXml({ privateKey, signatureAlgorithm: algo, canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#' })
  sig.addReference({ xpath: `//*[local-name(.)='Assertion']`, transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: digest })
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${ref}']/*[local-name(.)='Issuer']`, action: 'after' } })
  return sig.getSignedXml()
}
const response = (inner: string, status = 'urn:oasis:names:tc:SAML:2.0:status:Success'): string =>
  `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1" Version="2.0" InResponseTo="${REQ}"><samlp:Status><samlp:StatusCode Value="${status}"/></samlp:Status>${inner}</samlp:Response>`

const check = (xml: string, over: Partial<Parameters<typeof validateSamlResponse>[0]> = {}) =>
  validateSamlResponse({ xml, keys: [good.publicKey], idpEntityId: IDP, spEntityId: SP, acsUrl: ACS, requestId: REQ, now: NOW, ...over })
const signed = (o: Opts = {}, key = good.privateKey): string => response(sign(assertionXml(o), key, 'Assertion'))
const code = (r: ReturnType<typeof check>): string => ('code' in r ? r.code : 'ok')

describe('SAML response validation', () => {
  it('accepts a signed assertion and reads the subject and email', () => {
    const r = check(signed())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.assertion.subject).toBe('ann@acme.example.com')
      expect(r.assertion.email).toBe('ann@acme.example.com')
      expect(r.assertion.assertionId).toBe('_a1')
    }
  })
  it('accepts a signed Response element too', () => {
    const inner = assertionXml()
    const body = response(inner)
    const sig = new SignedXml({ privateKey: good.privateKey, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#' })
    sig.addReference({ xpath: `/*[local-name(.)='Response']`, transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' })
    sig.computeSignature(body, { location: { reference: `/*[local-name(.)='Response']/*[local-name(.)='Status']`, action: 'before' } })
    expect(code(check(sig.getSignedXml()))).toBe('ok')
  })
  it('refuses a signature from another key', () => expect(code(check(signed({}, other.privateKey)))).toBe('bad-signature'))
  it('refuses an unsigned response', () => expect(code(check(response(assertionXml())))).toBe('no-signature'))
  it('refuses a tampered assertion', () => expect(code(check(signed().replace('ann@acme.example.com', 'root@acme.example.com')))).toBe('bad-signature'))
  it('refuses a wrapped assertion (signature valid, evil assertion read first)', () => {
    const s = signed()
    const evil = assertionXml({ id: '_evil', email: 'boss@acme.example.com' })
    const wrapped = s.replace('<samlp:Status>', `${evil}<samlp:Status>`)
    const r = check(wrapped)
    // Either the signature no longer matches, or the signed (genuine) assertion is what is read: never the evil one.
    if ('code' in r) expect(['bad-signature', 'no-assertion']).toContain(r.code)
    else expect(r.assertion.subject).toBe('ann@acme.example.com')
  })
  it('refuses an expired assertion', () => expect(code(check(signed({ notOnOrAfter: NOW - 600_000 })))).toBe('time'))
  it('refuses the wrong audience', () => expect(code(check(signed({ audience: 'https://other.example.com' })))).toBe('audience'))
  it('refuses the wrong recipient', () => expect(code(check(signed({ recipient: 'https://evil.example.com/acs' })))).toBe('recipient'))
  it('refuses the wrong InResponseTo', () => expect(code(check(signed({ inResponseTo: '_other' })))).toBe('request-id'))
  it('refuses the wrong issuer', () => expect(code(check(signed({ issuer: 'https://evil.example.com' })))).toBe('issuer'))
  it('refuses a failed status', () => expect(code(check(response(sign(assertionXml(), good.privateKey, 'Assertion'), 'urn:oasis:names:tc:SAML:2.0:status:Responder')))).toBe('not-success'))
  it('refuses a DOCTYPE', () => expect(code(check(`<!DOCTYPE x [<!ENTITY a "b">]>${signed()}`))).toBe('doctype'))
  it('refuses SHA-1 signatures', () => expect(code(check(response(sign(assertionXml(), good.privateKey, 'Assertion', 'http://www.w3.org/2000/09/xmldsig#rsa-sha1', 'http://www.w3.org/2000/09/xmldsig#sha1'))))).toBe('weak-algorithm'))
  it('refuses oversized and non-XML input', () => {
    expect(code(check('x'.repeat(300_000)))).toBe('too-large')
    expect(code(check('not xml <<<'))).toBe('not-xml')
  })
  it('accepts a rotated key (second pinned key)', () => expect(code(check(signed(), { keys: [other.publicKey, good.publicKey] }))).toBe('ok'))
})

describe('SAML helpers', () => {
  it('parses PEM blocks and skips junk', () => {
    expect(parsePem(good.publicKey)).toHaveLength(1)
    expect(parsePem('nothing here')).toHaveLength(0)
  })
  it('validates setup input', () => {
    expect(validateSamlInput({ entityId: IDP, ssoUrl: 'https://idp.example.com/sso', certificate: good.publicKey }).ok).toBe(true)
    expect(validateSamlInput({ entityId: IDP, ssoUrl: 'http://idp.example.com/sso', certificate: good.publicKey }).ok).toBe(false)
    expect(validateSamlInput({ entityId: IDP, ssoUrl: 'https://idp.example.com/sso', certificate: 'x' }).ok).toBe(false)
  })
  it('builds an AuthnRequest and SP metadata', () => {
    expect(buildAuthnRequest({ id: REQ, now: NOW, destination: 'https://idp.example.com/sso', acsUrl: ACS, spEntityId: SP })).toContain(`ID="${REQ}"`)
    expect(spMetadata({ spEntityId: SP, acsUrl: ACS })).toContain(ACS)
  })
  it('reads identity provider metadata', () => {
    const cert = good.publicKey.replace(/-----[A-Z ]+-----|\s/g, '')
    const xml = `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="${IDP}"><md:IDPSSODescriptor><md:KeyDescriptor use="signing"><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${cert}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor><md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/></md:IDPSSODescriptor></md:EntityDescriptor>`
    const m = readIdpMetadata(xml)
    expect(m?.entityId).toBe(IDP)
    expect(m?.ssoUrl).toBe('https://idp.example.com/sso')
    expect(readIdpMetadata('<a/>')).toBeNull()
  })
})
