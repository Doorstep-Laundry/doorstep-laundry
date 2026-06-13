"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type CustomerType =
  | "young_professional"
  | "busy_family"
  | "mobility_limited"
  | "business"
  | "not_set";

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  young_professional: "Young Professional",
  busy_family: "Busy Family",
  mobility_limited: "Mobility-Limited",
  business: "Business",
  not_set: "Not Set",
};

const CUSTOMER_TYPE_OPTIONS: CustomerType[] = [
  "not_set",
  "young_professional",
  "busy_family",
  "mobility_limited",
  "business",
];

type CustomerSearchHit = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  customPricePerPoundCents: number | null;
  nmgrtExempt: boolean;
  customerType: CustomerType;
};

type CustomerDetail = CustomerSearchHit & {
  phone: string | null;
  defaultLoadOptions: unknown;
  orderCount: number;
  creditedLoads: number;
};

const inputClass =
  "rounded-lg border border-fern-200 bg-white px-3 py-2 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 w-full";

export function AdminCustomerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customRate, setCustomRate] = useState<string>("");
  const [nmgrtExempt, setNmgrtExempt] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>("not_set");
  const [creditedLoads, setCreditedLoads] = useState<string>("0");
  const [message, setMessage] = useState("");

  const runSearch = useCallback(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    setMessage("");
    fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setSearching(false);
      })
      .catch(() => {
        setResults([]);
        setSearching(false);
      });
  }, [query]);

  function selectCustomer(c: CustomerSearchHit) {
    setSelected(null);
    setLoadingDetail(true);
    setMessage("");
    fetch(`/api/admin/customers/${c.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setMessage(data.error);
          setLoadingDetail(false);
          return;
        }
        setSelected(data);
        setCustomRate(
          data.customPricePerPoundCents != null
            ? String(data.customPricePerPoundCents)
            : ""
        );
        setNmgrtExempt(Boolean(data.nmgrtExempt));
        setCustomerType((data.customerType as CustomerType) ?? "not_set");
        setCreditedLoads(String(data.creditedLoads ?? 0));
        setLoadingDetail(false);
      })
      .catch(() => {
        setMessage("Failed to load customer");
        setLoadingDetail(false);
      });
  }

  async function saveCustomer() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const body: {
        customPricePerPoundCents?: number | null;
        nmgrtExempt?: boolean;
        customerType?: CustomerType;
        creditedLoads?: number;
      } = {
        nmgrtExempt,
        customerType,
      };
      if (customRate === "" || customRate.trim() === "") {
        body.customPricePerPoundCents = null;
      } else {
        const n = parseInt(customRate, 10);
        if (!Number.isNaN(n) && n >= 0) {
          body.customPricePerPoundCents = n;
        }
      }
      const creditsVal = parseInt(creditedLoads, 10);
      if (!Number.isNaN(creditsVal) && creditsVal >= 0) {
        body.creditedLoads = creditsVal;
      }
      const res = await fetch(`/api/admin/customers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              customPricePerPoundCents: data.customPricePerPoundCents ?? null,
              nmgrtExempt: data.nmgrtExempt ?? false,
              customerType: data.customerType ?? "not_set",
              creditedLoads: data.creditedLoads ?? 0,
            }
          : null
      );
      setMessage("Saved.");
    } catch {
      setMessage("Something went wrong");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          className={inputClass}
          aria-label="Search customers"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Find"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-fern-600">{message}</p>
      )}

      {results.length > 0 && !selected && (
        <div className="rounded-lg border border-fern-200 bg-white max-h-60 overflow-y-auto">
          <ul className="divide-y divide-fern-200">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectCustomer(c)}
                  className="w-full px-4 py-3 text-left hover:bg-fern-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fern-900">{c.email}</span>
                    {c.customerType !== "not_set" && (
                      <span className="text-xs rounded-full bg-fern-100 text-fern-700 px-2 py-0.5 font-medium">
                        {CUSTOMER_TYPE_LABELS[c.customerType]}
                      </span>
                    )}
                  </div>
                  {c.name && (
                    <div className="text-sm text-fern-500">{c.name}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingDetail && (
        <p className="text-sm text-fern-500">Loading customer…</p>
      )}

      {selected && (
        <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-fern-900">
                {selected.email}
                {selected.name && (
                  <span className="text-fern-600 font-normal ml-2">
                    {selected.name}
                  </span>
                )}
              </h3>
              {selected.customerType !== "not_set" && (
                <span className="text-xs rounded-full bg-fern-100 text-fern-700 px-2.5 py-1 font-medium">
                  {CUSTOMER_TYPE_LABELS[selected.customerType]}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-fern-500 hover:text-fern-700"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-fern-500">
            {selected.orderCount} order{selected.orderCount !== 1 ? "s" : ""}
            {" · "}
            <Link href="/orders" className="text-fern-600 hover:underline">
              View all orders
            </Link>
          </p>
          <div className="grid gap-3 max-w-md">
            <div>
              <label className="block text-sm font-medium text-fern-700 mb-1">
                Customer type
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                className={inputClass}
              >
                {CUSTOMER_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {CUSTOMER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fern-700 mb-1">
                Custom price per pound (cents)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Default (global setting)"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-fern-500 mt-0.5">
                Leave blank to use global default. Overrides base $/lb for this customer.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-fern-700 mb-1">
                Credited loads
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={creditedLoads}
                onChange={(e) => setCreditedLoads(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-fern-500 mt-0.5">
                Free wash loads granted to this customer. Consumed at booking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="nmgrt-exempt"
                checked={nmgrtExempt}
                onChange={(e) => setNmgrtExempt(e.target.checked)}
                className="rounded border-fern-300 text-fern-600 focus:ring-fern-500"
              />
              <label htmlFor="nmgrt-exempt" className="text-sm font-medium text-fern-700">
                NMGRT exempt (e.g. non-profit)
              </label>
            </div>
            <button
              type="button"
              onClick={saveCustomer}
              disabled={saving}
              className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50 w-fit"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
