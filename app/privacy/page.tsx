import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Static in-app Privacy Policy. Rendered as normal page content in the shared
// legal shell. No third-party embed, no environment variables required.

const TITLE = "Privacy Policy"
const LAST_UPDATED = "Last updated: June 30, 2026"

const INTRO =
  `Guildy ("Guildy," "we," "us," or "our") provides an interview preparation and job-hunt tool available at guildy.ai and app.guildy.ai (the "Service"). This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have. By using the Service, you agree to the practices described here.`

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "1. Who we are",
    body: [
      `Guildy is an independently operated software product. If you have questions about this policy or your data, contact us at tryguildy@gmail.com.`,
    ],
  },
  {
    heading: "2. Information we collect",
    body: [
      `Account information. When you create an account, we collect your email address. If you sign in with a third-party provider, we receive basic account identifiers from that provider.`,
      `Content you provide. To generate interview preparation, you give us information such as your resume text, job descriptions you paste in, details about the roles you are tracking, interview stage and context, information about your interviewers (such as a name, title, or profile link), and compensation or offer details you choose to enter. You control what you provide.`,
      `Payment information. When you subscribe, payment is processed by our payment provider, Stripe. We do not collect or store your full card number. We receive limited billing details such as your subscription status and the last four digits of your card from Stripe.`,
      `Usage information. We collect analytics about how you use the Service, such as pages viewed, features used, and events like starting a prep generation. This helps us understand what works and improve the product.`,
      `Technical information. We automatically receive standard technical data such as your browser type, device information, and IP address through our hosting and analytics providers.`,
      `Cookies. We use cookies and similar technologies for authentication, to keep you signed in, and for analytics. You can control cookies through your browser settings, though some features may not work without them.`,
    ],
  },
  {
    heading: "3. How we use your information",
    body: [
      `We use your information to provide and operate the Service, generate interview preparation and related content from the information you provide, process your subscription and payments, communicate with you about your account and the Service, analyze and improve the product, maintain security and prevent abuse, and comply with legal obligations.`,
    ],
  },
  {
    heading: "4. How we use AI providers",
    body: [
      `Guildy uses third-party artificial intelligence providers to generate preparation content. When you request prep, the relevant content you have provided (such as your resume text, the job description, and interview context) is sent to these providers to produce the output. We currently use Anthropic and OpenAI for content generation. These providers process the data to return results to us and are bound by their own terms and privacy commitments. We do not use your content to train our own models.`,
    ],
  },
  {
    heading: "5. Interviewer research",
    body: [
      `Some features research publicly available information about an interviewer you add (for example, from public web pages, professional profiles, talks, or posts) in order to help you prepare. This research draws only on information that is already publicly accessible. We do not seek out private or sensitive information about interviewers, and this feature is intended solely to help you prepare for a professional conversation.`,
    ],
  },
  {
    heading: "6. Who we share information with",
    body: [
      `We do not sell your personal information. We share information only with service providers that help us operate the Service, and only as needed for them to perform their function. These include Supabase for authentication and database hosting, Anthropic and OpenAI for AI content generation, Stripe for payment processing, PostHog for product analytics, Vercel for application hosting, and Resend for transactional email. We may also disclose information if required by law, to protect our rights or the safety of others, or in connection with a business transfer.`,
    ],
  },
  {
    heading: "7. Data retention",
    body: [
      `We keep your information for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time by contacting tryguildy@gmail.com. We may retain limited information as required for legal, accounting, or security purposes.`,
    ],
  },
  {
    heading: "8. Your choices and rights",
    body: [
      `You can access and update much of your information within the Service. Depending on where you live, you may have rights to access, correct, delete, or export your personal information, and to object to or restrict certain processing. To exercise these rights, contact tryguildy@gmail.com. We will respond consistent with applicable law.`,
    ],
  },
  {
    heading: "9. Security",
    body: [
      `We take reasonable measures to protect your information, including working with reputable infrastructure providers. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.`,
    ],
  },
  {
    heading: "10. Children",
    body: [
      `The Service is not directed to children under 16, and we do not knowingly collect personal information from them. If you believe a child has provided us information, contact us and we will delete it.`,
    ],
  },
  {
    heading: "11. International users",
    body: [
      `Guildy is operated from the United States. If you access the Service from outside the United States, your information may be processed in the United States and other countries where our providers operate.`,
    ],
  },
  {
    heading: "12. Changes to this policy",
    body: [
      `We may update this Privacy Policy from time to time. When we do, we will revise the date at the top. Your continued use of the Service after changes take effect means you accept the updated policy.`,
    ],
  },
  {
    heading: "13. Contact",
    body: [
      `Questions about this Privacy Policy or your data can be sent to tryguildy@gmail.com.`,
    ],
  },
]

export default function PrivacyPage() {
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
