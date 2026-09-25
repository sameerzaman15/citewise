import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOTS = ["app", "components", "lib", "data/samples", "README.md"]

function filesIn(target: string): string[] {
  const full = path.join(process.cwd(), target)
  if (!statSync(full).isDirectory()) return [full]
  const found: string[] = []
  for (const entry of readdirSync(full)) {
    const next = path.join(full, entry)
    if (statSync(next).isDirectory()) found.push(...filesIn(path.relative(process.cwd(), next)))
    else if (/\.(tsx?|md|txt|css)$/.test(entry)) found.push(next)
  }
  return found
}

describe("user-facing copy", () => {
  it("has no em dashes in the UI, samples, or README", () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of filesIn(root)) {
        const text = readFileSync(file, "utf8")
        if (text.includes("\u2014")) offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders).toEqual([])
  })

  it("does not hardcode the old 0.92 demo score", () => {
    const offenders: string[] = []
    for (const root of ["app", "components", "lib", "README.md"]) {
      for (const file of filesIn(root)) {
        const text = readFileSync(file, "utf8")
        if (/\b0\.92\b/.test(text)) offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders).toEqual([])
  })
})
