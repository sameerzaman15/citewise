import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { embed, embedMany, type EmbeddingModel, type LanguageModel } from "ai"
import { resolveProviders, type EnvLike, type PublicStatus } from "@/lib/ai/config"

export function getPublicStatus(env: EnvLike = process.env): PublicStatus {
  return resolveProviders(env)
}

export function getChatModel(env: EnvLike = process.env): LanguageModel | null {
  const config = resolveProviders(env)
  if (!config.chatEnabled || !config.llmModel) return null
  if (config.llmProvider === "openai") {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
    return openai(config.llmModel)
  }
  const groq = createGroq({ apiKey: env.GROQ_API_KEY })
  return groq(config.llmModel)
}

export function chatProviderOptions(
  env: EnvLike = process.env,
): Record<string, Record<string, string>> | undefined {
  const config = resolveProviders(env)
  if (config.llmProvider === "openai") {
    return { openai: { reasoningEffort: "minimal" } }
  }
  if (config.llmProvider === "groq") {
    return { groq: { reasoningEffort: "low" } }
  }
  return undefined
}

function embeddingModel(env: EnvLike): { model: EmbeddingModel; id: string } | null {
  const config = resolveProviders(env)
  if (config.embeddingProvider !== "openai" || !env.OPENAI_API_KEY) return null
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  return { model: openai.embedding(config.embeddingModel), id: config.embeddingModel }
}

export async function embedTexts(texts: string[], env: EnvLike = process.env): Promise<number[][] | null> {
  const selected = embeddingModel(env)
  if (!selected || texts.length === 0) return null
  const vectors: number[][] = []
  const batchSize = 64
  for (let index = 0; index < texts.length; index += batchSize) {
    const values = texts.slice(index, index + batchSize)
    const result = await embedMany({ model: selected.model, values })
    vectors.push(...result.embeddings)
  }
  return vectors
}

export async function embedQuery(text: string, env: EnvLike = process.env): Promise<number[] | null> {
  const selected = embeddingModel(env)
  if (!selected) return null
  const result = await embed({ model: selected.model, value: text })
  return result.embedding
}
