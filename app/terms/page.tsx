import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Static in-app Terms of Service. Rendered as normal page content in the shared
// legal shell. No third-party embed, no environment variables required.

const TITLE = "Terms of Service"
const LAST_UPDATED = "Last updated: June 30, 2026"

const INTRO =
  `These Terms of Service ("Terms") govern your access to and use of Guildy, an interview preparation and job-hunt tool available at guildy.ai and app.guildy.ai (the "Service"), operated by Guildy ("we," "us," or "our"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.`

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "1. The Service",
    body: [
      `Guildy helps you organize your job search and prepare for interviews. It generates preparation material, tracks the roles you are pursuing, and provides related tools. The Service is an aid to your own preparation.`,
    ],
  },
  {
    heading: "2. No guarantee of outcomes",
    body: [
      `Guildy does not guarantee any job, interview, offer, salary, or other outcome. The Service provides preparation and organizational tools only. Your results depend on many factors outside our control. Nothing in the Service is a promise of employment or a specific result.`,
    ],
  },
  {
    heading: "3. Eligibility and accounts",
    body: [
      `You must be at least 16 years old to use the Service. You are responsible for the information you provide, for maintaining the security of your account, and for all activity that occurs under it. Notify us promptly at tryguildy@gmail.com if you suspect unauthorized use.`,
    ],
  },
  {
    heading: "4. Subscriptions and billing",
    body: [
      `Guildy offers a free tier and a paid subscription. The paid subscription is billed at $19.99 US per month through our payment provider, Stripe. By subscribing, you authorize us to charge the applicable fee to your payment method on a recurring monthly basis until you cancel. Your subscription renews automatically each month. You can cancel at any time through the customer billing portal, and cancellation stops future charges. Cancellation takes effect at the end of your current billing period, and you keep access to paid features until then. Fees already paid are non-refundable except where required by law. We may change our prices, and if we do, we will give you reasonable notice before the change applies to you.`,
    ],
  },
  {
    heading: "5. Acceptable use",
    body: [
      `You agree not to misuse the Service. You will not use it for any unlawful purpose, attempt to gain unauthorized access to it, interfere with its operation, reverse engineer it except as permitted by law, resell or redistribute it without permission, or use it to harass or harm others. You will not upload content you do not have the right to provide.`,
    ],
  },
  {
    heading: "6. Your content",
    body: [
      `You retain ownership of the content you provide, such as your resume text and the job details you enter. You grant us a limited license to process, store, and use that content solely to operate the Service and provide the features you request, including sending relevant content to the AI providers described in our Privacy Policy. You are responsible for the accuracy of what you provide and for keeping your own copies of anything important to you.`,
    ],
  },
  {
    heading: "7. AI-generated content",
    body: [
      `The Service uses artificial intelligence to generate preparation material. AI output can be inaccurate, incomplete, or out of date. You should review and verify any information before relying on it, especially compensation figures, company details, and facts about individuals. The output is guidance, not professional, legal, financial, or career advice.`,
    ],
  },
  {
    heading: "8. Our intellectual property",
    body: [
      `The Service, including its software, design, and the content we create, is owned by us and protected by intellectual property laws. These Terms do not grant you any rights in our trademarks, logos, or other proprietary materials except the limited right to use the Service as intended.`,
    ],
  },
  {
    heading: "9. Third-party services",
    body: [
      `The Service relies on third-party providers, including those listed in our Privacy Policy. We are not responsible for the acts or omissions of those providers, and your use of the Service may also be subject to their terms.`,
    ],
  },
  {
    heading: "10. Disclaimers",
    body: [
      `The Service is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error free, or secure, or that any output will be accurate or reliable.`,
    ],
  },
  {
    heading: "11. Limitation of liability",
    body: [
      `To the fullest extent permitted by law, Guildy and its operator will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or opportunities, arising out of or related to your use of the Service. To the fullest extent permitted by law, our total liability for any claim relating to the Service will not exceed the amount you paid us in the twelve months before the claim, or one hundred US dollars if you paid nothing.`,
    ],
  },
  {
    heading: "12. Indemnification",
    body: [
      `You agree to indemnify and hold harmless Guildy and its operator from any claims, damages, or expenses arising out of your misuse of the Service, your violation of these Terms, or your violation of any law or the rights of a third party.`,
    ],
  },
  {
    heading: "13. Termination",
    body: [
      `You may stop using the Service at any time. We may suspend or terminate your access if you violate these Terms or if we discontinue the Service. On termination, your right to use the Service ends. Sections that by their nature should survive termination will survive.`,
    ],
  },
  {
    heading: "14. Changes to these Terms",
    body: [
      `We may update these Terms from time to time. When we do, we will revise the date at the top. Your continued use of the Service after changes take effect means you accept the updated Terms.`,
    ],
  },
  {
    heading: "15. Governing law",
    body: [
      `These Terms are governed by the laws of the State of California, without regard to its conflict of laws rules. Any dispute will be subject to the exclusive jurisdiction of the state and federal courts located in California.`,
    ],
  },
  {
    heading: "16. Contact",
    body: [
      `Questions about these Terms can be sent to tryguildy@gmail.com.`,
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">{TITLE}</h1>
          <p className="mt-2 text-sm text-gray-500">{LAST_UPDATED}</p>
          <p className="mt-6 text-sm leading-relaxed text-gray-700">{INTRO}</p>

          {SECTIONS.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                {section.heading}
              </h2>
              {section.body.map((paragraph, index) => (
                <p
                  key={index}
                  className="mt-3 text-sm leading-relaxed text-gray-700"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
