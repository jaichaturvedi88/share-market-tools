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
    panelY: "fyersOneClick.panelY"
  };

  const DEFAULTS = {
    rr: "2",
    maxLoss: "1000"
  };

  const state = {
    calculation: null,
    activeSymbol: "",
    hasSavedPanelPosition: false,
    orderPrepared: {
      order1: false,
      order2: false
    },
    values: {
      rr: DEFAULTS.rr,
      maxLoss: DEFAULTS.maxLoss,
      buyPrice: "",
      stopLoss: ""
    }
  };

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

  function checkboxField(id, label) {
    const wrapper = createElement("label", "foc-label foc-check-field");
    const input = createElement("input", "foc-check");
    const inputWrap = createElement("div", "foc-check-box");
    const text = createElement("span", "", label);
    input.id = id;
    input.type = "checkbox";
    inputWrap.append(input);
    wrapper.append(text, inputWrap);
    return { wrapper, input };
  }

  function readOnlyField(label) {
    const wrapper = createElement("div", "foc-label");
    const text = createElement("span", "", label);
    const valueElement = createElement("div", "foc-readonly-field", "-");
    wrapper.append(text, valueElement);
    return { wrapper, valueElement };
  }

  function splitResultItem(label) {
    const wrapper = createElement("label", "foc-split-result-item");
    const input = createElement("input", "foc-split-result-check");
    const text = createElement("span", "foc-split-result-value", label);
    input.type = "checkbox";
    input.disabled = true;
    wrapper.append(input, text);
    return { wrapper, input, text };
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

  function setStatus(message, type) {
    refs.status.textContent = message || "";
    refs.status.classList.toggle("is-error", type === "error");
    refs.status.classList.toggle("is-success", type === "success");
  }

  function getSplitQuantities(totalQuantity) {
    const order1Qty = Math.ceil(totalQuantity / 2);
    return {
      order1Qty,
      order2Qty: totalQuantity - order1Qty
    };
  }

  function resetOrderButtons() {
    state.orderPrepared.order1 = false;
    state.orderPrepared.order2 = false;
    refs.order1.disabled = false;
    refs.order2.disabled = false;
    refs.fillTool.disabled = false;
    refs.fetch.textContent = "Get LTP";
    refs.order1.textContent = "Order 1";
    refs.order2.textContent = "Order 2";
    refs.fillTool.textContent = "Fill Tool";
    refs.order1.classList.remove("is-ready");
    refs.order2.classList.remove("is-ready");
  }

  function refreshSplitModeUi() {
    const splitEnabled = refs.split.checked;
    const calculation = state.calculation;
    const quantity = calculation?.quantity || 0;
    const splitQuantities = getSplitQuantities(quantity);
    const hasStopLoss = refs.stopLoss.value.trim() !== "";
    const showSplitResult = splitEnabled && hasStopLoss && calculation?.isValid && quantity > 0;

    refs.splitResult.classList.toggle("is-hidden", !showSplitResult);
    refs.actions.classList.toggle("is-split", splitEnabled);
    refs.splitTotalQty.textContent = splitEnabled && quantity > 0 ? `Total Qty: ${quantity}` : "Total Qty: -";
    refs.order1ResultText.textContent = splitEnabled && splitQuantities.order1Qty > 0 ? String(splitQuantities.order1Qty) : "-";
    refs.order2ResultText.textContent = splitEnabled && splitQuantities.order2Qty > 0 ? String(splitQuantities.order2Qty) : "-";
    refs.order1ResultCheck.checked = state.orderPrepared.order1;
    refs.order2ResultCheck.checked = state.orderPrepared.order2;
    refs.order2.classList.toggle("is-hidden", !splitEnabled);

    if (splitEnabled) {
      refs.fetch.textContent = "LTP";
      refs.order1.textContent = state.orderPrepared.order1 ? "\u2713 Ord 1" : "Ord 1";
      refs.order2.textContent = state.orderPrepared.order2 ? "\u2713 Ord 2" : "Ord 2";
      refs.fillTool.textContent = "Tool";
      refs.order1.disabled = state.orderPrepared.order1;
      refs.order2.disabled = state.orderPrepared.order2;
      refs.fillTool.disabled = false;
      refs.order1.classList.toggle("is-ready", state.orderPrepared.order1);
      refs.order2.classList.toggle("is-ready", state.orderPrepared.order2);
    } else {
      refs.fetch.textContent = "Get LTP";
      refs.order1.textContent = "Fill Data";
      refs.order2.textContent = "Order 2";
      refs.fillTool.textContent = "Fill Tool";
      refs.order1.disabled = false;
      refs.order2.disabled = false;
      refs.fillTool.disabled = false;
      refs.order1.classList.remove("is-ready");
      refs.order2.classList.remove("is-ready");
    }
  }

  function resetOrderState() {
    resetOrderButtons();
    refreshSplitModeUi();
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
    refreshSplitModeUi();

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
    refs.splitTotalQty.textContent = "Total Qty: -";
    refs.order1ResultText.textContent = "-";
    refs.order2ResultText.textContent = "-";
    refs.order1ResultCheck.checked = false;
    refs.order2ResultCheck.checked = false;
    refs.splitResult.classList.add("is-hidden");
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
    refs.splitTotalQty.textContent = "Total Qty: -";
    refs.order1ResultText.textContent = "-";
    refs.order2ResultText.textContent = "-";
    refs.order1ResultCheck.checked = false;
    refs.order2ResultCheck.checked = false;
    refs.splitResult.classList.add("is-hidden");
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

  async function prepareOrder(orderNumber) {
    const calculation = recalculate();
    const splitEnabled = refs.split.checked;
    const splitQuantities = getSplitQuantities(calculation.quantity);
    const orderQuantity = splitEnabled
      ? (orderNumber === 1 ? splitQuantities.order1Qty : splitQuantities.order2Qty)
      : calculation.quantity;

    if (!state.activeSymbol) {
      setStatus("Click Get LTP before filling data.", "error");
      return;
    }

    if (!calculation.isValid) {
      setStatus(calculation.errors[0], "error");
      return;
    }

    if (orderQuantity <= 0) {
      setStatus("Order quantity must be greater than 0.", "error");
      return;
    }

    setStatus("Opening buy order and filling fields...", "");

    try {
      const result = await window.FyersOCODomHandler.prepareTrade({
        quantity: orderQuantity,
        buyPrice: window.FyersOCOCalculator.roundPrice(calculation.buyPrice),
        stopLoss: window.FyersOCOCalculator.roundToDecimals(calculation.stopLoss, 1).toFixed(1),
        targetPrice: window.FyersOCOCalculator.roundToDecimals(calculation.targetPrice, 1).toFixed(1)
      });

      if (result.ok) {
        if (splitEnabled) {
          const key = orderNumber === 1 ? "order1" : "order2";
          const button = orderNumber === 1 ? refs.order1 : refs.order2;
          state.orderPrepared[key] = true;
          button.disabled = true;
          button.textContent = `\u2713 Order ${orderNumber} Ready`;
          button.classList.add("is-ready");
          refs.order1ResultCheck.checked = state.orderPrepared.order1;
          refs.order2ResultCheck.checked = state.orderPrepared.order2;

          setStatus("", "success");
        } else {
          setStatus(`Trade prepared with qty ${orderQuantity}. Review before BUY.`, "success");
        }
      } else {
        setStatus(`Prepared partially. Check ${result.missing.join(", ")} manually.`, "error");
      }
    } catch (error) {
      setStatus(`Could not prepare trade: ${error.message}`, "error");
    }
  }

  async function fillDrawingToolLevels() {
    const calculation = recalculate();

    if (!calculation.isValid) {
      setStatus(calculation.errors[0], "error");
      return;
    }

    setStatus("Filling drawing tool levels...", "");
    refs.fillTool.disabled = true;

    try {
      const result = await window.FyersOCODomHandler.prepareDrawingToolLevels({
        buyPrice: window.FyersOCOCalculator.roundPrice(calculation.buyPrice).toFixed(2),
        targetPrice: window.FyersOCOCalculator.roundToDecimals(calculation.targetPrice, 1).toFixed(1),
        stopLoss: window.FyersOCOCalculator.roundToDecimals(calculation.stopLoss, 1).toFixed(1)
      });

      if (result.ok) {
        setStatus("Drawing tool levels filled.", "success");
      } else {
        if (result.error) {
          setStatus(result.error, "error");
        } else {
          setStatus(`Drawing tool partially filled. Check ${result.missing.join(", ")} manually.`, "error");
        }
      }
    } catch (error) {
      setStatus(`Could not fill drawing tool: ${error.message}`, "error");
    } finally {
      refs.fillTool.disabled = false;
    }
  }

  function buildPanel() {
    if (document.getElementById("foc-root")) {
      return null;
    }

    const root = createElement("div");
    root.id = "foc-root";

    const button = createElement("button", "foc-fab", "OCO");
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
    const split = checkboxField("foc-split", "Split 50%");
    split.input.checked = true;
    topGrid.classList.add("foc-top-grid");
    topGrid.append(rr.wrapper, maxLoss.wrapper, split.wrapper);

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
    const order1 = createElement("button", "foc-btn foc-primary", "Fill Data");
    const order2 = createElement("button", "foc-btn foc-primary is-hidden", "Order 2");
    const fillTool = createElement("button", "foc-btn foc-secondary", "Fill Tool");
    fetch.type = "button";
    order1.type = "button";
    order2.type = "button";
    fillTool.type = "button";
    actions.append(fetch, order1, order2, fillTool);

    const splitResult = createElement("div", "foc-split-result is-hidden");
    const splitTotalQty = createElement("span", "foc-split-total", "Total Qty: -");
    const order1Result = splitResultItem("-");
    const order2Result = splitResultItem("-");
    splitResult.append(splitTotalQty, order1Result.wrapper, order2Result.wrapper);

    const status = createElement("div", "foc-status");
    panel.append(header, topGrid, activeSection, tradeSection, outputSection, actions, splitResult, status);
    root.append(button, panel);
    document.documentElement.appendChild(root);

    return {
      button,
      panel,
      header,
      close,
      rr: rr.input,
      maxLoss: maxLoss.input,
      split: split.input,
      activeSymbol: activeOutput.valueElement,
      buyPrice: buyPrice.input,
      stopLoss: stopLoss.input,
      risk: risk.valueElement,
      quantity: quantity.valueElement,
      target: target.valueElement,
      amount: amount.valueElement,
      splitResult,
      splitTotalQty,
      order1ResultCheck: order1Result.input,
      order2ResultCheck: order2Result.input,
      order1ResultText: order1Result.text,
      order2ResultText: order2Result.text,
      actions,
      fetch,
      order1,
      fillTool,
      order2,
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
  refs.order1.addEventListener("click", () => prepareOrder(1));
  refs.fillTool.addEventListener("click", fillDrawingToolLevels);
  refs.order2.addEventListener("click", () => prepareOrder(2));
  refs.split.addEventListener("change", () => {
    resetOrderState();
    recalculate();
    setStatus("", "");
  });
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

  loadSettings();
  loadPanelPosition();
})();
