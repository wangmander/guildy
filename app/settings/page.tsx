"use client";

import { SessionProvider } from "next-auth/react";
import { GoogleConnectionCard } from "@/components/GoogleConnectionCard";

export default function SettingsPage() {
  return (
    <SessionProvider>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

        <GoogleConnectionCard />
      </div>
    </SessionProvider>
  );
}
