import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
      className={`${inter.variable} antialiased h-screen overflow-hidden`}
    >
      <body className="bg-gray-50 h-screen overflow-hidden">{children}</body>
    </html>
  )
}
