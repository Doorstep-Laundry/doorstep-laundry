"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const pricingNav = { href: "/app/pricing", label: "Pricing" } as const;

const allNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/book", label: "Book a pickup" },
] as const;

const linkBase =
  "text-sm font-medium transition-colors py-2 px-1 border-b-2 border-transparent";
const linkActive = "text-fern-900 font-semibold border-fern-500 cursor-default";
const linkInactive =
  "text-fern-600 hover:text-fern-900 border-transparent hover:border-fern-200";

function PersonIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "customer";
  const isStaffOrAdmin = role === "staff" || role === "admin";
  const navLinks =
    role === "admin"
      ? [
          pricingNav,
          { href: "/wash", label: "Wash" },
          { href: "/orders", label: "Orders" },
          { href: "/driver", label: "Driver" },
          { href: "/admin", label: "Admin" },
        ]
      : isStaffOrAdmin
        ? [
            pricingNav,
            { href: "/wash", label: "Wash" },
            { href: "/orders", label: "Orders" },
            { href: "/driver", label: "Driver" },
          ]
        : [pricingNav, ...allNavLinks];

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/app/pricing" && pathname.startsWith("/app/pricing")) ||
    (href === "/dashboard" && pathname === "/wash") ||
    (href === "/admin" && pathname.startsWith("/admin")) ||
    (href === "/orders" && pathname === "/orders") ||
    (href === "/driver" && pathname.startsWith("/driver"));

  useEffect(() => {
    if (!accountOpen) return;
    function close() {
      setAccountOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [accountOpen]);

  return (
    <header className="relative border-b border-fern-200/80 bg-white shadow-sm">
      <div className="mx-auto max-w-5xl px-4 py-4 flex justify-between items-center">
        <Link
          href="/"
          className="flex items-center gap-2 text-fern-900 hover:opacity-90 transition-opacity"
          aria-label="Doorstep Laundry – Home"
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
            alt="Doorstep"
            width={140}
            height={28}
            className="h-7 w-auto hidden sm:block"
            unoptimized
          />
          <span className="text-lg font-semibold text-fern-800 sm:hidden">Doorstep Laundry</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            return isActive(href) ? (
              <span
                key={href}
                aria-current="page"
                className={`${linkBase} ${linkActive}`}
              >
                {label}
              </span>
            ) : (
              <Link
                key={href}
                href={href}
                className={`${linkBase} ${linkInactive}`}
              >
                {label}
              </Link>
            );
          })}
          <div className="relative ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAccountOpen((o) => !o);
              }}
              className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-fern-200 bg-fern-50 text-fern-700 hover:bg-fern-100 hover:border-fern-300 transition-colors"
              aria-expanded={accountOpen}
              aria-label="Account menu"
            >
              <PersonIcon />
            </button>
            {accountOpen && (
              <div
                className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-lg border border-fern-200 bg-white shadow-lg z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href="/account"
                  onClick={() => setAccountOpen(false)}
                  className={`block px-4 py-2 text-sm font-medium ${
                    pathname === "/account"
                      ? "text-fern-900 bg-fern-50"
                      : "text-fern-700 hover:bg-fern-50"
                  }`}
                  aria-current={pathname === "/account" ? "page" : undefined}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-fern-700 hover:bg-fern-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile: hamburger button */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden p-2 rounded-lg text-fern-700 hover:bg-fern-100"
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10 bg-fern-900/20 md:hidden"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="absolute left-0 right-0 top-full z-20 border-b border-fern-200/80 bg-white shadow-lg md:hidden"
            aria-label="Mobile menu"
          >
            <div className="mx-auto max-w-5xl px-4 py-3 flex flex-col gap-0">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`py-3 px-2 text-base font-medium border-b border-fern-100 ${
                    isActive(href) ? "text-fern-900" : "text-fern-600 hover:text-fern-900"
                  }`}
                  aria-current={isActive(href) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className={`py-3 px-2 text-base font-medium border-b border-fern-100 ${
                  pathname === "/account" ? "text-fern-900" : "text-fern-600 hover:text-fern-900"
                }`}
                aria-current={pathname === "/account" ? "page" : undefined}
              >
                Profile
              </Link>
              <div className="border-t border-fern-100 mt-1 pt-2">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left py-3 px-2 text-base font-medium text-fern-600 hover:text-fern-900"
                >
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
