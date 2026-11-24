import type { Handle } from "remix/component"

import { sql } from "../lib/agent/db.ts"
import { redis } from "../lib/agent/redis.ts"

export interface StatusInfo {
  overall: string
  label: string
  updated: string
  components: { name: string; detail: string; status: string }[]
}

export async function loadStatus(): Promise<StatusInfo> {
  const check = async (p: Promise<unknown>) => {
    try {
      await p
      return "operational"
    } catch {
      return "outage"
    }
  }
  const [queue, db] = await Promise.all([check(redis.ping()), check(sql`SELECT 1`)])
  const overall = queue === "operational" && db === "operational" ? "operational" : "outage"
  return {
    overall,
    label: overall === "operational" ? "All systems operational" : "Partial outage",
    updated: new Date().toISOString(),
    components: [
      { name: "Agent queue", detail: "", status: queue },
      { name: "Database", detail: "", status: db },
    ],
  }
}

export function StatusCard(handle: Handle<{ status: StatusInfo }>) {
  return () => {
    const { status } = handle.props
    const ok = status.overall === "operational"
    return (
      <div class="sw-card">
        <div class="sw-card-h">
          <b>{"System status"}</b>
          <span id="sw-updated">{updatedAgo(status.updated)}</span>
        </div>
        <div class="sw-overall">
          <span class={"sw-ico " + status.overall}>
            {ok ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5.5 12.5l4.2 4.2L18.5 7.8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
                <path d="M12 6v8M12 18h.01" />
              </svg>
            )}
          </span>
          <div>
            <b id="sw-label">{status.label}</b>
            <small id="sw-sub">
              {ok ? "Everything is running normally" : "We are aware and working through it"}
            </small>
          </div>
        </div>
        <div class="sw-list" id="sw-list">
          {status.components.map((c, i) => (
            <div key={i} class="sw-comp">
              <span>{c.name}</span>
              <span>
                {c.detail}
                <i class={c.status} />
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export function StatusDot(handle: Handle<{ overall: string }>) {
  return () => <span class={"sw-dot " + handle.props.overall} />
}

function updatedAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (!isFinite(s)) return ""
  if (s < 10) return "Updated just now"
  if (s < 90) return "Updated " + s + "s ago"
  return "Updated " + Math.round(s / 60) + " min ago"
}
