import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getPricePerPoundCents } from "@/lib/settings";
import {
  BULKY_ITEM_KEYS,
  BULKY_ITEM_LABELS,
  BULKY_SET_DESCRIPTION,
  getBulkyUnitPriceCents,
} from "@/lib/bulky-items";

export const metadata: Metadata = {
  title: "Pricing – Doorstep Laundry",
  description:
    "Wash and fold pricing by the pound and bulky bedding items in Las Cruces, NM.",
  robots: "index, follow",
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const pricePerPoundCents = await getPricePerPoundCents();
  const perLb = (pricePerPoundCents / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-fern-50">
      {session ? (
        <AppHeader />
      ) : (
        <header className="border-b border-fern-200/80 bg-white shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-4 flex justify-between items-center">
            <Link
              href="/app"
              className="flex items-center gap-2 text-fern-900 hover:opacity-90 transition-opacity"
              aria-label="Doorstep Laundry – Laundry service Las Cruces NM"
            >
              <Image
                src="/doorstep/DL_icon_RGB.svg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-auto"
                unoptimized
              />
              <Image
                src="/doorstep/doorstep-logo-wordmark.svg"
                alt="Doorstep Laundry Las Cruces"
                width={140}
                height={28}
                className="h-7 w-auto hidden sm:block"
                unoptimized
              />
              <span className="text-lg font-semibold text-fern-800 sm:hidden">
                Doorstep Laundry
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/app/pricing"
                className="text-sm font-medium text-fern-800"
                aria-current="page"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-fern-600 hover:text-fern-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 transition-colors shadow-sm"
              >
                Sign up
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-fern-900 sm:text-4xl">
          Pricing
        </h1>
        <p className="mt-3 text-fern-600">
          Simple, transparent pricing for wash, fold, and delivery in Las Cruces and the
          surrounding area.
        </p>

        <section className="mt-10 rounded-2xl border border-fern-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-fern-900">Regular laundry</h2>
          <p className="mt-2 text-2xl font-bold text-fern-800">
            ${perLb}
            <span className="text-lg font-semibold text-fern-600"> / lb</span>
          </p>
          <p className="mt-4 text-fern-600 leading-relaxed">
            Your final price is based on the weight of your laundry{" "}
            <strong className="font-medium text-fern-800">after</strong> it&apos;s been
            washed and folded—we weigh it once everything is clean and ready to go.
          </p>
          <p className="mt-3 text-fern-600 leading-relaxed">
            Not sure how much that is? A <strong className="font-medium text-fern-800">large hamper</strong>{" "}
            of typical wash-and-fold laundry is usually around <strong className="font-medium text-fern-800">20 pounds</strong>.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-fern-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-fern-900">Bulky items</h2>
          <p className="mt-2 text-sm text-fern-600 leading-relaxed">
            Bedding sets and comforters are priced separately from your per-pound laundry.
            When you book, tell us what&apos;s in each load so we can charge accurately.
          </p>
          <p className="mt-3 text-sm text-fern-600 leading-relaxed">
            <strong className="font-medium text-fern-800">What&apos;s a &quot;set&quot;?</strong>{" "}
            {BULKY_SET_DESCRIPTION}
          </p>
          <ul className="mt-6 divide-y divide-fern-100 border border-fern-100 rounded-xl overflow-hidden">
            {BULKY_ITEM_KEYS.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-4 bg-fern-50/40 px-4 py-3.5"
              >
                <span className="font-medium text-fern-900">
                  {BULKY_ITEM_LABELS[key]}
                </span>
                <span className="text-fern-800 font-semibold tabular-nums">
                  $
                  {(getBulkyUnitPriceCents(pricePerPoundCents, key) / 100).toFixed(
                    2
                  )}{" "}
                  each
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-sm text-fern-500">
          <Link href="/app" className="text-fern-700 font-medium hover:text-fern-900">
            ← Back to home
          </Link>
        </p>
      </main>

      <footer className="border-t border-fern-200/80 bg-white py-8 mt-auto">
        <div className="mx-auto max-w-5xl px-4 flex flex-col items-center gap-3 text-sm text-fern-500">
          <Image
            src="/doorstep/doorstep-logo-subtext.svg"
            alt="Doorstep Laundry Las Cruces – wash · fold · delivered"
            width={200}
            height={48}
            className="h-12 w-auto opacity-80"
            unoptimized
          />
          <span>Doorstep Laundry Service · Las Cruces, NM</span>
        </div>
      </footer>
    </div>
  );
}
