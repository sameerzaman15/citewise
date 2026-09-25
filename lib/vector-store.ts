import { cosine } from "@/lib/cosine"
import type { Chunk, RetrievalHit } from "@/lib/types"

export type VectorRecord = {
  chunk: Chunk
  vector: number[]
}

/** Tiny in-memory index. The browser and the server share this module. */
export class VectorStore {
  private records: VectorRecord[] = []

  add(records: VectorRecord[]): void {
    this.records.push(...records)
  }

  clear(): void {
    this.records = []
  }

  get size(): number {
    return this.records.length
  }

  search(queryVector: number[], k: number): RetrievalHit[] {
    const limit = Math.max(0, Math.floor(k))
    if (limit === 0 || this.records.length === 0) return []
    const scored = this.records.map((record) => ({
      chunk: record.chunk,
      score: cosine(queryVector, record.vector),
    }))
    scored.sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index)
    return scored.slice(0, limit)
  }
}
