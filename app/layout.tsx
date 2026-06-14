import type React from "react"
import type { Metadata } from "next"
import { Inter, Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

import { PostHogProvider } from "@/components/posthog-provider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

// Design system foundation (spec 1b): Bricolage for display/numerals/brand,
// Hanken for UI/body (body default). opsz axis intentionally not wired.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-bricolage",
})

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
})

export const metadata: Metadata = {
  title: "Guildy",
  description: "Track every pipeline. Prep every stage. Close the offer.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${GeistSans.variable} ${bricolage.variable} ${hanken.variable} antialiased`}
    >
      <body className="min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
