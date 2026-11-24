import { sql } from "./db.ts"

// Postgres-backed key/value + progress store (replaces Upstash Redis).
// goal_kv holds small JSON values with optional TTL; goal progress is kept
// as a JSON array under `progress:<goalId>` — single-writer per goal, so
// read-modify-write is safe.

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const rows = await sql`
    SELECT value FROM goal_kv
    WHERE key = ${key} AND (expires_at IS NULL OR expires_at > now())
  `
  return (rows[0]?.value as T | undefined) ?? null
}

export async function kvSet(key: string, value: unknown, opts?: { ex?: number }) {
  const expiresAt = opts?.ex ? new Date(Date.now() + opts.ex * 1000) : null
  await sql`
    INSERT INTO goal_kv (key, value, expires_at, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt}, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = now()
  `
}

export async function kvDel(key: string) {
  await sql`DELETE FROM goal_kv WHERE key = ${key}`
}

export async function kvExists(key: string) {
  const rows = await sql`
    SELECT 1 FROM goal_kv
    WHERE key = ${key} AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `
  return rows.length > 0
}

export const setResult = (goalId: string, result: unknown) =>
  kvSet(`result:${goalId}`, result)

export const getResult = (goalId: string) => kvGet(`result:${goalId}`)

export async function pushProgress(goalId: string, entry: unknown) {
  const key = `progress:${goalId}`
  const current = await kvGet<unknown[]>(key)
  const list = Array.isArray(current) ? current : []
  list.push(entry)
  await kvSet(key, list)
}

export async function getProgress(goalId: string) {
  const value = await kvGet<unknown[]>(`progress:${goalId}`)
  return Array.isArray(value) ? value : []
}

export async function ping() {
  await sql`SELECT 1`
}
