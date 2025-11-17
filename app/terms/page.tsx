import Link from "next/link"
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">Effective Date: October 31, 2025</p>

          <div className="prose prose-sm max-w-none">
            <p className="mb-4">
              <strong>Company Name:</strong> Guildy.ai, Inc.
            </p>
            <p className="mb-4">
              <strong>Product/App:</strong> Guildy.ai
            </p>
            <p className="mb-4">
              <strong>Website:</strong> <a href="https://guildy.ai" className="text-blue-600 hover:underline">https://guildy.ai</a>
            </p>
            <p className="mb-4">
              <strong>Contact Email:</strong> <a href="mailto:support@guildy.ai" className="text-blue-600 hover:underline">support@guildy.ai</a>
            </p>
            <p className="mb-6">
              <strong>Business Address:</strong> Guildy.ai, Inc., San Francisco, CA, USA
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="mb-4">
              By accessing or using Guildy (the "Service") you ("you," "your," "User") agree to be bound by these Terms of Service (the "TOS"), our Privacy Policy and any other policies referenced herein. If you do not agree to these TOS, you may not access or use the Service.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Changes to Terms</h2>
            <p className="mb-4">
              We may revise these TOS at any time. When we do, we will post the revised version on our website with a new "Effective Date." Continued use of the Service after such changes constitutes your acceptance of the revised TOS.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Description of Service</h2>
            <p className="mb-4">
              Guildy provides software to help users convert Gmail job‑related email threads into a visual job pipeline, and to receive AI‑driven interview preparation tools. Access to Gmail via OAuth2 (read‑only) is required. The Service is made available through a web‑based interface and other channels we may offer.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. User Accounts & Access</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.1 Account Registration</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>You must provide accurate, complete information when registering.</li>
              <li>You are responsible for maintaining the confidentiality of any login credentials and for all activity under your account.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.2 Gmail OAuth Access</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>You must authorize Guildy via your Gmail account using OAuth2.</li>
              <li>You grant read‑only access to your Gmail inbox (via the scope https://www.googleapis.com/auth/gmail.readonly) solely for the purposes described in our Privacy Policy.</li>
              <li>You must use the Gmail account you designate for the generation of your job‑pipeline data.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.3 Permissions & Use</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>You may use the Service only in compliance with these TOS, and all applicable laws and regulations.</li>
              <li>You may not access the Service in a way that harms, impairs or overloads it, or attempt to reverse engineer or modify any part of the Service.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. License Grant & Intellectual Property</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.1 License Grant</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Guildy.ai, Inc. grants you a limited, non‑exclusive, non‑transferable, revocable license to access and use the Service in accordance with these TOS.</li>
              <li>All rights not expressly granted are reserved by the Company.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.2 Ownership</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>The Service, software, content, databases, and underlying technology, including all associated intellectual property rights, are and remain the property of Guildy.ai, Inc. or its licensors.</li>
              <li>You retain ownership of your data, as further described in the Privacy Policy, subject to the rights granted to us to provide the Service.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Payment & Subscription (if applicable)</h2>
            <p className="mb-2">If the Service includes paid features:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Fees, billing cycles, payment terms, upgrades, downgrades, refunds (if any) will be described on the pricing page or in applicable supplemental agreements.</li>
              <li>You are responsible for providing valid payment information and for the timely payment of all fees.</li>
              <li>Failure to pay on time may result in suspension or termination of access to the paid features.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Termination & Suspension</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7.1 Termination by You</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>You may delete your account at any time via the Service (Settings → Delete Account) or by contacting support@guildy.ai.</li>
              <li>Deletion will trigger removal of your account data and any linked Gmail synchronization as described in our Privacy Policy.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7.2 Termination by Company</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>We may suspend or terminate your access to the Service at our discretion, including for violation of these TOS, non‑payment, or abuse of the Service.</li>
              <li>Upon termination, your right to access the Service ceases, and we may delete or archive your data in accordance with our data retention policies.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Disclaimers & Limitations of Liability</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8.1 Disclaimer of Warranties</h3>
            <p className="mb-4">
              The Service is provided "AS IS" and "AS AVAILABLE." Guildy.ai, Inc. disclaims all warranties and conditions of any kind, whether express or implied, including but not limited to merchantability, fitness for a particular purpose, or non‑infringement.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8.2 Limitation of Liability</h3>
            <p className="mb-4">
              To the fullest extent permitted by law, Guildy.ai, Inc.'s total liability for any claim arising out of or related to these TOS or the Service is limited to the amount you paid, if any, during the twelve (12) months preceding the claim.
            </p>
            <p className="mb-4">
              In no event shall Guildy.ai, Inc. be liable for any indirect, incidental, special, consequential or punitive damages, including lost profits, data loss or business interruption, even if advised of the possibility of such damages.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Indemnification</h2>
            <p className="mb-4">
              You agree to indemnify and hold harmless Guildy.ai, Inc., its affiliates, officers, directors, employees and agents from and against any and all claims, liabilities, damages, losses, costs or expenses (including attorneys' fees) arising out of or related to your use of the Service, your breach of these TOS, or your violation of any law or right of a third‑party.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Privacy Policy</h2>
            <p className="mb-4">
              Your use of the Service is also governed by our Privacy Policy. By using the Service, you consent to our collection, use and storage of your information as described in the Privacy Policy.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. International Use & Export Controls</h2>
            <p className="mb-4">
              The Service is offered from the United States and serves users globally. You agree to comply with all laws and regulations of your jurisdiction. Use of the Service is subject to U.S. export control laws and other applicable restrictions.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Data Protection & Security</h2>
            <p className="mb-4">
              We use commercially reasonable measures to protect your data, as described in the Privacy Policy. However, no system can guarantee absolute security, and we cannot guarantee it.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Governing Law & Dispute Resolution</h2>
            <p className="mb-4">
              These TOS are governed by the laws of the State of California, USA, without regard to its conflict‑of‑law provisions.
            </p>
            <p className="mb-4">
              Any dispute arising from or relating to these TOS or the Service will be resolved in the state or federal courts located in San Francisco County, California. You and Guildy.ai, Inc. consent to the personal jurisdiction of those courts.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Modifications to the Service</h2>
            <p className="mb-4">
              We may modify, suspend or discontinue the Service (or any part thereof) at any time with or without notice. We will use commercially reasonable efforts to provide notice of material changes, but we are not obligated to do so.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Acceptable Use & Prohibited Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Use the Service for any fraudulent, unlawful or abusive activity.</li>
              <li>Attempt to gain unauthorized access to the Service or any related network.</li>
              <li>Use the Service in a manner that would interfere with others' use of it or impair the integrity or security of the Service.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">16. Feedback</h2>
            <p className="mb-4">
              If you provide any suggestions, comments or other feedback relating to the Service ("Feedback"), you assign all rights in such Feedback to Guildy.ai, Inc. We shall be free to use, disclose, modify and incorporate the Feedback without restriction.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">17. Severability</h2>
            <p className="mb-4">
              If any provision of these TOS is held invalid or unenforceable, the remaining provisions will remain in full force and effect.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">18. Waiver</h2>
            <p className="mb-4">
              No waiver of any term of these TOS shall be deemed a further or continuing waiver of such term or any other term.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">19. Entire Agreement</h2>
            <p className="mb-4">
              These TOS, together with the Privacy Policy and any other documents expressly referenced, constitute the entire agreement between you and Guildy.ai, Inc. regarding the Service and supersede any prior or contemporaneous agreements.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">20. Contact Us</h2>
            <p className="mb-2">Guildy.ai, Inc.</p>
            <p className="mb-2">San Francisco, CA, USA</p>
            <p className="mb-4">
              <a href="mailto:support@guildy.ai" className="text-blue-600 hover:underline">support@guildy.ai</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
