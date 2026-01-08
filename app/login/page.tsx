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

    const mockJob2: Job = {
        id: "mock2",
        company: { name: "TechCorp", id: "2" },
        role: "Product Designer",
        title: "Product Designer",
        stage: "APPLIED",
        stage_detail: "Screening",
        tags: ["Design", "Product"],
        predicted_stages: ["Screening", "Portfolio", "Design Challenge", "Team Match", "Offer"],
        status: "ACTIVE"
    } as any

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F8F9FA]">
            {/* Left Column: Content */}
            <div className="flex flex-col justify-center items-start px-8 md:px-16 lg:px-24 py-12">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-12">
                    <div className="w-8 h-8 bg-[#482C4C] rounded-lg flex items-center justify-center text-white font-serif font-bold text-xl">
                        G
                    </div>
                    <span className="text-[#482C4C] font-semibold text-xl tracking-tight">guildy</span>
                </div>

                {/* Hero Text */}
                <h1 className="text-5xl md:text-6xl font-bold text-[#2D2D2D] leading-[1.1] mb-6 tracking-tight">
                    Where interviews <br />
                    <span className="text-[#482C4C]">get slayed</span>
                </h1>

                <p className="text-lg text-gray-600 mb-10 max-w-md leading-relaxed">
                    Track every pipeline. Prep every round. <span className="font-semibold text-gray-900">Close the damn offer.</span>
                </p>

                {/* Auth Buttons */}
                <button
                    onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
                    className="bg-[#2D2D2D] text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-black transition-all shadow-lg hover:shadow-xl flex items-center gap-3 w-full md:w-auto justify-center group"
                >
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                        />
                    </svg>
                    Request early access
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>

                <p className="mt-4 text-sm text-gray-500">Free to try for beta users</p>
            </div>

            {/* Right Column: Visuals */}
            <div className="hidden lg:flex relative bg-[#F4F4F5] items-center justify-center overflow-hidden">
                {/* Decorative background blob */}
                <div className="absolute w-[600px] h-[600px] bg-purple-100 rounded-full blur-3xl opacity-50 -top-20 -right-20"></div>

                <div className="relative w-full max-w-md space-y-4 transform scale-110">
                    {/* Card 1 */}
                    <div className="transform translate-x-8 translate-y-4 shadow-2xl rounded-[3rem]">
                        <PipelineCard
                            job={mockJob1}
                            onClick={() => { }}
                            isSelected={false}
                        />
                    </div>

                    {/* Card 2 */}
                    <div className="transform -translate-x-8 -translate-y-4 shadow-xl opacity-90 rounded-[3rem]">
                        <PipelineCard
                            job={mockJob2}
                            onClick={() => { }}
                            isSelected={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
