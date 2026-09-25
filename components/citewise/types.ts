import type { Chunk, RetrievalHit } from "@/lib/types"

export type SavedRetrieval = {
  query: string
  semantic: RetrievalHit[]
  keyword: Chunk[]
  belowThreshold: boolean
  latencyMs: number
  topK: number
  threshold: number
  embeddingModel: string
  dimensions: number
}

export type ActiveDocument = {
  name: string
  sampleId?: string
  pages: number | null
  chunks: Chunk[]
  vectors: number[][]
  embeddingModel: string
  embeddingDimensions: number
  indexedMs: number
  cached: boolean
  hash: string
}
