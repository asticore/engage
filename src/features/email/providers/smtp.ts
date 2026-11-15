import type { EmailAdapter } from '../types'

import { authPlain, buildMime, dotStuff, parseReplyLine } from './smtpMime'

export type SmtpConfig = {
  host: string
  port: number
  username: string
  password: string
  /** 'tls' connects encrypted (usually port 465); 'starttls' upgrades after hello (usually 587); 'none' is plain (testing only). */
  security: 'tls' | 'starttls' | 'none'
}

type Socket = {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
  startTls: () => Socket
  close: () => Promise<void>
}

const TIMEOUT_MS = 20_000

/** Opens a TCP connection from the Worker. The module only exists on Cloudflare, so it is loaded when first used. */
async function connect(config: SmtpConfig): Promise<Socket> {
  // Built at run time (reversed text) so the minifier cannot fold it into a literal that the bundler then fails to resolve.
  const moduleName = 'stekcos:eralfduolc'.split('').reverse().join('')
  const { connect: open } = (await import(/* webpackIgnore: true */ moduleName)) as {
    connect: (address: { hostname: string; port: number }, options: { secureTransport: string; allowHalfOpen: boolean }) => Socket
  }
  return open({ hostname: config.host, port: config.port }, { secureTransport: config.security === 'tls' ? 'on' : config.security === 'starttls' ? 'starttls' : 'off', allowHalfOpen: false })
}

/**
 * Sends one message over SMTP, for operators whose mail comes from their own or their host's mail server.
 * Plain AUTH, one message per connection. A 4xx reply is reported with status 451 and a 5xx with its own code;
 * a connection that cannot be opened has no status, so the fallback list treats it as transient.
 */
export const sendViaSmtp: EmailAdapter<SmtpConfig> = async (message, config) => {
  let socket: Socket | null = null
  try {
    socket = await connect(config)
    let writer = socket.writable.getWriter()
    let reader = socket.readable.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const readReply = async (): Promise<{ code: number; text: string }> => {
      const lines: string[] = []
      for (;;) {
        let newline = buffer.indexOf('\r\n')
        while (newline === -1) {
          const chunk = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The mail server did not answer in time.')), TIMEOUT_MS)),
          ])
          if (chunk.done) throw new Error('The mail server closed the connection.')
          buffer += decoder.decode(chunk.value, { stream: true })
          newline = buffer.indexOf('\r\n')
        }
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 2)
        const parsed = parseReplyLine(line)
        if (!parsed) continue
        lines.push(parsed.text)
        if (parsed.last) return { code: parsed.code, text: lines.join(' ') }
      }
    }
    const send = (line: string): Promise<void> => writer.write(new TextEncoder().encode(line + '\r\n'))
    const expect = async (ok: number[], what: string): Promise<{ code: number; text: string }> => {
      const reply = await readReply()
      if (!ok.includes(reply.code)) throw Object.assign(new Error(`${what}: ${reply.code} ${reply.text}`), { smtpCode: reply.code })
      return reply
    }

    await expect([220], 'Greeting')
    await send('EHLO engage')
    await expect([250], 'Hello')
    if (config.security === 'starttls') {
      await send('STARTTLS')
      await expect([220], 'STARTTLS')
      writer.releaseLock()
      reader.releaseLock()
      socket = socket.startTls()
      writer = socket.writable.getWriter()
      reader = socket.readable.getReader()
      buffer = ''
      await send('EHLO engage')
      await expect([250], 'Hello')
    }
    if (config.username) {
      await send(`AUTH PLAIN ${authPlain(config.username, config.password)}`)
      await expect([235], 'Sign in')
    }
    await send(`MAIL FROM:<${message.fromEmail.replace(/[\r\n<>]+/g, '')}>`)
    await expect([250], 'Sender')
    for (const to of message.to) {
      await send(`RCPT TO:<${to.replace(/[\r\n<>]+/g, '')}>`)
      await expect([250, 251], 'Recipient')
    }
    await send('DATA')
    await expect([354], 'Data')
    await send(dotStuff(buildMime(message)) + '.')
    const done = await expect([250], 'Message')
    await send('QUIT').catch((): void => undefined)
    return { ok: true, id: done.text.slice(0, 120) }
  } catch (error) {
    const code = (error as { smtpCode?: number }).smtpCode
    const messageText = error instanceof Error ? error.message : String(error)
    // A temporary SMTP refusal (4xx) maps to 503 so the fallback list moves on; a permanent one (5xx) is returned as it is.
    return { ok: false, error: messageText, ...(code ? { status: code >= 400 && code < 500 ? 503 : code } : {}) }
  } finally {
    try {
      await socket?.close()
    } catch {
      // the connection is gone either way
    }
  }
}
