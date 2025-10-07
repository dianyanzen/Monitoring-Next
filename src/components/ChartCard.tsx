"use client";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, CategoryScale, LinearScale, PointElement, Tooltip } from "chart.js";

Chart.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip);

export default function ChartCard() {
  const data = {
    labels: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    datasets: [
      {
        label: "Perekaman KTP",
        data: [12, 19, 14, 22, 30, 25, 28],
        fill: true,
        borderColor: "#00b3ff",
        backgroundColor: "rgba(0,179,255,0.15)",
        tension: 0.4,
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#888" }, grid: { color: "#222" } },
      y: { ticks: { color: "#888" }, grid: { color: "#222" } },
    },
  };

  return (
    <div className="bg-[#121216]/80 backdrop-blur-md border border-gray-800 rounded-xl p-5">
      <h3 className="text-gray-400 mb-3">Grafik Perekaman Mingguan</h3>
      <Line data={data} options={options} height={120} />
    </div>
  );
}
