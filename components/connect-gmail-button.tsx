"use client"

import { Button } from "@/components/ui/button"
import { Mail, X } from "lucide-react"

interface ConnectGmailButtonProps {
  connected: boolean
  connectedEmail?: string
  onConnect: () => void
  onDisconnect: () => void
  variant?: "default" | "outline"
}

export function ConnectGmailButton({
  connected,
  connectedEmail,
  onConnect,
  onDisconnect,
  variant = "default",
}: ConnectGmailButtonProps) {
  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled className="flex items-center gap-2 bg-transparent">
          <Mail className="h-4 w-4" />
          Connected: {connectedEmail}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={onConnect} variant={variant} className="flex items-center gap-2">
      <Mail className="h-4 w-4" />
      Connect Gmail
    </Button>
  )
}
