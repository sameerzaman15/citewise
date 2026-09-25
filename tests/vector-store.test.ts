import { describe, expect, it } from "vitest"
import { cosine } from "@/lib/cosine"
import type { Chunk } from "@/lib/types"
import { VectorStore } from "@/lib/vector-store"

function chunk(id: string, text: string): Chunk {
  return { id, index: Number(id.slice(1)) - 1, text, charStart: 0, charEnd: text.length }
}

describe("cosine and VectorStore", () => {
  it("scores identical vectors as 1 and orthogonal vectors as 0", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1)
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([1], [])).toBe(0)
    expect(cosine([3, 0], [6, 0])).toBe(1)
  })

  it("returns the closest vectors first", () => {
    const store = new VectorStore()
    store.add([
      { chunk: chunk("c1", "far"), vector: [0, 1] },
      { chunk: chunk("c2", "near"), vector: [1, 0] },
    ])
    const hits = store.search([0.9, 0.1], 2)
    expect(hits.map((hit) => hit.chunk.id)).toEqual(["c2", "c1"])
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 0)
    expect(hits[0]?.score).not.toBe(0.92)
    store.clear()
    expect(store.size).toBe(0)
    expect(store.search([1, 0], 2)).toEqual([])
  })
})
