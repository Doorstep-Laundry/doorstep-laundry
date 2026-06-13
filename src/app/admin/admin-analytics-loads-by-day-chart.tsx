"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { LoadsByDayPoint } from "@/app/api/admin/analytics/loads-by-day-of-week/route";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AM_COLOR   = "#2d6a4f";
const PM_COLOR   = "#c08040";

type ChartRow = { day: string; morning: number; evening: number };

const dateInputClass =
  "rounded-lg border border-fern-200 bg-white px-2.5 py-1.5 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20";

function todayStr()    { return new Date().toISOString().split("T")[0]; }
function janFirstStr() { return `${new Date().getFullYear()}-01-01`; }

function CustomLegend() {
  return (
    <div className="flex justify-center gap-6 pt-3 text-sm text-fern-700">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: AM_COLOR }} />
        Morning
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PM_COLOR }} />
        Evening
      </span>
    </div>
  );
}

export function AdminAnalyticsLoadsByDayChart() {
  const [data, setData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(janFirstStr);
  const [to,   setTo]   = useState(todayStr);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    const url = `/api/admin/analytics/loads-by-day-of-week${params.size ? `?${params}` : ""}`;

    fetch(url)
      .then((r) => r.json())
      .then((raw: LoadsByDayPoint[]) => {
        const rows: ChartRow[] = DAY_LABELS.map((day, i) => {
          const am = raw.find((r) => r.dayOfWeek === i &&  r.isAm);
          const pm = raw.find((r) => r.dayOfWeek === i && !r.isAm);
          return { day, morning: am?.loadCount ?? 0, evening: pm?.loadCount ?? 0 };
        });
        setData(rows);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load data."); setLoading(false); });
  }, [from, to]);

  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-base font-semibold text-fern-900">
          Scheduled Loads by Day of Week
        </h2>
        <div className="flex items-center gap-2 text-sm text-fern-600">
          <label htmlFor="dow-from">From</label>
          <input
            id="dow-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={dateInputClass}
          />
          <label htmlFor="dow-to">To</label>
          <input
            id="dow-to"
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2ede6" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: "#4a7c5c" }}
              tickLine={false}
              axisLine={{ stroke: "#c3dbc9" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#4a7c5c" }}
              tickLine={false}
              axisLine={false}
              width={40}
              label={{
                value: "Loads",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { fontSize: 11, fill: "#4a7c5c" },
              }}
            />
            <Tooltip
              cursor={{ fill: "#f0f7f2" }}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: "#c3dbc9" }}
            />
            <Legend content={<CustomLegend />} />
            <Bar dataKey="morning" name="Morning before noon" fill={AM_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
            <Bar dataKey="evening" name="Evening after noon"  fill={PM_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
