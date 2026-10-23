"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { HistoryPoint } from "@/lib/types";

const colors = ["#1268e5", "#0f9f8f", "#7c5cbf", "#d0892b", "#d4537e", "#3d7a4a"];

function useDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function TrendChart({
  series,
  selected,
  onToggle,
}: {
  series: { fullName: string; points: HistoryPoint[] }[];
  selected: string[];
  onToggle: (fullName: string) => void;
}) {
  const chosen = series.filter((item) => selected.includes(item.fullName));
  const dates = [...new Set(chosen.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const rows = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of chosen) {
      row[item.fullName] = item.points.find((point) => point.date === date)?.stars ?? null;
    }
    return row;
  });
  const canDraw = dates.length >= 2 && chosen.length > 0;
  const dark = useDark();
  const axis = dark ? "#93a0b5" : "#66758c";
  const grid = dark ? "#243044" : "#e6ebf2";

  return (
    <div className="surface space-y-4 p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {series.slice(0, 8).map((item, index) => {
          const active = selected.includes(item.fullName);
          return (
            <button
              key={item.fullName}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(item.fullName)}
              className={`choice choice-pill choice-calm shrink-0 rounded-full border px-3 py-1 text-xs ${active ? "text-white" : "bg-background text-foreground"}`}
              style={active ? { background: colors[index % colors.length] } : undefined}
            >
              {item.fullName}
            </button>
          );
        })}
      </div>
      {canDraw ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke={axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={axis}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value: number) => formatNumber(value)}
              />
              <Tooltip
                formatter={(value) => formatNumber(Number(value ?? 0))}
                labelFormatter={(label) => formatShortDate(String(label))}
                contentStyle={{
                  background: dark ? "#141b26" : "#ffffff",
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  color: dark ? "#e8eef7" : "#17233b",
                }}
              />
              {chosen.map((item) => {
                const colorIndex = series.findIndex((entry) => entry.fullName === item.fullName);
                return (
                  <Line
                    key={item.fullName}
                    type="monotone"
                    dataKey={item.fullName}
                    name={item.fullName}
                    stroke={colors[colorIndex % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          至少需要两天快照才能画出星标趋势。首次采集日会先把仓库记下来，明天再对照。
        </p>
      )}
    </div>
  );
}
