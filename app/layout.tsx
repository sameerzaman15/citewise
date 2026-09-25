import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Citewise: chat with your documents",
    template: "%s · Citewise",
  },
  description:
    "Concept demo. Ask a PDF or text file a question and get a streamed answer that cites the passages it used, with similarity scores beside them.",
  applicationName: "Citewise",
  openGraph: {
    title: "Citewise: chat with your documents",
    description:
      "A portfolio demo by Sameer Zaman. Sample documents are fictional. Answers cite the passages they came from.",
    type: "website",
    url: siteUrl,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delayDuration={250}>
            <div className="flex min-h-dvh flex-col max-lg:[&:has([data-citewise])]:h-dvh max-lg:[&:has([data-citewise])]:max-h-dvh max-lg:[&:has([data-citewise])]:overflow-hidden">
              <SiteHeader />
              {children}
              <SiteFooter />
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
