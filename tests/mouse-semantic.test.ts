import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { chunkDocument } from "@/lib/chunk"
import { MOUSE_QUERY } from "@/lib/copy"
import { keywordSearch } from "@/lib/keyword-search"
import { VectorStore } from "@/lib/vector-store"

type Fixture = {
  model: string
  query: string
  dimensions: number
  queryVector: string
  chunks: { id: string; heading: string; vector: string }[]
}

function fromBase64(value: string): number[] {
  const buf = Buffer.from(value, "base64")
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4))
}

describe("mouse without cable", () => {
  it("ranks a wireless mouse first using saved MiniLM vectors", () => {
    const fixture = JSON.parse(
      readFileSync(path.join(process.cwd(), "tests/fixtures/mouse-minilm.json"), "utf8"),
    ) as Fixture
    const catalog = readFileSync(path.join(process.cwd(), "data/samples/voltline-catalog.txt"), "utf8")
    const chunks = chunkDocument(catalog)
    expect(fixture.model).toBe("Xenova/all-MiniLM-L6-v2")
    expect(fixture.query).toBe(MOUSE_QUERY)
    expect(fixture.dimensions).toBe(384)
    expect(fixture.chunks).toHaveLength(chunks.length)

    const byId = new Map(fixture.chunks.map((item) => [item.id, fromBase64(item.vector)]))
    const store = new VectorStore()
    store.add(
      chunks.map((chunk) => {
        const vector = byId.get(chunk.id)
        expect(vector?.length).toBe(384)
        return { chunk, vector: vector ?? [] }
      }),
    )

    expect(keywordSearch(chunks, MOUSE_QUERY)).toHaveLength(0)
    const hits = store.search(fromBase64(fixture.queryVector), 4)
    const top = hits[0]
    expect(top).toBeTruthy()
    expect(top?.chunk.text).toMatch(/Glide Wireless Mouse|Arc Bluetooth Mouse|Trek Travel Mouse/)
    expect(top?.chunk.text).not.toMatch(/braided USB cable/)
    expect(top?.score).toBeGreaterThan(0.3)
    expect(top?.score).toBeLessThanOrEqual(1)
    expect(top?.score.toFixed(3)).toMatch(/^\d\.\d{3}$/)
    const wired = hits.findIndex((hit) => hit.chunk.text.includes("Voltline Line Wired Mouse"))
    const wireless = hits.findIndex((hit) =>
      /Glide Wireless Mouse|Arc Bluetooth Mouse|Trek Travel Mouse/.test(hit.chunk.text),
    )
    expect(wireless).toBe(0)
    if (wired !== -1) expect(wireless).toBeLessThan(wired)
  })
})
