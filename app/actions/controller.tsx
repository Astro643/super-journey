import { createController } from "remix/router"
import { redirect } from "remix/response/redirect"
import type { RemixNode } from "remix/component"

import { assets } from "../assets.ts"
import { routes } from "../routes.ts"
import { DashboardPage, meta as dashboardMeta } from "../pages/dashboard.tsx"
import { DocsPage, meta as docsMeta } from "../pages/docs.tsx"
import { GoalPage, meta as goalMeta } from "../pages/goal.tsx"
import { HomePage, meta as homeMeta } from "../pages/home.tsx"
import { LoginPage, meta as loginMeta } from "../pages/login.tsx"
import { PlanPage, meta as planMeta } from "../pages/plan.tsx"
import { PrivacyPage, meta as privacyMeta } from "../pages/privacy.tsx"
import { SignupPage, meta as signupMeta } from "../pages/signup.tsx"
import { TermsPage, meta as termsMeta } from "../pages/terms.tsx"
import { NotFoundPage, meta as notFoundMeta } from "../pages/not-found.tsx"
import { auth } from "../lib/auth.ts"
import { Document } from "./document.tsx"
import { GoalCard, loadGoalCard } from "./goal-card.tsx"
import { loadStatus, StatusCard, StatusDot } from "./status-card.tsx"
import { SupportThread, type ThreadMessage } from "./support-thread.tsx"
import { cancelGoal, confirmGoal, getGoal, recordGoal, sql } from "../lib/agent/db.ts"
import { setResult } from "../lib/agent/store.ts"
import { resolveGoalControl, startGoal } from "../lib/agent/runner.ts"
import { answerSupport, type ChatTurn } from "../lib/agent/support.ts"

const MAX_MESSAGE = 2000
const MAX_CHAT = 600
const HISTORY_MAX = 8

function isFrameRequest(request: Request) {
  return request.headers.get("x-remix-frame") === "true"
}

function isDocumentNavigation(request: Request) {
  return request.headers.get("sec-fetch-mode") === "navigate"
}

interface RenderContext {
  request: Request
  render: (node: RemixNode, init?: ResponseInit) => Response | Promise<Response>
}

async function requireUser(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    return session?.user ?? null
  } catch {
    return null
  }
}

function getSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") return h.getSetCookie()
  const single = headers.get("set-cookie")
  return single ? [single] : []
}

function authRedirect(path: string, headers?: Headers) {
  const res = redirect(path, 303)
  if (headers) {
    for (const cookie of getSetCookies(headers)) res.headers.append("set-cookie", cookie)
  }
  return res
}

function authError(error: unknown, fallback: string) {
  const body = (error as { body?: { message?: string } })?.body
  return body?.message || fallback
}

async function goalError(context: RenderContext, message: string) {
  if (isDocumentNavigation(context.request)) {
    return context.render(
      <Document meta={{ title: "Goal · Controller" }}>
        <main>
          <p className="op-note" style={{ maxWidth: "680px", margin: "120px auto" }}>
            {message}
          </p>
          <p style={{ textAlign: "center" }}>
            <a href="/dashboard">{"Back to Console"}</a>
          </p>
        </main>
      </Document>,
      { status: 400 },
    )
  }
  return context.render(<p className="op-note">{message}</p>, {
    status: 400,
    headers: { "x-goal-error": message, "cache-control": "no-store" },
  })
}

function retryCard(goalId: string) {
  return (
    <article class="op" data-id={goalId}>
      <div class="op-note">{"Status unavailable — retrying…"}</div>
    </article>
  )
}

async function loadCard(goalId: string) {
  try {
    return await loadGoalCard(goalId)
  } catch {
    return null
  }
}

async function goalMutationResponse(context: RenderContext, goalId: string) {
  if (isFrameRequest(context.request)) {
    const card = await loadCard(goalId)
    if (card) return context.render(<GoalCard {...card} />, { headers: { "cache-control": "no-store" } })
    return context.render(retryCard(goalId), { headers: { "cache-control": "no-store" } })
  }
  return redirect(`/goals/${goalId}`, 303)
}

function readHistory(raw: FormDataEntryValue | null): ChatTurn[] {
  if (typeof raw !== "string" || !raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (m): m is { role: string; text: string } =>
          !!m &&
          typeof m === "object" &&
          ((m as { role?: unknown }).role === "user" ||
            (m as { role?: unknown }).role === "assistant"),
      )
      .slice(-HISTORY_MAX)
      .map((m) => ({
        role: m.role,
        text: typeof m.text === "string" ? m.text.slice(0, 800) : "",
      }))
      .filter((m) => m.text)
  } catch {
    return []
  }
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not Found", { status: 404 })
    },

    async goalSubmit(context) {
      const form = await context.request.formData()
      const message = String(form.get("message") ?? "").trim()
      if (!message || message.length > MAX_MESSAGE) {
        return goalError(context, "Describe a goal in 2000 characters or fewer.")
      }
      const user = await requireUser(context.request)
      if (!user) {
        if (isDocumentNavigation(context.request)) return redirect("/login", 303)
        return goalError(context, "Please log in to run goals.")
      }
      const serverId = user.id

      const goalId = crypto.randomUUID()
      try {
        await recordGoal(goalId, serverId, message)
        startGoal(goalId, serverId, message)
      } catch {
        return goalError(context, "The agent backend is unavailable. Please try again shortly.")
      }

      if (isDocumentNavigation(context.request)) {
        return redirect(`/goals/${goalId}`, 303)
      }
      return context.render(<GoalCard id={goalId} prompt={message} status="processing" />, {
        status: 201,
        headers: { "x-goal-id": goalId, "cache-control": "no-store" },
      })
    },

    async goalShow(context) {
      const user = await requireUser(context.request)
      if (!user) {
        if (isDocumentNavigation(context.request)) return redirect("/login", 303)
        return new Response("Unauthorized", { status: 401 })
      }
      let goal = null
      try {
        goal = await getGoal(context.params.id)
      } catch {
        goal = null
      }
      if (!goal) return new Response("Goal not found", { status: 404 })
      return context.render(
        <Document meta={goalMeta}>
          <GoalPage id={goal.id} prompt={goal.message} />
        </Document>,
      )
    },

    async goalStatus(context) {
      const user = await requireUser(context.request)
      if (!user) return new Response("Unauthorized", { status: 401 })
      const card = await loadCard(context.params.id)
      if (!card) {
        return context.render(retryCard(context.params.id), {
          headers: { "cache-control": "no-store" },
        })
      }
      return context.render(<GoalCard {...card} />, { headers: { "cache-control": "no-store" } })
    },

    async goalConfirm(context) {
      const goalId = context.params.id
      try {
        if (await confirmGoal(goalId)) resolveGoalControl(goalId)
      } catch {}
      return goalMutationResponse(context, goalId)
    },

    async goalCancel(context) {
      const goalId = context.params.id
      try {
        if (await cancelGoal(goalId)) {
          resolveGoalControl(goalId)
          await setResult(goalId, { status: "cancelled" })
        }
      } catch {}
      return goalMutationResponse(context, goalId)
    },

    async supportThread(context) {
      return context.render(<SupportThread messages={[]} empty={true} />, {
        headers: { "cache-control": "no-store" },
      })
    },

    async supportChat(context) {
      const form = await context.request.formData()
      const mode = String(form.get("mode") ?? "send")
      const history = readHistory(form.get("history"))

      let messages: ThreadMessage[]
      if (mode === "render") {
        messages = history
      } else {
        const message = String(form.get("message") ?? "").trim().slice(0, MAX_CHAT)
        if (!message) {
          return context.render(<SupportThread messages={history} empty={false} />, {
            status: 400,
            headers: { "cache-control": "no-store" },
          })
        }
        const next: ThreadMessage[] = [...history, { role: "user", text: message }]
        const outcome = await answerSupport(message, history)
        if ("reply" in outcome) {
          next.push({ role: "assistant", text: outcome.reply })
        } else {
          next.push({ role: "assistant", text: outcome.error, error: true })
        }
        messages = next
      }
      return context.render(<SupportThread messages={messages} empty={false} />, {
        headers: { "cache-control": "no-store" },
      })
    },

    async statusCard(context) {
      const status = await loadStatus()
      return context.render(<StatusCard status={status} />, { headers: { "cache-control": "no-store" } })
    },

    async statusDot(context) {
      const status = await loadStatus()
      return context.render(<StatusDot overall={status.overall} />, {
        headers: { "cache-control": "no-store" },
      })
    },

    async loginView(context) {
      const user = await requireUser(context.request)
      if (user) return redirect(user.plan ? "/dashboard" : "/plan", 303)
      return context.render(
        <Document meta={loginMeta}>
          <LoginPage />
        </Document>,
      )
    },

    async loginSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim()
      const password = String(form.get("password") ?? "")
      try {
        const result = await auth.api.signInEmail({
          body: { email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        const plan = (result.response.user as { plan?: string }).plan
        return authRedirect(plan ? "/dashboard" : "/plan", result.headers)
      } catch (error) {
        console.error("[auth] login failed:", error)
        return context.render(
          <Document meta={loginMeta}>
            <LoginPage error={authError(error, "Invalid email or password.")} />
          </Document>,
          { status: 401 },
        )
      }
    },

    async signupView(context) {
      const user = await requireUser(context.request)
      if (user) return redirect(user.plan ? "/dashboard" : "/plan", 303)
      return context.render(
        <Document meta={signupMeta}>
          <SignupPage />
        </Document>,
      )
    },

    async signupSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim()
      const password = String(form.get("password") ?? "")
      const name = email.split("@")[0] || "user"
      try {
        await auth.api.signUpEmail({
          body: { name, email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        return authRedirect("/plan")
      } catch (error) {
        console.error("[auth] signup failed:", error)
        return context.render(
          <Document meta={signupMeta}>
            <SignupPage error={authError(error, "Could not create that account.")} />
          </Document>,
          { status: 400 },
        )
      }
    },

    async planView(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      if (user.plan) return redirect("/dashboard", 303)
      return context.render(
        <Document meta={planMeta}>
          <PlanPage />
        </Document>,
      )
    },

    async planSubmit(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      const form = await context.request.formData()
      const plan = String(form.get("plan") ?? "")
      if (plan !== "trial") {
        return context.render(
          <Document meta={planMeta}>
            <PlanPage error={"That plan is not available yet."} />
          </Document>,
          { status: 400 },
        )
      }
      await sql`UPDATE "user" SET plan = 'trial', "updatedAt" = now() WHERE id = ${user.id}`
      return redirect("/dashboard", 303)
    },

    async logout(context) {
      try {
        const result = await auth.api.signOut({
          headers: context.request.headers,
          returnHeaders: true,
        })
        return authRedirect("/", result.headers)
      } catch {
        return redirect("/", 303)
      }
    },

    async home(context) {
      return context.render(
        <Document meta={homeMeta}>
          <HomePage />
        </Document>,
      )
    },

    async privacy(context) {
      return context.render(
        <Document meta={privacyMeta}>
          <PrivacyPage />
        </Document>,
      )
    },

    async terms(context) {
      return context.render(
        <Document meta={termsMeta}>
          <TermsPage />
        </Document>,
      )
    },

    async dashboard(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      if (!user.plan) return redirect("/plan", 303)
      return context.render(
        <Document meta={dashboardMeta}>
          <DashboardPage />
        </Document>,
      )
    },

    async docs(context) {
      return context.render(
        <Document meta={docsMeta}>
          <DocsPage />
        </Document>,
      )
    },

    async notFound(context) {
      return context.render(
        <Document meta={notFoundMeta}>
          <NotFoundPage />
        </Document>,
        { status: 404 },
      )
    },
  },
})
