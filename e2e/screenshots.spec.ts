import path from "node:path"
import { expect, test } from "@playwright/test"

const docs = path.join(process.cwd(), "docs")

test("loads a sample, runs the mouse comparison, and captures screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.getByRole("button", { name: "Which wireless mouse is made for travel?" }).click()
  await expect(page.getByTestId("embedding-model")).toHaveText("Xenova/all-MiniLM-L6-v2", { timeout: 180_000 })
  await expect(page.getByTestId("chunk-count")).not.toHaveText("0")
  await expect(page.getByTestId("semantic-top")).toContainText(/Trek|wireless|Travel/i, { timeout: 180_000 })
  const score = page.getByTestId("semantic-top").locator("span.font-mono").nth(1)
  await expect(score).toHaveText(/^\d\.\d{3}$/)
  await page.screenshot({ path: path.join(docs, "screenshot-chat.png"), fullPage: false })

  await page.getByTestId("mouse-example").click()
  await expect(page.getByTestId("keyword-count")).toHaveText("0", { timeout: 180_000 })
  await expect(page.getByTestId("semantic-top")).toContainText(/Wireless|Bluetooth|Trek|cordless/i)
  await expect(page.getByTestId("semantic-score")).toContainText(/\d\.\d{3}/)
  await expect(page.getByText("Keyword search needs your exact words.")).toBeVisible()
  await page.screenshot({ path: path.join(docs, "screenshot-compare.png"), fullPage: false })

  await page.getByTestId("upload-input").setInputFiles("data/samples/harbor-pine-handbook.pdf")
  const switchDoc = page.getByRole("button", { name: "Switch document" })
  const switching = await switchDoc
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false)
  if (switching) await switchDoc.click()
  await expect(page.getByTestId("active-doc")).toContainText(/[1-9]\d* pages/, { timeout: 120_000 })
  await expect(page.getByTestId("chunk-count")).not.toHaveText("0")

  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId("mobile-tabs").getByRole("tab", { name: "Document" }).click()
  await expect(page.getByTestId("active-doc")).toBeVisible()
  await page.getByTestId("mobile-tabs").getByRole("tab", { name: "Chat" }).click()
  await expect(page.getByTestId("no-key-banner")).toBeVisible()
  await page.getByTestId("mobile-tabs").getByRole("tab", { name: "Sources" }).click()
  await expect(page.getByTestId("retrieval-panel")).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
  await page.screenshot({ path: path.join(docs, "screenshot-mobile.png"), fullPage: false })
})
