"use client"

import { signIn } from "next-auth/react"
import { PipelineCard } from "@/components/pipeline-card"
import type { Job } from "@/types"

export default function LoginPage() {
    // Background Mock Job
    const mockJob1: Job = {
        id: "mock1",
        company: { name: "CloudScale", id: "1" },
        role: "DevOps Engineer",
        title: "DevOps Engineer",
        stage: "HIRING_MANAGER",
        stage_detail: "Hiring Manager Screen",
        tags: ["Cloud", "DevOps"],
        scheduledMeeting: {
            date: new Date(Date.now() + 86400000).toISOString(),
        },
        predicted_stages: ["Screening", "Hiring manager", "Presentation", "Full loop", "Offer discussion"],
        status: "ACTIVE"
    } as any

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center pt-20 p-4">

            {/* Center Content */}
            <div className="w-full max-w-[540px] flex flex-col items-start space-y-6">

                {/* Logo Section */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-14 bg-[#482C4C] rounded-b-[2rem] rounded-t-[1rem] flex items-center justify-center text-white font-serif font-bold text-3xl pb-1 shadow-md">
                        G
                    </div>
                    <span className="text-[#482C4C] font-serif font-bold text-4xl tracking-tight">guildy</span>
                </div>

                <div className="space-y-4 w-full">
                    <h1 className="text-5xl md:text-6xl font-bold text-[#482C4C] leading-[1.1] tracking-tight">
                        Where interviews <br />
                        get slayed
                    </h1>

                    <p className="text-xl text-[#1C1E21] max-w-md leading-relaxed">
                        Track every pipeline. Prep every round. <br />
                        Close the damn offer.
                    </p>
                </div>

                {/* CTA Button: Standard Google Style */}
                <div className="w-full pt-2">
                    <button
                        onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
                        className="w-full bg-white text-[#1f1f1f] border border-[#747775] h-12 rounded-full font-medium text-[16px] hover:bg-gray-50 hover:shadow-sm transition-all flex items-center justify-center gap-3 relative"
                    >
                        {/* Google 'G' Logo */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>
                    <p className="w-full text-center text-gray-400 text-sm mt-3 font-medium">Free to try for beta users</p>
                </div>
            </div>

            {/* Visuals: Stacked Below */}
            <div className="mt-16 relative w-full max-w-[800px] flex flex-col items-center">

                {/* Background Card */}
                <div className="w-full max-w-[700px] transform scale-95 opacity-50 blur-[1px]">
                    <div className="pointer-events-none select-none">
                        <PipelineCard
                            job={mockJob1}
                            onClick={() => { }}
                            isSelected={false}
                        />
                    </div>
                </div>

                {/* Foreground Card: Prep Popover */}
                <div className="absolute top-12 w-full max-w-[600px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform hover:scale-[1.02] transition-transform duration-500">

                    {/* Questions They Might Ask You */}
                    <div className="bg-[#FAF5FF] p-8 border-b border-purple-100">
                        <div className="flex items-center gap-3 mb-4 text-[#7E22CE]">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="font-bold text-lg tracking-tight">Questions They Might Ask You</h3>
                        </div>
                        <ul className="space-y-3">
                            {[
                                "Walk me through a project where you improved reliability.",
                                "How do you collaborate with product and design teams?",
                                "Describe a time you managed infrastructure scaling challenges.",
                                "What's your approach to monitoring and incident response?"
                            ].map((q, i) => (
                                <li key={i} className="flex gap-3 text-gray-700 text-[15px] leading-snug">
                                    <span className="text-[#A855F7] font-bold text-lg leading-none">•</span>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Questions You Should Ask Them */}
                    <div className="bg-[#FFFBEB] p-8">
                        <div className="flex items-center gap-3 mb-4 text-[#B45309]">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <h3 className="font-bold text-lg tracking-tight">Questions You Should Ask Them</h3>
                        </div>
                        <ul className="space-y-3">
                            {[
                                "What does success look like in this role after 90 days?",
                                "How does the team measure operational excellence?",
                                "What are the current challenges the infrastructure team faces?",
                                "What's the team's approach to professional development?"
                            ].map((q, i) => (
                                <li key={i} className="flex gap-3 text-gray-700 text-[15px] leading-snug">
                                    <span className="text-[#F59E0B] font-bold text-lg leading-none">•</span>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

            </div>
        </div>
    )
}
