import { num } from "./utils.js";

export function calcRowStats(row, dateCols, lotSize, lots) {
  const buyDay = row.buyDate;
  const buyPremium = num((row.dates[buyDay] || "").trim());

  const premiums = [];
  for (const d of dateCols) {
    if (d >= buyDay) {
      const p = num((row.dates[d] || "").trim());
      if (Number.isFinite(p)) premiums.push(p);
    }
  }

  const currentPremium = premiums.length ? premiums[premiums.length - 1] : NaN;
  const maxPremium = premiums.length ? Math.max(...premiums) : NaN;
  const minPremium = premiums.length ? Math.min(...premiums) : NaN;

  const investedAmount = (Number.isFinite(buyPremium) ? buyPremium : 0) * lotSize * lots;

  const pnl = (Number.isFinite(currentPremium) && Number.isFinite(buyPremium))
    ? (currentPremium - buyPremium) * lotSize * lots
    : NaN;

  const maxProfit = (Number.isFinite(maxPremium) && Number.isFinite(buyPremium))
    ? (maxPremium - buyPremium) * lotSize * lots
    : NaN;

  const maxLoss = (Number.isFinite(minPremium) && Number.isFinite(buyPremium))
    ? (minPremium - buyPremium) * lotSize * lots
    : NaN;

  const pctGain = (Number.isFinite(pnl) && investedAmount > 0)
    ? (pnl / investedAmount) * 100
    : NaN;

  return { buyDay, buyPremium, currentPremium, maxPremium, minPremium, pnl, maxProfit, maxLoss, pctGain };
}
