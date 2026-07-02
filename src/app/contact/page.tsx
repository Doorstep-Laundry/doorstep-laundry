import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCompanyInfo } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact Us – Doorstep Laundry",
  description:
    "Get in touch with Doorstep Laundry in Las Cruces, NM. Questions about our laundry pickup and delivery service? We'd love to hear from you.",
  robots: "index, follow",
};

export default async function ContactPage() {
  const company = await getCompanyInfo();
  const email = company.email || "hello@doorsteplaundrylc.com";

  return (
    <div className="min-h-screen bg-fern-50">
      <header className="border-b border-fern-200/80 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-fern-900 hover:opacity-90 transition-opacity"
            aria-label="Doorstep Laundry – Laundry service Las Cruces NM"
          >
            <Image src="/doorstep/DL_icon_RGB.svg" alt="" width={36} height={36} className="h-9 w-auto" unoptimized />
            <Image src="/doorstep/doorstep-logo-wordmark.svg" alt="Doorstep Laundry Las Cruces" width={140} height={28} className="h-7 w-auto hidden sm:block" unoptimized />
            <span className="text-lg font-semibold text-fern-800 sm:hidden">Doorstep Laundry</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm font-medium text-fern-600 hover:text-fern-900 transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium text-fern-600 hover:text-fern-900 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 transition-colors shadow-sm">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-fern-900 sm:text-4xl">
          Contact us
        </h1>
        <p className="mt-4 text-lg text-fern-600">
          Have a question about our laundry pickup and delivery service in Las Cruces? We&apos;re happy to help.
        </p>

        <div className="mt-10 rounded-2xl border border-fern-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fern-500">Email</h2>
            <a
              href={`mailto:${email}`}
              className="mt-1 block text-lg font-medium text-fern-700 hover:text-fern-900 transition-colors"
            >
              {email}
            </a>
          </div>

          {company.phone && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fern-500">Phone</h2>
              <a
                href={`tel:${company.phone.replace(/\D/g, "")}`}
                className="mt-1 block text-lg font-medium text-fern-700 hover:text-fern-900 transition-colors"
              >
                {company.phone}
              </a>
            </div>
          )}

          {company.address && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fern-500">Mailing address</h2>
              <p className="mt-1 text-lg font-medium text-fern-800 whitespace-pre-line">
                {company.address}
              </p>
            </div>
          )}

          {!company.address && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fern-500">Location</h2>
              <p className="mt-1 text-lg font-medium text-fern-800">Las Cruces, NM</p>
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-fern-500">
          <Link href="/" className="text-fern-700 font-medium hover:text-fern-900">
            ← Back to home
          </Link>
        </p>
      </main>

      <footer className="border-t border-fern-200/80 bg-white py-8">
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
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <Link href="/legal/terms" className="hover:text-fern-700 transition-colors">Terms of Service</Link>
            <Link href="/legal/privacy" className="hover:text-fern-700 transition-colors">Privacy Policy</Link>
            <Link href="/legal/sms" className="hover:text-fern-700 transition-colors">SMS Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
