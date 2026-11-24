import type { Handle } from "remix/component"

export interface ThreadMessage {
  role: string
  text: string
  error?: boolean
}

const SUGGESTIONS = [
  "Is everything working right now?",
  "How do I sign in?",
  "Why did my request fail?",
]

export function SupportThread(handle: Handle<{ messages: ThreadMessage[]; empty: boolean }>) {
  return () => {
    const { messages, empty } = handle.props
    if (empty || !messages.length) {
      return (
        <div class="sw-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
            <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
            <path d="M8 9.5h8M8 12.5h5" />
          </svg>
          <h4>{"No messages yet"}</h4>
          <p>
            {"Ask anything about the bot. Answers come from an AI assistant, available around the clock."}
          </p>
          <div class="sw-chips">
            {SUGGESTIONS.map((s) => (
              <form key={s} method="post" action="/support/chat" data-rmx-target="sw-thread">
                <input type="hidden" name="mode" value="send" />
                <input type="hidden" name="message" value={s} />
                <input type="hidden" name="history" value="[]" />
                <button class="sw-chip" type="submit">
                  {s}
                </button>
              </form>
            ))}
          </div>
        </div>
      )
    }
    return (
      <>
        {messages.map((m, i) => (
          <div
            key={i}
            class={"sw-msg " + (m.role === "user" ? "user" : "bot") + (m.error ? " err" : "")}
            data-role={m.role}
          >
            {m.text}
          </div>
        ))}
      </>
    )
  }
}
