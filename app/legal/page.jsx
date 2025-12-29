import Link from "next/link";

export const metadata = {
  title: "Terms & Policies | LM-Intel",
  description: "Terms of service, refund policy, and legal information for LM-Intel products including QuickList",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            LM-Intel
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">
          Terms of Service & Policies
        </h1>

        {/* Company Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Company Information
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-slate-700 mb-3">
              <strong>Business Name:</strong> LM-Intel LLC
            </p>
            <p className="text-slate-700 mb-3">
              <strong>Website:</strong> lm-intel.ai
            </p>
            <p className="text-slate-700 mb-3">
              <strong>Contact Email:</strong> support@lm-intel.ai
            </p>
            <p className="text-slate-700">
              <strong>Business Address:</strong> Oxford, Massachusetts, United States
            </p>
          </div>
        </section>

        {/* Products & Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Products & Services
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">QuickList</h3>
            <p className="text-slate-700 mb-4">
              QuickList is an AI-powered real estate marketing platform that generates professional 
              listing content in seconds. Our service helps real estate professionals create:
            </p>
            <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4">
              <li>Property descriptions and marketing copy</li>
              <li>Feature lists and amenities</li>
              <li>MLS-compliant data fields</li>
              <li>Video slideshows with AI voiceovers</li>
            </ul>
            <p className="text-slate-700">
              <strong>Service Type:</strong> Software as a Service (SaaS) - Credit-based system
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Pricing
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-slate-700 mb-4">
              QuickList uses a credit-based pricing model. Credits are purchased in packages 
              and can be used to generate listing content.
            </p>
            <div className="space-y-3 text-slate-700">
              <p><strong>Starter Package:</strong> 1 Credit - $20.00 USD</p>
              <p><strong>Pro Package:</strong> 10 Credits - $150.00 USD</p>
              <p><strong>Agency Package:</strong> 50 Credits - $400.00 USD</p>
            </div>
            <p className="text-slate-600 text-sm mt-4">
              All prices are in USD. One credit = one complete listing generation.
            </p>
          </div>
        </section>

        {/* Refund Policy */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Refund & Dispute Policy
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Credit Refunds</h3>
              <p className="text-slate-700">
                If a listing generation fails due to a technical issue on our end, the credit 
                will be automatically refunded to your account. No action is required.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Payment Refunds</h3>
              <p className="text-slate-700 mb-2">
                We offer a 14-day refund policy for unused credits:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
                <li>Request a refund within 14 days of purchase</li>
                <li>Credits must be unused</li>
                <li>Contact support@lm-intel.ai with your order details</li>
                <li>Refunds processed within 5-7 business days</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Disputes</h3>
              <p className="text-slate-700">
                If you have a billing dispute or issue with a charge, please contact us at 
                support@lm-intel.ai before initiating a chargeback. We will work with you 
                to resolve any billing issues promptly.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Non-Refundable Items</h3>
              <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
                <li>Credits that have been used to generate listings</li>
                <li>Credits purchased more than 14 days ago</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Cancellation Policy */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Cancellation Policy
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
            <p className="text-slate-700">
              <strong>No Subscriptions:</strong> QuickList does not use recurring subscriptions. 
              All purchases are one-time credit packages, so there are no subscriptions to cancel.
            </p>
            
            <p className="text-slate-700">
              <strong>Account Deletion:</strong> You may delete your account at any time through 
              your account settings. Unused credits will be forfeited upon account deletion.
            </p>

            <p className="text-slate-700">
              <strong>Service Termination:</strong> We reserve the right to terminate access to 
              our service for violations of our terms of service, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
              <li>Fraudulent activity</li>
              <li>Abuse of service or API</li>
              <li>Violation of applicable laws</li>
            </ul>
          </div>
        </section>

        {/* Legal & Export Restrictions */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Legal & Export Restrictions
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Service Availability</h3>
              <p className="text-slate-700">
                QuickList is available worldwide. However, you are responsible for ensuring 
                your use of our service complies with local laws and regulations.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Fair Housing Compliance</h3>
              <p className="text-slate-700">
                Our service includes built-in Fair Housing Act compliance checking for U.S. 
                real estate listings. Users are responsible for ensuring all content complies 
                with applicable fair housing laws in their jurisdiction.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Data & Privacy</h3>
              <p className="text-slate-700">
                Your data is stored securely and will not be shared with third parties except 
                as necessary to provide our service (e.g., payment processing through Stripe). 
                We comply with applicable data protection regulations.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Acceptable Use</h3>
              <p className="text-slate-700 mb-2">
                You may not use QuickList to:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
                <li>Generate discriminatory or illegal content</li>
                <li>Violate intellectual property rights</li>
                <li>Attempt to reverse engineer or abuse our service</li>
                <li>Resell credits or service access</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Promotional Terms */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Promotional Terms & Conditions
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
            <p className="text-slate-700">
              <strong>Beta Testing:</strong> During our beta period, select users may receive 
              complimentary credits for testing purposes. Beta credits:
            </p>
            <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
              <li>Are non-transferable</li>
              <li>May expire after the beta period ends</li>
              <li>Cannot be combined with other promotions</li>
              <li>Are provided "as-is" with no refund value</li>
            </ul>

            <p className="text-slate-700 mt-4">
              <strong>Discount Codes:</strong> Promotional discount codes may be offered from 
              time to time. Unless otherwise stated:
            </p>
            <ul className="list-disc list-inside text-slate-700 space-y-1 ml-4">
              <li>One discount per purchase</li>
              <li>Cannot be combined with other offers</li>
              <li>Expire on the date specified in the promotion</li>
              <li>Cannot be applied to past purchases</li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Customer Support
          </h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-slate-700 mb-4">
              For questions, support, or to report issues:
            </p>
            <div className="space-y-2 text-slate-700">
              <p><strong>Email:</strong> support@lm-intel.ai</p>
              <p><strong>Response Time:</strong> Within 24 hours on business days</p>
              <p><strong>Website:</strong> <a href="https://lm-intel.ai" className="text-indigo-600 hover:underline">lm-intel.ai</a></p>
            </div>
          </div>
        </section>

        {/* Last Updated */}
        <section className="text-center text-slate-500 text-sm border-t border-slate-200 pt-8">
          <p>Last Updated: December 29, 2025</p>
          <p className="mt-2">© 2025 LM-Intel LLC. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
}
