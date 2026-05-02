import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">Effective Date: May 2, 2026</p>

          <div className="prose prose-sm max-w-none">
            <p className="mb-4">
              <strong>Company Name:</strong> Guildy.ai, Inc.
            </p>
            <p className="mb-4">
              <strong>Product/App:</strong> Guildy.ai
            </p>
            <p className="mb-4">
              <strong>Website:</strong>{" "}
              <a href="https://guildy.ai" className="text-blue-600 hover:underline">
                https://guildy.ai
              </a>
            </p>
            <p className="mb-4">
              <strong>Contact Email:</strong>{" "}
              <a href="mailto:support@guildy.ai" className="text-blue-600 hover:underline">
                support@guildy.ai
              </a>
            </p>
            <p className="mb-6">
              <strong>Business Address:</strong> Guildy.ai, Inc., San Francisco, CA, USA
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="mb-4">
              By accessing or using Guildy (the &quot;Service&quot;) you (&quot;you,&quot; &quot;your,&quot;
              &quot;User&quot;) agree to be bound by these Terms of Service (the &quot;TOS&quot;), our Privacy
              Policy and any other policies referenced herein. If you do not agree to these TOS,
              you may not access or use the Service.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Changes to Terms</h2>
            <p className="mb-4">
              We may revise these TOS at any time. When we do, we will post the revised version on
              our website with a new &quot;Effective Date.&quot; Continued use of the Service after such
              changes constitutes your acceptance of the revised TOS.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Description of Service</h2>
            <p className="mb-4">
              Guildy is a job pipeline tracker with AI-powered interview prep. You enter the jobs
              you are pursuing, paste relevant context (job descriptions, recruiter messages,
              interviewer info), and Guildy generates interview prep tailored to your background.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. User Accounts &amp; Access</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.1 Account Registration</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Sign-in is by email magic link.</li>
              <li>You are responsible for the security of the email account you sign in with.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.2 Permissions &amp; Use</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>You may use the Service only in compliance with these TOS and applicable laws.</li>
              <li>
                You may not access the Service in a way that harms, impairs, or overloads it, or
                attempt to reverse engineer or modify any part of the Service.
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
              5. License Grant &amp; Intellectual Property
            </h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.1 License Grant</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>
                Guildy.ai, Inc. grants you a limited, non-exclusive, non-transferable, revocable
                license to access and use the Service in accordance with these TOS.
              </li>
              <li>All rights not expressly granted are reserved by the Company.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.2 Ownership</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>
                The Service, software, content, databases, and underlying technology, including
                all associated intellectual property rights, are and remain the property of
                Guildy.ai, Inc. or its licensors.
              </li>
              <li>You retain ownership of your data, subject to the rights granted to us to provide the Service.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Payment &amp; Subscription</h2>
            <p className="mb-4">
              Paid features (when available) are billed monthly. Fees, billing cycles, and refund
              terms will be described on the pricing page or in supplemental agreements at the
              time of purchase.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Termination &amp; Suspension</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7.1 Termination by You</h3>
            <p className="mb-4">
              You may delete your account at any time by contacting support@guildy.ai. Deletion
              removes your profile, jobs, prep history, and resume.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7.2 Termination by Company</h3>
            <p className="mb-4">
              We may suspend or terminate your access for violation of these TOS, non-payment, or
              abuse of the Service.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
              8. Disclaimers &amp; Limitations of Liability
            </h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8.1 Disclaimer of Warranties</h3>
            <p className="mb-4">
              The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE.&quot; Guildy.ai, Inc. disclaims all
              warranties of any kind, whether express or implied.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8.2 Limitation of Liability</h3>
            <p className="mb-4">
              To the fullest extent permitted by law, Guildy.ai, Inc.&apos;s total liability is
              limited to the amount you paid, if any, during the twelve (12) months preceding the
              claim.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Indemnification</h2>
            <p className="mb-4">
              You agree to indemnify and hold harmless Guildy.ai, Inc., its affiliates, officers,
              directors, employees and agents from and against any claims, liabilities, damages,
              losses, costs or expenses arising out of your use of the Service or breach of these
              TOS.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Privacy Policy</h2>
            <p className="mb-4">
              Your use of the Service is also governed by our Privacy Policy.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Governing Law</h2>
            <p className="mb-4">
              These TOS are governed by the laws of the State of California, USA. Any disputes
              will be resolved in the state or federal courts located in San Francisco County.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Modifications to the Service</h2>
            <p className="mb-4">
              We may modify, suspend, or discontinue the Service at any time with or without
              notice.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Use the Service for fraudulent or unlawful activity.</li>
              <li>Attempt to gain unauthorized access to the Service or related systems.</li>
              <li>Use the Service in a manner that interferes with others&apos; use or impairs its security.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Entire Agreement</h2>
            <p className="mb-4">
              These TOS, together with the Privacy Policy, constitute the entire agreement between
              you and Guildy.ai, Inc. regarding the Service.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Contact Us</h2>
            <p className="mb-2">Guildy.ai, Inc.</p>
            <p className="mb-2">San Francisco, CA, USA</p>
            <p className="mb-4">
              <a href="mailto:support@guildy.ai" className="text-blue-600 hover:underline">
                support@guildy.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
