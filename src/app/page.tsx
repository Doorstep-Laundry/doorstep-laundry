import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Doorstep Laundry – Laundry Pickup & Delivery in Las Cruces, NM | Coming Soon",
  description:
    "Doorstep Laundry is coming to Las Cruces, New Mexico. Pickup and delivery laundry service—we wash, fold, and bring it back to your door. No trips to the laundromat.",
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
      "Laundry pickup and delivery in Las Cruces, New Mexico. We wash, fold, and deliver. Coming soon.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Doorstep Laundry – Las Cruces, NM | Coming Soon",
    description: "Laundry pickup and delivery in Las Cruces, NM. Wash, fold, delivered. Coming soon.",
  },
  robots: "index, follow",
};

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-fern-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-8">
          <Image
            src="/doorstep/DL_logo_horizontal_RGB-cropped.svg"
            alt="Doorstep Laundry – laundry pickup and delivery in Las Cruces, NM"
            width={240}
            height={96}
            className="h-20 w-auto sm:h-24"
            unoptimized
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-fern-900 sm:text-4xl">
          Something fresh is on the way
        </h1>
        <p className="mt-4 text-lg text-fern-600">
          Laundry pickup and delivery in Las Cruces, NM—at your door. We&apos;re getting ready to launch.
        </p>
        <p className="mt-2 text-sm text-fern-500">
          Check back soon.
        </p>
        <p className="mt-8 text-sm text-fern-400" aria-hidden="true">
          Laundry service · wash and fold · pickup and delivery
        </p>
      </div>
      <footer className="mt-16 text-sm text-fern-400">
        Doorstep Laundry · wash · fold · delivered
      </footer>
    </div>
  );
}
