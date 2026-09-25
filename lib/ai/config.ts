export type LlmProviderId = "openai" | "groq" | "none"
export type EmbeddingProviderId = "openai" | "browser"
export type RateLimitBackend = "upstash" | "memory"

export const OPENAI_CHAT_DEFAULT = "gpt-5-mini"
export const GROQ_CHAT_DEFAULT = "openai/gpt-oss-20b"
export const OPENAI_EMBED_DEFAULT = "text-embedding-3-small"
export const BROWSER_EMBED_MODEL = "Xenova/all-MiniLM-L6-v2"
export const OPENAI_EMBED_DIMS = 1536
export const BROWSER_EMBED_DIMS = 384

export type PublicStatus = {
  llmProvider: LlmProviderId
  llmModel: string | null
  chatEnabled: boolean
  hasOpenAIKey: boolean
  hasGroqKey: boolean
  embeddingProvider: EmbeddingProviderId
  embeddingModel: string
  embeddingDimensions: number
  rateLimit: {
    chatPer10Min: number
    ingestPer10Min: number
    embedPer10Min: number
    windowMinutes: 10
    dailyRequestCap: number
    dailyCapActive: boolean
    backend: RateLimitBackend
  }
}

export type EnvLike = Record<string, string | undefined>

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

export function embeddingDimensionsFor(model: string): number {
  if (model === "text-embedding-3-large") return 3072
  if (model.includes("MiniLM") || model.includes("minilm")) return BROWSER_EMBED_DIMS
  return OPENAI_EMBED_DIMS
}

/** Default minimum cosine score. Tuned per model family, never a fixed demo score. */
export function defaultThreshold(model: string): number {
  if (model.includes("MiniLM") || model.includes("minilm")) return 0.32
  return 0.3
}

export function hasUpstash(env: EnvLike): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
}

export function rateLimitSettings(env: EnvLike): PublicStatus["rateLimit"] {
  return {
    chatPer10Min: positiveInt(env.RATE_LIMIT_CHAT_PER_10MIN, 20),
    ingestPer10Min: positiveInt(env.RATE_LIMIT_INGEST_PER_10MIN, 6),
    embedPer10Min: positiveInt(env.RATE_LIMIT_EMBED_PER_10MIN, 60),
    windowMinutes: 10,
    dailyRequestCap: positiveInt(env.DAILY_REQUEST_CAP, 500),
    dailyCapActive: hasUpstash(env),
    backend: (hasUpstash(env) ? "upstash" : "memory") as RateLimitBackend,
  }
}

export function resolveProviders(env: EnvLike): PublicStatus {
  const hasOpenAIKey = Boolean(env.OPENAI_API_KEY)
  const hasGroqKey = Boolean(env.GROQ_API_KEY)
  const requestedLlm = env.LLM_PROVIDER
  let llmProvider: LlmProviderId = "none"
  if (requestedLlm === "openai" || requestedLlm === "groq") {
    llmProvider = requestedLlm
  } else if (hasOpenAIKey) {
    llmProvider = "openai"
  } else if (hasGroqKey) {
    llmProvider = "groq"
  }

  const chatEnabled =
    (llmProvider === "openai" && hasOpenAIKey) || (llmProvider === "groq" && hasGroqKey)

  const llmModel =
    llmProvider === "none"
      ? null
      : env.LLM_MODEL?.trim() ||
        (llmProvider === "openai" ? OPENAI_CHAT_DEFAULT : GROQ_CHAT_DEFAULT)

  const requestedEmbed = env.EMBEDDING_PROVIDER
  let embeddingProvider: EmbeddingProviderId
  if (requestedEmbed === "browser") {
    embeddingProvider = "browser"
  } else if (requestedEmbed === "openai") {
    embeddingProvider = hasOpenAIKey ? "openai" : "browser"
  } else if (hasOpenAIKey) {
    embeddingProvider = "openai"
  } else {
    embeddingProvider = "browser"
  }

  const embeddingModel =
    embeddingProvider === "openai"
      ? env.EMBEDDING_MODEL?.trim() || OPENAI_EMBED_DEFAULT
      : BROWSER_EMBED_MODEL

  return {
    llmProvider,
    llmModel,
    chatEnabled,
    hasOpenAIKey,
    hasGroqKey,
    embeddingProvider,
    embeddingModel,
    embeddingDimensions: embeddingDimensionsFor(embeddingModel),
    rateLimit: rateLimitSettings(env),
  }
}
