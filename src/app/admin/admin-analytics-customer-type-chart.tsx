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

export function AdminAnalyticsCustomerTypeChart() {
  const [data, setData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics/customer-types")
      .then((r) => r.json())
      .then((raw: CustomerTypeDataPoint[]) => {
        const byType = new Map(raw.map((r) => [r.customerType, r]));
        const rows: ChartRow[] = TYPE_ORDER.map((t) => ({
          label: CUSTOMER_TYPE_LABELS[t] ?? t,
          revenueDollars: byType.get(t)?.revenueDollars ?? 0,
          loadCount: byType.get(t)?.loadCount ?? 0,
        }));
        setData(rows);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analytics data.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-fern-500 py-12 text-center">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-500 py-12 text-center">{error}</p>;
  }

  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-fern-900 mb-6">
        Revenue &amp; Loads by Customer Type
      </h2>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2ede6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#4a7c5c" }}
            tickLine={false}
            axisLine={{ stroke: "#c3dbc9" }}
          />
          {/* Left Y — Revenue */}
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
          {/* Right Y — Loads */}
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
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
          />
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
    </div>
  );
}
