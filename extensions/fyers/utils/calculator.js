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
   * 
   * @param {Object} position 
   * @param {number} targetProfit - Profit in Rupees to secure (e.g. 200)
   * @returns {number|null} Calculated Stop Loss price, rounded to 0.05 tick
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
    if (side === "buy") {
      rawSL = avgPrice + (targetProfit / qty);
    } else if (side === "sell") {
      rawSL = avgPrice - (targetProfit / qty);
    } else {
      return null;
    }

    return roundToTick(rawSL);
  }

  // Bind to window for integration
  window.FyersSLCalculator = {
    toNumber,
    roundToTick,
    calculateTargetSL
  };
})();
