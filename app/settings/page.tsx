"use client"

import { SessionProvider } from "next-auth/react"
import { GoogleConnectionCard } from "@/components/GoogleConnectionCard"

export default function SettingsPage() {
  return (
    <SessionProvider>
      <div className="max-w-3xl mx-auto p-6">
        <GoogleConnectionCard />
      </div>
    </SessionProvider>
  )
}
