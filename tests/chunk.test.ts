import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { chunkDocument, splitLong } from "@/lib/chunk"

describe("chunkDocument", () => {
  it("keeps product entries apart when they are separated by ---", () => {
    const alpha = `Alpha mouse\n${"wireless desk ".repeat(40)}`
    const beta = `Beta cable\n${"braided lead ".repeat(40)}`
    const chunks = chunkDocument([alpha, "---", beta].join("\n"))
    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.text.startsWith("Alpha mouse")).toBe(true)
    expect(chunks[1]?.text.startsWith("Beta cable")).toBe(true)
    expect(chunks[0]?.id).toBe("c1")
    expect(chunks[1]?.index).toBe(1)
  })

  it("does not pack prose across PDF pages", () => {
    const chunks = chunkDocument([
      { page: 1, text: "Page one stays here with a full sentence." },
      { page: 2, text: "Page two is its own passage." },
    ])
    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.page).toBe(1)
    expect(chunks[1]?.page).toBe(2)
    expect(chunks[1]?.text).toContain("Page two")
  })

  it("splits an oversized passage on word boundaries and overlaps", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`)
    const pieces = splitLong(words.join(" "), 40, 10)
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) {
      expect(piece.text.startsWith(" ")).toBe(false)
      expect(piece.text.endsWith(" ")).toBe(false)
      expect(piece.text).toMatch(/\bword\d+\b/)
    }
    const chunks = chunkDocument(words.join(" "), { targetChars: 40, overlapChars: 10 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.length).toBeLessThanOrEqual(300)
    const rejoined = chunks.map((chunk) => chunk.text).join(" ")
    expect(rejoined).toContain("word0")
    expect(rejoined).toContain("word79")
  })

  it("stops at the chunk cap", () => {
    const pages = Array.from({ length: 12 }, (_, index) => ({
      page: index + 1,
      text: `Section ${index} ${"sentence ".repeat(40)}`,
    }))
    const chunks = chunkDocument(pages, { targetChars: 80, maxChunks: 5 })
    expect(chunks).toHaveLength(5)
  })

  it("keeps each Voltline mouse in its own passage", () => {
    const text = readFileSync(path.join(process.cwd(), "data/samples/voltline-catalog.txt"), "utf8")
    const chunks = chunkDocument(text)
    const names = ["Voltline Glide Wireless Mouse", "Voltline Arc Bluetooth Mouse", "Voltline Trek Travel Mouse", "Voltline Line Wired Mouse"]
    for (const name of names) {
      const matches = chunks.filter((chunk) => chunk.text.includes(name))
      expect(matches, name).toHaveLength(1)
    }
    const glide = chunks.find((chunk) => chunk.text.includes("Voltline Glide Wireless Mouse"))
    expect(glide?.text).not.toMatch(/Arc Bluetooth Mouse|braided USB cable/)
  })
})
