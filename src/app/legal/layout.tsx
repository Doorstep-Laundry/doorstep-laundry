import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fern-50">
      <header className="border-b border-fern-200/80 bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/doorstep/DL_icon_RGB.svg" alt="" width={32} height={32} className="h-8 w-auto" unoptimized />
            <Image src="/doorstep/doorstep-logo-wordmark.svg" alt="Doorstep Laundry" width={120} height={28} className="h-7 w-auto hidden sm:block" unoptimized />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        {children}
      </main>

      <footer className="border-t border-fern-200/80 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fern-500">
          <Link href="/contact" className="hover:text-fern-700 transition-colors">Contact</Link>
          <Link href="/legal/terms" className="hover:text-fern-700 transition-colors">Terms of Service</Link>
          <Link href="/legal/privacy" className="hover:text-fern-700 transition-colors">Privacy Policy</Link>
          <Link href="/legal/sms" className="hover:text-fern-700 transition-colors">SMS Policy</Link>
        </div>
      </footer>
    </div>
  );
}
