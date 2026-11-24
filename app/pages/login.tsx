import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Sign in · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface LoginPageProps {
  error?: string
}

export function LoginPage(handle: Handle<LoginPageProps>) {
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
            <h2>{"Welcome back"}</h2>
            <p className={"sub"}>{"Sign in to your Console."}</p>
            {error ? <p className={"auth-err"}>{error}</p> : null}
            <form method="post" action="/login" autoComplete="on">
              <label>
                {"Email"}
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <label>
                {"Password"}
                <input name="password" type="password" required autoComplete="current-password" />
              </label>
              <button className={"btn btn-primary"} type="submit">
                {"Sign in"}
              </button>
            </form>
            <p className={"auth-alt"}>
              {"New here? "}
              <a href={"/signup"}>{"Create account"}</a>
            </p>
          </section>
        </main>
      </>
    )
  }
}
