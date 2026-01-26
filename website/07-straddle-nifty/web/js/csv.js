export function parseCSV(text) {
  const rows = [];
  let i = 0;
  let cur = "";
  let inQuotes = false;
  let row = [];

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";

      if (row.some(x => String(x).trim() !== "")) rows.push(row);

      row = [];
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some(x => String(x).trim() !== "")) rows.push(row);
  }

  return rows;
}
