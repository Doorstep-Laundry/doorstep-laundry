import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Policy – Doorstep Laundry",
};

export default function SmsPage() {
  return (
    <article className="bg-white rounded-2xl border border-fern-200/80 shadow-sm px-6 py-10 sm:px-10 space-y-8 text-fern-800 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold text-fern-900">SMS / Text Message Policy</h1>
        <p className="mt-2 text-sm text-fern-500">Effective June 13, 2026</p>
      </header>

      <p>
        This policy describes how Doorstep Laundry Service (&ldquo;Doorstep&rdquo;) sends text messages and
        how you can manage your preferences.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Program Description</h2>
        <p>
          The Doorstep Laundry SMS program sends transactional and service-related text messages
          to customers who have provided a phone number and given explicit consent. Message types
          include:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Order confirmation when a pickup is scheduled</li>
          <li>Pickup and delivery reminder notifications</li>
          <li>Driver on-the-way alerts</li>
          <li>Order status updates (picked up, washed, out for delivery, delivered)</li>
          <li>Payment receipts or alerts</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">How to Opt In</h2>
        <p>
          You can opt in to SMS messages by adding your phone number and checking the consent box
          in your{" "}
          <a href="/account" className="text-fern-600 underline hover:text-fern-800">
            Account Settings
          </a>
          . Consent is never required as a condition of purchasing our service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Message Frequency</h2>
        <p>
          Message frequency varies based on your order activity. You may receive up to 5 messages
          per order (confirmation, reminders, and status updates).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Message and Data Rates</h2>
        <p>
          Message and data rates may apply depending on your mobile carrier and plan. Doorstep is
          not responsible for any charges incurred from receiving SMS messages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">How to Opt Out</h2>
        <p>
          To stop receiving text messages, reply <strong>STOP</strong> to any message we send.
          You will receive one final confirmation that you have been unsubscribed. You can also
          remove your phone number in your{" "}
          <a href="/account" className="text-fern-600 underline hover:text-fern-800">
            Account Settings
          </a>.
        </p>
        <p>
          After opting out, you will no longer receive SMS messages from Doorstep. This will not
          affect your ability to use our service or receive email communications.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Help</h2>
        <p>
          Reply <strong>HELP</strong> to any message for help, or contact us at{" "}
          <a href="mailto:hello@doorsteplaundrylc.com" className="text-fern-600 underline hover:text-fern-800">
            hello@doorsteplaundrylc.com
          </a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Supported Carriers</h2>
        <p>
          Supported US carriers include AT&amp;T, T-Mobile, Verizon, Sprint, and most major
          carriers. Carrier availability may vary. Carriers are not liable for delayed or
          undelivered messages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">Privacy</h2>
        <p>
          Your phone number is used solely for sending the messages described in this policy. We
          do not sell or share your phone number with third parties for marketing purposes. See our{" "}
          <a href="/legal/privacy" className="text-fern-600 underline hover:text-fern-800">
            Privacy Policy
          </a>{" "}
          for full details.
        </p>
        <p>
          All the above categories exclude text messaging originator opt-in data and consent; this
          information will not be shared with any third parties.
        </p>
      </section>
    </article>
  );
}
