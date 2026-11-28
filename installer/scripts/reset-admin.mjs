#!/usr/bin/env node
// Recovery tool for a lost admin login. Run from this repository (the one the Deploy button created):
//
//   node scripts/reset-admin.mjs list                       shows the email addresses of every admin
//   node scripts/reset-admin.mjs reset you@example.com      sets a new random password for that admin and prints it
//   node scripts/reset-admin.mjs reset you@example.com 'MyNewPassw0rd!'   sets the password you give (12+ characters)
//   node scripts/reset-admin.mjs create example@example.com admin   adds an admin account (any password, so it can be a throwaway start login)
//
// It needs `npx wrangler login` (or CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID) and talks to the
// remote D1 database named in wrangler.jsonc. Nothing is sent anywhere else. The password is hashed here
// the same way the site hashes it, all sessions of that admin are signed out, and the lock is cleared.
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB = 'engage-site'

export function hashPassword(password) {
  const salt = randomBytes(32).toString('hex')
  const hash = pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex')
  return { salt, hash }
}

export function newPassword() {
  return randomBytes(12).toString('base64url')
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

export function resetSql(email, salt, hash) {
  const who = `(SELECT id FROM users WHERE lower(email) = lower(${quote(email)}))`
  return [
    `UPDATE users SET salt = ${quote(salt)}, hash = ${quote(hash)}, login_attempts = 0, lock_until = NULL, reset_password_token = NULL, reset_password_expiration = NULL WHERE id = ${who};`,
    `DELETE FROM users_sessions WHERE _parent_id = ${who};`,
  ].join(' ')
}

export function createSql(email, salt, hash) {
  return [
    `INSERT INTO users (email, salt, hash) VALUES (${quote(email)}, ${quote(salt)}, ${quote(hash)});`,
    `INSERT INTO users_roles ("order", parent_id, value) VALUES (1, (SELECT id FROM users WHERE lower(email) = lower(${quote(email)})), 'admin');`,
  ].join(' ')
}

function d1(command) {
  return execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', command], { cwd: ROOT, encoding: 'utf8' })
}

function main() {
  const [action, email, given] = process.argv.slice(2)
  if (action === 'list') {
    const out = JSON.parse(d1("SELECT u.email AS email FROM users u JOIN users_roles r ON r.parent_id = u.id WHERE r.value = 'admin' ORDER BY u.id"))
    const rows = out?.[0]?.results ?? []
    console.log(rows.length ? rows.map((r) => r.email).join('\n') : 'No admin accounts yet: open /admin on the site to create the first one.')
    return
  }
  if (action === 'reset' && email) {
    const password = given || newPassword()
    if (password.length < 12) throw new Error('The password must be at least 12 characters.')
    const { salt, hash } = hashPassword(password)
    const check = JSON.parse(d1(`SELECT count(*) AS n FROM users WHERE lower(email) = lower(${quote(email)})`))
    if (!check?.[0]?.results?.[0]?.n) throw new Error(`No user with the email ${email}. Run "node scripts/reset-admin.mjs list" to see them.`)
    d1(resetSql(email, salt, hash))
    console.log(`Password reset for ${email}.${given ? '' : `\nNew password: ${password}`}\nSign in at /admin, then change it under your profile.`)
    return
  }
  if (action === 'create' && email) {
    const password = given || newPassword()
    const { salt, hash } = hashPassword(password)
    const check = JSON.parse(d1(`SELECT count(*) AS n FROM users WHERE lower(email) = lower(${quote(email)})`))
    if (check?.[0]?.results?.[0]?.n) throw new Error(`${email} already exists. Use "reset" to change its password.`)
    d1(createSql(email, salt, hash))
    console.log(`Admin ${email} created.${given ? '' : `\nPassword: ${password}`}\nSign in at /admin, then change the email and password under your profile.`)
    return
  }
  console.log('Usage:\n  node scripts/reset-admin.mjs list\n  node scripts/reset-admin.mjs reset <email> [new password]\n  node scripts/reset-admin.mjs create <email> [password]')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
