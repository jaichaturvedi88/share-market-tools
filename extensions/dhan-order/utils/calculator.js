(function () {
  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return NaN;
    }

    return Number(String(value).replace(/,/g, "").trim());
  }

  function roundPrice(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  function roundToDecimals(value, decimals) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function calculateTrade(values) {
    const rr = toNumber(values.rr);
    const maxLoss = toNumber(values.maxLoss);
    const buyPrice = toNumber(values.buyPrice);
    const stopLoss = toNumber(values.stopLoss);
    const riskPerShare = buyPrice - stopLoss;
    const errors = [];

    if (!Number.isFinite(rr) || rr <= 0) {
      errors.push("RR must be greater than 0.");
    }

    if (!Number.isFinite(maxLoss) || maxLoss <= 0) {
      errors.push("Max loss must be greater than 0.");
    }

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      errors.push("Buy price must be greater than 0.");
    }

    if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
      errors.push("Stop loss must be greater than 0.");
    }

    if (Number.isFinite(buyPrice) && Number.isFinite(stopLoss) && stopLoss >= buyPrice) {
      errors.push("SL must be less than Buy Price.");
    }

    if (Number.isFinite(riskPerShare) && riskPerShare <= 0) {
      errors.push("Risk Per Share must be greater than 0.");
    }

    const quantity = riskPerShare > 0 && maxLoss > 0 ? Math.floor(maxLoss / riskPerShare) : 0;
    const targetPrice = roundPrice(buyPrice + riskPerShare * rr);
    const totalAmount = roundPrice(quantity * buyPrice);

    if (errors.length === 0 && quantity <= 0) {
      errors.push("Quantity must be greater than 0.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      rr,
      maxLoss,
      buyPrice,
      stopLoss,
      riskPerShare: roundPrice(riskPerShare),
      quantity,
      targetPrice,
      totalAmount
    };
  }

  window.DhanOrderCalculator = {
    calculateTrade,
    roundPrice,
    roundToDecimals,
    toNumber
  };
})();
