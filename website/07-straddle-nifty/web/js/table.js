import { FIXED_COUNT } from "./config.js";
import { fmt, dayOnly, getLots, getLotSize, formatMonthFromFileName, num } from "./utils.js";
import { calcRowStats } from "./calc.js";
import { applySearchHighlight } from "./search.js";

export function buildTable(state, els) {
  if (!state.header.length) return;

  const lots = getLots(els.lots.value);
  const lotSize = getLotSize(els.lotSize.value);

  state.dateCols = state.header.slice(FIXED_COUNT);

  els.monthLabel.textContent = state.loadedFileName
    ? formatMonthFromFileName(state.loadedFileName)
    : "";

  const thead = document.createElement("thead");
  const htr = document.createElement("tr");

  // Strike
  const thStrike = document.createElement("th");
  thStrike.textContent = "Strike";
  thStrike.classList.add("strikecol");
  htr.appendChild(thStrike);

  // Buy
  const thBuy = document.createElement("th");
  thBuy.textContent = "Buy";
  thBuy.classList.add("buycol");
  htr.appendChild(thBuy);

  // Dates
  for (const d of state.dateCols) {
    const th = document.createElement("th");
    th.textContent = dayOnly(d);
    htr.appendChild(th);
  }

  // Summary
  const summaryCols = ["Max Loss", "Max Profit", "Cur PnL", "% Gain"];
  for (const label of summaryCols) {
    const th = document.createElement("th");
    th.textContent = label;
    th.classList.add("sumcol");
    htr.appendChild(th);
  }

  thead.appendChild(htr);

  const tbody = document.createElement("tbody");

  for (const r of state.dataRows) {
    const stats = calcRowStats(r, state.dateCols, lotSize, lots);
    const tr = document.createElement("tr");

    const tdStrike = document.createElement("td");
    tdStrike.textContent = r.strike || "";
    tdStrike.classList.add("strikecol");
    tr.appendChild(tdStrike);

    const tdBuy = document.createElement("td");
    tdBuy.textContent = dayOnly(r.buyDate);
    tdBuy.classList.add("buycol");
    tr.appendChild(tdBuy);

    for (const d of state.dateCols) {
      const prem = num((r.dates[d] || "").trim());
      const td = document.createElement("td");

      if (Number.isFinite(prem) && lotSize > 0 && lots > 0) td.textContent = fmt(prem * lotSize * lots);
      else td.textContent = "";

      if (d === stats.buyDay) td.classList.add("buyday");

      if (Number.isFinite(stats.buyPremium) && d > stats.buyDay && Number.isFinite(prem)) {
        if (prem > stats.buyPremium) td.classList.add("profit");
        else if (prem < stats.buyPremium) td.classList.add("loss");
      }

      // ✅ Hover tooltip: show Day P/L and Day % vs Buy Premium
      const dayPnl = (Number.isFinite(stats.buyPremium) && Number.isFinite(prem))
        ? (prem - stats.buyPremium) * lotSize * lots
        : NaN;

      const dayPct = (Number.isFinite(stats.buyPremium) && stats.buyPremium > 0 && Number.isFinite(prem))
        ? ((prem - stats.buyPremium) / stats.buyPremium) * 100
        : NaN;

      // ✅ Native hover tooltip on cell
      if (Number.isFinite(dayPnl) && Number.isFinite(dayPct)) {
        const signPnl = dayPnl >= 0 ? "+" : "";
        const signPct = dayPct >= 0 ? "+" : "";
        td.title = `Day P/L: ${signPnl}${Math.round(dayPnl).toLocaleString()}\nDay %: ${signPct}${dayPct.toFixed(2)}%`;
      } else {
        td.title = "";
      }


      tr.appendChild(td);
    }

    const tdMaxLoss = document.createElement("td");
    tdMaxLoss.textContent = fmt(stats.maxLoss);
    tdMaxLoss.classList.add("sumcol");
    if (Number.isFinite(stats.maxLoss) && stats.maxLoss < 0) tdMaxLoss.classList.add("loss");
    tr.appendChild(tdMaxLoss);

    const tdMaxProfit = document.createElement("td");
    tdMaxProfit.textContent = fmt(stats.maxProfit);
    tdMaxProfit.classList.add("sumcol");
    if (Number.isFinite(stats.maxProfit) && stats.maxProfit > 0) tdMaxProfit.classList.add("profit");
    tr.appendChild(tdMaxProfit);

    const tdPnL = document.createElement("td");
    tdPnL.textContent = fmt(stats.pnl);
    tdPnL.classList.add("sumcol");
    if (Number.isFinite(stats.pnl)) {
      if (stats.pnl > 0) tdPnL.classList.add("profit");
      else if (stats.pnl < 0) tdPnL.classList.add("loss");
    }
    tr.appendChild(tdPnL);

    const tdGain = document.createElement("td");
    tdGain.classList.add("sumcol");
    tdGain.textContent = Number.isFinite(stats.pctGain) ? Math.round(stats.pctGain) + "%" : "";
    if (Number.isFinite(stats.pctGain)) {
      if (stats.pctGain > 0) tdGain.classList.add("profit");
      else if (stats.pctGain < 0) tdGain.classList.add("loss");
    }
    tr.appendChild(tdGain);

    tbody.appendChild(tr);
  }

  els.tbl.innerHTML = "";
  els.tbl.appendChild(thead);
  els.tbl.appendChild(tbody);

  els.status.textContent = `Loaded ${state.dataRows.length} rows | Lots=${lots} | LotSize=${lotSize}`;
  els.tableWrap.style.display = "";

  applySearchHighlight(els.tbl, state.searchQuery);
}
