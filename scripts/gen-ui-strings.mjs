#!/usr/bin/env node
// Writes public/ui-strings/<locale>.json from src/features/uiStrings/dictionaries/*.ts.
// The Worker reads these as static assets instead of bundling every language into the script.
//   node scripts/gen-ui-strings.mjs          write the files
//   node scripts/gen-ui-strings.mjs --check  exit 1 when the files are out of date
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src/features/uiStrings/dictionaries')
const OUT = path.join(ROOT, 'public/ui-strings')
const check = process.argv.includes('--check')

fs.mkdirSync(OUT, { recursive: true })
let stale = 0
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.ts') && f !== 'portal.ts').sort()) {
  const locale = file.replace(/\.ts$/, '')
  const dict = (await tsImport(pathToFileURL(path.join(SRC, file)).href, import.meta.url)).default
  const json = JSON.stringify(Object.fromEntries(Object.entries(dict).sort(([a], [b]) => (a < b ? -1 : 1))))
  const target = path.join(OUT, `${locale}.json`)
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== json) { console.error(`stale: ${locale}`); stale++ }
  } else fs.writeFileSync(target, json)
}
if (check && stale) process.exit(1)
console.log(check ? 'ui-strings up to date' : 'ui-strings written')
