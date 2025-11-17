"use client"

import { ConnectGmailButton } from "./connect-gmail-button"

interface OnboardingBannerProps {
  onConnect: () => void
}

export function OnboardingBanner({ onConnect }: OnboardingBannerProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-blue-600">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-blue-800 font-medium">Connect Gmail to auto-track your job applications</p>
        </div>
        <ConnectGmailButton connected={false} onConnect={onConnect} onDisconnect={() => {}} variant="outline" />
      </div>
    </div>
  )
}
