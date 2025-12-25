"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Pipeline = {
  id: string
  company: string
  role: string
  stage: string
}

export default function PipelinesPage() {
  const [rows, setRows] = useState<Pipeline[]>([])

  useEffect(() => {
    supabase
      .from("pipelines")
      .select("*")
      .then(({ data }) => {
        setRows(data ?? [])
      })
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Pipelines</h1>

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="bg-white border rounded-lg p-4 shadow-sm"
          >
            <div className="font-semibold text-lg">{row.company}</div>
            <div className="text-gray-600">{row.role}</div>
            <div className="text-sm mt-2">{row.stage}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
