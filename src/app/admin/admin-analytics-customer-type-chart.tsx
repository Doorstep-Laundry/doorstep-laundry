"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CustomerTypeDataPoint } from "@/app/api/admin/analytics/customer-types/route";

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  young_professional: "Young Professional",
  busy_family: "Busy Family",
  mobility_limited: "Mobility-Limited",
  business: "Business",
  not_set: "Not Set",
};

const TYPE_ORDER = [
  "young_professional",
  "busy_family",
  "mobility_limited",
  "business",
  "not_set",
];

type ChartRow = {
  label: string;
  revenueDollars: number;
  loadCount: number;
};

const dateInputClass =
  "rounded-lg border border-fern-200 bg-white px-2.5 py-1.5 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function janFirstStr() {
  return `${new Date().getFullYear()}-01-01`;
}

export function AdminAnalyticsCustomerTypeChart() {
  const [data, setData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(janFirstStr);
  const [to, setTo] = useState(todayStr);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    const url = `/api/admin/analytics/customer-types${params.size ? `?${params}` : ""}`;

    fetch(url)
      .then((r) => r.json())
      .then((raw: CustomerTypeDataPoint[]) => {
        const byType = new Map(raw.map((r) => [r.customerType, r]));
        const rows: ChartRow[] = TYPE_ORDER.map((t) => ({
          label: CUSTOMER_TYPE_LABELS[t] ?? t,
          revenueDollars: byType.get(t)?.revenueDollars ?? 0,
          loadCount: byType.get(t)?.loadCount ?? 0,
        }));
        setData(rows);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analytics data.");
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-base font-semibold text-fern-900">
          Revenue &amp; Loads by Customer Type
        </h2>
        <div className="flex items-center gap-2 text-sm text-fern-600">
          <label htmlFor="ct-from" className="whitespace-nowrap">From</label>
          <input
            id="ct-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={dateInputClass}
          />
          <label htmlFor="ct-to" className="whitespace-nowrap">To</label>
          <input
            id="ct-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={dateInputClass}
          />
          <button
            type="button"
            onClick={() => { setFrom(janFirstStr()); setTo(todayStr()); }}
            className="text-fern-400 hover:text-fern-700 text-xs underline whitespace-nowrap"
          >
            Reset
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-fern-500 py-24 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-24 text-center">{error}</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2ede6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#4a7c5c" }}
              tickLine={false}
              axisLine={{ stroke: "#c3dbc9" }}
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              tick={{ fontSize: 12, fill: "#4a7c5c" }}
              tickLine={false}
              axisLine={false}
              width={72}
              label={{
                value: "Revenue ($)",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { fontSize: 11, fill: "#4a7c5c" },
              }}
            />
            <YAxis
              yAxisId="loads"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#a07040" }}
              tickLine={false}
              axisLine={false}
              width={48}
              label={{
                value: "Loads",
                angle: 90,
                position: "insideRight",
                offset: 12,
                style: { fontSize: 11, fill: "#a07040" },
              }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "Revenue") return [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                return [value, name];
              }}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: "#c3dbc9" }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
            <Bar
              yAxisId="revenue"
              dataKey="revenueDollars"
              name="Revenue"
              fill="#4a7c5c"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
            />
            <Line
              yAxisId="loads"
              type="monotone"
              dataKey="loadCount"
              name="Loads"
              stroke="#c08040"
              strokeWidth={2}
              dot={{ r: 4, fill: "#c08040" }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
