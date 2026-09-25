import { readFile } from "node:fs/promises"
import path from "node:path"
import { chunkDocument } from "@/lib/chunk"
import { hashText } from "@/lib/hash"
import { parseDocument, DocumentError } from "@/lib/parse-document"
import { readSampleCache, writeSampleCache } from "@/lib/sample-cache"
import { sampleById } from "@/lib/samples"
import { getPublicStatus, embedTexts } from "@/lib/ai/providers"
import type { IngestPayload } from "@/lib/types"

export type IngestResult = IngestPayload

async function readSampleFile(sampleId: string): Promise<{ data: Uint8Array; filename: string; name: string }> {
  const sample = sampleById(sampleId)
  if (!sample) {
    throw new DocumentError("Unknown sample document.", "UNKNOWN_SAMPLE", 404)
  }
  const filename = sample.fileName
  let data: Buffer
  if (filename === "voltline-catalog.txt") {
    data = await readFile(path.join(process.cwd(), "data/samples/voltline-catalog.txt"))
  } else if (filename === "harbor-pine-handbook.pdf") {
    data = await readFile(path.join(process.cwd(), "data/samples/harbor-pine-handbook.pdf"))
  } else if (filename === "tidewatch-help-center.txt") {
    data = await readFile(path.join(process.cwd(), "data/samples/tidewatch-help-center.txt"))
  } else {
    throw new DocumentError("Unknown sample document.", "UNKNOWN_SAMPLE", 404)
  }
  return { data: new Uint8Array(data), filename, name: sample.title }
}

export async function ingestBytes(input: {
  data: Uint8Array
  filename: string
  name: string
  sampleId?: string
}): Promise<IngestResult> {
  const started = Date.now()
  const status = getPublicStatus()
  const cacheKey = input.sampleId
    ? `${input.sampleId}:${status.embeddingProvider}:${status.embeddingModel}`
    : null
  if (cacheKey) {
    const cached = readSampleCache(cacheKey)
    if (cached && (!status.embeddingProvider || cached.model === status.embeddingModel)) {
      const vectors = cached.vectors ?? null
      if (status.embeddingProvider === "browser" || vectors) {
        return {
          name: cached.name,
          sampleId: input.sampleId,
          pages: cached.pages,
          charCount: cached.charCount,
          hash: hashText(cached.chunks.map((chunk) => chunk.text).join("\n")),
          chunks: cached.chunks,
          vectors,
          embeddingProvider: status.embeddingProvider,
          embeddingModel: status.embeddingModel,
          embeddingDimensions: vectors?.[0]?.length ?? status.embeddingDimensions,
          cached: true,
          timings: { parseMs: 0, chunkMs: 0, embedMs: 0, totalMs: Date.now() - started },
        }
      }
    }
  }

  const parseStarted = Date.now()
  const parsed = await parseDocument(input.data, input.filename)
  const parseMs = Date.now() - parseStarted
  const chunkStarted = Date.now()
  const chunks = chunkDocument(
    parsed.pageCount ? parsed.pages : parsed.pages.map((page) => page.text).join("\n\n"),
  )
  const chunkMs = Date.now() - chunkStarted

  let vectors: number[][] | null = null
  let embedMs = 0
  if (status.embeddingProvider === "openai") {
    const embedStarted = Date.now()
    vectors = await embedTexts(chunks.map((chunk) => chunk.text))
    embedMs = Date.now() - embedStarted
  }

  const result: IngestResult = {
    name: input.name,
    sampleId: input.sampleId,
    pages: parsed.pageCount,
    charCount: parsed.charCount,
    hash: hashText(chunks.map((chunk) => chunk.text).join("\n")),
    chunks,
    vectors,
    embeddingProvider: status.embeddingProvider,
    embeddingModel: status.embeddingModel,
    embeddingDimensions: vectors?.[0]?.length ?? status.embeddingDimensions,
    cached: false,
    timings: { parseMs, chunkMs, embedMs, totalMs: Date.now() - started },
  }

  if (cacheKey) {
    writeSampleCache(cacheKey, {
      chunks,
      vectors: vectors ?? undefined,
      model: status.embeddingModel,
      pages: parsed.pageCount,
      charCount: parsed.charCount,
      name: input.name,
    })
  }

  return result
}

export async function ingestSample(sampleId: string): Promise<IngestResult> {
  const file = await readSampleFile(sampleId)
  return ingestBytes({ ...file, sampleId })
}
