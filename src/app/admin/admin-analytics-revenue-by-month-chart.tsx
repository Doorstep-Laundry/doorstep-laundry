"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { RevenueByMonthPoint } from "@/app/api/admin/analytics/revenue-by-month/route";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();

// Current year: solid fern green.
// Each year prior shifts hue 22° toward blue (145° → 210°) at 50% opacity.
function yearStroke(year: number): { color: string; opacity: number; width: number } {
  const yearsAgo = CURRENT_YEAR - year;
  if (yearsAgo === 0) return { color: "#2d6a4f", opacity: 1, width: 2.5 };
  const hue = Math.min(145 + yearsAgo * 22, 210);
  return { color: `hsl(${hue}, 45%, 40%)`, opacity: 0.5, width: 2 };
}

type ChartRow = Record<string, number | string>;

function buildRows(raw: RevenueByMonthPoint[], allTime: boolean, years: number[]): ChartRow[] {
  if (allTime) {
    const byMonth = new Map<number, number>();
    raw.forEach((r) => byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.revenueDollars));
    return MONTHS.map((m, i) => ({ month: m, "All time": byMonth.get(i + 1) ?? 0 }));
  }

  const byKey = new Map<string, number>();
  raw.forEach((r) => byKey.set(`${r.year}-${r.month}`, r.revenueDollars));

  return MONTHS.map((m, i) => {
    const row: ChartRow = { month: m };
    years.forEach((y) => { row[String(y)] = byKey.get(`${y}-${i + 1}`) ?? 0; });
    return row;
  });
}

export function AdminAnalyticsRevenueByMonthChart() {
  const [raw, setRaw] = useState<RevenueByMonthPoint[]>([]);
  const [allTime, setAllTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics/revenue-by-month")
      .then((r) => r.json())
      .then((data: RevenueByMonthPoint[]) => { setRaw(data); setLoading(false); })
      .catch(() => { setError("Failed to load data."); setLoading(false); });
  }, []);

  if (loading) return <p className="text-sm text-fern-500 py-12 text-center">Loading…</p>;
  if (error)   return <p className="text-sm text-red-500  py-12 text-center">{error}</p>;

  // Years present in data, newest first.
  const years = Array.from(new Set(raw.map((r) => r.year))).sort((a, b) => b - a);
  const rows = buildRows(raw, allTime, years);

  const dollarFormatter = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-fern-900">Revenue by Month</h2>
        <label className="flex items-center gap-2 text-sm text-fern-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allTime}
            onChange={(e) => setAllTime(e.target.checked)}
            className="rounded border-fern-300 text-fern-600 focus:ring-fern-500"
          />
          All time
        </label>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2ede6" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#4a7c5c" }}
            tickLine={false}
            axisLine={{ stroke: "#c3dbc9" }}
          />
          <YAxis
            tickFormatter={dollarFormatter}
            tick={{ fontSize: 12, fill: "#4a7c5c" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value) => [
              `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ]}
            contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: "#c3dbc9" }}
          />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />

          {allTime ? (
            <Line
              type="monotone"
              dataKey="All time"
              stroke="#2d6a4f"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#2d6a4f" }}
              activeDot={{ r: 5 }}
            />
          ) : (
            years.map((year) => {
              const { color, opacity, width } = yearStroke(year);
              return (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={String(year)}
                  stroke={color}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  dot={{ r: 3, fill: color, fillOpacity: opacity }}
                  activeDot={{ r: 5, fillOpacity: 1 }}
                />
              );
            })
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
