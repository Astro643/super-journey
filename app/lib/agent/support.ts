import { generate, MODELS } from "./gemini.ts"

const SUPPORT_SYSTEM =
  "You are Controller's support assistant for a Discord server management product. " +
  "Answer the user's question clearly and briefly. Do not invent features."

export interface ChatTurn {
  role: string
  text: string
}

export async function answerSupport(
  message: string,
  history: ChatTurn[],
): Promise<{ reply: string } | { error: string }> {
  try {
    const convo = history.map((m) => `${m.role}: ${m.text}`).join("\n")
    const reply = await generate(
      MODELS.support,
      convo ? `${convo}\nuser: ${message}` : message,
      SUPPORT_SYSTEM,
    )
    return { reply }
  } catch (error) {
    console.error("support chat failed:", error)
    return { error: "Support is temporarily unavailable. Please try again." }
  }
}
