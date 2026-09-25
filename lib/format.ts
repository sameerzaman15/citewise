export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, ms) / 1000
  return `${seconds.toFixed(1)}s`
}

export function formatScore(score: number): string {
  return score.toFixed(3)
}
