"use client"

import { signIn } from "next-auth/react"

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center pt-[15vh] p-4">

            {/* Center Content - Scaled Up */}
            <div className="w-full max-w-[640px] flex flex-col items-start space-y-8">

                {/* Logo Section */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-20 bg-[#482C4C] rounded-b-[2rem] rounded-t-[1rem] flex items-center justify-center text-white font-serif font-bold text-4xl pb-1 shadow-md">
                        G
                    </div>
                    <span className="text-[#482C4C] font-serif font-bold text-5xl tracking-tight">guildy</span>
                </div>

                <div className="space-y-6 w-full">
                    {/* H1: Single color #482C4C */}
                    <h1 className="text-6xl md:text-7xl font-bold text-[#482C4C] leading-[1.1] tracking-tight">
                        Where interviews <br />
                        get slayed
                    </h1>

                    <p className="text-2xl text-[#1C1E21] max-w-lg leading-relaxed">
                        Track every pipeline. Prep every round. <br />
                        Close the damn offer.
                    </p>
                </div>

                {/* CTA Button: Official Google Style Match */}
                <div className="w-full pt-8">
                    <button
                        onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
                        className="w-full bg-white text-[#1f1f1f] border border-[#747775] h-[64px] rounded-full font-roboto font-medium text-[22px] hover:bg-[#F0F4F9] hover:border-[#747775] transition-colors flex items-center justify-center gap-6 relative overflow-hidden"
                    >
                        {/* Google 'G' Logo - Exact Paths */}
                        <div className="w-8 h-8 relative flex items-center justify-center">
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full block">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                        </div>
                        <span className="tracking-normal">Continue with Google</span>
                    </button>
                    <p className="w-full text-center text-gray-400 text-lg mt-4 font-medium">Free to try for beta users</p>
                </div>
            </div>
        </div>
    )
}
