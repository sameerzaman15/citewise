import { env, pipeline, type FeatureExtractionPipeline, type ProgressInfo } from "@huggingface/transformers"
import { BROWSER_EMBED_MODEL } from "@/lib/ai/config"

type Inbound = { type: "load" } | { type: "embed"; id: string; texts: string[] }

const scope = self as unknown as {
  location: { origin: string }
  onmessage: ((event: MessageEvent<Inbound>) => void) | null
  postMessage: (data: unknown) => void
}

env.allowLocalModels = false
env.useBrowserCache = true

const onnx = env.backends.onnx as {
  wasm?: { wasmPaths?: string; numThreads?: number }
}
onnx.wasm = {
  ...(onnx.wasm ?? {}),
  wasmPaths: `${scope.location.origin}/ort/`,
  numThreads: 1,
}

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", BROWSER_EMBED_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (event: ProgressInfo) => {
        if (event.status === "progress") {
          scope.postMessage({
            type: "progress",
            loaded: event.loaded,
            total: event.total,
            file: event.file,
          })
        }
      },
    }).catch((error: unknown) => {
      extractorPromise = null
      throw error
    })
  }
  return extractorPromise
}

scope.onmessage = (event: MessageEvent<Inbound>) => {
  void handle(event.data)
}

async function handle(message: Inbound) {
  try {
    const extractor = await loadExtractor()
    if (message.type === "load") {
      const probe = await extractor("citewise", { pooling: "mean", normalize: true })
      const width = probe.dims[probe.dims.length - 1] ?? probe.data.length
      scope.postMessage({ type: "ready", model: BROWSER_EMBED_MODEL, dimensions: width })
      return
    }

    const vectors: number[][] = []
    for (let index = 0; index < message.texts.length; index++) {
      const output = await extractor(message.texts[index] ?? "", {
        pooling: "mean",
        normalize: true,
      })
      vectors.push(Array.from(output.data))
      scope.postMessage({
        type: "embed-progress",
        id: message.id,
        done: index + 1,
        total: message.texts.length,
      })
    }
    scope.postMessage({
      type: "vectors",
      id: message.id,
      vectors,
      dimensions: vectors[0]?.length ?? 0,
      model: BROWSER_EMBED_MODEL,
    })
  } catch (error) {
    scope.postMessage({
      type: "error",
      id: message.type === "embed" ? message.id : undefined,
      message: error instanceof Error ? error.message : "The embedding model failed to load.",
    })
  }
}
