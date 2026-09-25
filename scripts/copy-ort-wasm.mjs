import { createRequire } from "node:module"
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import path from "node:path"

function findOnnxRuntimeWeb() {
  const require = createRequire(path.join(process.cwd(), "package.json"))
  try {
    return path.dirname(require.resolve("onnxruntime-web/package.json"))
  } catch {
    // pnpm does not hoist this package unless public-hoist-pattern says so.
  }

  const store = path.join(process.cwd(), "node_modules", ".pnpm")
  if (!existsSync(store)) return null
  const preferred = readdirSync(store)
    .filter((name) => name.startsWith("onnxruntime-web@1.22"))
    .sort()
  const fallback = readdirSync(store)
    .filter((name) => name.startsWith("onnxruntime-web@"))
    .sort()
  const match = preferred[0] ?? fallback[0]
  if (!match) return null
  return path.join(store, match, "node_modules", "onnxruntime-web")
}

const root = findOnnxRuntimeWeb()
if (!root) {
  console.warn("copy-ort-wasm: onnxruntime-web was not installed, skipping")
  process.exit(0)
}

const dist = path.join(root, "dist")
const target = path.join(process.cwd(), "public", "ort")
mkdirSync(target, { recursive: true })

const files = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm.wasm",
  "ort-wasm-simd.wasm",
]

let copied = 0
for (const file of files) {
  const from = path.join(dist, file)
  if (!existsSync(from)) continue
  cpSync(from, path.join(target, file))
  copied += 1
}

if (copied === 0) {
  console.warn("copy-ort-wasm: no wasm files copied from onnxruntime-web")
} else {
  console.log(`copy-ort-wasm: copied ${copied} file(s) to public/ort`)
}
