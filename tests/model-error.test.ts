import { APICallError } from "ai"
import { describe, expect, it } from "vitest"
import { DEMO_BUSY_MESSAGE, INVALID_KEY_MESSAGE } from "@/lib/copy"
import {
  isProviderRateLimit,
  messageForModelError,
  messageFromChatResponse,
  MODEL_UNAVAILABLE_MESSAGE,
  presentChatError,
} from "@/lib/ai/model-error"

function rateLimitError() {
  return new APICallError({
    message: "Rate limit reached for model openai/gpt-oss-20b on tokens per minute (TPM): Limit 8000",
    url: "https://api.groq.com/openai/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: '{"error":{"message":"Rate limit reached","code":"rate_limit_exceeded"}}',
    isRetryable: true,
  })
}

describe("provider rate limit errors", () => {
  it("maps a Groq 429 to the busy message", () => {
    const error = rateLimitError()
    expect(isProviderRateLimit(error)).toBe(true)
    expect(messageForModelError(error)).toBe(DEMO_BUSY_MESSAGE)
  })

  it("keeps the invalid-key message for 401", () => {
    const error = new APICallError({
      message: "Invalid API key",
      url: "https://api.groq.com/openai/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 401,
    })
    expect(messageForModelError(error)).toBe(INVALID_KEY_MESSAGE)
  })

  it("uses a generic retry message for other model failures", () => {
    expect(messageForModelError(new Error("socket hang up"))).toBe(MODEL_UNAVAILABLE_MESSAGE)
  })

  it("shows the busy message for a raw Groq 429 body and keeps our own limiter copy", () => {
    expect(
      messageFromChatResponse(429, {
        error: { message: "Rate limit reached", code: "rate_limit_exceeded" },
      }),
    ).toBe(DEMO_BUSY_MESSAGE)
    expect(
      messageFromChatResponse(429, {
        code: "RATE_LIMITED",
        message: "You've reached the demo limit (20 questions per 10 minutes). Try again in 9 minutes.",
      }),
    ).toContain("demo limit")
    expect(presentChatError("Rate limit reached for tokens per minute")).toBe(DEMO_BUSY_MESSAGE)
  })
})
