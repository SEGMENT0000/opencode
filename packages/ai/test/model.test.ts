import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { ai, Model } from "../src/effect.js"
import { apis } from "../src/apis.js"
import { OpenAI } from "../src/providers.js"
import { Auth, LLMClient } from "../src/route.js"
import { compileRequest } from "../src/testing.js"
import { it } from "./lib/effect.js"
import { dynamicResponse, observe, type Call } from "./lib/http.js"
import { deltaChunk } from "./lib/openai-chunks.js"
import { sseEvents } from "./lib/sse.js"

const send = (model: Model<"chat">) =>
  Effect.gen(function* () {
    const calls: Array<Call> = []
    yield* LLMClient.generate(ai.request({ model, prompt: "Hi" })).pipe(
      Effect.provide(
        dynamicResponse((input) =>
          observe(calls, input).pipe(
            Effect.as(
              input.respond(sseEvents(deltaChunk({}, "stop")), { headers: { "content-type": "text/event-stream" } }),
            ),
          ),
        ),
      ),
      // Only the outgoing request matters here.
      Effect.exit,
    )
    return calls[0]!
  })

describe("Model", () => {
  it.effect("describes a text model by its API, base URL and auth", () =>
    Effect.gen(function* () {
      const described = Model.make({
        type: "chat",
        id: "gpt-5.5",
        provider: "openai",
        api: apis.openaiResponses,
        baseURL: "https://api.openai.com/v1",
        auth: Auth.bearer("fixture"),
      })
      const fromRoute = apis.openaiResponses
        .with({ endpoint: { baseURL: "https://api.openai.com/v1" }, auth: Auth.bearer("fixture") })
        .model({ id: "gpt-5.5" })

      expect(described.baseURL).toBe("https://api.openai.com/v1")
      expect((yield* compileRequest(ai.request({ model: described, prompt: "Hi" }))).body).toEqual(
        (yield* compileRequest(ai.request({ model: fromRoute, prompt: "Hi" }))).body,
      )
    }),
  )

  it.effect("fills baseURL and auth from the API", () =>
    Effect.gen(function* () {
      const model = OpenAI.configure({ apiKey: "fixture" }).chat("gpt-5.5")

      expect(model.baseURL).toBe("https://api.openai.com/v1")
      expect(model.auth).toBe(model.auth)
    }),
  )

  it.effect("sends a spread-edited baseURL to the new host and keeps auth", () =>
    Effect.gen(function* () {
      const model = OpenAI.configure({ apiKey: "fixture" }).chat("gpt-5.5")
      const call = yield* send({ ...model, baseURL: "https://proxy.test/v1" })

      expect(call.url).toBe("https://proxy.test/v1/chat/completions")
      expect(call.headers.get("authorization")).toBe("Bearer fixture")
    }),
  )

  it.effect("sends a spread-edited path and auth", () =>
    Effect.gen(function* () {
      const model = OpenAI.configure({ apiKey: "fixture" }).chat("gpt-5.5")
      const call = yield* send({ ...model, path: "/v2/chat", auth: Auth.bearer("other") })

      expect(call.url).toBe("https://api.openai.com/v1/v2/chat")
      expect(call.headers.get("authorization")).toBe("Bearer other")
    }),
  )

  it.effect("applies spread-edited options and keeps the API's preset", () =>
    Effect.gen(function* () {
      const model = OpenAI.configure({ apiKey: "fixture" }).responses("gpt-5.5")
      const call = yield* send({ ...model, options: { ...model.options, temperature: 0, maxTokens: 64 } })
      const body = JSON.parse(call.body)

      expect(body.temperature).toBe(0)
      expect(body.max_output_tokens).toBe(64)
      expect(body.store).toBe(false)
    }),
  )
})
