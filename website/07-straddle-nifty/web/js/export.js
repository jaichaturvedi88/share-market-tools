import { FIXED_COUNT } from "./config.js";
import { dayOnly, getLots, getLotSize, num } from "./utils.js";
import { calcRowStats } from "./calc.js";

function downloadCSV(filename, rows) {
  const csvText = rows
    .map(r => r.map(v => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(","))
    .join("\n");

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export function exportTableToCSV(state, els) {
  if (!state.header.length || !state.dataRows.length) {
    alert("No table data loaded.");
    return;
  }

  const lots = getLots(els.lots.value);
  const lotSize = getLotSize(els.lotSize.value);

  const dateCols = state.header.slice(FIXED_COUNT);

  const out = [];
  out.push([
    "Strike",
    "Buy",
    ...dateCols.map(d => dayOnly(d)),
    "Max Loss",
    "Max Profit",
    "Current PnL",
    "% Gain"
  ]);

  for (const r of state.dataRows) {
    const stats = calcRowStats(r, dateCols, lotSize, lots);

    const dateValues = dateCols.map(d => {
      const prem = num((r.dates[d] || "").trim());
      if (Number.isFinite(prem) && lotSize > 0 && lots > 0) {
        return String(Math.round(prem * lotSize * lots));
      }
      return "";
    });

    out.push([
      r.strike || "",
      dayOnly(r.buyDate),
      ...dateValues,
      Number.isFinite(stats.maxLoss) ? String(Math.round(stats.maxLoss)) : "",
      Number.isFinite(stats.maxProfit) ? String(Math.round(stats.maxProfit)) : "",
      Number.isFinite(stats.pnl) ? String(Math.round(stats.pnl)) : "",
      Number.isFinite(stats.pctGain) ? String(Math.round(stats.pctGain)) + "%" : ""
    ]);
  }

  const baseName = state.loadedFileName ? state.loadedFileName.replace(".csv", "") : "straddle_export";
  const finalName = `${baseName}_lots${lots}_size${lotSize}.csv`;

  downloadCSV(finalName, out);
}
