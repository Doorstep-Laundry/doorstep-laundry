import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Doorstep Laundry",
};

export default function PrivacyPage() {
  return (
    <article className="bg-white rounded-2xl border border-fern-200/80 shadow-sm px-6 py-10 sm:px-10 space-y-8 text-fern-800 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold text-fern-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-fern-500">Effective June 13, 2026</p>
      </header>

      <p>
        Doorstep Laundry Service (&ldquo;Doorstep,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to
        protecting your privacy. This policy explains what information we collect, how we use it,
        and your rights regarding that information.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">1. Information We Collect</h2>
        <p>When you create an account or book a pickup, we collect:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account information:</strong> Name, email address, and password</li>
          <li><strong>Contact information:</strong> Phone number (optional, for SMS order updates)</li>
          <li><strong>Address information:</strong> Pickup and delivery addresses you provide</li>
          <li><strong>Payment information:</strong> Card details processed and stored by Stripe — we do not store full card numbers on our servers</li>
          <li><strong>Order information:</strong> Booking dates, load preferences, notes, and order history</li>
          <li><strong>Usage information:</strong> Log data, device type, and browser information collected automatically</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide, operate, and improve our pickup and delivery service</li>
          <li>Process payments and send receipts</li>
          <li>Send order confirmations, pickup reminders, and delivery updates via email or SMS (based on your preferences)</li>
          <li>Respond to your support requests</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>
          We do not sell your personal information to third parties. We do not use your information
          for advertising or marketing beyond communications directly related to your service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">3. Third-Party Services</h2>
        <p>We use the following third-party services that may receive your data:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Stripe</strong> — payment processing. Your card information is handled directly
            by Stripe under their{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-fern-600 underline hover:text-fern-800">
              Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Google Maps</strong> — address autocomplete and verification. Subject to
            Google&rsquo;s{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-fern-600 underline hover:text-fern-800">
              Privacy Policy
            </a>.
          </li>
          <li>
            <strong>SMS provider</strong> — if you opt in to text messages, your phone number is
            shared with our SMS delivery provider solely for that purpose.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">4. Data Retention</h2>
        <p>
          We retain your account and order information for as long as your account is active and
          for up to 3 years after account closure for tax, legal, and dispute resolution purposes.
          You may request deletion of your account at any time (see Section 5).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Correct inaccurate information in your account settings</li>
          <li>Request deletion of your account and associated data</li>
          <li>Opt out of SMS communications at any time by replying STOP</li>
          <li>Opt out of email communications via the unsubscribe link in any email</li>
        </ul>
        <p>
          To exercise any of these rights, email us at{" "}
          <a href="mailto:hello@doorsteplaundrylc.com" className="text-fern-600 underline hover:text-fern-800">
            hello@doorsteplaundrylc.com
          </a>.
          We will respond within 30 days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">6. Security</h2>
        <p>
          We use industry-standard practices to protect your information, including encrypted
          connections (HTTPS) and secure credential storage. No method of transmission or storage
          is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">7. Children</h2>
        <p>
          Our service is not directed to children under 13. We do not knowingly collect personal
          information from children. If you believe a child has provided us with their information,
          contact us and we will delete it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by posting the updated policy on this page and updating the effective date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">9. Contact</h2>
        <p>
          Questions or concerns about your privacy? Contact us at{" "}
          <a href="mailto:hello@doorsteplaundrylc.com" className="text-fern-600 underline hover:text-fern-800">
            hello@doorsteplaundrylc.com
          </a>.
        </p>
      </section>
    </article>
  );
}
