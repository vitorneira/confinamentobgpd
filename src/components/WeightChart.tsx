"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatData, formatNumero } from "@/lib/format";

type Ponto = { data: string; pesoKg: number | null };

function TooltipCustomizado({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Ponto }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-card border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-zinc-500">{formatData(ponto.data)}</p>
      <p className="font-medium tabular-nums text-black dark:text-zinc-50">
        {formatNumero(ponto.pesoKg)} kg
      </p>
    </div>
  );
}

export function WeightChart({ pontos }: { pontos: Ponto[] }) {
  const dados = pontos.filter((p) => p.pesoKg !== null);
  if (dados.length === 0) {
    return <p className="text-sm text-zinc-500">Sem pesagens registradas.</p>;
  }

  return (
    <div className="viz-root h-56 w-full">
      <style>{`
        .viz-root .peso-line { stroke: #4a3aa7; fill: #4a3aa7; }
        @media (prefers-color-scheme: dark) {
          .viz-root .peso-line { stroke: #9085e9; fill: #9085e9; }
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
          <XAxis
            dataKey="data"
            tickFormatter={formatData}
            tick={{ fontSize: 11, fill: "#898781" }}
            axisLine={{ stroke: "#c3c2b7" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#898781" }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["dataMin - 20", "dataMax + 20"]}
          />
          <Tooltip content={<TooltipCustomizado />} />
          <Line
            className="peso-line"
            type="monotone"
            dataKey="pesoKg"
            strokeWidth={2}
            dot={{ r: 4, className: "peso-line" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
