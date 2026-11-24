import postgres from "postgres"

export const sql = postgres(process.env.DATABASE_URL!, { max: 5, idle_timeout: 20 })

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id uuid PRIMARY KEY,
      server_id text NOT NULL,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'received',
      plan jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      image text,
      plan text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "session" (
      id text PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL,
      token text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "account" (
      id text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      scope text,
      password text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS goal_kv (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "verification" (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
}

export async function recordGoal(goalId: string, serverId: string, message: string) {
  await sql`INSERT INTO goals (id, server_id, message) VALUES (${goalId}, ${serverId}, ${message})`
}

export async function getGoal(goalId: string) {
  const rows = await sql`
    SELECT id, server_id, message, status, plan, created_at FROM goals WHERE id = ${goalId}
  `
  return (rows[0] as GoalRow | undefined) ?? null
}

export async function getGoalStatus(goalId: string) {
  const goal = await getGoal(goalId)
  return goal?.status ?? null
}

export async function listResumableGoals() {
  const rows = await sql`
    SELECT id, server_id, message, status, plan FROM goals
    WHERE status IN ('received', 'awaiting_confirmation', 'executing')
  `
  return rows as unknown as GoalRow[]
}

export async function setGoalPlan(goalId: string, plan: unknown) {
  await sql`UPDATE goals SET plan = ${JSON.stringify(plan)}::jsonb, status = 'awaiting_confirmation' WHERE id = ${goalId}`
}

export async function setGoalStatus(goalId: string, status: string) {
  await sql`UPDATE goals SET status = ${status} WHERE id = ${goalId}`
}

export async function confirmGoal(goalId: string) {
  const rows = await sql`
    UPDATE goals SET status = 'confirmed' WHERE id = ${goalId} AND status = 'awaiting_confirmation' RETURNING id
  `
  return rows.length > 0
}

export async function cancelGoal(goalId: string) {
  const rows = await sql`
    UPDATE goals SET status = 'cancelled' WHERE id = ${goalId}
      AND status IN ('received', 'awaiting_confirmation', 'confirmed', 'executing') RETURNING id
  `
  return rows.length > 0
}

export interface GoalRow {
  id: string
  server_id: string
  message: string
  status: string
  plan: unknown
  created_at?: string
}
