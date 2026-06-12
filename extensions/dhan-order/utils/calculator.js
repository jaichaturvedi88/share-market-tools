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
    const errors = [];

    if (!Number.isFinite(rr) || rr <= 0) {
      errors.push("RR must be greater than 0.");
    }

    if (!Number.isFinite(maxLoss) || maxLoss <= 0) {
      errors.push("Max loss must be greater than 0.");
    }

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      errors.push("Entry price must be greater than 0.");
    }

    if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
      errors.push("Stop loss must be greater than 0.");
    }

    let riskPerShare = 0;
    let targetPrice = 0;
    let isShort = false;

    if (Number.isFinite(buyPrice) && Number.isFinite(stopLoss)) {
      if (stopLoss > buyPrice) {
        isShort = true;
        riskPerShare = stopLoss - buyPrice;
        targetPrice = buyPrice - riskPerShare * rr;
      } else if (buyPrice > stopLoss) {
        riskPerShare = buyPrice - stopLoss;
        targetPrice = buyPrice + riskPerShare * rr;
      } else {
        errors.push("SL and Entry price cannot be equal.");
      }
    }

    if (errors.length === 0 && riskPerShare <= 0) {
      errors.push("Risk Per Share must be greater than 0.");
    }

    const quantity = riskPerShare > 0 && maxLoss > 0 ? Math.floor(maxLoss / riskPerShare) : 0;
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
      targetPrice: roundToDecimals(targetPrice, 1),
      totalAmount,
      isShort
    };
  }

  window.DhanOrderCalculator = {
    calculateTrade,
    roundPrice,
    roundToDecimals,
    toNumber
  };
})();
