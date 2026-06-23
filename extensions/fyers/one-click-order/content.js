(function () {
  if (window.top !== window) {
    return;
  }

  const STORAGE_KEYS = {
    rr: "fyersOneClick.rr",
    maxLoss: "fyersOneClick.maxLoss",
    buyPrice: "fyersOneClick.buyPrice",
    stopLoss: "fyersOneClick.stopLoss",
    panelX: "fyersOneClick.panelX",
    panelY: "fyersOneClick.panelY",
    authToken: "fyersSL.authToken",
    apiBaseUrl: "fyersSL.apiBaseUrl"
  };

  const DEFAULTS = {
    rr: "2",
    maxLoss: "1000"
  };

  const state = {
    calculation: null,
    activeSymbol: "",
    hasSavedPanelPosition: false,
    authToken: null,
    apiBaseUrl: null,
    values: {
      rr: DEFAULTS.rr,
      maxLoss: DEFAULTS.maxLoss,
      buyPrice: "",
      stopLoss: ""
    }
  };

  // Listen for Captured tokens from bridge
  window.addEventListener("fyers-token-captured", (e) => {
    const { token, baseUrl } = e.detail;
    if (token && (state.authToken !== token || state.apiBaseUrl !== baseUrl)) {
      state.authToken = token;
      state.apiBaseUrl = baseUrl;
      chrome.storage.local.set({
        [STORAGE_KEYS.authToken]: token,
        [STORAGE_KEYS.apiBaseUrl]: baseUrl
      });
      console.log("[Fyers OCO Content] Token captured! Base URL:", baseUrl);
    }
  });

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function field(id, label, type, placeholder) {
    const wrapper = createElement("label", "foc-label");
    const text = createElement("span", "", label);
    const input = createElement("input", "foc-input");
    input.id = id;
    input.type = type;
    input.placeholder = placeholder || "";
    input.autocomplete = "off";
    input.inputMode = type === "number" ? "decimal" : "text";

    if (type === "number") {
      input.min = "0";
      input.step = "0.05";
    }

    wrapper.append(text, input);
    return { wrapper, input };
  }

  function output(label) {
    const wrapper = createElement("div", "foc-output");
    const labelElement = createElement("span", "", label);
    const valueElement = createElement("span", "", "-");
    wrapper.append(labelElement, valueElement);
    return { wrapper, valueElement };
  }

  function readOnlyField(label) {
    const wrapper = createElement("div", "foc-label");
    const text = createElement("span", "", label);
    const valueElement = createElement("div", "foc-readonly-field", "-");
    wrapper.append(text, valueElement);
    return { wrapper, valueElement };
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value) || value <= 0) {
      return "-";
    }

    return value.toLocaleString("en-IN", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    });
  }

  function displaySymbolName(symbol) {
    const trimmed = String(symbol || "").trim().toUpperCase();
    return trimmed.length > 20 ? trimmed.slice(0, 20) : trimmed;
  }

  function findNumberInObject(value, fieldNames) {
    if (!value || typeof value !== "object") {
      return NaN;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNumberInObject(item, fieldNames);
        if (Number.isFinite(found)) {
          return found;
        }
      }
      return NaN;
    }

    for (const fieldName of fieldNames) {
      const numberValue = Number(value[fieldName]);
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue;
      }
    }

    for (const child of Object.values(value)) {
      const found = findNumberInObject(child, fieldNames);
      if (Number.isFinite(found)) {
        return found;
      }
    }

    return NaN;
  }

  function getExecutionPrice(orderResponseBody, fallbackPrice) {
    const executionPrice = findNumberInObject(orderResponseBody, ["price_traded", "tradedPrice", "avgPrice", "price"]);
    return Number.isFinite(executionPrice) && executionPrice > 0 ? executionPrice : fallbackPrice;
  }

  function setStatus(message, type) {
    refs.status.textContent = message || "";
    refs.status.classList.toggle("is-error", type === "error");
    refs.status.classList.toggle("is-success", type === "success");
  }

  function resetOrderButtons() {
    refs.buy.disabled = false;
    refs.sell.disabled = false;
    refs.fetch.textContent = "Get LTP";
    refs.buy.textContent = "Buy";
    refs.sell.textContent = "Sell";
  }

  function resetOrderState() {
    resetOrderButtons();
  }

  function persistSettings() {
    chrome.storage.local.set({
      [STORAGE_KEYS.rr]: refs.rr.value,
      [STORAGE_KEYS.maxLoss]: refs.maxLoss.value
    });
  }

  function persistDraft() {
    chrome.storage.local.set({
      [STORAGE_KEYS.buyPrice]: refs.buyPrice.value,
      [STORAGE_KEYS.stopLoss]: refs.stopLoss.value
    });
  }

  function readValues() {
    state.values = {
      rr: refs.rr.value,
      maxLoss: refs.maxLoss.value,
      buyPrice: refs.buyPrice.value,
      stopLoss: refs.stopLoss.value
    };
    return state.values;
  }

  function recalculate() {
    const values = readValues();
    const calculation = window.FyersOCOCalculator.calculateTrade(values);
    state.calculation = calculation;

    refs.risk.textContent = formatNumber(calculation.riskPerShare, 2);
    refs.quantity.textContent = calculation.quantity > 0 ? String(calculation.quantity) : "-";
    refs.target.textContent = formatNumber(calculation.targetPrice, 1);
    refs.amount.textContent = formatNumber(calculation.totalAmount, 2);

    if (values.buyPrice || values.stopLoss) {
      setStatus(calculation.errors[0] || "", calculation.errors.length ? "error" : "");
    } else if (!Number.isFinite(calculation.rr) || calculation.rr <= 0 || !Number.isFinite(calculation.maxLoss) || calculation.maxLoss <= 0) {
      setStatus(calculation.errors[0] || "", "error");
    } else {
      setStatus("", "");
    }

    return calculation;
  }

  async function loadSettings() {
    const saved = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    state.authToken = saved[STORAGE_KEYS.authToken] || null;
    state.apiBaseUrl = saved[STORAGE_KEYS.apiBaseUrl] || null;
    refs.rr.value = saved[STORAGE_KEYS.rr] || DEFAULTS.rr;
    refs.maxLoss.value = saved[STORAGE_KEYS.maxLoss] || DEFAULTS.maxLoss;
    refs.buyPrice.value = saved[STORAGE_KEYS.buyPrice] || "";
    refs.stopLoss.value = saved[STORAGE_KEYS.stopLoss] || "";
    recalculate();
  }

  function clearTradeFields() {
    state.activeSymbol = "";
    refs.activeSymbol.textContent = "-";
    refs.buyPrice.value = "";
    refs.stopLoss.value = "";
    refs.risk.textContent = "-";
    refs.quantity.textContent = "-";
    refs.target.textContent = "-";
    refs.amount.textContent = "-";
    setStatus("", "");
    state.calculation = null;
    resetOrderState();
    chrome.storage.local.remove([STORAGE_KEYS.buyPrice, STORAGE_KEYS.stopLoss]);
  }

  function clearRiskData() {
    refs.stopLoss.value = "";
    refs.risk.textContent = "-";
    refs.quantity.textContent = "-";
    refs.target.textContent = "-";
    refs.amount.textContent = "-";
    state.calculation = null;
    resetOrderState();
    chrome.storage.local.remove([STORAGE_KEYS.stopLoss]);
  }

  function openPanel() {
    if (!state.hasSavedPanelPosition) {
      anchorPanelAboveButton();
    }

    refs.panel.classList.add("is-open");
    window.setTimeout(keepPanelInViewport, 0);
    window.setTimeout(() => refs.stopLoss.focus(), 80);
  }

  function closePanel() {
    refs.panel.classList.remove("is-open");
  }

  function togglePanel() {
    if (refs.panel.classList.contains("is-open")) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function keepPanelInViewport() {
    if (!refs.panel.classList.contains("is-open")) {
      return;
    }

    const rect = refs.panel.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    const nextLeft = clamp(rect.left, 8, maxLeft);
    const nextTop = clamp(rect.top, 8, maxTop);

    refs.panel.style.left = `${nextLeft}px`;
    refs.panel.style.top = `${nextTop}px`;
    refs.panel.style.right = "auto";
    refs.panel.style.bottom = "auto";
  }

  function anchorPanelAboveButton() {
    refs.panel.style.left = "auto";
    refs.panel.style.right = "16px";
    refs.panel.style.top = "auto";
    refs.panel.style.bottom = "138px";
  }

  async function loadPanelPosition() {
    const saved = await chrome.storage.local.get([STORAGE_KEYS.panelX, STORAGE_KEYS.panelY]);
    const left = Number(saved[STORAGE_KEYS.panelX]);
    const top = Number(saved[STORAGE_KEYS.panelY]);

    if (Number.isFinite(left) && Number.isFinite(top)) {
      state.hasSavedPanelPosition = true;
      refs.panel.style.left = `${left}px`;
      refs.panel.style.top = `${top}px`;
      refs.panel.style.right = "auto";
      refs.panel.style.bottom = "auto";
    } else {
      anchorPanelAboveButton();
    }

    window.setTimeout(keepPanelInViewport, 0);
  }

  function savePanelPosition() {
    const rect = refs.panel.getBoundingClientRect();
    chrome.storage.local.set({
      [STORAGE_KEYS.panelX]: Math.round(rect.left),
      [STORAGE_KEYS.panelY]: Math.round(rect.top)
    });
  }

  function enableDrag() {
    let dragState = null;

    refs.header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) {
        return;
      }

      const rect = refs.panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };

      refs.header.setPointerCapture(event.pointerId);
      refs.panel.classList.add("is-dragging");
      event.preventDefault();
    });

    refs.header.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const rect = refs.panel.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      const nextLeft = clamp(event.clientX - dragState.offsetX, 8, maxLeft);
      const nextTop = clamp(event.clientY - dragState.offsetY, 8, maxTop);

      refs.panel.style.left = `${nextLeft}px`;
      refs.panel.style.top = `${nextTop}px`;
      refs.panel.style.right = "auto";
      refs.panel.style.bottom = "auto";
    });

    refs.header.addEventListener("pointerup", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      refs.header.releasePointerCapture(event.pointerId);
      refs.panel.classList.remove("is-dragging");
      dragState = null;
      state.hasSavedPanelPosition = true;
      savePanelPosition();
    });

    refs.header.addEventListener("pointercancel", () => {
      refs.panel.classList.remove("is-dragging");
      dragState = null;
    });

    window.addEventListener("resize", keepPanelInViewport);
  }

  function fetchLtp() {
    const result = window.FyersOCODomHandler.getActiveWatchlistScrip();

    if (!result.ok) {
      setStatus(result.error, "error");
      return;
    }

    state.activeSymbol = result.symbol;
    refs.activeSymbol.textContent = displaySymbolName(result.symbol);
    refs.activeSymbol.title = result.symbol;
    refs.buyPrice.value = window.FyersOCOCalculator.roundPrice(result.ltp).toFixed(2);
    clearRiskData();
    persistDraft();
    setStatus(`Fetched ${result.symbol} LTP ${refs.buyPrice.value}.`, "success");
  }

  function buildPanel() {
    if (document.getElementById("foc-root")) {
      return null;
    }

    const root = createElement("div");
    root.id = "foc-root";

    const button = createElement("button", "foc-fab");
    const buttonIcon = createElement("span", "foc-fab-icon");
    const buttonText = createElement("span", "foc-fab-text", "OCO");
    button.append(buttonIcon, buttonText);
    button.type = "button";
    button.title = "open One Click Order panel";

    const panel = createElement("aside", "foc-panel");
    panel.setAttribute("aria-label", "Fyers fast trade panel");

    const header = createElement("div", "foc-header");
    const title = createElement("h2", "foc-title", "Fast Trade");
    const close = createElement("button", "foc-close", "\u00D7");
    close.type = "button";
    close.title = "Close";
    header.append(title, close);

    const topGrid = createElement("div", "foc-grid");
    const rr = field("foc-rr", "Risk Reward", "number", "2");
    const maxLoss = field("foc-max-loss", "Max Loss", "number", "1000");
    topGrid.classList.add("foc-top-grid");
    topGrid.append(rr.wrapper, maxLoss.wrapper);

    const activeSection = createElement("div", "foc-section");
    const activeOutput = output("Active Symbol");
    activeOutput.wrapper.classList.add("foc-active-symbol");
    activeSection.append(activeOutput.wrapper);

    const tradeSection = createElement("div", "foc-section foc-trade-grid");
    const buyPrice = field("foc-buy-price", "Buy Price", "number", "0.00");
    const stopLoss = field("foc-stop-loss", "Stop Price", "number", "0.00");
    const risk = readOnlyField("Risk / Share");
    tradeSection.append(buyPrice.wrapper, stopLoss.wrapper, risk.wrapper);

    const outputSection = createElement("div", "foc-section foc-metric-grid");
    const quantity = readOnlyField("Qty");
    const target = readOnlyField("Target");
    const amount = readOnlyField("Amount");
    outputSection.append(quantity.wrapper, target.wrapper, amount.wrapper);

    const actions = createElement("div", "foc-actions");
    const fetch = createElement("button", "foc-btn foc-secondary", "Get LTP");
    const buy = createElement("button", "foc-btn foc-primary foc-poc-buy", "Buy");
    const sell = createElement("button", "foc-btn foc-primary foc-poc-sell", "Sell");

    fetch.type = "button";
    buy.type = "button";
    sell.type = "button";

    actions.append(fetch, buy, sell);

    const status = createElement("div", "foc-status");
    panel.append(header, topGrid, activeSection, tradeSection, outputSection, actions, status);
    root.append(button, panel);
    document.documentElement.appendChild(root);

    return {
      button,
      panel,
      header,
      close,
      rr: rr.input,
      maxLoss: maxLoss.input,
      activeSymbol: activeOutput.valueElement,
      buyPrice: buyPrice.input,
      stopLoss: stopLoss.input,
      risk: risk.valueElement,
      quantity: quantity.valueElement,
      target: target.valueElement,
      amount: amount.valueElement,
      actions,
      fetch,
      buy,
      sell,
      status
    };
  }

  const refs = buildPanel();

  if (!refs) {
    return;
  }

  refs.button.addEventListener("click", togglePanel);
  refs.close.addEventListener("click", closePanel);
  refs.fetch.addEventListener("click", fetchLtp);
  refs.buy.addEventListener("click", () => triggerPocTrade(1));
  refs.sell.addEventListener("click", () => triggerPocTrade(-1));

  enableDrag();

  [refs.rr, refs.maxLoss].forEach((input) => {
    input.addEventListener("input", () => {
      persistSettings();
      resetOrderState();
      recalculate();
    });
  });

  [refs.buyPrice, refs.stopLoss].forEach((input) => {
    input.addEventListener("input", () => {
      persistDraft();
      resetOrderState();
      recalculate();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      togglePanel();
    }

    if (event.key === "Escape" && refs.panel.classList.contains("is-open")) {
      closePanel();
    }
  });

  async function triggerPocTrade(side) {
    const calculation = recalculate();
    if (!calculation.isValid) {
      setStatus(calculation.errors[0], "error");
      return;
    }

    if (!state.activeSymbol) {
      setStatus("No active symbol. Please click Get LTP first.", "error");
      return;
    }

    if (!state.authToken) {
      setStatus("Authorization token not captured yet. Please interact with the page.", "error");
      return;
    }

    const qty = calculation.quantity;
    const buyPrice = calculation.buyPrice;
    const stopLoss = calculation.stopLoss;
    const actionWord = side === 1 ? "BUY" : "SELL";

    if (side === 1 && stopLoss >= buyPrice) {
      setStatus(`For BUY, Stop Price must be below Entry Price. Entry: ${buyPrice}, Stop: ${stopLoss}.`, "error");
      return;
    }

    if (side === -1 && stopLoss <= buyPrice) {
      setStatus(`For SELL, Stop Price must be above Entry Price. Entry: ${buyPrice}, Stop: ${stopLoss}.`, "error");
      return;
    }

    // 1. Place the primary buy/sell order
    // Exact payload format captured from Fyers web app curl:
    // noConfirm, LTP, filledQty are REQUIRED by the Fyers internal API
    const orderPayload = {
      noConfirm: true,
      productType: "INTRADAY",
      side: side,         // 1 = Buy, -1 = Sell
      symbol: state.activeSymbol,
      qty: qty,
      disclosedQty: 0,
      type: 2,            // 2 = Market order
      LTP: buyPrice,      // Required: current LTP
      validity: "DAY",
      filledQty: 0,       // Required by Fyers internal API
      limitPrice: 0,
      stopPrice: 0,
      offlineOrder: false
    };
    console.log("[Fyers OCO] Placing order payload:", JSON.stringify(orderPayload));

    console.group(`[Fyers OCO] ${actionWord} Order Request`);
    console.log("Symbol:", state.activeSymbol);
    console.log("Payload:", JSON.parse(JSON.stringify(orderPayload)));
    console.log("Token (first 20 chars):", state.authToken?.slice(0, 20));
    console.log("API Base URL:", state.apiBaseUrl);
    console.groupEnd();
    setStatus(`Placing ${actionWord} order for ${qty} shares of ${state.activeSymbol}...`);
    refs.buy.disabled = true;
    refs.sell.disabled = true;

    chrome.runtime.sendMessage({
      action: "placeOrder",
      token: state.authToken,
      baseUrl: state.apiBaseUrl,
      payload: orderPayload
    }, async (response) => {
      console.group(`[Fyers OCO] ${actionWord} Order Response`);
      console.log("Success:", response?.success);
      console.log("URL tried:", response?.urlTried);
      console.log("Raw response:", response?.rawResponse);
      console.log("All endpoint attempts:", response?.attempts);
      console.log("Error:", response?.error);
      console.groupEnd();

      if (chrome.runtime.lastError || !response || !response.success) {
        const errMsg = response?.error || chrome.runtime.lastError?.message || "Unknown error";
        setStatus(`Failed to place ${actionWord} order: ${errMsg}`, "error");
        refs.buy.disabled = false;
        refs.sell.disabled = false;
        return;
      }

      setStatus(`Placed ${actionWord} order successfully. Waiting 2 seconds before placing Stop Loss...`, "success");

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const executionPrice = getExecutionPrice(response.body, buyPrice);
      const stopLossDistance = window.FyersOCOCalculator.roundPrice(Math.abs(executionPrice - stopLoss));

      if (!Number.isFinite(stopLossDistance) || stopLossDistance <= 0) {
        setStatus(`Could not calculate SL distance. Entry: ${executionPrice}, Stop: ${stopLoss}.`, "error");
        refs.buy.disabled = false;
        refs.sell.disabled = false;
        return;
      }

      // 2. Place the Stop Loss (BO order)
      const slPayload = {
        legType: 1,
        placeFlag: false,
        type: 2,
        orderTag: "OWTPSL",
        positionId: `${state.activeSymbol}-INTRADAY`,
        stopLoss: stopLossDistance,
        qty: qty,
        symbol: state.activeSymbol
      };

      console.log("[Fyers OCO] Intended SL price:", stopLoss, "Execution/entry price:", executionPrice, "SL distance sent:", stopLossDistance);
      setStatus(`Placing Stop Loss at ${stopLoss.toFixed(2)} for ${state.activeSymbol}...`);

      chrome.runtime.sendMessage({
        action: "placeSL",
        token: state.authToken,
        baseUrl: state.apiBaseUrl,
        payload: slPayload
      }, (slResponse) => {
        refs.buy.disabled = false;
        refs.sell.disabled = false;

        if (chrome.runtime.lastError || !slResponse || !slResponse.success) {
          const errMsg = slResponse?.error || chrome.runtime.lastError?.message || "Unknown error";
          setStatus(`Placed ${actionWord} order, but SL placement failed: ${errMsg}`, "error");
          return;
        }

        setStatus(`Trade fully executed! ${actionWord} order + Stop Loss placed.`, "success");
      });
    });
  }

  loadSettings();
  loadPanelPosition();
})();
