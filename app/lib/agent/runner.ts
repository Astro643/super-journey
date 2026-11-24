import { understand, type Plan } from "./understand.ts"
import { setResult } from "./redis.ts"
import { getGoalStatus, listResumableGoals, setGoalPlan, setGoalStatus } from "./db.ts"
import { deleteGoalBox, executeSteps } from "./box.ts"

const CONFIRM_TIMEOUT_MS = 24 * 60 * 60 * 1000
const DECISION_POLL_MS = 2000

const waiters = new Map<string, () => void>()

// Called by the confirm/cancel routes so a waiting runner wakes immediately
// instead of waiting for the next status poll.
export function resolveGoalControl(goalId: string) {
  const wake = waiters.get(goalId)
  if (wake) {
    waiters.delete(goalId)
    wake()
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForDecision(goalId: string): Promise<"confirmed" | "cancelled" | "expired"> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS
  while (Date.now() < deadline) {
    const status = await getGoalStatus(goalId)
    if (status === "confirmed" || status === "cancelled" || status === "expired") return status
    let wake: (() => void) | undefined
    await Promise.race([
      new Promise<void>((resolve) => {
        wake = () => resolve()
        waiters.set(goalId, wake)
      }),
      sleep(DECISION_POLL_MS),
    ])
    if (wake) waiters.delete(goalId)
  }
  return "expired"
}

export function startGoal(goalId: string, serverId: string, message: string) {
  void runGoal(goalId, serverId, message)
}

async function runGoal(goalId: string, serverId: string, message: string) {
  try {
    const outcome = await understand(message, serverId)
    if (outcome.type === "question") {
      await setResult(goalId, { status: "answered", answer: outcome.answer })
      await setGoalStatus(goalId, "answered")
      return
    }
    await setResult(goalId, { status: "plan", plan: outcome.plan })
    await setGoalPlan(goalId, outcome.plan)
    await confirmAndExecute(goalId, outcome.plan)
  } catch (error) {
    console.error(`goal ${goalId} failed:`, error)
    await setResult(goalId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {})
    await setGoalStatus(goalId, "failed").catch(() => {})
    await deleteGoalBox(goalId).catch(() => {})
  }
}

async function confirmAndExecute(goalId: string, plan: Plan) {
  const decision = await waitForDecision(goalId)
  if (decision === "cancelled") {
    await setResult(goalId, { status: "cancelled" })
    await setGoalStatus(goalId, "cancelled")
    await deleteGoalBox(goalId).catch(() => {})
    return
  }
  if (decision !== "confirmed") {
    await setResult(goalId, { status: "expired" })
    await setGoalStatus(goalId, "expired")
    return
  }

  await executePlan(goalId, plan)
}

async function executePlan(goalId: string, plan: Plan) {
  await setGoalStatus(goalId, "executing")
  try {
    const { results, cancelled } = await executeSteps(goalId, plan.steps, async () => {
      return (await getGoalStatus(goalId)) === "cancelled"
    })
    if (cancelled) {
      await setResult(goalId, { status: "cancelled" })
      await setGoalStatus(goalId, "cancelled")
      return
    }
    await setResult(goalId, { status: "completed", results: { summary: plan.summary, steps: results } })
    await setGoalStatus(goalId, "completed")
  } finally {
    await deleteGoalBox(goalId).catch(() => {})
  }
}

// Runs once at server boot: goals left mid-flight rejoin the pipeline.
// "received" goals re-run understanding, "awaiting_confirmation" goals keep
// waiting on their stored plan, and "executing" goals resume on their Box
// from the last recorded step instead of being failed.
export async function resumeGoals() {
  try {
    const goals = await listResumableGoals()
    for (const goal of goals) {
      const plan = goal.plan as Plan | null
      if (goal.status === "received") {
        void runGoal(goal.id, goal.server_id, goal.message).catch((error) => {
          console.error(`goal ${goal.id} resume failed:`, error)
        })
      } else if (plan?.steps?.length) {
        if (goal.status === "executing") {
          void executePlan(goal.id, plan).catch((error) => {
            console.error(`goal ${goal.id} resume failed:`, error)
          })
        } else {
          void confirmAndExecute(goal.id, plan).catch((error) => {
            console.error(`goal ${goal.id} resume failed:`, error)
          })
        }
      } else {
        await setGoalStatus(goal.id, "failed")
      }
    }
  } catch (error) {
    console.error("goal recovery failed:", error)
  }
}
