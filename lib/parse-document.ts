import { extractText, getDocumentProxy } from "unpdf"
import {
  MAX_CHARS,
  MAX_PAGES,
  OCR_ERROR,
  TOO_MANY_CHARS,
  TOO_MANY_PAGES,
  UNSUPPORTED_TYPE,
} from "@/lib/copy"

export class DocumentError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export type ParsedDocument = {
  pages: { page?: number; text: string }[]
  pageCount: number | null
  charCount: number
}

export function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim())
  return match?.[1]?.toLowerCase() ?? ""
}

export function assertSupportedFile(filename: string, byteLength: number): void {
  const extension = extensionOf(filename)
  if (extension !== "pdf" && extension !== "txt" && extension !== "md") {
    throw new DocumentError(UNSUPPORTED_TYPE, "UNSUPPORTED_TYPE")
  }
  if (byteLength > 4 * 1024 * 1024) {
    throw new DocumentError(
      "This file is over the 4 MB limit.",
      "FILE_TOO_LARGE",
      413,
    )
  }
}

export async function parseDocument(data: Uint8Array, filename: string): Promise<ParsedDocument> {
  assertSupportedFile(filename, data.byteLength)
  const extension = extensionOf(filename)

  if (extension === "pdf") {
    const pdf = await getDocumentProxy(data)
    const extracted = await extractText(pdf, { mergePages: false })
    const texts = Array.isArray(extracted.text) ? extracted.text : [extracted.text]
    if (extracted.totalPages > MAX_PAGES) {
      throw new DocumentError(TOO_MANY_PAGES, "TOO_MANY_PAGES")
    }
    const pages = texts.map((text, index) => ({
      page: index + 1,
      text: text.replace(/\u0000/g, "").trim(),
    }))
    const joined = pages.map((page) => page.text).join("\n")
    if (joined.replace(/\s/g, "").length < 20) {
      throw new DocumentError(OCR_ERROR, "NO_TEXT")
    }
    if (joined.length > MAX_CHARS) {
      throw new DocumentError(TOO_MANY_CHARS, "TOO_MANY_CHARS")
    }
    return { pages, pageCount: extracted.totalPages, charCount: joined.length }
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(data)
  if (text.length > MAX_CHARS) {
    throw new DocumentError(TOO_MANY_CHARS, "TOO_MANY_CHARS")
  }
  return { pages: [{ text }], pageCount: null, charCount: text.length }
}
