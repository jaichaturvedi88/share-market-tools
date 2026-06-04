(function () {
  /**
   * Safe conversion of string/number values to standard float.
   */
  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return NaN;
    }
    // Remove commas, plus signs, spaces, etc.
    return Number(String(value).replace(/,/g, "").replace(/\+/g, "").replace(/\u2212/g, "-").trim());
  }

  /**
   * Rounds a price to the nearest tick size (default 0.05 for Indian markets).
   */
  function roundToTick(price, tick = 0.05) {
    if (!Number.isFinite(price)) {
      return 0;
    }
    const rounded = Math.round(price / tick) * tick;
    // Fix floating point issues like 24.399999999999995 by rounding to 4 decimals
    return Math.round(rounded * 10000) / 10000;
  }

  /**
   * Calculates the target stop loss price to secure a specific profit in Rupees.
   * For Long (Buy):  SL = AvgPrice + (TargetProfit / Qty)
   * For Short (Sell): SL = AvgPrice - (TargetProfit / Qty)
   */
  function calculateTargetSL(position, targetProfit) {
    const qty = Math.abs(toNumber(position.netQty));
    const avgPrice = toNumber(position.avgPrice);
    const side = String(position.side || "").trim().toLowerCase();

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avgPrice) || avgPrice <= 0) {
      return null;
    }

    if (!Number.isFinite(targetProfit) || targetProfit <= 0) {
      return null;
    }

    let rawSL = 0;
    if (side === "buy" || side === "1") {
      rawSL = avgPrice + (targetProfit / qty);
    } else if (side === "sell" || side === "-1") {
      rawSL = avgPrice - (targetProfit / qty);
    } else {
      return null;
    }

    return roundToTick(rawSL);
  }

  /**
   * Calculates the chunk-based target stop loss price to secure profit in chunks:
   * e.g., if targetProfit = 200:
   * - profit > 400 (2 * targetProfit) => Lock in 200 (1 * targetProfit)
   * - profit > 600 (3 * targetProfit) => Lock in 400 (2 * targetProfit)
   * - general: profit > (N+1)*targetProfit => Lock in N*targetProfit
   */
  function calculateChunkSL(position, targetProfit, currentProfit) {
    const qty = Math.abs(toNumber(position.netQty));
    const avgPrice = toNumber(position.avgPrice);
    const side = String(position.side || "").trim().toLowerCase();

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avgPrice) || avgPrice <= 0) {
      return null;
    }

    if (!Number.isFinite(targetProfit) || targetProfit <= 0) {
      return null;
    }

    const profit = Number(currentProfit);
    if (!Number.isFinite(profit) || profit <= 0) {
      return null;
    }

    const ratio = Math.floor(profit / targetProfit);
    if (ratio < 2) {
      return null; // No profit locked in yet
    }

    const N = ratio - 1;
    const capturedProfit = N * targetProfit;

    let rawSL = 0;
    if (side === "buy" || side === "1") {
      rawSL = avgPrice + (capturedProfit / qty);
    } else if (side === "sell" || side === "-1") {
      rawSL = avgPrice - (capturedProfit / qty);
    } else {
      return null;
    }

    return roundToTick(rawSL);
  }

  // Bind to window for integration
  window.FyersSLCalculator = {
    toNumber,
    roundToTick,
    calculateTargetSL,
    calculateChunkSL
  };
})();
