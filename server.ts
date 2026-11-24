import * as http from "node:http"

import { createRequestListener } from "remix/node-fetch-server"

import { auth } from "./app/lib/auth.ts"
import { initDb } from "./app/lib/agent/db.ts"
import { resumeGoals } from "./app/lib/agent/runner.ts"
import { router } from "./app/router.ts"

initDb()
  .then(() => resumeGoals())
  .catch((error) => {
    console.error("[agent] startup init failed:", error)
  })

const handler = createRequestListener(async (request) => {
  if (new URL(request.url).pathname.startsWith("/api/auth/")) {
    return auth.handler(request)
  }
  return router.fetch(request)
})

const port = Number(process.env.PORT ?? 44100)
const server = http.createServer(handler)

server.listen(port, () => {
  console.log(`Controller listening on http://localhost:${port}`)
})
