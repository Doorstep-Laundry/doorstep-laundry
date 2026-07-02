import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppHeader } from "@/components/app-header";
import { formatPhoneDisplay } from "@/lib/phone";
import { AccountForm } from "./account-form";
import { AddressSection } from "./address-section";
import { DefaultLoadOptionsSection } from "./default-load-options-section";
import type { LoadOptionsInput } from "@/lib/load-options";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;

  const [user, addresses, ordersUsingAddresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, smsConsentAt: true, defaultLoadOptions: true },
    }),
    prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.order.findMany({
      where: { customerId: userId },
      select: { pickupAddressId: true, deliveryAddressId: true },
    }),
  ]);

  const addressIdsInUse = [
    ...new Set(
      ordersUsingAddresses.flatMap((o) => [o.pickupAddressId, o.deliveryAddressId])
    ),
  ];

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold text-fern-900 mb-6">
          Account
        </h1>
        <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-fern-900 mb-4">
            Profile
          </h2>
          {(role === "staff" || role === "admin") && (
            <p className="mb-4 text-sm text-fern-700">
              <span className="font-medium">Account type:</span>{" "}
              {role === "admin" ? "Admin" : "Staff"}
            </p>
          )}
          <AccountForm
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            phone={formatPhoneDisplay(user?.phone ?? "")}
            smsConsentAt={user?.smsConsentAt ?? null}
          />
        </section>
        <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-fern-900 mb-4">
            Default laundry options
          </h2>
          <DefaultLoadOptionsSection
            initialOptions={
              user?.defaultLoadOptions && typeof user.defaultLoadOptions === "object"
                ? (user.defaultLoadOptions as LoadOptionsInput)
                : null
            }
          />
        </section>
        <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-fern-900 mb-4">
            Addresses
          </h2>
          <AddressSection addresses={addresses} addressIdsInUse={addressIdsInUse} />
        </section>
      </main>
    </div>
  );
}
