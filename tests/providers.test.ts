import { describe, expect, it } from "vitest"
import { resolveProviders } from "@/lib/ai/config"
import { chatProviderOptions, getChatModel, getPublicStatus } from "@/lib/ai/providers"

describe("provider factory", () => {
  it("runs with no keys: browser embeddings and answers off", () => {
    const status = resolveProviders({})
    expect(status.llmProvider).toBe("none")
    expect(status.chatEnabled).toBe(false)
    expect(status.embeddingProvider).toBe("browser")
    expect(status.embeddingModel).toBe("Xenova/all-MiniLM-L6-v2")
    expect(status.embeddingDimensions).toBe(384)
    expect(getChatModel({})).toBeNull()
  })

  it("uses OpenAI for chat and embeddings when that key is set", () => {
    const status = resolveProviders({ OPENAI_API_KEY: "sk-test-secret" })
    expect(status.llmProvider).toBe("openai")
    expect(status.llmModel).toBe("gpt-5-mini")
    expect(status.chatEnabled).toBe(true)
    expect(status.embeddingProvider).toBe("openai")
    expect(status.embeddingModel).toBe("text-embedding-3-small")
    expect(status.embeddingDimensions).toBe(1536)
    expect(status.hasOpenAIKey).toBe(true)
    expect(JSON.stringify(status)).not.toContain("sk-test-secret")
    expect(chatProviderOptions({ OPENAI_API_KEY: "sk-test-secret" })?.openai).toEqual({
      reasoningEffort: "minimal",
    })
    expect(getChatModel({ OPENAI_API_KEY: "sk-test-secret" })).toBeTruthy()
  })

  it("uses Groq for chat and the browser for embeddings", () => {
    const status = resolveProviders({ GROQ_API_KEY: "gsk_test_secret", LLM_PROVIDER: "groq" })
    expect(status.llmProvider).toBe("groq")
    expect(status.llmModel).toBe("openai/gpt-oss-20b")
    expect(status.chatEnabled).toBe(true)
    expect(status.embeddingProvider).toBe("browser")
    expect(JSON.stringify(status)).not.toContain("gsk_test_secret")
    expect(chatProviderOptions({ GROQ_API_KEY: "gsk_test_secret", LLM_PROVIDER: "groq" })?.groq).toEqual({
      reasoningEffort: "low",
    })
  })

  it("falls back to browser embeddings when OpenAI embeddings are requested without a key", () => {
    const status = resolveProviders({ EMBEDDING_PROVIDER: "openai", LLM_PROVIDER: "openai" })
    expect(status.chatEnabled).toBe(false)
    expect(status.embeddingProvider).toBe("browser")
  })

  it("keeps browser embeddings when that provider is explicit, even with an OpenAI key", () => {
    const status = resolveProviders({
      OPENAI_API_KEY: "sk-test-secret",
      EMBEDDING_PROVIDER: "browser",
      LLM_MODEL: "gpt-5-mini",
    })
    expect(status.embeddingProvider).toBe("browser")
    expect(status.embeddingModel).toBe("Xenova/all-MiniLM-L6-v2")
    expect(status.llmModel).toBe("gpt-5-mini")
  })

  it("does not put secrets in the public status payload", () => {
    const status = getPublicStatus({
      OPENAI_API_KEY: "sk-live-looking-value",
      GROQ_API_KEY: "gsk_live_looking_value",
      UPSTASH_REDIS_REST_TOKEN: "upstash-token-value",
    })
    const json = JSON.stringify(status)
    expect(json).not.toContain("sk-live-looking-value")
    expect(json).not.toContain("gsk_live_looking_value")
    expect(json).not.toContain("upstash-token-value")
    expect(status.hasOpenAIKey).toBe(true)
    expect(status.hasGroqKey).toBe(true)
  })
})
