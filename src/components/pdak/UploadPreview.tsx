import type { DatasetConfig } from "@/lib/pdak/config";
export default function UploadPreview({
  rows,
  dataset,
}: {
  rows: Array<Record<string, string | number | null>>;
  dataset: DatasetConfig;
}) {
  const fields = dataset.fields.filter(
    (f) =>
      ["KODE", "WILAYAH"].includes(f.column) ||
      /PERSEN/.test(f.column) ||
      f === dataset.fields[3],
  );
  return (
    <details className="pdak-upload__preview" open>
      <summary>
        Preview 5 baris • Kota: 1 / Kecamatan: 30 / Kelurahan: 151
      </summary>
      <div className="pdak-upload__table-wrap">
        <table>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.column}>{f.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.KODE)}>
                {fields.map((f) => (
                  <td key={f.column}>{row[f.column] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
