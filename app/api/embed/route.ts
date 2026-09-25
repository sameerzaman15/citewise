import { z } from "zod"
import { getPublicStatus, embedQuery, embedTexts } from "@/lib/ai/providers"
import { enforceRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  text: z.string().min(1).max(8000).optional(),
  texts: z.array(z.string().min(1).max(8000)).min(1).max(64).optional(),
})

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "embed")
  if (limited) return limited

  const status = getPublicStatus()
  if (status.embeddingProvider !== "openai") {
    return Response.json(
      {
        code: "BROWSER_EMBEDDINGS",
        message: "Embeddings run in the browser for this deployment.",
        embeddingProvider: status.embeddingProvider,
        embeddingModel: status.embeddingModel,
      },
      { status: 400 },
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ code: "BAD_REQUEST", message: "Send JSON." }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success || (!parsed.data.text && !parsed.data.texts)) {
    return Response.json(
      { code: "BAD_REQUEST", message: "Send a text or texts field." },
      { status: 400 },
    )
  }

  const started = Date.now()
  try {
    if (parsed.data.texts) {
      const vectors = await embedTexts(parsed.data.texts)
      return Response.json({
        vectors,
        model: status.embeddingModel,
        dimensions: vectors?.[0]?.length ?? status.embeddingDimensions,
        ms: Date.now() - started,
      })
    }
    const vector = await embedQuery(parsed.data.text ?? "")
    return Response.json({
      vector,
      model: status.embeddingModel,
      dimensions: vector?.length ?? status.embeddingDimensions,
      ms: Date.now() - started,
    })
  } catch (error) {
    const statusCode = readStatusCode(error)
    if (statusCode === 401) {
      return Response.json(
        {
          code: "INVALID_API_KEY",
          message: "The configured AI key was rejected. Check the key in your environment variables.",
        },
        { status: 401 },
      )
    }
    console.error("embed failed", error)
    return Response.json(
      { code: "EMBED_FAILED", message: "The embedding request failed." },
      { status: 502 },
    )
  }
}

function readStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as { statusCode?: unknown; status?: unknown }
  if (typeof record.statusCode === "number") return record.statusCode
  if (typeof record.status === "number") return record.status
  return undefined
}
