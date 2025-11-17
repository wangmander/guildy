import Link from "next/link"
import { ArrowLeft } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/pipelines"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">About Guildy</h1>

          <div className="prose prose-sm max-w-none">
            <p className="mb-4 text-lg text-gray-700">
              Job searching has turned into a full-time operations problem. When you're running multiple interview pipelines, tracking communication threads, scheduling screens, and preparing for every stage, a simple inbox turns into chaos fast.
            </p>

            <p className="mb-4">
              I've lived this personally. I tried spreadsheets, notes, reminders, and inbox hacks. Still dropped threads, prepped reactively, and wasted time switching context instead of sharpening performance.
            </p>

            <p className="mb-4">
              Guildy is built to solve that. It gives candidates one command center for interview readiness and communication intelligence. No more scattered notes. No more spreadsheet gymnastics. No more wondering where you stand or what to do next.
            </p>

            <p className="mb-6">
              Guildy turns your inbox into a structured, focused interview system so you can show up ready, stay organized, and convert opportunities into offers.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Our Mission</h2>
            <p className="mb-6">
              Bring clarity, structure, and execution quality to interviewing, so candidates can compete like pros and win the roles they deserve.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Company</h2>
            <p className="mb-2">Guildy.ai, Inc.</p>
            <p className="mb-2">San Francisco, CA</p>
            <p className="mb-2">
              <a href="https://guildy.ai" className="text-blue-600 hover:underline">https://guildy.ai</a>
            </p>
            <p className="mb-4">
              <a href="mailto:contact@guildy.ai" className="text-blue-600 hover:underline">contact@guildy.ai</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
