import type { Handle } from "remix/component"

import { getGoal, getGoalStatus } from "../lib/agent/db.ts"
import { getProgress, getResult } from "../lib/agent/store.ts"
import type { Plan, PlannedStep } from "../lib/agent/understand.ts"

export type GoalViewStatus =
  | "processing"
  | "executing"
  | "plan_ready"
  | "answered"
  | "completed"
  | "expired"
  | "cancelled"
  | "failed"

const BADGES: Record<GoalViewStatus, { label: string; cls: string }> = {
  processing: { label: "Processing", cls: "s-processing" },
  executing: { label: "Processing", cls: "s-processing" },
  plan_ready: { label: "Approval required", cls: "s-awaiting_approval" },
  answered: { label: "Answered", cls: "s-executed" },
  completed: { label: "Completed", cls: "s-executed" },
  expired: { label: "Expired", cls: "s-unknown" },
  cancelled: { label: "Cancelled", cls: "s-cancelled" },
  failed: { label: "Failed", cls: "s-failed" },
}

export interface GoalCardProps {
  id: string
  prompt: string
  status: GoalViewStatus
  note?: string
  plan?: Plan
  progress?: { label: string; ok: boolean; detail: string }[]
}

interface ResultShape {
  status?: string
  answer?: string
  error?: string
  plan?: Plan
  results?: { summary?: string; steps?: { label: string; ok: boolean; detail: string }[] }
}

function resultsNote(results: NonNullable<ResultShape["results"]>) {
  const steps = Array.isArray(results.steps) ? results.steps : []
  return steps
    .map((s) => `${s.ok ? "✓" : "✗"} ${s.label}${s.detail ? ` — ${s.detail}` : ""}`)
    .join("\n")
}

export async function loadGoalCard(goalId: string): Promise<GoalCardProps | null> {
  const [result, goal, progress] = await Promise.all([
    getResult(goalId),
    getGoal(goalId),
    getProgress(goalId),
  ])
  if (!goal) return null

  const res = (result ?? null) as ResultShape | null
  const prompt = goal.message
  const progressRows = progress as unknown[]
  const done = progressRows.filter(
    (p): p is { label: string; ok: boolean; detail: string } =>
      !!p && typeof p === "object" && typeof (p as { label?: unknown }).label === "string",
  )

  if (res?.status === "plan" || (!res && goal.plan)) {
    const plan = (res?.plan ?? (goal.plan as Plan | null)) as Plan | null
    if (plan?.steps?.length) {
      return { id: goalId, prompt, status: "plan_ready", plan, progress: done }
    }
  }
  if (res?.status === "answered") {
    return { id: goalId, prompt, status: "answered", note: res.answer ?? "" }
  }
  if (res?.status === "completed") {
    return {
      id: goalId,
      prompt,
      status: "completed",
      note: res.results ? resultsNote(res.results) : "",
    }
  }
  if (res?.status === "expired") return { id: goalId, prompt, status: "expired", note: "The plan waited too long for confirmation." }
  if (res?.status === "cancelled") return { id: goalId, prompt, status: "cancelled" }
  if (res?.status === "failed") {
    return { id: goalId, prompt, status: "failed", note: res.error ?? "Something went wrong." }
  }

  const dbStatus = await getGoalStatus(goalId)
  if (dbStatus === "executing") {
    return {
      id: goalId,
      prompt,
      status: "executing",
      note: done.length ? done.map((s) => `${s.ok ? "✓" : "✗"} ${s.label}`).join("\n") : "",
      progress: done,
    }
  }
  return { id: goalId, prompt, status: "processing" }
}

export function GoalCard(handle: Handle<GoalCardProps>) {
  return () => {
    const { id, prompt, status, note, plan, progress } = handle.props
    const badge = BADGES[status]
    const frameTarget = `goal-${id}`
    const planSteps: PlannedStep[] = plan?.steps ?? []
    const total = planSteps.length
    const doneCount = progress?.filter((s) => s.ok).length ?? 0

    return (
      <article class="op" data-id={id} data-status={status}>
        <div class="op-bubble">{prompt}</div>
        <div class="status-row">
          <span class={"badge " + badge.cls}>
            <i />
            {badge.label}
          </span>
          <span class="op-id">{id}</span>
          {status === "executing" && total > 0 ? (
            <span class="op-time">{`${doneCount}/${total} steps`}</span>
          ) : null}
          {status === "plan_ready" ? (
            <>
              <form method="post" action={`/goals/${id}/confirm`} data-rmx-target={frameTarget}>
                <button class="op-cancel op-approve" type="submit">
                  {"Confirm plan"}
                </button>
              </form>
              <form method="post" action={`/goals/${id}/cancel`} data-rmx-target={frameTarget}>
                <button class="op-cancel" type="submit">
                  {"Cancel"}
                </button>
              </form>
            </>
          ) : null}
        </div>
        {status === "plan_ready" && plan ? (
          <div class="op-note">
            {plan.summary ? `${plan.summary}\n` : ""}
            {planSteps.map((step, i) => `${i + 1}. ${step.label}`).join("\n")}
          </div>
        ) : null}
        {status === "executing" && progress?.length ? (
          <div class="op-note">
            {progress.map((s) => `${s.ok ? "✓" : "✗"} ${s.label}${s.detail ? ` — ${s.detail}` : ""}`).join("\n")}
          </div>
        ) : null}
        {note && status !== "executing" ? <div class="op-note">{note}</div> : null}
      </article>
    )
  }
}
