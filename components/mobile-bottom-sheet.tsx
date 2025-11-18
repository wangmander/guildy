"use client"

import { useState, useEffect } from "react"
import { X } from 'lucide-react'
import type { Job } from "@/types"
import { JobDetailPanel } from "./job-detail-panel"

interface MobileBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  job: Job | null
  onSaveNotes: (jobId: string, notes: string) => void
}

export function MobileBottomSheet({ isOpen, onClose, job, onSaveNotes }: MobileBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-xl z-50 lg:hidden transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <JobDetailPanel job={job} onSaveNotes={onSaveNotes} isMobile />
        </div>
      </div>
    </>
  )
}
