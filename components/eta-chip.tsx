"use client"

interface EtaChipProps {
  text: string
}

export function EtaChip({ text }: EtaChipProps) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
      {text}
    </span>
  )
}
