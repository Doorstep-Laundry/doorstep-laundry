import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { AdminUserList } from "./admin-user-list";
import { AdminCustomerSearch } from "./admin-customer-search";
import { AdminLoadLocations } from "./admin-load-locations";
import { AdminDriverLocations } from "./admin-driver-locations";
import { AdminPricePerPound } from "./admin-price-per-pound";
import { AdminGrtPercent } from "./admin-grt-percent";
import { AdminCompanyInfo } from "./admin-company-info";
import { AdminBookingAvailability } from "./admin-booking-availability";
import { AdminDebugSection } from "./admin-debug-section";
import { AdminPastDueGracePeriod } from "./admin-past-due-grace-period";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-12">
        <section>
          <h1 className="text-xl font-semibold text-fern-900 mb-6">
            Admin – User roles
          </h1>
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

        <section>
          <h2 className="text-lg font-semibold text-fern-900 mb-2">
            Debug
          </h2>
          <AdminDebugSection />
        </section>
      </main>
    </div>
  );
}
