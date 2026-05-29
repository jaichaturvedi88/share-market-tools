(function () {
  if (window.top !== window) {
    return;
  }

  const STORAGE_KEYS = {
    rr: "dhanFastTrade.rr",
    maxLoss: "dhanFastTrade.maxLoss",
    buyPrice: "dhanFastTrade.buyPrice",
    stopLoss: "dhanFastTrade.stopLoss",
    panelX: "dhanFastTrade.panelX",
    panelY: "dhanFastTrade.panelY"
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
    const wrapper = createElement("label", "dft-label");
    const text = createElement("span", "", label);
    const input = createElement("input", "dft-input");
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
    const wrapper = createElement("div", "dft-output");
    const labelElement = createElement("span", "", label);
    const valueElement = createElement("span", "", "-");
    wrapper.append(labelElement, valueElement);
    return { wrapper, valueElement };
  }

  function checkboxField(id, label) {
    const wrapper = createElement("label", "dft-check-label");
    const input = createElement("input", "dft-check");
    const text = createElement("span", "", label);
    input.id = id;
    input.type = "checkbox";
    wrapper.append(input, text);
    return { wrapper, input };
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
    refs.order1.textContent = "Order 1";
    refs.order2.textContent = "Order 2";
    refs.order1.classList.remove("is-ready");
    refs.order2.classList.remove("is-ready");
  }

  function refreshSplitModeUi() {
    const splitEnabled = refs.split.checked;
    const calculation = state.calculation;
    const quantity = calculation?.quantity || 0;
    const splitQuantities = getSplitQuantities(quantity);

    refs.splitOutputs.classList.toggle("is-hidden", !splitEnabled);
    refs.actions.classList.toggle("is-split", splitEnabled);
    refs.order1Qty.textContent = splitEnabled && splitQuantities.order1Qty > 0 ? String(splitQuantities.order1Qty) : "-";
    refs.order2Qty.textContent = splitEnabled && splitQuantities.order2Qty > 0 ? String(splitQuantities.order2Qty) : "-";
    refs.order2.classList.toggle("is-hidden", !splitEnabled);

    if (splitEnabled) {
      refs.order1.textContent = state.orderPrepared.order1 ? "\u2713 Order 1 Ready" : "Order 1";
      refs.order2.textContent = state.orderPrepared.order2 ? "\u2713 Order 2 Ready" : "Order 2";
      refs.order1.disabled = state.orderPrepared.order1;
      refs.order2.disabled = state.orderPrepared.order2;
      refs.order1.classList.toggle("is-ready", state.orderPrepared.order1);
      refs.order2.classList.toggle("is-ready", state.orderPrepared.order2);
    } else {
      refs.order1.textContent = "Fill Data";
      refs.order2.textContent = "Order 2";
      refs.order1.disabled = false;
      refs.order2.disabled = false;
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
    const calculation = window.DhanOrderCalculator.calculateTrade(values);
    state.calculation = calculation;

    refs.risk.textContent = formatNumber(calculation.riskPerShare, 2);
    refs.quantity.textContent = calculation.quantity > 0 ? String(calculation.quantity) : "-";
    refs.target.textContent = formatNumber(calculation.targetPrice, 2);
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
    refs.order1Qty.textContent = "-";
    refs.order2Qty.textContent = "-";
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
    refs.order1Qty.textContent = "-";
    refs.order2Qty.textContent = "-";
    state.calculation = null;
    resetOrderState();
    chrome.storage.local.remove([STORAGE_KEYS.stopLoss]);
  }

  function openPanel() {
    anchorPanelAboveButton();
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
    const result = window.DhanOrderDomHandler.getActiveWatchlistScrip();

    if (!result.ok) {
      setStatus(result.error, "error");
      return;
    }

    state.activeSymbol = result.symbol;
    refs.activeSymbol.textContent = displaySymbolName(result.symbol);
    refs.activeSymbol.title = result.symbol;
    refs.buyPrice.value = window.DhanOrderCalculator.roundPrice(result.ltp).toFixed(2);
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
      setStatus("Click Fetch LTP before filling data.", "error");
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
      const result = await window.DhanOrderDomHandler.prepareTrade({
        quantity: orderQuantity,
        buyPrice: window.DhanOrderCalculator.roundPrice(calculation.buyPrice),
        stopLoss: window.DhanOrderCalculator.roundToDecimals(calculation.stopLoss, 1).toFixed(1),
        targetPrice: window.DhanOrderCalculator.roundToDecimals(calculation.targetPrice, 1).toFixed(1)
      });

      if (result.ok) {
        if (splitEnabled) {
          const key = orderNumber === 1 ? "order1" : "order2";
          const button = orderNumber === 1 ? refs.order1 : refs.order2;
          state.orderPrepared[key] = true;
          button.disabled = true;
          button.textContent = `\u2713 Order ${orderNumber} Ready`;
          button.classList.add("is-ready");

          if (state.orderPrepared.order1 && state.orderPrepared.order2) {
            setStatus(`\u2705 Full Position Prepared\nTotal Qty: ${calculation.quantity}\nOrder 1: ${splitQuantities.order1Qty}\nOrder 2: ${splitQuantities.order2Qty}`, "success");
          } else {
            setStatus(`Order ${orderNumber} prepared\nQty: ${orderQuantity}`, "success");
          }
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

  function buildPanel() {
    if (document.getElementById("dhan-fast-trade-root")) {
      return null;
    }

    const root = createElement("div");
    root.id = "dhan-fast-trade-root";

    const button = createElement("button", "dft-fab", "\u26A1 Trade");
    button.type = "button";
    button.title = "Open fast trade panel (Alt+T)";

    const panel = createElement("aside", "dft-panel");
    panel.setAttribute("aria-label", "Dhan fast trade panel");

    const header = createElement("div", "dft-header");
    const title = createElement("h2", "dft-title", "Fast Trade");
    const close = createElement("button", "dft-close", "\u00D7");
    close.type = "button";
    close.title = "Close";
    header.append(title, close);

    const topGrid = createElement("div", "dft-grid");
    const rr = field("dft-rr", "Risk Reward", "number", "2");
    const maxLoss = field("dft-max-loss", "Max Loss", "number", "1000");
    const split = checkboxField("dft-split", "Split 50%");
    split.input.checked = true;
    topGrid.classList.add("dft-top-grid");
    topGrid.append(rr.wrapper, maxLoss.wrapper, split.wrapper);

    const activeSection = createElement("div", "dft-section");
    const activeOutput = output("Active Symbol");
    activeOutput.wrapper.classList.add("dft-active-symbol");
    activeSection.append(activeOutput.wrapper);

    const tradeSection = createElement("div", "dft-section dft-grid");
    const buyPrice = field("dft-buy-price", "Buy Price", "number", "0.00");
    const stopLoss = field("dft-stop-loss", "Stop Loss", "number", "0.00");
    tradeSection.append(buyPrice.wrapper, stopLoss.wrapper);

    const outputSection = createElement("div", "dft-section dft-output-grid");
    const risk = output("Risk / Share");
    const quantity = output("Quantity");
    const target = output("Target Price");
    const amount = output("Total Amount");
    outputSection.append(quantity.wrapper, risk.wrapper, target.wrapper, amount.wrapper);
    const splitOutputs = createElement("div", "dft-section dft-output-grid is-hidden");
    const order1Qty = output("Order 1 Qty");
    const order2Qty = output("Order 2 Qty");
    splitOutputs.append(order1Qty.wrapper, order2Qty.wrapper);

    const actions = createElement("div", "dft-actions");
    const fetch = createElement("button", "dft-btn dft-secondary", "Fetch LTP");
    const order1 = createElement("button", "dft-btn dft-primary", "Fill Data");
    const order2 = createElement("button", "dft-btn dft-primary is-hidden", "Order 2");
    fetch.type = "button";
    order1.type = "button";
    order2.type = "button";
    actions.append(fetch, order1, order2);

    const status = createElement("div", "dft-status");
    panel.append(header, topGrid, activeSection, tradeSection, outputSection, splitOutputs, actions, status);
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
      splitOutputs,
      order1Qty: order1Qty.valueElement,
      order2Qty: order2Qty.valueElement,
      actions,
      fetch,
      order1,
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
  anchorPanelAboveButton();
})();
