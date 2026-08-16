/** RFC 4180-ish CSV. Quotes any field containing a comma, quote or newline. */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/**
 * Hand the browser a CSV file. Uses an object URL rather than a data: URI so
 * large schedules (360+ rows) do not hit URL length limits.
 */
export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 correctly instead of mangling it.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
