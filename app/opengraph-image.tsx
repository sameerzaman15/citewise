import { ImageResponse } from "next/og"

export const alt = "Citewise concept demo: chat with a document and see the cited passages."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAF8F3",
          color: "#1C1917",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 2, color: "#4338CA" }}>CONCEPT DEMO</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontFamily: "Georgia" }}>Citewise</div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 32, maxWidth: 820, lineHeight: 1.35 }}>
            Ask a document a question. See the passages, the scores, and the citations.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22 }}>A portfolio demo by Sameer Zaman</div>
      </div>
    ),
    { ...size },
  )
}
