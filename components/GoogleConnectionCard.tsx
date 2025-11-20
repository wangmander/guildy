"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useState } from "react"

export function GoogleConnectionCard() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)

  const isConnected = status === "authenticated" && !!session?.user?.email

  const handleConnect = () => {
    signIn("google")
  }

  const handleDisconnect = async () => {
    setLoading(true)
    await signOut({ callbackUrl: "/" })
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
          <span className="text-xs font-bold">G</span>
        </div>
        <div>
          <p className="text-sm font-semibold">
            {isConnected ? "Google connected" : "Connect Google"}
          </p>
          <p className="text-xs text-gray-500">
            {isConnected && session.user?.email
              ? session.user.email
              : "Connect Gmail so Guildy can find interviews for you."}
          </p>
        </div>
      </div>

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
        >
          Connect
        </button>
      )}
    </div>
  )
}

