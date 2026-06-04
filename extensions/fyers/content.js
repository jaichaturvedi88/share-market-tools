(function () {
  // Prevent running in sub-frames that do not have access to top window
  if (window.top !== window) {
    return;
  }

  const STORAGE_KEYS = {
    targetProfit: "fyersSL.targetProfit",
    voiceAlerts: "fyersSL.voiceAlerts",
    autoConfirm: "fyersSL.autoConfirm",
    hideClosed: "fyersSL.hideClosed",
    panelX: "fyersSL.panelX",
    panelY: "fyersSL.panelY"
  };

  const DEFAULTS = {
    targetProfit: 200,
    voiceAlerts: true,
    autoConfirm: false,
    hideClosed: true
  };

  // Extension State
  const state = {
    targetProfit: DEFAULTS.targetProfit,
    voiceAlerts: DEFAULTS.voiceAlerts,
    autoConfirm: DEFAULTS.autoConfirm,
    hideClosed: DEFAULTS.hideClosed,
    hasSavedPosition: false,
    alertedSymbols: new Map(), // Track symbol -> target profit for voice alerts
    activePositions: [],
    currentSort: {
      key: 'symbol',
      direction: 'asc' // 'asc' or 'desc'
    }
  };

  // Helper: Create element
  function h(tag, className, textContent, attributes = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // Helper: Format price
  function formatPrice(val) {
    if (val === null || val === undefined || !Number.isFinite(val)) return "-";
    return val.toFixed(2);
  }

  // Play Speech synthesis voice alert
  function playVoiceAlert(message) {
    if (!state.voiceAlerts) return;
    
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel(); // cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[Fyers SL Manager] Speech synthesis failed:", err);
      }
    }
  }

  // Build the entire DOM structure matching Zerodha GTT panel style
  function buildUI() {
    if (document.getElementById("fyers-sl-manager-root")) {
      return null;
    }

    const root = h("div", "", undefined, { id: "fyers-sl-manager-root" });

    // 1. Floating Toggle Button (Matches Zerodha Trades toggle)
    const fab = h("button", "", undefined, { id: "fsl-helper-toggle", type: "button", title: "Open SL details" });
    const fabIcon = h("span", "fsl-helper-icon", "🛡️");
    const fabText = h("span", "", " SL Manager");
    fab.append(fabIcon, fabText);

    // 2. Sliding Panel (Matches Zerodha panel)
    const panel = h("section", "", undefined, { id: "fsl-helper-panel", "aria-label": "SL details panel" });

    // Panel Header
    const header = h("div", "fsl-helper-header");
    const title = h("strong", "", "SL Details");
    
    const controls = h("div");

    // Checkbox 1: Voice Alerts
    const voiceLabel = h("label", "fsl-helper-toggle-option", undefined, { title: "Enable voice announcements" });
    const voiceCheckbox = h("input", "", undefined, { type: "checkbox", id: "fsl-hide-gtt" });
    voiceCheckbox.checked = state.voiceAlerts;
    voiceLabel.append(voiceCheckbox, h("span", "", "Voice Alert"));

    // Checkbox 2: Hide 0
    const hide0Label = h("label", "fsl-helper-toggle-option", undefined, { title: "Hide closed positions (qty 0)" });
    const hide0Checkbox = h("input", "", undefined, { type: "checkbox", id: "fsl-hide-completed" });
    hide0Checkbox.checked = state.hideClosed;
    hide0Label.append(hide0Checkbox, h("span", "", "Hide 0"));

    // Checkbox 3: Auto-Confirm
    const autoLabel = h("label", "fsl-helper-toggle-option", undefined, { title: "Auto click modify button in modal" });
    const autoCheckbox = h("input", "", undefined, { type: "checkbox", id: "fsl-auto-confirm" });
    autoCheckbox.checked = state.autoConfirm;
    autoLabel.append(autoCheckbox, h("span", "", "Auto Confirm"));

    // Action buttons in header
    const refreshBtn = h("button", "", "↻", { type: "button", id: "fsl-helper-refresh", title: "Refresh details" });
    const closeBtn = h("button", "", "×", { type: "button", id: "fsl-helper-close", title: "Close helper" });

    controls.append(voiceLabel, hide0Label, autoLabel, refreshBtn, closeBtn);
    header.append(title, controls);

    // Configuration bar for Target Profit
    const configBar = h("div", "fsl-helper-config-bar");
    const profitLabel = h("label", "fsl-helper-config-label", "Target profit to capture: ₹ ");
    const profitInput = h("input", "fsl-helper-config-input", undefined, {
      type: "number",
      min: "1",
      step: "5",
      value: String(state.targetProfit)
    });
    configBar.append(profitLabel, profitInput);

    // Status Area
    const status = h("div", "", "Syncing positions and SL metrics...", { id: "fsl-helper-status" });

    // Table view wrap
    const tableWrap = h("div", "fsl-helper-table-wrap");
    const table = h("table");
    
    // Table Headers with sorting buttons
    const thead = h("thead");
    const tr = h("tr");

    const headersConfig = [
      { text: "Symbol", key: "symbol", cls: "" },
      { text: "Qty", key: "netQty", cls: "col-numeric" },
      { text: "Buy", key: "avgPrice", cls: "col-numeric" },
      { text: "Trigr", key: "targetSL", cls: "col-numeric" },
      { text: "LTP", key: "ltp", cls: "col-numeric" },
      { text: "Trigr %", key: "trigrPercent", cls: "col-numeric" },
      { text: "Result", key: "unrealizedPl", cls: "col-center" },
      { text: "SL", key: null, cls: "col-center" }
    ];

    headersConfig.forEach(col => {
      const th = h("th", col.cls);
      if (col.key) {
        const btn = h("button", "", col.text, { type: "button", "data-sort-key": col.key });
        // Set default sort icon attribute
        if (col.key === state.currentSort.key) {
          btn.setAttribute("data-sort-direction", state.currentSort.direction);
        }
        th.appendChild(btn);
      } else {
        th.textContent = col.text;
      }
      tr.appendChild(th);
    });

    thead.appendChild(tr);
    
    // Table Body
    const tbody = h("tbody", "", undefined, { id: "fsl-helper-rows" });
    tbody.appendChild(h("tr", "", undefined, { html: '<tr><td colspan="8">No data loaded.</td></tr>' }));

    table.append(thead, tbody);
    tableWrap.appendChild(table);

    panel.append(header, configBar, status, tableWrap);
    root.append(fab, panel);
    document.documentElement.appendChild(root);

    return {
      fab,
      panel,
      header,
      closeBtn,
      refreshBtn,
      profitInput,
      voiceCheckbox,
      hide0Checkbox,
      autoCheckbox,
      tbody,
      status,
      thead
    };
  }

  const refs = buildUI();
  if (!refs) return;

  // Set Status UI Helper
  function setStatus(msg, type = "") {
    refs.status.textContent = msg || "";
    refs.status.className = "";
    if (type) refs.status.classList.add(`is-${type}`);
    refs.status.title = msg || "";
  }

  // Panel bounds clamping
  function clamp(val, minVal, maxVal) {
    return Math.min(Math.max(val, minVal), maxVal);
  }

  function keepPanelInViewport() {
    if (!refs.panel.classList.contains("is-open")) return;
    
    const rect = refs.panel.getBoundingClientRect();
    const maxLeft = Math.max(10, window.innerWidth - rect.width - 10);
    const maxTop = Math.max(10, window.innerHeight - rect.height - 10);
    const nextLeft = clamp(rect.left, 10, maxLeft);
    const nextTop = clamp(rect.top, 10, maxTop);

    refs.panel.style.left = `${nextLeft}px`;
    refs.panel.style.top = `${nextTop}px`;
    refs.panel.style.right = "auto";
    refs.panel.style.bottom = "auto";
  }

  function anchorPanelAboveFAB() {
    refs.panel.style.left = "auto";
    refs.panel.style.right = "16px";
    refs.panel.style.top = "auto";
    refs.panel.style.bottom = "100px";
  }

  async function loadPanelPosition() {
    const saved = await chrome.storage.local.get([STORAGE_KEYS.panelX, STORAGE_KEYS.panelY]);
    const left = Number(saved[STORAGE_KEYS.panelX]);
    const top = Number(saved[STORAGE_KEYS.panelY]);

    if (Number.isFinite(left) && Number.isFinite(top)) {
      state.hasSavedPosition = true;
      refs.panel.style.left = `${left}px`;
      refs.panel.style.top = `${top}px`;
      refs.panel.style.right = "auto";
      refs.panel.style.bottom = "auto";
    } else {
      anchorPanelAboveFAB();
    }
    setTimeout(keepPanelInViewport, 0);
  }

  function savePanelPosition() {
    const rect = refs.panel.getBoundingClientRect();
    chrome.storage.local.set({
      [STORAGE_KEYS.panelX]: Math.round(rect.left),
      [STORAGE_KEYS.panelY]: Math.round(rect.top)
    });
  }

  // Enable Panel Dragging
  function enablePanelDrag() {
    let drag = null;

    refs.header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label")) return;

      const rect = refs.panel.getBoundingClientRect();
      drag = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      };

      refs.header.classList.add("is-dragging");
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!drag) return;

      const rect = refs.panel.getBoundingClientRect();
      const maxLeft = Math.max(10, window.innerWidth - rect.width - 10);
      const maxTop = Math.max(10, window.innerHeight - rect.height - 10);
      const nextLeft = clamp(e.clientX - drag.offsetX, 10, maxLeft);
      const nextTop = clamp(e.clientY - drag.offsetY, 10, maxTop);

      refs.panel.style.left = `${nextLeft}px`;
      refs.panel.style.top = `${nextTop}px`;
      refs.panel.style.right = "auto";
      refs.panel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (!drag) return;
      refs.header.classList.remove("is-dragging");
      drag = null;
      state.hasSavedPosition = true;
      savePanelPosition();
    });

    window.addEventListener("resize", keepPanelInViewport);
  }

  // Load configs
  async function loadConfig() {
    const saved = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    
    state.targetProfit = Number(saved[STORAGE_KEYS.targetProfit]) || DEFAULTS.targetProfit;
    refs.profitInput.value = String(state.targetProfit);

    if (saved[STORAGE_KEYS.voiceAlerts] !== undefined) {
      state.voiceAlerts = Boolean(saved[STORAGE_KEYS.voiceAlerts]);
      refs.voiceCheckbox.checked = state.voiceAlerts;
    }

    if (saved[STORAGE_KEYS.hideClosed] !== undefined) {
      state.hideClosed = Boolean(saved[STORAGE_KEYS.hideClosed]);
      refs.hide0Checkbox.checked = state.hideClosed;
    }

    if (saved[STORAGE_KEYS.autoConfirm] !== undefined) {
      state.autoConfirm = Boolean(saved[STORAGE_KEYS.autoConfirm]);
      refs.autoCheckbox.checked = state.autoConfirm;
    }
  }

  // Toggle Panel
  function togglePanel() {
    const isOpen = refs.panel.classList.contains("is-open");
    if (isOpen) {
      refs.panel.classList.remove("is-open");
    } else {
      refs.panel.classList.add("is-open");
      loadPanelPosition();
      playVoiceAlert(""); // Warm up Speech Engine
      syncAndRender();
    }
  }

  // Handle Move SL Action
  async function handleMoveSL(position, targetSL, btnElement) {
    btnElement.disabled = true;
    setStatus(`Moving SL for ${position.symbol} to ${targetSL.toFixed(2)}...`);

    try {
      const result = await window.FyersSLDomHandler.triggerSLModification(
        position.symbol, 
        targetSL, 
        state.autoConfirm
      );

      if (result.ok) {
        setStatus(result.msg || `SL moved for ${position.symbol} to ${targetSL.toFixed(2)}.`, "success");
        state.alertedSymbols.set(position.symbol, state.targetProfit);
      } else {
        setStatus(`SL move failed: ${result.error}`, "error");
        btnElement.disabled = false;
      }
    } catch (err) {
      setStatus(`SL move failed: ${err.message}`, "error");
      btnElement.disabled = false;
    }
  }

  // Sorting Helper
  function sortPositions(positions) {
    const { key, direction } = state.currentSort;
    const factor = direction === 'asc' ? 1 : -1;

    return [...positions].sort((a, b) => {
      let valA, valB;

      // Extract specific sort values
      if (key === 'symbol') {
        valA = a.symbol || "";
        valB = b.symbol || "";
        return valA.localeCompare(valB) * factor;
      } else if (key === 'netQty') {
        valA = Number(a.netQty) || 0;
        valB = Number(b.netQty) || 0;
      } else if (key === 'avgPrice') {
        valA = Number(a.avgPrice) || 0;
        valB = Number(b.avgPrice) || 0;
      } else if (key === 'targetSL') {
        valA = window.FyersSLCalculator.calculateTargetSL(a, state.targetProfit) || 0;
        valB = window.FyersSLCalculator.calculateTargetSL(b, state.targetProfit) || 0;
      } else if (key === 'ltp') {
        valA = Number(a.ltp) || 0;
        valB = Number(b.ltp) || 0;
      } else if (key === 'trigrPercent') {
        const slA = window.FyersSLCalculator.calculateTargetSL(a, state.targetProfit) || 0;
        const slB = window.FyersSLCalculator.calculateTargetSL(b, state.targetProfit) || 0;
        valA = slA && a.ltp ? ((slA - a.ltp) / a.ltp * 100) : 0;
        valB = slB && b.ltp ? ((slB - b.ltp) / b.ltp * 100) : 0;
      } else if (key === 'unrealizedPl') {
        valA = Number(a.unrealizedPl) || 0;
        valB = Number(b.unrealizedPl) || 0;
      } else {
        return 0;
      }

      if (valA < valB) return -1 * factor;
      if (valA > valB) return 1 * factor;
      return 0;
    });
  }

  // Handle Sort Clicks
  function setupSortListeners() {
    refs.thead.addEventListener("click", (e) => {
      const button = e.target.closest("[data-sort-key]");
      if (!button) return;

      const key = button.getAttribute("data-sort-key");
      let direction = "asc";

      if (state.currentSort.key === key) {
        direction = state.currentSort.direction === "asc" ? "desc" : "asc";
      }

      state.currentSort = { key, direction };

      // Update arrow icons in headers
      const buttons = refs.thead.querySelectorAll("[data-sort-key]");
      buttons.forEach(btn => {
        if (btn.getAttribute("data-sort-key") === key) {
          btn.setAttribute("data-sort-direction", direction);
        } else {
          btn.removeAttribute("data-sort-direction");
        }
      });

      renderRows();
    });
  }

  // Sync Positions and Redraw
  function syncAndRender() {
    try {
      const positions = window.FyersSLDomHandler.getOpenPositions();
      state.activePositions = positions;
      renderRows();
      
      const count = positions.length;
      const timeStr = new Date().toLocaleTimeString();
      setStatus(`Synced ${count} positions at ${timeStr}.`);
    } catch (err) {
      console.error("[Fyers SL Manager] Manual sync failed", err);
      setStatus(`Sync failed: ${err.message}`, "error");
    }
  }

  // Render rows inside the table body
  function renderRows() {
    let positions = state.activePositions;

    // 1. Filter out 0 Qty if Hide 0 is checked
    if (state.hideClosed) {
      positions = positions.filter(pos => Math.abs(pos.netQty) !== 0);
    }

    // 2. Sort Positions
    positions = sortPositions(positions);

    // Render HTML rows
    refs.tbody.innerHTML = "";

    if (positions.length === 0) {
      const tr = h("tr");
      const td = h("td", "", "No open positions found.", { colspan: "8", style: "text-align: center; color: #9fb0c7; padding: 20px;" });
      tr.appendChild(td);
      refs.tbody.appendChild(tr);
      return;
    }

    positions.forEach(pos => {
      const targetSL = window.FyersSLCalculator.calculateTargetSL(pos, state.targetProfit);
      const isLong = String(pos.side).toLowerCase() === "buy";
      const pnlVal = Number(pos.unrealizedPl) || 0;
      
      // Target met rule: P&L is above or equal to Target Profit
      const isTargetMet = pnlVal >= state.targetProfit;

      // Voice Alert trigger check
      if (isTargetMet && targetSL) {
        const lastAlerted = state.alertedSymbols.get(pos.symbol);
        if (lastAlerted !== state.targetProfit) {
          const speechMsg = `Stop Loss Alert. Profit target reached for ${pos.symbol.replace("NSE:", "").replace("-EQ", "")}. Target stop loss is ${targetSL.toFixed(2)}`;
          playVoiceAlert(speechMsg);
          state.alertedSymbols.set(pos.symbol, state.targetProfit);
        }
      } else {
        if (state.alertedSymbols.has(pos.symbol)) {
          state.alertedSymbols.delete(pos.symbol);
        }
      }

      // Calculate Trigger % difference: (Target_SL - LTP) / LTP * 100
      let triggerPctText = "-";
      let triggerPctVal = 0;
      if (targetSL && pos.ltp) {
        triggerPctVal = ((targetSL - pos.ltp) / pos.ltp) * 100;
        triggerPctText = `${triggerPctVal >= 0 ? "+" : ""}${triggerPctVal.toFixed(2)}%`;
      }

      // Row Creation
      const tr = h("tr", isTargetMet ? "is-target-met" : "");

      // TD: Symbol
      const tdSym = h("td", "");
      tdSym.style.fontWeight = "bold";
      tdSym.textContent = pos.symbol.replace("NSE:", "");
      tdSym.title = pos.symbol;

      // TD: Qty
      const tdQty = h("td", "val-numeric", String(pos.netQty));

      // TD: Buy (Avg price)
      const tdBuy = h("td", "val-numeric", formatPrice(pos.avgPrice));

      // TD: Trigr (Calculated SL)
      const tdTrigr = h("td", "val-numeric", formatPrice(targetSL));

      // TD: LTP
      const tdLtp = h("td", "val-numeric", formatPrice(pos.ltp));

      // TD: Trigr %
      const tdTrigrPct = h("td", "val-numeric");
      const spanPct = h("span", "fsl-trigger-percent", triggerPctText);
      if (isTargetMet) {
        spanPct.className = "fsl-trigger-percent fsl-trigger-percent-met";
      }
      tdTrigrPct.appendChild(spanPct);

      // TD: Result (Profit/Loss status text)
      const tdResult = h("td", "val-center");
      const spanResult = h("span", `fsl-status-text ${pnlVal >= 0 ? "fsl-status-profit" : "fsl-status-loss"}`, pnlVal >= 0 ? "Profit" : "Loss");
      tdResult.appendChild(spanResult);

      // TD: SL modification action
      const tdAction = h("td", "val-center");
      const moveBtn = h("button", "fsl-helper-move-sl", "↑", { type: "button" });
      
      if (!pos.hasProtectBtn) {
        moveBtn.disabled = true;
        moveBtn.title = "Protect button is not visible in row";
      } else {
        moveBtn.disabled = !isTargetMet;
        moveBtn.title = isTargetMet ? "Click to modify Stop Loss" : `Unrealized profit below ₹${state.targetProfit}`;
      }

      moveBtn.addEventListener("click", () => {
        if (targetSL) {
          handleMoveSL(pos, targetSL, moveBtn);
        }
      });

      tdAction.appendChild(moveBtn);

      tr.append(tdSym, tdQty, tdBuy, tdTrigr, tdLtp, tdTrigrPct, tdResult, tdAction);
      refs.tbody.appendChild(tr);
    });
  }

  // Periodic Polling loop (runs every 1.5 seconds)
  function startMonitoringLoop() {
    setInterval(() => {
      try {
        const positions = window.FyersSLDomHandler.getOpenPositions();
        state.activePositions = positions;
        
        // Re-render
        if (refs.panel.classList.contains("is-open")) {
          renderRows();
        } else {
          // Track alerts even if closed
          positions.forEach(pos => {
            const targetSL = window.FyersSLCalculator.calculateTargetSL(pos, state.targetProfit);
            const pnlVal = Number(pos.unrealizedPl) || 0;
            const isTargetMet = pnlVal >= state.targetProfit;

            if (isTargetMet && targetSL) {
              const lastAlerted = state.alertedSymbols.get(pos.symbol);
              if (lastAlerted !== state.targetProfit) {
                const speechMsg = `Stop Loss Alert. Profit target reached for ${pos.symbol.replace("NSE:", "").replace("-EQ", "")}. Target stop loss is ${targetSL.toFixed(2)}`;
                playVoiceAlert(speechMsg);
                state.alertedSymbols.set(pos.symbol, state.targetProfit);
              }
            } else {
              if (state.alertedSymbols.has(pos.symbol)) {
                state.alertedSymbols.delete(pos.symbol);
              }
            }
          });
        }
      } catch (err) {
        console.error("[Fyers SL Manager] Background check failed", err);
      }
    }, 1500);
  }

  // Bind Listeners
  refs.fab.addEventListener("click", togglePanel);
  refs.closeBtn.addEventListener("click", togglePanel);
  refs.refreshBtn.addEventListener("click", syncAndRender);

  // Target profit input
  refs.profitInput.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if (Number.isFinite(val) && val > 0) {
      state.targetProfit = val;
      chrome.storage.local.set({ [STORAGE_KEYS.targetProfit]: val });
      renderRows();
    }
  });

  // Voice checkbox
  refs.voiceCheckbox.addEventListener("change", (e) => {
    state.voiceAlerts = e.target.checked;
    chrome.storage.local.set({ [STORAGE_KEYS.voiceAlerts]: e.target.checked });
  });

  // Hide 0 checkbox
  refs.hide0Checkbox.addEventListener("change", (e) => {
    state.hideClosed = e.target.checked;
    chrome.storage.local.set({ [STORAGE_KEYS.hideClosed]: e.target.checked });
    renderRows();
  });

  // Auto-confirm checkbox
  refs.autoCheckbox.addEventListener("change", (e) => {
    state.autoConfirm = e.target.checked;
    chrome.storage.local.set({ [STORAGE_KEYS.autoConfirm]: e.target.checked });
  });

  // Shortcut Alt + S to open panel
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === "Escape" && refs.panel.classList.contains("is-open")) {
      togglePanel();
    }
  });

  // Init
  loadConfig().then(() => {
    loadPanelPosition();
    enablePanelDrag();
    setupSortListeners();
    startMonitoringLoop();
  });
})();
