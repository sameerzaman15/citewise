/** Cosine similarity. Returns 0 when either vector is empty or the lengths differ. */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  if (normA === 0 || normB === 0) return 0
  const score = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  if (score > 1) return 1
  if (score < -1) return -1
  return score
}
