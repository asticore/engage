// @vitest-environment node
// Task 23k: the OpenAPI document for the sign-in endpoints stays honest. Every documented path has a route
// file that exports the documented method, every operation is complete, every $ref resolves, and the
// download formats are wired up.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { AUTH_ROUTES, buildAuthOpenApi } from '@/features/apiBuilder/authOpenApi'
import { isGuideFormat, renderGuide } from '@/features/apiBuilder/guideResponse'

const options = { baseUrl: 'https://site.example', siteName: 'Example', generatedAt: '2026-11-16' }
type Doc = { openapi: string; paths: Record<string, Record<string, { operationId: string; tags: string[]; responses: Record<string, unknown>; summary: string }>>; components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> }; tags: Array<{ name: string }>; servers: Array<{ url: string }> }
const doc = buildAuthOpenApi(options) as unknown as Doc

const routeFile = (path: string): string | null => {
  const clean = path.replace('{provider}', '[provider]')
  if (path.startsWith('/.well-known/')) return join(process.cwd(), 'src/app', clean, 'route.ts')
  if (path.startsWith('/api/users/')) return null // served by the REST dispatcher, checked against AUTH_ROUTE_NAMES below
  return join(process.cwd(), 'src/app/(engage)', clean, 'route.ts')
}

describe('authentication OpenAPI document', () => {
  it('lists exactly the routes in AUTH_ROUTES', () => {
    const documented = Object.entries(doc.paths).flatMap(([path, item]) => Object.keys(item).map((method) => `${method} ${path}`))
    expect(documented.sort()).toEqual(AUTH_ROUTES.map(([method, path]) => `${method} ${path}`).sort())
  })

  it('has a route file that exports each documented method', () => {
    for (const [method, path] of AUTH_ROUTES) {
      const file = routeFile(path)
      if (!file) continue
      expect(existsSync(file), `${path} has no route file`).toBe(true)
      expect(readFileSync(file, 'utf8'), `${path} does not export ${method.toUpperCase()}`).toMatch(new RegExp(`export (async )?function ${method.toUpperCase()}\\b`))
    }
  })

  it('names only user routes the REST dispatcher serves', () => {
    const rest = readFileSync(join(process.cwd(), 'src/localapi/rest.ts'), 'utf8')
    const names = /const AUTH_ROUTE_NAMES = new Set\(\[([^\]]*)\]\)/.exec(rest)?.[1] ?? ''
    for (const [, path] of AUTH_ROUTES.filter(([, p]) => p.startsWith('/api/users/'))) expect(names).toContain(`'${path.split('/').pop()}'`)
  })

  it('is complete: unique operation ids, known tags, summaries, responses and security', () => {
    const ids = new Set<string>()
    const tags = new Set(doc.tags.map((t) => t.name))
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(item)) {
        expect(op.operationId, `${method} ${path}`).toBeTruthy()
        expect(ids.has(op.operationId), `duplicate ${op.operationId}`).toBe(false)
        ids.add(op.operationId)
        expect(op.summary.length).toBeGreaterThan(5)
        expect(op.tags.every((t) => tags.has(t))).toBe(true)
        expect(Object.keys(op.responses).length).toBeGreaterThan(0)
        expect(Object.keys(op.responses).every((c) => /^\d{3}$/.test(c))).toBe(true)
      }
    }
  })

  it('resolves every $ref and security scheme', () => {
    const text = JSON.stringify(doc)
    for (const match of text.matchAll(/#\/components\/schemas\/(\w+)/g)) expect(doc.components.schemas[match[1]], match[1]).toBeTruthy()
    for (const item of Object.values(doc.paths)) {
      for (const op of Object.values(item) as Array<{ security?: object[] }>) {
        for (const requirement of op.security ?? []) for (const scheme of Object.keys(requirement)) expect(doc.components.securitySchemes[scheme], scheme).toBeTruthy()
      }
    }
  })

  it('uses the request origin, is OpenAPI 3.1, and carries no secret', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.servers[0].url).toBe('https://site.example')
    expect(JSON.stringify(doc)).not.toMatch(/egk_[A-Za-z0-9_-]{20,}|egot_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\./)
  })

  it('documents the new social providers and the token endpoints', () => {
    const provider = doc.paths['/api/social/{provider}/start'].get as unknown as { parameters: Array<{ schema?: { enum?: string[] } }> }
    expect(provider.parameters[0].schema?.enum).toEqual(expect.arrayContaining(['x', 'linkedin', 'tiktok', 'slack', 'oidc']))
    expect(doc.paths['/api/auth/token'].post.operationId).toBe('exchangeApiKey')
    expect(doc.paths['/.well-known/jwks.json'].get.operationId).toBe('jwks')
  })
})

describe('download formats', () => {
  it('serves JSON and YAML as attachments', async () => {
    expect(isGuideFormat('auth-openapi.json')).toBe(true)
    expect(isGuideFormat('auth-openapi.yaml')).toBe(true)
    const json = renderGuide('auth-openapi.json', [], options, 'download')
    expect(json.headers.get('content-disposition')).toContain('auth-openapi.json')
    expect(JSON.parse(await json.text()).info.title).toBe('Example authentication API')
    const yaml = renderGuide('auth-openapi.yaml', [], options, 'download')
    expect(yaml.headers.get('content-type')).toContain('yaml')
    expect(await yaml.text()).toMatch(/"?openapi"?: "?3\.1\.0/)
  })
})
