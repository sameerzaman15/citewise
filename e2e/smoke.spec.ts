import { expect, test } from "@playwright/test"
import { NO_KEY_BANNER, OCR_ERROR, UNSUPPORTED_TYPE, FILE_TOO_LARGE } from "../lib/copy"

test("shows the concept demo label, footer, and no-key banner", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("concept-badge")).toHaveText("Concept demo")
  await expect(page.getByRole("link", { name: "Built by Sameer Zaman" })).toHaveAttribute(
    "href",
    "https://sameer-zaman.vercel.app",
  )
  await expect(page.getByText("Files are processed in memory for this session and not stored.")).toBeVisible()
  await expect(page.getByTestId("no-key-banner")).toHaveText(NO_KEY_BANNER)
  await expect(page.getByTestId("chat-input")).toBeDisabled()
  await expect(page.getByTestId("chat-input")).toHaveAttribute("placeholder", NO_KEY_BANNER)

  const status = await page.request.get("/api/status")
  expect(status.ok()).toBeTruthy()
  const body = await status.json()
  const serialized = JSON.stringify(body)
  expect(serialized).not.toMatch(/sk-|gsk_|UPSTASH_REDIS_REST_TOKEN/)
  expect(body.chatEnabled).toBe(false)
  expect(body.embeddingProvider).toBe("browser")

  const chat = await page.request.post("/api/chat", {
    data: {
      messages: [{ role: "user", parts: [{ type: "text", text: "Hello" }] }],
      context: [],
    },
  })
  expect(chat.status()).toBe(503)
  expect(await chat.json()).toMatchObject({ code: "NO_API_KEY" })
})

test("rejects the wrong file type, an oversized file, and a text-less PDF", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("upload-input").setInputFiles({
    name: "notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("not a real document"),
  })
  await expect(page.locator("p[role=alert]")).toHaveText(UNSUPPORTED_TYPE)

  await page.getByTestId("upload-input").setInputFiles({
    name: "huge.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 97),
  })
  await expect(page.locator("p[role=alert]")).toHaveText(FILE_TOO_LARGE)

  await page.getByTestId("upload-input").setInputFiles("tests/fixtures/blank.pdf")
  await expect(page.locator("p[role=alert]")).toHaveText(OCR_ERROR, { timeout: 30_000 })
})
