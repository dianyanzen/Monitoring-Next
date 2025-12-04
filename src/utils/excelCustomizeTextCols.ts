// Helper to force columns to text format in DataTables excelHtml5 exports
export function excelCustomizeTextCols(xlsx: any, wantedHeaders: string[]) {
  try {
    const wsName = Object.keys(xlsx?.xl?.worksheets ?? {})[0];
    if (!wsName) return;

    const wsStr = xlsx.xl.worksheets[wsName];
    const stylesStr = xlsx.xl["styles.xml"];
    const sstStr = xlsx.xl["sharedStrings.xml"]; // bisa tidak ada

    if (typeof wsStr !== "string" || typeof stylesStr !== "string") return;

    const wdoc = new DOMParser().parseFromString(wsStr, "application/xml");
    const sdoc = new DOMParser().parseFromString(stylesStr, "application/xml");
    const sstdoc = sstStr ? new DOMParser().parseFromString(sstStr, "application/xml") : null;

    // buat/cari style TEXT (numFmtId 49)
    const cellXfs = sdoc.getElementsByTagName("cellXfs")[0];
    let textId = Array.from(cellXfs.getElementsByTagName("xf")).findIndex((xf: any) => xf.getAttribute("numFmtId") === "49");
    if (textId < 0) {
      const xf = sdoc.createElement("xf");
      xf.setAttribute("numFmtId", "49");
      xf.setAttribute("applyNumberFormat", "1");
      cellXfs.appendChild(xf);
      textId = cellXfs.childNodes.length - 1;
      xlsx.xl["styles.xml"] = new XMLSerializer().serializeToString(sdoc);
    }

    // petakan judul header -> huruf kolom (A,B,C,...)
    const headMap: Record<string, string> = {};
    const headRow = wdoc.querySelector('sheetData row[r="1"]');
    const getText = (c: Element) => {
      const t = c.getAttribute("t");
      if (t === "inlineStr") return c.querySelector("is t")?.textContent ?? "";
      if (t === "s" && sstdoc) {
        const idx = Number(c.querySelector("v")?.textContent ?? "");
        return sstdoc.querySelectorAll("si t")[idx]?.textContent ?? "";
      }
      return c.querySelector("v")?.textContent ?? "";
    };
    headRow?.querySelectorAll("c").forEach((c) => {
      const col = c.getAttribute("r")!.replace(/\d+$/, "");
      const title = (getText(c) || "").trim().toLowerCase();
      headMap[title] = col;
    });

    // paksa kolom target menjadi TEXT
    wantedHeaders
      .map((h) => headMap[h.toLowerCase()])
      .filter(Boolean)
      .forEach((col) => {
        wdoc.querySelectorAll(`row c[r^="${col}"]`).forEach((c) => {
          c.setAttribute("t", "str");
          c.setAttribute("s", String(textId));
        });
      });

    xlsx.xl.worksheets[wsName] = new XMLSerializer().serializeToString(wdoc);
  } catch (e) {
    console.warn("excel customize failed:", e);
  }
}

