import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

const sourcePath = path.join(process.cwd(), "data/samples/harbor-pine-handbook.md")
const outputPath = path.join(process.cwd(), "data/samples/harbor-pine-handbook.pdf")

type Block =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "body"; text: string }

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 64
const MARGIN_TOP = 68
const MARGIN_BOTTOM = 60

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  let paragraph: string[] = []
  const flush = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim()
    paragraph = []
    if (text) blocks.push({ type: "body", text })
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flush()
      continue
    }
    if (trimmed.startsWith("# ")) {
      flush()
      blocks.push({ type: "title", text: trimmed.slice(2).trim() })
      continue
    }
    if (trimmed.startsWith("## ")) {
      flush()
      blocks.push({ type: "heading", text: trimmed.slice(3).trim() })
      continue
    }
    paragraph.push(trimmed)
  }
  flush()
  return blocks
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

async function main() {
  const markdown = await readFile(sourcePath, "utf8")
  const blocks = parseMarkdown(markdown)
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const width = PAGE_WIDTH - MARGIN_X * 2

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN_TOP

  const newPage = (): PDFPage => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN_TOP
    return page
  }

  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) newPage()
  }

  const drawLines = (
    lines: string[],
    font: PDFFont,
    size: number,
    leading: number,
    color = rgb(0.11, 0.1, 0.09),
  ) => {
    for (const line of lines) {
      ensure(leading)
      page.drawText(line, { x: MARGIN_X, y: y - size, size, font, color })
      y -= leading
    }
  }

  for (const block of blocks) {
    if (block.type === "title") {
      const lines = wrap(block.text, serifBold, 22, width)
      ensure(36 + lines.length * 28)
      drawLines(lines, serifBold, 22, 28, rgb(0.26, 0.22, 0.55))
      y -= 8
      continue
    }
    if (block.type === "heading") {
      const lines = wrap(block.text, serifBold, 15, width)
      ensure(22 + lines.length * 20)
      y -= 10
      drawLines(lines, serifBold, 15, 20, rgb(0.26, 0.22, 0.55))
      y -= 4
      continue
    }
    const lines = wrap(block.text, serif, 12, width)
    drawLines(lines, serif, 12, 17)
    y -= 8
  }

  const pages = doc.getPages()
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Harbor & Pine Studio  ·  ${index + 1}`, {
      x: MARGIN_X,
      y: 36,
      size: 9,
      font: serif,
      color: rgb(0.4, 0.38, 0.36),
    })
  })

  const count = pages.length
  if (count < 8 || count > 12) {
    throw new Error(`Handbook PDF is ${count} pages. Expected 8 to 12. Adjust the source or the layout.`)
  }

  doc.setTitle("Harbor & Pine Studio employee handbook")
  doc.setAuthor("Harbor & Pine Studio")
  doc.setSubject("Fictional employee handbook for the Citewise demo")
  const bytes = await doc.save()
  await writeFile(outputPath, bytes)
  console.log(`Wrote ${outputPath} (${count} pages, ${bytes.length} bytes)`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
