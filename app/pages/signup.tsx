import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Create account · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface SignupPageProps {
  error?: string
}

export function SignupPage(handle: Handle<SignupPageProps>) {
  return () => {
    const error = handle.props.error
    return (
      <>
        <a className={"auth-top"} href={"/"} aria-label={"Home"}>
          <svg viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path d={"M2.5 5h19L12 20.5z"} fill={"currentColor"}></path>
          </svg>
        </a>
        <main className={"auth-wrap"}>
          <section className={"auth-hero"}>
            <h1>
              {"THE FUTURE"}
              <br />
              {"OF AGENTS"}
            </h1>
            <p>
              {"Describe a goal in plain language. An agent audits it, plans it, and runs it — while you watch every step."}
            </p>
          </section>
          <section className={"auth-card"}>
            <h2>{"Create your account"}</h2>
            <p className={"sub"}>{"Pick a plan next — takes ten seconds."}</p>
            {error ? <p className={"auth-err"}>{error}</p> : null}
            <form method="post" action="/signup" autoComplete="on">
              <label>
                {"Email"}
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <label>
                {"Password"}
                <input name="password" type="password" required minLength={8} autoComplete="new-password" />
              </label>
              <button className={"btn btn-primary"} type="submit">
                {"Create account"}
              </button>
            </form>
            <p className={"auth-alt"}>
              {"Already have an account? "}
              <a href={"/login"}>{"Sign in"}</a>
            </p>
          </section>
        </main>
      </>
    )
  }
}
