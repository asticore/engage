/** What a scheduled job body is handed: the engine, the Worker bindings, a drizzle handle on D1 and the clock. */
export type JobContext = {
  engine: unknown
  env: { D1: D1Database }
  db: unknown
  now: Date
}
