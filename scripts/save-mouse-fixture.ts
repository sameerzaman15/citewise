import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers"
import { chunkDocument } from "../lib/chunk"
import { MOUSE_QUERY } from "../lib/copy"
import { VectorStore } from "../lib/vector-store"

function toBase64(values: number[]): string {
  const floats = Float32Array.from(values)
  return Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength).toString("base64")
}

function fromBase64(value: string): number[] {
  const buf = Buffer.from(value, "base64")
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4))
}

async function embed(extractor: FeatureExtractionPipeline, value: string): Promise<number[]> {
  const output = await extractor(value, { pooling: "mean", normalize: true })
  return Array.from(output.data as ArrayLike<number>)
}

async function main() {
  const text = readFileSync(path.join(process.cwd(), "data/samples/voltline-catalog.txt"), "utf8")
  const chunks = chunkDocument(text)
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  })
  const queryVector = await embed(extractor, MOUSE_QUERY)
  const encoded: { id: string; heading: string; vector: string }[] = []
  for (const chunk of chunks) {
    const vector = await embed(extractor, chunk.text)
    encoded.push({
      id: chunk.id,
      heading: chunk.heading ?? chunk.text.slice(0, 80),
      vector: toBase64(vector),
    })
    process.stdout.write(".")
  }
  process.stdout.write("\n")

  const store = new VectorStore()
  store.add(
    chunks.map((chunk, index) => ({
      chunk,
      vector: fromBase64(encoded[index]!.vector),
    })),
  )
  const ranked = store.search(queryVector, 5)
  for (const hit of ranked) {
    console.log(hit.score.toFixed(4), hit.chunk.heading ?? hit.chunk.text.slice(0, 60))
  }
  console.log("query dims", queryVector.length, "chunks", chunks.length)

  const fixture = {
    model: "Xenova/all-MiniLM-L6-v2",
    query: MOUSE_QUERY,
    dimensions: queryVector.length,
    queryVector: toBase64(queryVector),
    chunks: encoded,
  }
  const target = path.join(process.cwd(), "tests/fixtures/mouse-minilm.json")
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(fixture))
  console.log("wrote", target)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
