"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import Image from "next/image"
import { SlidersHorizontal } from 'lucide-react'

export function TopNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/pipelines" className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo%20M%20%28day%29-oTYCEQbX5fl2hjsV0T23lesFrlTL9Y.png"
              alt="Guildy"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          <div className="absolute left-1/2 -translate-x-1/2">
            <Link
              href="/pipelines"
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                pathname === "/pipelines"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
              )}
            >
              Pipelines
            </Link>
          </div>

          <Link
            href="/settings"
            className={cn(
              "p-2 rounded-md transition-colors",
              pathname === "/settings"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            )}
            aria-label="Settings"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
