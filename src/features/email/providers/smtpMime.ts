import type { OutgoingEmail } from '../types'

/** Pure pieces of the SMTP adapter: the message text and the reply parser. Kept apart so they test without a socket. */

const CRLF = '\r\n'

/** Base64 in 76 character lines, as mail wants it. */
const wrapBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return (btoa(binary).match(/.{1,76}/g) ?? []).join(CRLF)
}

/** A header value with non-ASCII text encoded as an RFC 2047 word. Line breaks are removed so a value cannot add a header. */
export const encodeHeader = (value: string): string => {
  const clean = value.replace(/[\r\n]+/g, ' ').trim()
  if (/^[\x20-\x7e]*$/.test(clean)) return clean
  return `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(clean)))}?=`
}

const address = (email: string): string => email.replace(/[\r\n<>]+/g, '').trim()

/** The full message (headers and body) that goes between DATA and the closing dot. */
export function buildMime(message: OutgoingEmail, boundary = `eg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`): string {
  const from = message.fromName ? `${encodeHeader(message.fromName)} <${address(message.fromEmail)}>` : address(message.fromEmail)
  const headers = [
    `From: ${from}`,
    `To: ${message.to.map(address).join(', ')}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ]
  if (message.replyTo) headers.push(`Reply-To: ${address(message.replyTo)}`)
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (/^[A-Za-z0-9-]+$/.test(name)) headers.push(`${name}: ${value.replace(/[\r\n]+/g, ' ')}`)
  }

  const text = message.text ?? ''
  const html = message.html ?? ''
  let body: string
  if (html && text) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(text),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(html),
      `--${boundary}--`,
    ].join(CRLF)
  } else {
    headers.push(`Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`, 'Content-Transfer-Encoding: base64')
    body = wrapBase64(html || text)
  }
  return headers.join(CRLF) + CRLF + CRLF + body + CRLF
}

/** Doubles a leading dot on every line, so a body line of "." cannot end the message early. */
export const dotStuff = (data: string): string => data.replace(/^\./gm, '..')

/** One SMTP reply: the code, and whether it is the last line of a multi-line reply. */
export function parseReplyLine(line: string): { code: number; last: boolean; text: string } | null {
  const match = /^(\d{3})([ -])(.*)$/.exec(line)
  if (!match) return null
  return { code: Number(match[1]), last: match[2] === ' ', text: match[3] }
}

/** The SMTP AUTH PLAIN initial response. */
export const authPlain = (username: string, password: string): string => {
  const bytes = new TextEncoder().encode(`\0${username}\0${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
