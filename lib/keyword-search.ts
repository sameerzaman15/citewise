import { KEYWORD_LABEL } from "@/lib/copy"

export { KEYWORD_LABEL }

/** Case-insensitive tokens. Punctuation is a separator, so "USB-C" becomes "usb" and "c". */
export function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Basic site search: every query word must appear as its own token in the chunk.
 * "mouse without cable" misses a wireless mouse that never says those exact words.
 */
export function keywordSearch<T extends { text: string }>(
  chunks: T[],
  query: string,
): T[] {
  const terms = tokenize(query)
  if (terms.length === 0) return []
  return chunks.filter((chunk) => {
    const tokens = new Set(tokenize(chunk.text))
    return terms.every((term) => tokens.has(term))
  })
}
