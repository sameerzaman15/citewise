import { FILE_TOO_LARGE } from "@/lib/copy"
import { DocumentError } from "@/lib/parse-document"
import { ingestBytes, ingestSample } from "@/lib/ingest-document"
import { enforceRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "ingest")
  if (limited) return limited

  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return Response.json(
          { code: "MISSING_FILE", message: "Choose a PDF, TXT, or MD file." },
          { status: 400 },
        )
      }
      if (file.size > MAX_BYTES) {
        return Response.json({ code: "FILE_TOO_LARGE", message: FILE_TOO_LARGE }, { status: 413 })
      }
      const data = new Uint8Array(await file.arrayBuffer())
      const result = await ingestBytes({
        data,
        filename: file.name || "upload.txt",
        name: file.name || "Uploaded document",
      })
      return Response.json(result)
    }

    const body = (await request.json()) as { sampleId?: unknown }
    if (typeof body.sampleId !== "string" || !body.sampleId) {
      return Response.json(
        { code: "BAD_REQUEST", message: "Send a file or a sampleId." },
        { status: 400 },
      )
    }
    const result = await ingestSample(body.sampleId)
    return Response.json(result)
  } catch (error) {
    if (error instanceof DocumentError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error("ingest failed", error)
    return Response.json(
      { code: "INGEST_FAILED", message: "The document could not be read. Try a different file." },
      { status: 500 },
    )
  }
}
