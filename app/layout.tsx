import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { TopNav } from "@/components/top-nav"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Guildy Dashboard",
  description: "Track your job applications with pipeline visualization",
  generator: "v0.app",
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
      <body className="bg-gray-50 h-screen overflow-hidden">
        <SessionProviderWrapper>
          <TopNav />
          <main className="h-[calc(100vh-64px)] overflow-hidden">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
