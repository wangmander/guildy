"use client"

import { signIn } from "next-auth/react"
import { PipelineCard } from "@/components/pipeline-card"
import type { Job } from "@/types"

export default function LoginPage() {
    // Mock Jobs for the visual
    const mockJob1: Job = {
        id: "mock1",
        company: { name: "CloudScale", id: "1" },
        role: "DevOps Engineer",
        title: "DevOps Engineer",
        stage: "HIRING_MANAGER",
        stage_detail: "Hiring Manager Screen",
        tags: ["Cloud", "DevOps"],
        scheduledMeeting: {
            date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        },
        predicted_stages: ["Screening", "Hiring manager", "Presentation", "Full loop", "Offer discussion"],
        status: "ACTIVE"
    } as any

    return (
        <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
            <div className="max-w-[980px] w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start pt-20">
                {/* Left Column: Brand & Value Prop (Facebook style: Left aligned text) */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 py-8">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 bg-[#482C4C] rounded-lg flex items-center justify-center text-white font-serif font-bold text-2xl">
                            G
                        </div>
                        <span className="text-[#482C4C] font-semibold text-3xl tracking-tight">guildy</span>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-bold text-[#1C1E21] leading-tight">
                        Where interviews <br />
                        <span className="text-[#482C4C]">get slayed</span>
                    </h1>

                    <p className="text-lg lg:text-2xl text-[#1C1E21] max-w-md leading-normal">
                        Track every pipeline. Prep every round. Close the damn offer.
                    </p>
                </div>

                {/* Right Column: Auth Card (Floating like FB) */}
                <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center space-y-6 w-full max-w-[400px] mx-auto">
                    {/* Visual Preview (Mini) */}
                    <div className="w-full relative h-[180px] overflow-hidden rounded-lg bg-gray-50 border border-gray-100 mb-2">
                        <div className="transform scale-[0.65] origin-top-left absolute top-3 left-3 w-[150%]">
                            <PipelineCard job={mockJob1} onClick={() => { }} isSelected={false} />
                        </div>
                    </div>

                    <button
                        onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
                        className="bg-[#1877F2] text-white w-full py-3 rounded-md font-bold text-xl hover:bg-[#166FE5] transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <svg className="w-6 h-6 bg-white rounded-full p-0.5 text-[#1877F2]" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
                        </svg>
                        Connect Gmail
                    </button>

                    <div className="border-t border-gray-200 w-full pt-4 text-center">
                        <span className="text-sm text-gray-500 font-medium">Free to try for beta users</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
