import type { Chunk } from "@/lib/types"

export type SampleCacheEntry = {
  chunks: Chunk[]
  vectors?: number[][]
  model: string
  pages: number | null
  charCount: number
  name: string
}

const cache = new Map<string, SampleCacheEntry>()

export function readSampleCache(key: string): SampleCacheEntry | undefined {
  return cache.get(key)
}

export function writeSampleCache(key: string, entry: SampleCacheEntry): void {
  cache.set(key, entry)
}
