import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "pdfjs-dist", "@huggingface/transformers"],
  outputFileTracingIncludes: {
    "/api/ingest": ["./data/samples/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ]
  },
}

export default nextConfig
