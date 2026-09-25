"use client"

export type EmbedEvent =
  | { type: "ready"; model: string; dimensions: number }
  | { type: "progress"; loaded: number; total: number; file: string }
  | { type: "embed-progress"; id: string; done: number; total: number }
  | { type: "vectors"; id: string; vectors: number[][]; dimensions: number; model: string }
  | { type: "error"; id?: string; message: string }

type Listener = (event: EmbedEvent) => void

let worker: Worker | null = null
const listeners = new Set<Listener>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/embed.worker.ts", import.meta.url), { type: "module" })
    worker.addEventListener("message", (event: MessageEvent<EmbedEvent>) => {
      for (const listener of listeners) listener(event.data)
    })
  }
  return worker
}

export function onEmbedEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function waitFor(id: string | undefined, type: "ready" | "vectors"): Promise<EmbedEvent> {
  const current = getWorker()
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<EmbedEvent>) => {
      const data = event.data
      if (data.type === "error" && data.id === id) {
        current.removeEventListener("message", onMessage)
        reject(new Error(data.message))
        return
      }
      if (data.type === type && (type === "ready" || (data.type === "vectors" && data.id === id))) {
        current.removeEventListener("message", onMessage)
        resolve(data)
      }
    }
    current.addEventListener("message", onMessage)
  })
}

export async function ensureBrowserModel(): Promise<{ model: string; dimensions: number }> {
  const pending = waitFor(undefined, "ready")
  getWorker().postMessage({ type: "load" })
  const event = await pending
  if (event.type !== "ready") throw new Error("The embedding model did not load.")
  return { model: event.model, dimensions: event.dimensions }
}

export async function embedWithBrowser(texts: string[]): Promise<{
  vectors: number[][]
  dimensions: number
  model: string
}> {
  const id = crypto.randomUUID()
  const pending = waitFor(id, "vectors")
  getWorker().postMessage({ type: "embed", id, texts })
  const event = await pending
  if (event.type !== "vectors") throw new Error("Embedding failed.")
  return { vectors: event.vectors, dimensions: event.dimensions, model: event.model }
}
