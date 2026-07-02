import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – Doorstep Laundry",
};

export default function TermsPage() {
  return (
    <article className="bg-white rounded-2xl border border-fern-200/80 shadow-sm px-6 py-10 sm:px-10 space-y-8 text-fern-800 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold text-fern-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-fern-500">Effective June 13, 2026</p>
      </header>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Doorstep Laundry Service
        (&ldquo;Doorstep,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a laundry pickup and delivery
        service operating in Las Cruces, NM and surrounding areas. By creating an account or
        scheduling a pickup, you agree to these Terms.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">1. Service Description</h2>
        <p>
          Doorstep provides scheduled pickup, wash-and-fold, and delivery of laundry to residential
          and commercial addresses within our service area. We reserve the right to decline or
          cancel service outside our coverage zone at our discretion.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">2. Facility and Equipment Sanitation</h2>
        <p>
          We maintain a routine cleaning and sanitation program for the equipment used in processing
          your laundry, including washing machines and dryers, consistent with standard commercial
          laundry practices. While we make commercially reasonable efforts to keep our equipment
          clean and in proper working condition, we make no representations or warranties regarding
          the elimination of any specific contaminants, allergens, or pathogens.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">3. Booking and Cancellations</h2>
        <p>
          You may schedule a pickup through our website or app. To cancel or reschedule without
          charge, please do so any time before your scheduled pickup window. Cancellations
          made after the pickup window has started may be subject to a cancellation fee.
        </p>
        <p>
          We reserve the right to reschedule or cancel any pickup due to circumstances outside our
          control (weather, equipment issues, staffing). We will notify you as promptly as possible
          if this occurs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">4. Payment and Billing</h2>
        <p>
          Charges are calculated based on weight of the clean, folded laundry and any applicable add-ons selected
          at booking. Pricing is displayed at checkout and on our pricing page.
        </p>
        <p>
          Payment is due upon completion of your order. We accept major credit and debit cards
          processed securely through our online payment platform.
        </p>
        <p>
          <strong>Free load credits:</strong> When a free load credit is applied to an order, the
          credit covers the base wash-and-fold rate for that load. Expedited service surcharges
          (next-morning or same-day turnaround) are not covered by credits and remain due regardless
          of how many credits are applied. Credits apply to the highest-cost loads first.
        </p>
        <p>
          <strong>Past-due accounts:</strong> If you have an outstanding unpaid balance, we will
          not accept new laundry pickups until the balance is settled. You will be notified of any
          past-due amount and directed to pay before booking again.
        </p>
        <p>
          If a charge is disputed or reversed without cause, we reserve the right to suspend your
          account pending resolution.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">5. Care of Your Items and Liability</h2>
        <p>
          The spirit of Doorstep is to help with your bulk laundry needs so that you can focus on
          your more delicate or special items at home. We handle everyday laundry&mdash;clothing,
          linens, and towels&mdash;with care, following standard care label instructions to the best
          of our ability.
        </p>
        <p>
          Because we process laundry in bulk, we cannot be responsible for:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Pre-existing damage, stains, or wear not reported at the time of pickup</li>
          <li>Items that bleed, shrink, or are damaged due to manufacturer care label inaccuracies</li>
          <li>Delicate, irreplaceable, or sentimental items not suitable for commercial washing</li>
          <li>Items left in pockets (coins, pens, tissues, etc.)</li>
        </ul>
        <p>
          We ask that you keep delicate, dry-clean-only, or high-value items out of your Doorstep
          bag, and that you empty all pockets before pickup. We are not liable for damage caused by
          items left in pockets.
        </p>
        <p>
          If you believe an item was damaged or lost during our handling, please contact us within
          48 hours of delivery and we will do our best to help. Claims reported after this window
          cannot be reviewed. We are not liable for lost or damaged items, and we do not cover
          jewelry, cash, electronics, or other valuables placed in laundry bags.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">6. Unclaimed Laundry</h2>
        <p>
          If we are unable to complete a delivery and you do not contact us to arrange an
          alternative, we will hold your laundry for 7 days after the scheduled delivery date.
          After that period, unclaimed laundry may be donated or disposed of and we are not
          liable for any items therein.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">7. Prohibited Items</h2>
        <p>We do not accept the following items for cleaning:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Heavily soiled or biohazardous items (blood, fecal matter, medical waste)</li>
          <li>Items infested with pests (bed bugs, fleas, etc.)</li>
          <li>Dry-clean-only garments (we do not offer dry cleaning)</li>
          <li>Items containing cash, firearms, illegal substances, or dangerous materials</li>
        </ul>
        <p>
          If prohibited items are discovered, we will contact you and may return the order without
          washing. A service fee may apply.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">8. Account Termination</h2>
        <p>
          We may suspend or terminate your account at any time if you violate these Terms, submit
          fraudulent payment, dispute legitimate charges, or engage in abusive behavior toward our
          team. Any outstanding balance remains due upon termination.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">9. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Doorstep&rsquo;s total liability to you for any claim
          arising from or related to these Terms or our services shall not exceed the amount you
          paid for the specific order giving rise to the claim.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you of material changes by
          posting the updated Terms on our website and, where appropriate, by email. Continued use
          of our service after changes become effective constitutes your acceptance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-fern-900">11. Contact</h2>
        <p>
          Questions about these Terms? Reach us at{" "}
          <a href="mailto:hello@doorsteplaundrylc.com" className="text-fern-600 underline hover:text-fern-800">
            hello@doorsteplaundrylc.com
          </a>{" "}
          or through our{" "}
          <a href="/contact" className="text-fern-600 underline hover:text-fern-800">
            contact page
          </a>.
        </p>
      </section>
    </article>
  );
}
