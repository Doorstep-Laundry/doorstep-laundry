"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type ScatterShapeProps,
} from "recharts";
import type { LoadsByDayPoint } from "@/app/api/admin/analytics/loads-by-day-of-week/route";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// AM dots sit slightly left, PM dots slightly right so they don't overlap.
const AM_OFFSET = -0.15;
const PM_OFFSET =  0.15;

const AM_COLOR = "#2d6a4f";
const PM_COLOR = "#c08040";

type ScatterPoint = { x: number; y: number; label: string };

// Hollow circle for AM pickups (before noon)
function HollowCircle(props: ScatterShapeProps) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={6} fill="none" stroke={AM_COLOR} strokeWidth={2} />;
}

// Hollow square for PM pickups (after noon)
function HollowSquare(props: ScatterShapeProps) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="none" stroke={PM_COLOR} strokeWidth={2} />;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-lg border border-fern-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-fern-900">{pt.label}</p>
      <p className="text-fern-600">{pt.y} load{pt.y !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function AdminAnalyticsLoadsByDayChart() {
  const [raw, setRaw] = useState<LoadsByDayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics/loads-by-day-of-week")
      .then((r) => r.json())
      .then((data: LoadsByDayPoint[]) => { setRaw(data); setLoading(false); })
      .catch(() => { setError("Failed to load data."); setLoading(false); });
  }, []);

  const amData: ScatterPoint[] = raw
    .filter((r) => r.isAm)
    .map((r) => ({
      x: r.dayOfWeek + AM_OFFSET,
      y: r.loadCount,
      label: `${DAY_LABELS[r.dayOfWeek]} · Morning · wk ${r.weekNumber} ${r.year}`,
    }));

  const pmData: ScatterPoint[] = raw
    .filter((r) => !r.isAm)
    .map((r) => ({
      x: r.dayOfWeek + PM_OFFSET,
      y: r.loadCount,
      label: `${DAY_LABELS[r.dayOfWeek]} · Evening · wk ${r.weekNumber} ${r.year}`,
    }));

  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-base font-semibold text-fern-900">
          Scheduled Loads by Day of Week
        </h2>
        <div className="flex items-center gap-4 text-xs text-fern-700">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="5" fill="none" stroke={AM_COLOR} strokeWidth="2" />
            </svg>
            Morning (before noon)
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="2" width="10" height="10" fill="none" stroke={PM_COLOR} strokeWidth="2" />
            </svg>
            Evening (after noon)
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-fern-500 py-24 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-24 text-center">{error}</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2ede6" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-0.5, 6.5]}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tickFormatter={(v) => DAY_LABELS[Math.round(v)] ?? ""}
              tick={{ fontSize: 12, fill: "#4a7c5c" }}
              tickLine={false}
              axisLine={{ stroke: "#c3dbc9" }}
            />
            <YAxis
              type="number"
              dataKey="y"
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
            <Tooltip content={<CustomTooltip />} />
            <Scatter name="Morning" data={amData} shape={HollowCircle} />
            <Scatter name="Evening" data={pmData} shape={HollowSquare} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
