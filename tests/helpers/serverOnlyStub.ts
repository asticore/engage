// Vitest stand-in for the `server-only` package. Next.js resolves the real package in the app; the
// package is not a dependency of this repo, so specs that import a server module get this empty module.
export {}
