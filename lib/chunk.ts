import {
  CHUNK_OVERLAP_CHARS,
  MAX_CHUNKS,
  TARGET_CHUNK_CHARS,
} from "@/lib/copy"
import type { Chunk } from "@/lib/types"

export type ChunkOptions = {
  targetChars?: number
  overlapChars?: number
  maxChunks?: number
}

export type PageInput = {
  page?: number
  text: string
}

type Unit = {
  text: string
  charStart: number
  charEnd: number
  heading?: string
  page?: number
}

function separatorPattern(): RegExp {
  return /(?:^|\n)---[ \t]*(?:\n|$)/g
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function hasProductSeparators(text: string): boolean {
  return separatorPattern().test(text)
}

/**
 * Split on `---` product separators when they are present. Otherwise split on
 * markdown headings and paragraphs. Pack units to about 800 characters. When a
 * single unit is longer than that, split it on word boundaries with overlap.
 * Offsets refer to the normalized text passed in (or the joined page text).
 */
export function chunkDocument(
  input: string | PageInput[],
  options: ChunkOptions = {},
): Chunk[] {
  const target = options.targetChars ?? TARGET_CHUNK_CHARS
  const overlap = options.overlapChars ?? CHUNK_OVERLAP_CHARS
  const maxChunks = options.maxChunks ?? MAX_CHUNKS

  const pages: PageInput[] = Array.isArray(input)
    ? input.map((page) => ({ ...page, text: normalizeNewlines(page.text) }))
    : [{ text: normalizeNewlines(input) }]

  const { full, ranges } = joinPages(pages)
  if (!full.trim()) return []

  if (hasProductSeparators(full)) {
    return emitUnits(splitProducts(full, ranges), target, overlap, maxChunks)
  }
  return packUnits(splitProse(full, ranges), target, overlap, maxChunks)
}

function joinPages(pages: PageInput[]): {
  full: string
  ranges: { page?: number; start: number; end: number }[]
} {
  let full = ""
  const ranges: { page?: number; start: number; end: number }[] = []
  pages.forEach((page, index) => {
    if (index > 0) full += "\n\n"
    const start = full.length
    full += page.text
    ranges.push({ page: page.page, start, end: full.length })
  })
  return { full, ranges }
}

function pageAt(
  ranges: { page?: number; start: number; end: number }[],
  offset: number,
): number | undefined {
  const range = ranges.find((item) => offset >= item.start && offset < item.end)
  return range?.page
}

function sliceTrim(
  full: string,
  start: number,
  end: number,
): { text: string; charStart: number; charEnd: number } | null {
  let left = start
  let right = end
  while (left < right && /\s/.test(full[left] ?? "")) left++
  while (right > left && /\s/.test(full[right - 1] ?? "")) right--
  if (left >= right) return null
  return { text: full.slice(left, right), charStart: left, charEnd: right }
}

function splitProducts(
  full: string,
  ranges: { page?: number; start: number; end: number }[],
): Unit[] {
  const units: Unit[] = []
  const marks = [...full.matchAll(separatorPattern())]
  let cursor = 0
  const push = (start: number, end: number) => {
    const sliced = sliceTrim(full, start, end)
    if (!sliced) return
    const firstLine = sliced.text.split("\n")[0]?.trim()
    units.push({
      ...sliced,
      heading: firstLine || undefined,
      page: pageAt(ranges, sliced.charStart),
    })
  }
  for (const mark of marks) {
    const index = mark.index ?? 0
    push(cursor, index)
    cursor = index + mark[0].length
  }
  push(cursor, full.length)
  return units
}

function splitProse(
  full: string,
  ranges: { page?: number; start: number; end: number }[],
): Unit[] {
  const units: Unit[] = []
  const markdown = /^#{1,6}\s+/m.test(full)

  for (const range of ranges) {
    const slice = full.slice(range.start, range.end)
    let heading: string | undefined
    let offset = 0
    const lines = slice.split("\n")
    let index = 0
    while (index < lines.length) {
      const line = lines[index] ?? ""
      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
      if (headingMatch) {
        heading = headingMatch[2]?.trim() || undefined
        offset += line.length + 1
        index++
        continue
      }
      if (!line.trim()) {
        offset += line.length + 1
        index++
        continue
      }
      const blockStart = offset
      const blockLines: string[] = []
      while (index < lines.length) {
        const current = lines[index] ?? ""
        if (!current.trim() || /^(#{1,6})\s+/.test(current)) break
        blockLines.push(current)
        offset += current.length + 1
        index++
      }
      const raw = blockLines.join("\n")
      const trimmed = raw.trim()
      if (!trimmed) continue
      const lead = raw.length - raw.trimStart().length
      const absolute = range.start + blockStart + lead
      const looksLikeHeading =
        !markdown &&
        blockLines.length === 1 &&
        trimmed.length <= 70 &&
        trimmed.split(/\s+/).length <= 8 &&
        !/[.!?:,;]$/.test(trimmed)
      if (looksLikeHeading) {
        heading = trimmed
        continue
      }
      units.push({
        text: trimmed,
        charStart: absolute,
        charEnd: absolute + trimmed.length,
        heading,
        page: range.page,
      })
    }
  }
  return units
}

/** One retrieval unit per product. Oversized entries are split on word boundaries. */
function emitUnits(units: Unit[], target: number, overlap: number, maxChunks: number): Chunk[] {
  const chunks: Chunk[] = []
  for (const unit of units) {
    const pieces = unit.text.length > target ? splitLong(unit.text, target, overlap) : [{ text: unit.text, localStart: 0 }]
    for (const piece of pieces) {
      chunks.push(makeChunk(chunks.length, piece.text, unit.charStart + piece.localStart, unit))
      if (chunks.length >= maxChunks) return chunks
    }
  }
  return chunks
}

function packUnits(
  units: Unit[],
  target: number,
  overlap: number,
  maxChunks: number,
): Chunk[] {
  const groups: Unit[][] = []
  let current: Unit[] = []
  let length = 0

  const flush = () => {
    if (current.length > 0) groups.push(current)
    current = []
    length = 0
  }

  for (const unit of units) {
    const separator = current.length > 0 ? 2 : 0
    const pageChanged =
      current.length > 0 &&
      current[0]?.page !== undefined &&
      unit.page !== undefined &&
      current[0]?.page !== unit.page
    if (current.length > 0 && (length + separator + unit.text.length > target || pageChanged)) {
      flush()
    }
    current.push(unit)
    length = current.reduce((sum, item, itemIndex) => {
      return sum + item.text.length + (itemIndex > 0 ? 2 : 0)
    }, 0)
  }
  flush()

  const chunks: Chunk[] = []
  for (const group of groups) {
    if (group.length === 1 && group[0] && group[0].text.length > target) {
      const unit = group[0]
      for (const piece of splitLong(unit.text, target, overlap)) {
        chunks.push(makeChunk(chunks.length, piece.text, unit.charStart + piece.localStart, unit))
        if (chunks.length >= maxChunks) return chunks
      }
      continue
    }
    const text = group.map((unit) => unit.text).join("\n\n")
    const first = group[0]
    const last = group[group.length - 1]
    if (!first || !last) continue
    chunks.push({
      id: `c${chunks.length + 1}`,
      index: chunks.length,
      text,
      page: first.page,
      heading: first.heading,
      charStart: first.charStart,
      charEnd: last.charEnd,
    })
    if (chunks.length >= maxChunks) return chunks
  }
  return chunks
}

function makeChunk(index: number, text: string, charStart: number, unit: Unit): Chunk {
  return {
    id: `c${index + 1}`,
    index,
    text,
    page: unit.page,
    heading: unit.heading,
    charStart,
    charEnd: charStart + text.length,
  }
}

export function splitLong(
  text: string,
  target: number,
  overlap: number,
): { text: string; localStart: number }[] {
  if (text.length <= target) return [{ text, localStart: 0 }]
  const parts: { text: string; localStart: number }[] = []
  let start = 0
  while (start < text.length && parts.length < MAX_CHUNKS) {
    let end = Math.min(text.length, start + target)
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end)
      if (space > start + Math.floor(target * 0.4)) end = space
    }
    let sliceStart = start
    let sliceEnd = end
    while (sliceStart < sliceEnd && text[sliceStart] === " ") sliceStart++
    while (sliceEnd > sliceStart && text[sliceEnd - 1] === " ") sliceEnd--
    if (sliceStart < sliceEnd) {
      parts.push({ text: text.slice(sliceStart, sliceEnd), localStart: sliceStart })
    }
    if (end >= text.length) break
    let next = Math.max(start + 1, end - overlap)
    if (next < text.length && text[next] !== " " && (next === 0 || text[next - 1] !== " ")) {
      const forward = text.indexOf(" ", next)
      if (forward !== -1) next = forward + 1
    }
    while (next < text.length && text[next] === " ") next++
    if (next <= start) next = Math.max(start + 1, end)
    start = next
  }
  return parts
}
