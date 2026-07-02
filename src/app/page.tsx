import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Doorstep Laundry – Laundry Pickup & Delivery in Las Cruces, NM",
  description:
    "Laundry pickup and delivery in Las Cruces, New Mexico. Schedule a pickup—we wash, fold, and deliver to your door. No trips to the laundromat.",
  keywords: [
    "laundry pickup Las Cruces",
    "laundry delivery Las Cruces NM",
    "wash and fold Las Cruces",
    "laundry service Las Cruces New Mexico",
    "Doorstep Laundry",
  ],
  openGraph: {
    title: "Doorstep Laundry – Laundry Pickup & Delivery in Las Cruces, NM",
    description:
      "Laundry pickup and delivery in Las Cruces, NM. We wash, fold, and deliver to your door.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Doorstep Laundry – Las Cruces, NM",
    description: "Laundry pickup and delivery in Las Cruces, NM. Wash, fold, delivered.",
  },
  robots: "index, follow",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-fern-50">
      {session ? (
        <AppHeader />
      ) : (
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
              <Link
                href="/pricing"
                className="text-sm font-medium text-fern-600 hover:text-fern-900 transition-colors"
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

      <main>
        <section className="mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="flex justify-center mb-10">
            <Image
              src="/doorstep/DL_logo_horizontal_RGB-cropped.svg"
              alt="Doorstep Laundry – laundry pickup and delivery in Las Cruces, NM"
              width={898}
              height={284}
              className="w-60 h-auto sm:w-80 md:w-[400px]"
              unoptimized
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-fern-900 sm:text-5xl">
            Laundry pickup and delivery, at your door
          </h1>
          <p className="mt-6 text-lg text-fern-600 max-w-2xl mx-auto">
            Schedule a pickup in Las Cruces or the surrounding area—we wash and fold, then deliver back to you. No hassle, no trips to the laundromat.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-fern-500 text-white px-6 py-3 text-base font-medium hover:bg-fern-600 transition-colors shadow-md"
                >
                  Dashboard
                </Link>
                <Link
                  href="/book"
                  className="rounded-xl border-2 border-fern-300 bg-white text-fern-700 px-6 py-3 text-base font-medium hover:bg-fern-50 hover:border-fern-400 transition-colors"
                >
                  Book a pickup
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-xl bg-fern-500 text-white px-6 py-3 text-base font-medium hover:bg-fern-600 transition-colors shadow-md"
                >
                  Get started
                </Link>
                <Link
                  href="/book"
                  className="rounded-xl border-2 border-fern-300 bg-white text-fern-700 px-6 py-3 text-base font-medium hover:bg-fern-50 hover:border-fern-400 transition-colors"
                >
                  Book a pickup
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="border-t border-fern-200/80 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <h2 className="text-2xl font-semibold text-fern-900 text-center">
              How it works
            </h2>
            <ul className="mt-14 grid gap-12 sm:grid-cols-3">
              <li className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-fern-100 text-fern-700 font-semibold text-lg">
                  1
                </div>
                <h3 className="mt-5 text-lg font-medium text-fern-900">
                  Schedule
                </h3>
                <p className="mt-2 text-fern-600">
                  Pick a pickup and delivery date. Add your address and we&apos;ll
                  handle the rest.
                </p>
              </li>
              <li className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-fern-100 text-fern-700 font-semibold text-lg">
                  2
                </div>
                <h3 className="mt-5 text-lg font-medium text-fern-900">
                  We pick up & wash
                </h3>
                <p className="mt-2 text-fern-600">
                  Our team picks up your laundry, washes and folds it at our
                  facility.
                </p>
              </li>
              <li className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-fern-100 text-fern-700 font-semibold text-lg">
                  3
                </div>
                <h3 className="mt-5 text-lg font-medium text-fern-900">
                  Delivered back
                </h3>
                <p className="mt-2 text-fern-600">
                  We deliver clean, folded laundry to your door on your chosen
                  date.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 text-center bg-fern-50">
          <h2 className="text-2xl font-semibold text-fern-900">
            {session ? "Ready to book?" : "Ready to try it?"}
          </h2>
          <p className="mt-4 text-fern-600">
            {session
              ? "Schedule your next pickup from your dashboard."
              : "Create an account to book your first pickup."}
          </p>
          <div className="mt-8">
            <Link
              href={session ? "/dashboard" : "/signup"}
              className="inline-flex rounded-xl bg-fern-500 text-white px-6 py-3 text-base font-medium hover:bg-fern-600 transition-colors shadow-md"
            >
              {session ? "Go to dashboard" : "Sign up"}
            </Link>
          </div>
        </section>
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
            <Link href="/contact" className="hover:text-fern-700 transition-colors">Contact</Link>
            <Link href="/legal/terms" className="hover:text-fern-700 transition-colors">Terms of Service</Link>
            <Link href="/legal/privacy" className="hover:text-fern-700 transition-colors">Privacy Policy</Link>
            <Link href="/legal/sms" className="hover:text-fern-700 transition-colors">SMS Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
