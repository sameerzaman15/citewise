import { beforeEach, describe, expect, it } from "vitest"
import { POST } from "@/app/api/chat/route"
import { NO_KEY_BANNER } from "@/lib/copy"
import { resetRateLimitsForTests, slidingWindowAllow } from "@/lib/rate-limit"

const savedEnv = { ...process.env }

beforeEach(() => {
  resetRateLimitsForTests()
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
  delete process.env.OPENAI_API_KEY
  delete process.env.GROQ_API_KEY
  delete process.env.LLM_PROVIDER
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

function chatRequest(ip: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      messages: [{ role: "user", parts: [{ type: "text", text: "What is the CEO's favorite color?" }] }],
      context: [],
    }),
  })
}

describe("rate limit", () => {
  it("blocks the 21st chat request from one IP", async () => {
    const ip = "203.0.113.21"
    for (let attempt = 1; attempt <= 20; attempt++) {
      const response = await POST(chatRequest(ip))
      expect(response.status, `request ${attempt}`).toBe(503)
      const body = (await response.json()) as { code: string }
      expect(body.code).toBe("NO_API_KEY")
    }
    const limited = await POST(chatRequest(ip))
    expect(limited.status).toBe(429)
    expect(limited.headers.get("Retry-After")).toBeTruthy()
    const body = (await limited.json()) as { code: string; message: string }
    expect(body.code).toBe("RATE_LIMITED")
    expect(body.message).toContain("20 questions per 10 minutes")
    expect(body.message).toMatch(/Try again in \d+ minutes?/)
  })

  it("does not spend a slot on an invalid body", async () => {
    const ip = "203.0.113.22"
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: "{",
      }),
    )
    expect(response.status).toBe(400)
    const decision = slidingWindowAllow({
      key: `chat:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
      now: Date.now(),
    })
    expect(decision.ok).toBe(true)
    expect(decision.remaining).toBe(19)
  })

  it("returns the no-key banner when chat is disabled", async () => {
    const response = await POST(chatRequest("203.0.113.23"))
    const body = (await response.json()) as { code: string; message: string }
    expect(response.status).toBe(503)
    expect(body).toEqual({ code: "NO_API_KEY", message: NO_KEY_BANNER })
  })
})
