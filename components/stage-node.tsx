"use client"

import type { Stage, Status, Job } from "@/types"
import { StatusTag } from "./status-tag"
import { EtaChip } from "./eta-chip"
import Image from "next/image"

interface StageNodeProps {
  stage: Stage
  status: Status
  eta?: string
  company: Job["company"]
  title: string
  onClick: () => void
  isActive: boolean
}

const stageLabels: Record<Stage, string> = {
  APPLIED: "Applied",
  RECRUITER_SCREEN: "Recruiter Screen",
  INTERVIEW: "Interview",
  OFFER: "Offer",
}

export function StageNode({ stage, status, eta, company, title, onClick, isActive }: StageNodeProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-start p-3 rounded-lg border-2 transition-all hover:shadow-md
        ${isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}
      `}
    >
      <div className="flex items-center gap-2 mb-2 w-full">
        {company.logoUrl && (
          <Image
            src={company.logoUrl || "/placeholder.svg"}
            alt={`${company.name} logo`}
            width={20}
            height={20}
            className="rounded"
          />
        )}
        <span className="font-medium text-sm text-gray-900 truncate">{company.name}</span>
      </div>

      <div className="text-xs text-gray-600 mb-2 text-left line-clamp-1">{title}</div>

      <div className="text-xs font-medium text-gray-800 mb-2">{stageLabels[stage]}</div>

      <div className="flex flex-col gap-1 w-full">
        <StatusTag value={status} />
        {eta && <EtaChip text={eta} />}
      </div>
    </button>
  )
}
