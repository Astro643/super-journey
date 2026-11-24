import { clientEntry } from "remix/component"
import type { Handle } from "remix/component"

const FINAL = new Set([
  "answered",
  "completed",
  "cancelled",
  "expired",
  "failed",
  "rejected",
  "unknown",
  "stalled",
])
const POLL_MS = 2000

export const GoalWatcher = clientEntry(import.meta.url, function GoalWatcher(handle: Handle) {
  handle.queueTask(() => {
    const id = window.location.pathname.split("/").filter(Boolean).pop() ?? ""
    if (!id) return
    const name = "goal-" + id

    const tick = setInterval(() => {
      const el = document.querySelector(`.op[data-id="${CSS.escape(id)}"]`)
      const status = el?.getAttribute("data-status")
      if (status && FINAL.has(status)) {
        clearInterval(tick)
        return
      }
      handle.frames.get(name)?.reload().catch(() => {})
    }, POLL_MS)
    handle.signal.addEventListener("abort", () => clearInterval(tick))
  })

  return () => null
})
