import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { TopNav } from "@/components/top-nav"
import { SessionProvider } from "next-auth/react"

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
        {/* GLOBAL SESSION PROVIDER */}
        <SessionProvider>
          <TopNav />
          <main className="h-[calc(100vh-64px)] overflow-hidden">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}
