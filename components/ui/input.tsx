import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[#1C1E21] shadow-xs transition-colors placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
