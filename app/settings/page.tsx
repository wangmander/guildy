"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const { data: session, status } = useSession()

  const isConnected = status === "authenticated"
  const email = session?.user?.email ?? ""

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Gmail Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Email Connection</CardTitle>
            <CardDescription>
              {isConnected
                ? "Your Gmail account is connected and syncing interview emails."
                : "Connect your Gmail account to automatically track interview emails."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Connected Email</p>
                  <p className="text-sm text-gray-600 mt-1">{email}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => signOut({ callbackUrl: "/settings" })}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Disconnect Gmail
                </Button>
              </div>
            ) : (
              <Button onClick={() => signIn("google")} className="bg-black text-white">
                Connect Gmail
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900 mt-1">
                  {isConnected ? email : "Not signed in"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
