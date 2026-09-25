import type { Chunk } from "@/lib/types"

export type SessionIndex = {
  chunks: Chunk[]
  vectors: number[][]
  model: string
  dimensions: number
  pages: number | null
  charCount: number
  name: string
  hash: string
}

function keyFor(hash: string, model: string): string {
  return `citewise:v1:${hash}:${model}`
}

export function readSessionIndex(hash: string, model: string): SessionIndex | null {
  return readKey(keyFor(hash, model))
}

export function readSampleSession(sampleId: string, model: string): SessionIndex | null {
  return readKey(`citewise:v1:sample:${sampleId}:${model}`)
}

export function writeSessionIndex(index: SessionIndex, sampleId?: string): void {
  const payload = JSON.stringify(index)
  try {
    sessionStorage.setItem(keyFor(index.hash, index.model), payload)
    if (sampleId) sessionStorage.setItem(`citewise:v1:sample:${sampleId}:${index.model}`, payload)
  } catch {
    // sessionStorage can reject large indexes. The in-memory index still works.
  }
}

function readKey(key: string): SessionIndex | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionIndex
    if (!parsed || !Array.isArray(parsed.chunks) || !Array.isArray(parsed.vectors)) return null
    if (parsed.chunks.length !== parsed.vectors.length || parsed.chunks.length === 0) return null
    return parsed
  } catch {
    return null
  }
}
