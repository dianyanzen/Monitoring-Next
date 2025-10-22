// FILE: src/components/charts/LineChart.tsx
"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from "chart.js";
import { useChartTheme } from "./useChartTheme";
import { useMemo } from "react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export type LineChartProps = {
  data: { labels: string[]; datasets: any[] };
  title?: string;
  height?: number;
};

export default function LineChart({ data, title, height = 220 }: LineChartProps) {
  const t = useChartTheme();

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: t.ticks } },
      title: title ? { display: true, text: title, color: t.ticks, font: { weight: "600" } } : { display: false },
      tooltip: {
        backgroundColor: t.tooltipBg,
        titleColor: t.tooltipFg,
        bodyColor: t.tooltipFg,
        borderColor: t.border,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: t.grid },
        ticks: { color: t.ticks },
      },
      y: {
        grid: { color: t.grid },
        ticks: { color: t.ticks },
      },
    },
  }), [t, title]);

  return (
    <div className="chart-card" style={{ height }}>
      <Line options={options as any} data={data} />
    </div>
  );
}