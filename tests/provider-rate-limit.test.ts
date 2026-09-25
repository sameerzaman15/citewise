import { APICallError, streamText } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/chat/route"
import { DEMO_BUSY_MESSAGE, INVALID_KEY_MESSAGE } from "@/lib/copy"
import { resetRateLimitsForTests } from "@/lib/rate-limit"

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return {
    ...actual,
    streamText: vi.fn(),
  }
})

const streamTextMock = vi.mocked(streamText)
const savedEnv = { ...process.env }

beforeEach(() => {
  resetRateLimitsForTests()
  streamTextMock.mockReset()
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
  delete process.env.OPENAI_API_KEY
  process.env.GROQ_API_KEY = "gsk_test"
  process.env.LLM_PROVIDER = "groq"
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
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "How long does the battery last?" }],
        },
      ],
      context: [
        {
          n: 1,
          chunkId: "c1",
          text: "The travel mouse lasts seventy hours.",
          page: 2,
          docName: "Catalog",
        },
      ],
    }),
  })
}

function groqRateLimit() {
  return new APICallError({
    message: "Rate limit reached for model openai/gpt-oss-20b on tokens per minute (TPM): Limit 8000",
    url: "https://api.groq.com/openai/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: '{"error":{"code":"rate_limit_exceeded"}}',
    isRetryable: true,
  })
}

describe("Groq rate limit responses", () => {
  it("returns the busy message when Groq responds 429 before streaming", async () => {
    streamTextMock.mockImplementation(() => {
      throw groqRateLimit()
    })
    const response = await POST(chatRequest("203.0.113.50"))
    expect(response.status).toBe(429)
    const body = (await response.json()) as { code: string; message: string }
    expect(body).toEqual({
      code: "PROVIDER_RATE_LIMIT",
      message: DEMO_BUSY_MESSAGE,
    })
  })

  it("puts the busy message in the stream when Groq fails mid-answer", async () => {
    streamTextMock.mockImplementation(
      () =>
        ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "error", error: groqRateLimit() })
              controller.close()
            },
          }),
        }) as ReturnType<typeof streamText>,
    )
    const response = await POST(chatRequest("203.0.113.51"))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain(DEMO_BUSY_MESSAGE)
    expect(text).not.toContain("rate_limit_exceeded")
  })

  it("still reports a rejected key", async () => {
    streamTextMock.mockImplementation(() => {
      throw new APICallError({
        message: "Invalid API key",
        url: "https://api.groq.com/openai/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 401,
      })
    })
    const response = await POST(chatRequest("203.0.113.52"))
    expect(response.status).toBe(401)
    const body = (await response.json()) as { message: string }
    expect(body.message).toBe(INVALID_KEY_MESSAGE)
  })
})
