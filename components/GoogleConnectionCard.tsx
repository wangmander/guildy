"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GoogleConnectionCard() {
  const sessionResult = useSession();

  // Extra defensive so we don’t crash even if something is weird in SSR
  const session = sessionResult?.data;
  const status = sessionResult?.status ?? "loading";

  const isConnected = status === "authenticated" && !!session?.user?.email;
  const email = session?.user?.email ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Connection</CardTitle>
        <CardDescription>
          {isConnected
            ? "Your Gmail is connected and syncing interview emails."
            : "Connect Gmail so Guildy can find interviews for you."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex items-center justify-between border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-full border bg-white">
            <span className="text-xs font-semibold">G</span>
          </div>

          <div className="flex flex-col">
            <p className="font-medium">
              {isConnected ? email : "Connect Gmail"}
            </p>
            <p className="text-sm text-gray-600">
              {isConnected
                ? "Guildy is syncing your interview pipeline."
                : "Guildy will scan only interview-related emails."}
            </p>
          </div>
        </div>

        {!isConnected ? (
          <Button
            onClick={() => signIn("google")}
            className="bg-black text-white"
          >
            Connect
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/settings" })}
          >
            Disconnect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

