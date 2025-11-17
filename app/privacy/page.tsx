import Link from "next/link"
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
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

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Introduction</h2>
            <p className="mb-4">
              Guildy helps users convert their Gmail job-related email threads into a visual job pipeline and provides AI interview preparation tools. This Privacy Policy explains how we collect, use, store, and protect your information.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Google API Services Disclosure</h2>
            <p className="mb-4">
              Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Data We Access</h2>
            <p className="mb-4">We only request the minimum access necessary to operate Guildy.</p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Google OAuth Scopes Requested</h3>
            <p className="mb-2"><strong>Required Scope</strong></p>
            <p className="mb-4 font-mono text-sm bg-gray-100 p-2 rounded">https://www.googleapis.com/auth/gmail.readonly</p>
            <p className="mb-4">Read-only access to Gmail messages and metadata to detect job-related threads, infer stages, and display timeline context.</p>

            <p className="mb-2"><strong>Identity Scopes</strong></p>
            <ul className="list-disc pl-6 mb-4">
              <li>openid</li>
              <li>email</li>
              <li>profile</li>
            </ul>
            <p className="mb-4">Used only for authentication and displaying your account profile.</p>
            <p className="mb-4">We never request permission to send, delete, or modify email.</p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Gmail Data We Process</h3>
            <p className="mb-2">We access:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Message metadata (message ID, thread ID, from/to, subject, date, labels)</li>
              <li>Limited text snippets for pipeline creation and stage detection</li>
              <li>Parsed context such as interview-related phrases (e.g., "schedule interview," "next round," "offer," "unfortunately")</li>
            </ul>
            <p className="mb-4">We do not access Drive, Calendar, Photos, Contacts, or non-Gmail Google services.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Purpose of Data Use</h2>
            <p className="mb-2">We use Gmail data only to provide core user-visible features:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Identify job-related threads and group them into pipelines</li>
              <li>Determine interview stage and timeline context</li>
              <li>Provide interview prep content tailored to the pipeline stage</li>
              <li>Support user notes and organization</li>
            </ul>
            <p className="mb-2">We do not use Gmail data for:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Advertising or marketing</li>
              <li>Profiling unrelated to job-search assistance</li>
              <li>Data sales or brokerage</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Storage & Retention</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">We Store</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Account info (email, name, avatar)</li>
              <li>Gmail message/thread IDs, subject, participants, date</li>
              <li>Minimal snippets needed for pipeline view and classification</li>
              <li>Stage inference results, confidence scores, and timeline history</li>
              <li>Interview prep notes and transcripts (if you use the feature)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">We Do Not Store</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Full Gmail inbox contents</li>
              <li>Email attachments unless explicitly surfaced by the user</li>
              <li>Drafts, chats, or unrelated messages</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Retention Rules</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>We do not persist full raw email bodies</li>
              <li>Temporary classification data is deleted within 30 days</li>
              <li>Snippet storage is strictly limited to text required for the product</li>
              <li>If the user disconnects Gmail, syncing stops immediately and Gmail-derived data is purged within 30 days</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Sharing & Transfers</h2>
            <p className="mb-2">We do not:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Sell personal data</li>
              <li>Share Gmail content with advertisers</li>
              <li>Allow third parties to train AI models on your data</li>
              <li>Allow human access to Gmail content unless required by law, abuse prevention, or user-initiated support</li>
            </ul>
            <p className="mb-4">
              We may use service providers acting solely as data processors under confidentiality and Limited Use restrictions.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">AI & Machine Learning</h2>
            <p className="mb-2">Guildy may send limited text context (or de-identified features) to an AI model to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Infer interview stages</li>
              <li>Generate interview prep questions and feedback</li>
            </ul>
            <p className="mb-4">
              We require all AI vendors to not train on your data, consistent with Google's Limited Use policy.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Security</h2>
            <p className="mb-2">We implement strong security measures, including:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>TLS encryption in transit</li>
              <li>Encrypted data storage</li>
              <li>Restricted production access with logging</li>
              <li>Role-based internal access controls</li>
              <li>Secure secrets management</li>
              <li>Regular security reviews and monitoring</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">User Controls</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Revoke Gmail Access Anytime</h3>
            <p className="mb-4">
              <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline">https://myaccount.google.com/permissions</a>
            </p>
            <p className="mb-4">
              Revoking access stops syncing immediately and triggers Gmail-derived data removal within 30 days.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Delete Your Data</h3>
            <p className="mb-2">You may:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Delete your account inside Guildy (Settings → Delete Account)</li>
              <li>Email us at support@guildy.ai to request deletion</li>
            </ul>
            <p className="mb-2">Full deletion includes:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Account</li>
              <li>Pipelines</li>
              <li>Metadata/snippets</li>
              <li>Interview prep data</li>
            </ul>
            <p className="mb-4">Backups delete on normal rotation.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Children's Privacy</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>Guildy is not intended for children under 16.</li>
              <li>We do not knowingly collect data from children.</li>
              <li>If you believe we have, contact us for prompt deletion.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">International Transfers</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>Data may be processed in the United States.</li>
              <li>Where required, we apply appropriate safeguards for international transfers.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Changes to This Policy</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>We may update this policy. Any updates will be posted here with a new effective date.</li>
              <li>Material changes may be communicated via email or in-app notice.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Contact Us</h2>
            <p className="mb-2">Guildy.ai, Inc.</p>
            <p className="mb-2">San Francisco, CA, USA</p>
            <p className="mb-4">
              <a href="mailto:support@guildy.ai" className="text-blue-600 hover:underline">support@guildy.ai</a>
            </p>
            <p className="mb-4">By using Guildy, you agree to this Privacy Policy.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
