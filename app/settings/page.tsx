"use client";

import { useSession } from "next-auth/react";
import { GoogleConnectionCard } from "@/components/GoogleConnectionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { data: session, status } = useSession();

  const connected = status === "authenticated";
  const connectedEmail = session?.user?.email ?? "Not connected";

  const handleDeleteAccount = () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      alert("Account deletion request submitted.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">

        {/* Google OAuth */}
        <Card>
          <CardHeader>
            <CardTitle>Email Connection</CardTitle>
            <CardDescription>
              {connected
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
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-gray-700">{connectedEmail}</p>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-600">Delete Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
