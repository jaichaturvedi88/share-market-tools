export function num(val) {
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function fmt(x) {
  if (!Number.isFinite(x)) return "";
  return Math.round(x).toLocaleString();
}

export function dayOnly(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  return parts.length === 3 ? parts[2] : String(dateStr);
}

export function getLots(lotsInputValue) {
  return Math.max(0, Math.floor(num(lotsInputValue) || 0));
}

export function getLotSize(lotSizeInputValue) {
  return Math.max(0, Math.floor(num(lotSizeInputValue) || 0));
}

export function formatMonthFromFileName(name) {
  const m = String(name).match(/straddle_matrix_(\d{4})_(\d{2})\.csv/i);
  if (!m) return name;

  const year = m[1];
  const monthNum = parseInt(m[2], 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[monthNum - 1] || m[2];
  return "Straddle for " + year + " " + mon;
}
