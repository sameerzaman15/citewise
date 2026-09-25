export type Chunk = {
  id: string
  index: number
  text: string
  page?: number
  heading?: string
  charStart: number
  charEnd: number
}

export type ContextPassage = {
  n: number
  chunkId: string
  text: string
  page: number | null
  docName: string
}

export type RetrievalHit = {
  chunk: Chunk
  score: number
}

export type SampleKind = "txt" | "pdf" | "md"

export type IngestPayload = {
  name: string
  sampleId?: string
  pages: number | null
  charCount: number
  hash: string
  chunks: Chunk[]
  vectors: number[][] | null
  embeddingProvider: "openai" | "browser"
  embeddingModel: string
  embeddingDimensions: number
  cached: boolean
  timings: { parseMs: number; chunkMs: number; embedMs: number; totalMs: number }
}

export type SampleMeta = {
  id: string
  title: string
  fileName: string
  kind: SampleKind
  bytes: number
  blurb: string
  questions: string[]
}
