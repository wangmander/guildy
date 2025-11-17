"use client"

import { useState, useEffect } from "react"
import { storage } from "@/lib/storage"
import { ConnectGmailButton } from "@/components/connect-gmail-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState("")

  useEffect(() => {
    setGmailConnected(storage.getGmailConnected())
    setConnectedEmail(storage.getConnectedEmail())
  }, [])

  const handleConnect = () => {
    const email = "example@gmail.com"
    setGmailConnected(true)
    setConnectedEmail(email)
    storage.setGmailConnected(true)
    storage.setConnectedEmail(email)
  }

  const handleDisconnect = () => {
    setGmailConnected(false)
    setConnectedEmail("")
    storage.setGmailConnected(false)
    storage.setConnectedEmail("")
  }

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      // Clear all storage
      handleDisconnect()
      // In a real app, this would call an API to delete the account
      alert("Account deletion requested. In a production app, this would permanently delete your account.")
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Connection</CardTitle>
            <CardDescription>
              {gmailConnected 
                ? "Your Gmail account is connected and tracking job applications" 
                : "Connect your Gmail account to automatically track job application emails"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gmailConnected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Connected Email</p>
                  <p className="text-sm text-gray-600 mt-1">{connectedEmail}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleDisconnect}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Disconnect Gmail
                </Button>
              </div>
            ) : (
              <ConnectGmailButton
                connected={gmailConnected}
                connectedEmail={connectedEmail}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            )}
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your basic profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <p className="text-sm text-gray-900 mt-1">John Doe</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900 mt-1">{gmailConnected ? connectedEmail : "Not connected"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Delete Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete Account</p>
                <p className="text-sm text-gray-500">Permanently delete your account and all associated data</p>
              </div>
              <Button 
                variant="destructive"
                onClick={handleDeleteAccount}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
