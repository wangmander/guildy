"use client"

import { GoogleConnectionCard } from "@/components/GoogleConnectionCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"

export default function SettingsPage() {
  const sessionResult = useSession()

  // In build-time SSR, useSession() is undefined → avoid destructuring directly.
  const session = sessionResult?.data
  const status = sessionResult?.status

  const connectedEmail = session?.user?.email ?? "Not connected"

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      alert("Account deletion requested. In production, this would fully delete the account.")
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">

        {/* REAL Google Connect / Disconnect */}
        <Card>
          <CardHeader>
            <CardTitle>Email Connection</CardTitle>
            <CardDescription>
              {status === "authenticated"
                ? "Your Gmail account is connected and tracking job applications"
                : "Connect Gmail to automatically track job-related emails"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleConnectionCard />
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
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900 mt-1">{connectedEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Delete Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete Account</p>
                <p className="text-sm text-gray-500">Permanently delete your account and all associated data.</p>
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
