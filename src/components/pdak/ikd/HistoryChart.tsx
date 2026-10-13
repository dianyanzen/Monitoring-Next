type Point = { date: string; value: number | null };
export default function HistoryChart({
  points,
  ranking = false,
  title,
}: {
  points: Point[];
  ranking?: boolean;
  title: string;
}) {
  const valid = points.filter(
    (p) => p.value !== null && Number.isFinite(p.value),
  );
  if (!valid.length)
    return (
      <p className="pdak-upload__empty">
        Belum ada data grafik yang dapat dibandingkan.
      </p>
    );
  const values = valid.map((p) => p.value!),
    max = ranking ? Math.max(2, ...values) : Math.max(1, ...values) * 1.1,
    min = ranking ? 1 : Math.min(0, ...values);
  const first = Date.parse(points[0].date + "T00:00:00Z"),
    last = Date.parse(points.at(-1)!.date + "T00:00:00Z");
  const x = (date: string) =>
    40 +
    (last === first
      ? 0.5
      : (Date.parse(date + "T00:00:00Z") - first) / (last - first)) *
      320;
  const y = (value: number) =>
    24 +
    (ranking ? (value - min) / (max - min) : (max - value) / (max - min)) * 130;
  let path = "";
  let previousValid = false;
  for (const p of points) {
    if (p.value === null) {
      previousValid = false;
      continue;
    }
    path += `${previousValid ? " L" : " M"}${x(p.date)},${y(p.value)}`;
    previousValid = true;
  }
  return (
    <figure className="ikd-chart">
      <figcaption>{title}</figcaption>
      <svg
        viewBox="0 0 400 200"
        role="img"
        aria-label={
          ranking
            ? "Riwayat peringkat, nomor satu berada di atas."
            : "Riwayat capaian IKD."
        }
      >
        <title>{title}</title>
        {[min, (max + min) / 2, max].map((t) => (
          <g key={t}>
            <line
              x1={40}
              x2={365}
              y1={y(t)}
              y2={y(t)}
              className="ikd-chart__grid"
            />
            <text x={33} y={y(t) + 4} textAnchor="end">
              {ranking ? "#" : ""}
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path d={path} className="ikd-chart__line" />
        {valid.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value!)} r={3}>
            <title>
              {p.date}: {ranking ? "#" : ""}
              {p.value}
            </title>
          </circle>
        ))}
        <text x={40} y={182}>
          {points[0].date}
        </text>
        <text x={360} y={182} textAnchor="end">
          {points.at(-1)!.date}
        </text>
      </svg>
    </figure>
  );
}
