import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Choose your plan · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface PlanPageProps {
  error?: string
}

const TRIAL_BENEFITS = [
  "Full agent access for 30 days",
  "Every toolset, including browser automation",
  "Priority execution queue",
  "Full goal history and step logs",
]

const FREE_BENEFITS = [
  "Core agent toolsets",
  "Standard execution queue",
  "Community support",
  "Free for as long as the service exists",
]

export function PlanPage(handle: Handle<PlanPageProps>) {
  return () => {
    const error = handle.props.error
    return (
      <>
        <a className={"auth-top"} href={"/"} aria-label={"Home"}>
          <svg viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path d={"M2.5 5h19L12 20.5z"} fill={"currentColor"}></path>
          </svg>
        </a>
        <main className={"tier-grid"}>
          <section className={"tier"}>
            <div className={"tier-head"}>
              <div>
                <h2>{"Trial"}</h2>
                <span className={"price"}>{"30 days · full access"}</span>
              </div>
            </div>
            <ul>
              {TRIAL_BENEFITS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className={"warn"}>
              {"Your account and all of its data will be permanently deleted from our system 30 days after signup."}
            </p>
            {error ? <p className={"auth-err"}>{error}</p> : null}
            <form method="post" action="/plan">
              <input type="hidden" name="plan" value="trial" />
              <button className={"btn btn-primary"} type="submit">
                {"Start trial"}
              </button>
            </form>
          </section>
          <section className={"tier disabled"}>
            <div className={"tier-head"}>
              <div>
                <h2>{"Free"}</h2>
                <span className={"price"}>{"forever · limited"}</span>
              </div>
              <span className={"soon"}>{"Coming soon"}</span>
            </div>
            <ul>
              {FREE_BENEFITS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <form>
              <button className={"btn"} type="button" disabled>
                {"Coming soon"}
              </button>
            </form>
          </section>
        </main>
      </>
    )
  }
}
