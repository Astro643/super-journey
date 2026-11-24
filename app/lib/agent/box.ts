import { Box } from "@upstash/box"

import { getProgress, pushProgress, redis } from "./redis.ts"
import type { PlannedStep } from "./understand.ts"

const STEP_TIMEOUT_MS = 120_000
const BOX_KEY = (goalId: string) => `box:${goalId}`

let warned = false

export interface StepResult {
  label: string
  ok: boolean
  detail: string
}

export interface PlanResult {
  results: StepResult[]
  cancelled: boolean
}

const clip = (s: string, max = 2000) => (s.length > max ? s.slice(0, max) + "…" : s)

const isStepResult = (p: unknown): p is StepResult =>
  !!p &&
  typeof p === "object" &&
  typeof (p as { label?: unknown }).label === "string" &&
  typeof (p as { ok?: unknown }).ok === "boolean"

// One persistent Box per goal: shell steps run through exec, and the
// headless Chromium is available via box.browser for browser steps.
// The box id is stored in Redis so a restarted process can re-attach
// and resume remaining steps instead of starting over.
async function getOrCreateBox(goalId: string): Promise<Box> {
  const existing = await redis.get<string>(BOX_KEY(goalId))
  if (existing) {
    const box = await Box.get(existing)
    await box.resume().catch(() => {})
    return box
  }
  const box = await Box.create({
    name: `goal-${goalId.slice(0, 8)}`,
    labels: ["app:controller", `goal:${goalId.slice(0, 8)}`],
    runtime: "node",
    browser: true,
    size: "small",
  })
  await redis.set(BOX_KEY(goalId), box.id)
  return box
}

export async function deleteGoalBox(goalId: string) {
  const id = await redis.get<string>(BOX_KEY(goalId))
  if (!id) return
  await redis.del(BOX_KEY(goalId)).catch(() => {})
  await Box.delete({ boxIds: id }).catch((error) => {
    if (!warned) {
      warned = true
      console.error("[box] delete failed:", error)
    }
  })
}

async function runStep(box: Box, command: string) {
  const stream = await box.exec.stream(command)
  let output = ""
  let exitCode: number | null = null
  const deadline = Date.now() + STEP_TIMEOUT_MS
  try {
    for await (const chunk of stream) {
      if (chunk.type === "output") {
        output += chunk.data
      } else if (chunk.type === "exit") {
        exitCode = chunk.exitCode
        break
      }
      if (Date.now() > deadline) {
        await stream.cancel().catch(() => {})
        return { ok: false, detail: "Step timed out." }
      }
    }
  } catch (error) {
    return { ok: false, detail: clip(String(error)) }
  }
  const ok = exitCode === 0
  return { ok, detail: clip(output || (ok ? "" : "Command failed.")) }
}

// Resumable: steps already recorded in Redis progress are skipped, so a
// restarted process continues mid-plan on the same Box.
export async function executeSteps(
  goalId: string,
  steps: PlannedStep[],
  isCancelled: () => Promise<boolean>,
): Promise<PlanResult> {
  const prior = ((await getProgress(goalId)) as unknown[]).filter(isStepResult)
  const results: StepResult[] = [...prior]
  const start = Math.min(prior.length, steps.length)

  if (start >= steps.length) {
    return { results, cancelled: await isCancelled() }
  }
  if (await isCancelled()) return { results, cancelled: true }

  const box = await getOrCreateBox(goalId)
  for (let i = start; i < steps.length; i++) {
    if (await isCancelled()) return { results, cancelled: true }

    const step = steps[i]
    let result: StepResult
    try {
      const res = await runStep(box, step.action)
      result = { label: step.label, ok: res.ok, detail: res.detail }
    } catch (error) {
      result = { label: step.label, ok: false, detail: clip(String(error)) }
    }
    results.push(result)
    await pushProgress(goalId, result).catch(() => {})
  }
  return { results, cancelled: await isCancelled() }
}
