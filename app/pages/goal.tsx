import { Frame } from "remix/component"
import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"
import { GoalWatcher } from "../ui/goal-watcher.tsx"

export const meta: PageMeta = {
  title: "Goal · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface GoalPageProps {
  id: string
  prompt: string
}

export function GoalPage(handle: Handle<GoalPageProps>) {
  return () => {
    const { id } = handle.props
    return (
      <>
        <a className={"mark"} href={"/dashboard"} aria-label={"Console"}>
          <svg viewBox={"0 0 24 24"} width={"24"} height={"24"} aria-hidden={"true"}>
            <path d={"M2.5 5h19L12 20.5z"} fill={"currentColor"}></path>
          </svg>
        </a>
        <main className={"goal-page"}>
          <div className={"goal-card"}>
            <Frame
              name={"goal-" + id}
              src={"/goals/" + id + "/status"}
              fallback={<p className={"op-note"}>{"Loading status…"}</p>}
            />
          </div>
          <p className={"goal-back"}>
            <a href={"/dashboard"}>{"Back to Console"}</a>
          </p>
        </main>
        <GoalWatcher />
      </>
    )
  }
}
