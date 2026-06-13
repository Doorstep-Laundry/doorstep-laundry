"use client";

import { useState } from "react";
import { AdminUserList } from "./admin-user-list";
import { AdminCustomerSearch } from "./admin-customer-search";
import { AdminLoadLocations } from "./admin-load-locations";
import { AdminDriverLocations } from "./admin-driver-locations";
import { AdminPricePerPound } from "./admin-price-per-pound";
import { AdminGrtPercent } from "./admin-grt-percent";
import { AdminCompanyInfo } from "./admin-company-info";
import { AdminBookingAvailability } from "./admin-booking-availability";
import { AdminPastDueGracePeriod } from "./admin-past-due-grace-period";
import { DebugTools } from "@/app/debug/debug-tools";
import { AdminAnalyticsCustomerTypeChart } from "./admin-analytics-customer-type-chart";
import { AdminAnalyticsRevenueByMonthChart } from "./admin-analytics-revenue-by-month-chart";
import { AdminAnalyticsLoadsByDayChart } from "./admin-analytics-loads-by-day-chart";

type Tab = "operations" | "analytics" | "debug";

const TABS: { id: Tab; label: string }[] = [
  { id: "operations", label: "Operations" },
  { id: "analytics", label: "Analytics" },
  { id: "debug", label: "Debug" },
];

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("operations");

  return (
    <div>
      <div className="border-b border-fern-200 mb-8">
        <nav className="flex gap-1" aria-label="Admin tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-fern-600 text-fern-700"
                  : "border-transparent text-fern-500 hover:text-fern-700 hover:border-fern-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "operations" && (
        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              User roles
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Set each user&apos;s role. Changes take effect on their next request or when they sign in again.
            </p>
            <AdminUserList />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Find customer
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Search all customers by email or name. Select one to set custom price per pound and NMGRT exempt (e.g. for non-profits).
            </p>
            <AdminCustomerSearch />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Load locations
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Locations staff can assign to loads on the Wash page (e.g. Washer 2, Shelf 1, Folding station). Add or edit when you add equipment.
            </p>
            <AdminLoadLocations />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Driver locations
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Where drivers are (when they share location from the Driver page). Click &quot;View on map&quot; to open in Google Maps.
            </p>
            <AdminDriverLocations />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Price per pound
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Base price per pound (before tax) when orders enter &quot;Waiting for payment&quot; (after loads are cleaned and weighed). NMGRT is added on top of this rate. Default $1.50/lb.
            </p>
            <AdminPricePerPound />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              GRT (Gross Receipts Tax)
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              New Mexico Gross Receipts Tax percentage, added on top of the base price per pound. Receipts show subtotal (base), NMGRT, and total. Default 8.39%.
            </p>
            <AdminGrtPercent />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Booking — days &amp; time slots
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Use the grid: each column is a day, each row is a time window. Checked cells are shown to customers for both pickup and delivery.
            </p>
            <AdminBookingAvailability />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-2">
              Past due grace period
            </h2>
            <p className="text-sm text-fern-600 mb-6">
              Number of days after the scheduled delivery date before an unpaid order is considered past due. Customers with a past due balance cannot schedule a new pickup until they pay. Default is 3 days.
            </p>
            <AdminPastDueGracePeriod />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fern-900 mb-6">
              Company, facility &amp; service area
            </h2>
            <AdminCompanyInfo />
          </section>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-8">
          <AdminAnalyticsCustomerTypeChart />
          <AdminAnalyticsRevenueByMonthChart />
          <AdminAnalyticsLoadsByDayChart />
        </div>
      )}

      {activeTab === "debug" && (
        <div className="space-y-8">
          <DebugTools />
        </div>
      )}
    </div>
  );
}
