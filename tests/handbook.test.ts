import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { chunkDocument } from "@/lib/chunk"
import { parseDocument } from "@/lib/parse-document"

describe("handbook PDF", () => {
  it("keeps page numbers from the text layer", async () => {
    const data = readFileSync(path.join(process.cwd(), "data/samples/harbor-pine-handbook.pdf"))
    const parsed = await parseDocument(new Uint8Array(data), "harbor-pine-handbook.pdf")
    expect(parsed.pageCount).toBeGreaterThanOrEqual(8)
    expect(parsed.pageCount).toBeLessThanOrEqual(12)
    const chunks = chunkDocument(parsed.pages)
    const abroad = chunks.find((chunk) => chunk.text.includes("Working abroad") || chunk.heading === "Working abroad")
    expect(abroad?.page).toBeGreaterThan(0)
    const policy = chunks.filter((chunk) => chunk.heading === "Working abroad" || chunk.text.includes("30 consecutive"))
    expect(policy.some((chunk) => /\bcountry\b/i.test(chunk.text))).toBe(false)
  })
})
