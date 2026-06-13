(function () {
  if (window.top !== window) {
    return;
  }

  const STORAGE_KEYS = {
    rr: "tvFastTrade.rr",
    maxLoss: "tvFastTrade.maxLoss",
    stopLoss: "tvFastTrade.stopLoss",
    panelX: "tvFastTrade.panelX",
    panelY: "tvFastTrade.panelY",
    tgtCheck: "tvFastTrade.tgtCheck"
  };

  const DEFAULTS = {
    rr: "2",
    maxLoss: "1000"
  };

  const state = {
    calculation: null,
    activeBuyPrice: null,
    hasSavedPanelPosition: false,
    values: {
      rr: DEFAULTS.rr,
      maxLoss: DEFAULTS.maxLoss,
      stopLoss: ""
    }
  };

  async function logConsole(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const prefix = `[${time}] `;
    
    const newLog = {
      timestamp: Date.now(),
      message: message,
      type: type
    };
    
    try {
      const data = await chrome.storage.local.get("tv_trade_logs");
      const logs = data.tv_trade_logs || [];
      logs.push(newLog);
      
      // Limit logs count to prevent storage bloat
      if (logs.length > 500) {
        logs.shift();
      }
      
      await chrome.storage.local.set({ tv_trade_logs: logs });
    } catch (err) {
      console.error("Failed to save log:", err);
    }
    
    console.log(`[TV Fast Trade] ${prefix}${message}`);
  }

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
    const wrapper = createElement("label", "tvft-label");
    const text = createElement("span", "", label);
    const input = createElement("input", "tvft-input");
    input.id = id;
    input.type = type;
    input.placeholder = placeholder || "";
    input.autocomplete = "off";
    input.inputMode = type === "number" ? "decimal" : "text";

    if (type === "number") {
      input.min = "0";
      input.step = "0.01";
    }

    wrapper.append(text, input);
    return { wrapper, input };
  }

  function checkboxField(id, label) {
    const wrapper = createElement("label", "tvft-label tvft-check-field");
    const input = createElement("input", "tvft-check");
    const inputWrap = createElement("div", "tvft-check-box");
    const text = createElement("span", "", label);
    input.id = id;
    input.type = "checkbox";
    inputWrap.append(input);
    wrapper.append(inputWrap, text);
    return { wrapper, input };
  }

  function readOnlyField(label) {
    const wrapper = createElement("label", "tvft-label");
    const text = createElement("span", "", label);
    const valueElement = createElement("div", "tvft-readonly-field", "-");
    wrapper.append(text, valueElement);
    return { wrapper, valueElement };
  }

  function splitResultItem(label) {
    const wrapper = createElement("label", "tvft-split-result-item");
    const input = createElement("input", "tvft-split-result-check");
    const text = createElement("span", "tvft-split-result-value", label);
    input.type = "checkbox";
    input.disabled = true;
    wrapper.append(input, text);
    return { wrapper, input, text };
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value) || value <= 0) {
      return "-";
    }
    return value.toLocaleString("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    });
  }

  function setStatus(message, type) {
    refs.status.textContent = message || "";
    refs.status.classList.toggle("is-error", type === "error");
    refs.status.classList.toggle("is-success", type === "success");
    if (message) {
      logConsole(message, type);
    }
  }

  function resetOrderButtons() {
    refs.buyBtn.disabled = false;
    refs.sellBtn.disabled = false;
    refs.fetch.textContent = "Get LTP";
    refs.buyBtn.textContent = "Buy";
    refs.sellBtn.textContent = "Sell";
  }

  function resetOrderState() {
    resetOrderButtons();
  }

  function persistSettings() {
    chrome.storage.local.set({
      [STORAGE_KEYS.rr]: refs.rr.value,
      [STORAGE_KEYS.maxLoss]: refs.maxLoss.value,
      [STORAGE_KEYS.tgtCheck]: refs.tgtCheck.checked
    });
  }

  function persistDraft() {
    chrome.storage.local.set({
      [STORAGE_KEYS.stopLoss]: refs.stopLoss.value
    });
  }

  function readValues() {
    state.values = {
      rr: refs.rr.value,
      maxLoss: refs.maxLoss.value,
      buyPrice: refs.buyPrice.value || "",
      stopLoss: refs.stopLoss.value
    };
    return state.values;
  }

  function recalculate() {
    const values = readValues();
    if (!values.buyPrice) {
      refs.risk.valueElement.textContent = "-";
      refs.quantity.valueElement.textContent = "-";
      refs.target.valueElement.textContent = "-";
      return { isValid: false, errors: ["Fetch Buy Price first."] };
    }

    const calculation = window.TvOrderCalculator.calculateTrade(values);
    state.calculation = calculation;

    refs.risk.valueElement.textContent = formatNumber(calculation.riskPerShare, 2);
    refs.quantity.valueElement.textContent = calculation.quantity > 0 ? String(calculation.quantity) : "-";
    
    const fillTgt = refs.tgtCheck.checked;
    refs.target.valueElement.textContent = fillTgt ? formatNumber(calculation.targetPrice, 2) : "-";

    if (values.stopLoss) {
      setStatus(calculation.errors[0] || "", calculation.errors.length ? "error" : "");
    }

    return calculation;
  }

  async function loadSettings() {
    const saved = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    refs.rr.value = saved[STORAGE_KEYS.rr] || DEFAULTS.rr;
    refs.maxLoss.value = saved[STORAGE_KEYS.maxLoss] || DEFAULTS.maxLoss;
    refs.stopLoss.value = saved[STORAGE_KEYS.stopLoss] || "";
    refs.tgtCheck.checked = saved[STORAGE_KEYS.tgtCheck] !== false;

    recalculate();
    logConsole("Settings loaded from local storage.");
  }

  function clearTradeFields() {
    refs.buyPrice.value = "";
    refs.stopLoss.value = "";
    refs.risk.valueElement.textContent = "-";
    refs.quantity.valueElement.textContent = "-";
    refs.target.valueElement.textContent = "-";
    setStatus("", "");
    state.calculation = null;
    resetOrderState();
    chrome.storage.local.remove([STORAGE_KEYS.stopLoss]);
    logConsole("Fields cleared.");
  }

  function openPanel() {
    if (!state.hasSavedPanelPosition) {
      anchorPanelAboveButton();
    }
    refs.panel.classList.add("is-open");
    window.setTimeout(keepPanelInViewport, 0);
    window.setTimeout(() => refs.stopLoss.focus(), 80);
    logConsole("Panel opened.");
  }

  function closePanel() {
    refs.panel.classList.remove("is-open");
    logConsole("Panel closed.");
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
    refs.panel.style.right = "8px";
    refs.panel.style.top = "auto";
    refs.panel.style.bottom = "48px";
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
      if (event.button !== 0 || event.target.closest("button") || event.target.closest("input") || event.target.closest("label")) {
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

  async function fetchLtp() {
    setStatus("Ensuring Order Panel is open...", "");
    const panelOpened = await window.TvDomHandler.ensureOrderPanelOpen();
    if (!panelOpened) {
      logConsole("Could not verify if Order panel opened.", "warning");
    }

    const buyPrice = window.TvDomHandler.fetchBuyPrice();
    if (!buyPrice || !Number.isFinite(buyPrice)) {
      setStatus("Could not fetch Buy Price. Open the order ticket first.", "error");
      return;
    }

    refs.buyPrice.value = buyPrice.toFixed(2);
    recalculate();
    setStatus(`Fetched Buy Price: ${buyPrice.toFixed(2)}`, "success");
  }

  async function fillTradingviewOrder(side) {
    // 1. Validate the current inputs first before fetching LTP
    const currentValues = readValues();
    const currentBuyPrice = parseFloat(currentValues.buyPrice);
    const currentStopLoss = parseFloat(currentValues.stopLoss);

    if (Number.isFinite(currentBuyPrice) && Number.isFinite(currentStopLoss)) {
      if (side === "buy" && currentStopLoss >= currentBuyPrice) {
        setStatus("Error: Stop Price must be below Buy Price for Buy trades.", "error");
        return;
      }
      if (side === "sell" && currentStopLoss <= currentBuyPrice) {
        setStatus("Error: Stop Price must be above Buy Price for Sell trades.", "error");
        return;
      }
    }

    // Always fetch latest LTP first to ensure calculations are accurate
    await fetchLtp();
    if (!refs.buyPrice.value) {
      return;
    }

    const calculation = recalculate();
    if (!calculation.isValid) {
      setStatus(calculation.errors[0] || "Invalid trade parameters.", "error");
      return;
    }

    // Validate if the stop loss matches the trade direction again
    if (side === "buy" && calculation.stopLoss >= calculation.buyPrice) {
      setStatus("Error: Stop Price must be below Buy Price for Buy trades.", "error");
      return;
    }
    if (side === "sell" && calculation.stopLoss <= calculation.buyPrice) {
      setStatus("Error: Stop Price must be above Buy Price for Sell trades.", "error");
      return;
    }

    const orderQuantity = calculation.quantity;

    if (orderQuantity <= 0) {
      setStatus("Order quantity is 0. Check Max Loss or SL Price.", "error");
      return;
    }

    setStatus(`Preparing ${side.toUpperCase()} Order...`, "");
    
    try {
      // 1. Switch side on TradingView ticket
      const switched = window.TvDomHandler.switchTradeSide(side);
      if (!switched) {
        logConsole(`Could not find ${side} tab to click, attempting to fill form anyway.`, "warning");
      } else {
        logConsole(`Switched TradingView ticket to ${side.toUpperCase()} mode.`, "info");
        // Wait 150ms for tab transition to complete
        await new Promise(r => setTimeout(r, 150));
      }

      // 2. Fill order ticket
      const result = await window.TvDomHandler.fillOrderTicket({
        quantity: orderQuantity,
        targetPrice: calculation.targetPrice,
        stopLoss: calculation.stopLoss,
        fillTgt: refs.tgtCheck.checked
      });

      if (result.ok) {
        setStatus(`Filled inputs for Qty ${orderQuantity}. Executing...`, "success");
        
        // Wait 300ms for React input states to settle before clicking submit
        await new Promise(r => setTimeout(r, 300));
        
        const executed = window.TvDomHandler.clickBuyButton(); // clicks the Buy/Sell submit button
        if (executed) {
          setStatus(`${side.toUpperCase()} Order submitted successfully!`, "success");
        } else {
          setStatus("Form filled, but could not auto-click Buy/Sell button. Please click manually.", "warning");
        }
      } else {
        setStatus("Failed to fill all fields. Check order ticket manually.", "error");
      }
    } catch (err) {
      setStatus(`Execution error: ${err.message}`, "error");
    }
  }



  function buildPanel() {
    if (document.getElementById("tv-fast-trade-root")) {
      return null;
    }

    const root = createElement("div");
    root.id = "tv-fast-trade-root";

    const button = createElement("button", "tvft-fab", "\u26A1");
    button.type = "button";
    button.title = "Open TV Quick Trade (Alt+V)";

    const panel = createElement("aside", "tvft-panel");
    panel.setAttribute("aria-label", "TradingView fast trade panel");

    // Header
    const header = createElement("div", "tvft-header");
    const title = createElement("h2", "tvft-title", "TV Fast Trade");
    const headerActions = createElement("div", "tvft-header-actions");
    const tgtCheck = checkboxField("tvft-tgt-check", "Tgt");
    tgtCheck.input.checked = true;
    const logsBtn = createElement("button", "tvft-logs-btn", "📋");
    logsBtn.type = "button";
    logsBtn.title = "View Logs";
    const close = createElement("button", "tvft-close", "\u00D7");
    close.type = "button";
    close.title = "Close";
    headerActions.append(tgtCheck.wrapper, logsBtn, close);
    header.append(title, headerActions);

    // Inputs Grid
    const topGrid = createElement("div", "tvft-grid");
    const rr = field("tvft-rr", "Risk Reward", "number", "2");
    const maxLoss = field("tvft-max-loss", "Max Loss", "number", "1000");
    topGrid.append(rr.wrapper, maxLoss.wrapper);

    // Inputs Buy / SL / Outputs
    const tradeSection = createElement("div", "tvft-section tvft-trade-grid");
    const buyPrice = field("tvft-buy-price", "Buy Price", "number", "0.00");
    const stopLoss = field("tvft-stop-loss", "Stop Price", "number", "0.00");
    const risk = readOnlyField("Risk / Share");
    tradeSection.append(buyPrice.wrapper, stopLoss.wrapper, risk.wrapper);

    const outputSection = createElement("div", "tvft-section tvft-grid");
    const quantity = readOnlyField("Qty");
    const target = readOnlyField("Target");
    outputSection.append(quantity.wrapper, target.wrapper);

    // Single-Row Actions
    const actions = createElement("div", "tvft-actions");
    const fetch = createElement("button", "tvft-btn tvft-secondary", "Get LTP");
    const buyBtn = createElement("button", "tvft-btn tvft-primary", "Buy");
    const sellBtn = createElement("button", "tvft-btn tvft-danger", "Sell");
    fetch.type = "button";
    buyBtn.type = "button";
    sellBtn.type = "button";
    actions.append(fetch, buyBtn, sellBtn);

    // Strategy Performance Section
    const perfSection = createElement("div", "tvft-section tvft-grid");
    const tPnl = readOnlyField("T Pnl");
    const mDd = readOnlyField("M Dd");
    const wr = readOnlyField("WR");
    const pf = readOnlyField("PF");
    perfSection.append(tPnl.wrapper, mDd.wrapper, wr.wrapper, pf.wrapper);

    // Status bar
    const status = createElement("div", "tvft-status");

    panel.append(header, topGrid, tradeSection, outputSection, actions, perfSection, status);
    root.append(button, panel);
    document.documentElement.appendChild(root);

    return {
      button,
      panel,
      header,
      tgtCheck: tgtCheck.input,
      logsBtn,
      close,
      rr: rr.input,
      maxLoss: maxLoss.input,
      buyPrice: buyPrice.input,
      stopLoss: stopLoss.input,
      risk,
      quantity,
      target,
      actions,
      fetch,
      buyBtn,
      sellBtn,
      tPnl: tPnl.valueElement,
      mDd: mDd.valueElement,
      wr: wr.valueElement,
      pf: pf.valueElement,
      status
    };
  }

  const refs = buildPanel();
  if (!refs) {
    return;
  }

  // Event Listeners
  refs.button.addEventListener("click", togglePanel);
  refs.close.addEventListener("click", closePanel);
  refs.fetch.addEventListener("click", fetchLtp);
  refs.buyBtn.addEventListener("click", () => fillTradingviewOrder("buy"));
  refs.sellBtn.addEventListener("click", () => fillTradingviewOrder("sell"));
  refs.logsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "open_logs" });
  });

  enableDrag();

  [refs.rr, refs.maxLoss, refs.buyPrice].forEach((input) => {
    input.addEventListener("input", () => {
      persistSettings();
      resetOrderState();
      recalculate();
    });
  });

  refs.tgtCheck.addEventListener("change", () => {
    persistSettings();
    recalculate();
  });

  refs.stopLoss.addEventListener("input", () => {
    persistDraft();
    resetOrderState();
    recalculate();
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      togglePanel();
    }
    if (event.key === "Escape" && refs.panel.classList.contains("is-open")) {
      closePanel();
    }
  });

  // Init
  loadSettings();
  loadPanelPosition();

  // Periodically update Strategy Performance values
  window.setInterval(() => {
    if (refs.panel.classList.contains("is-open")) {
      const data = window.TvDomHandler.fetchAnalyticsData();
      refs.tPnl.textContent = data.tPnl;
      refs.mDd.textContent = data.mDd;
      refs.wr.textContent = data.wr;
      refs.pf.textContent = data.pf;
    }
  }, 1500);
})();
