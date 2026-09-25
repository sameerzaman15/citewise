import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { chunkDocument } from "@/lib/chunk"
import { MOUSE_QUERY } from "@/lib/copy"
import { keywordSearch, tokenize } from "@/lib/keyword-search"

describe("keywordSearch", () => {
  it("requires every query token", () => {
    const chunks = [
      { text: "A wireless mouse with Bluetooth." },
      { text: "A braided USB cable for the mouse." },
      { text: "A mouse without a cable." },
    ]
    expect(keywordSearch(chunks, MOUSE_QUERY)).toEqual([{ text: "A mouse without a cable." }])
  })

  it("returns nothing for mouse without cable on the Voltline catalog", () => {
    const text = readFileSync(path.join(process.cwd(), "data/samples/voltline-catalog.txt"), "utf8")
    expect(tokenize(text)).not.toContain("without")
    const chunks = chunkDocument(text)
    expect(keywordSearch(chunks, MOUSE_QUERY)).toEqual([])
  })
})
