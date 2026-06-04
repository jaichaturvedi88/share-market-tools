(function () {
  const HELPER_LOG_PREFIX = "[Fyers SL Manager DOM]";

  /**
   * Print debug logs in console.
   */
  function logDebug(message, data) {
    console.log(`${HELPER_LOG_PREFIX} ${message}`, data || "");
  }

  /**
   * Helper to wait for a given number of milliseconds.
   */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safe check for element visibility.
   */
  function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  /**
   * Safely check if element belongs to our extension.
   */
  function isExtensionElement(element) {
    return Boolean(element.closest("#fyers-sl-manager-root"));
  }

  /**
   * Dispatches events to simulate typing.
   */
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: element.value || element.textContent || ""
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Set native value on React/Vue-controlled input fields.
   */
  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  /**
   * Simulates full click sequence.
   */
  function simulateClick(element) {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  /**
   * Traverses deep shadow DOM to find elements.
   */
  function querySelectorAllDeep(root, selector) {
    const queryRoot = root && typeof root.querySelectorAll === "function" ? root : document;
    const matches = Array.from(queryRoot.querySelectorAll(selector));
    const elements = Array.from(queryRoot.querySelectorAll("*"));

    elements.forEach((element) => {
      if (!element.shadowRoot) return;
      matches.push(...querySelectorAllDeep(element.shadowRoot, selector));
    });

    return matches;
  }

  /**
   * Get all active document contexts (top + same-origin frames).
   */
  function getSearchDocuments() {
    const docs = [{ label: "top", doc: document, href: window.location.href }];
    const frames = Array.from(document.querySelectorAll("iframe, frame"));

    frames.forEach((frame, index) => {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc) {
          docs.push({
            label: `frame:${index}`,
            doc: frameDoc,
            href: frame.contentWindow?.location?.href || frame.src || ""
          });
        }
      } catch (error) {
        // Suppress cross-origin warnings
      }
    });

    return docs;
  }

  /**
   * Finds the Fyers positions table across all frames.
   */
  function findPositionsTable(searchDocs) {
    const selectors = [
      'table.positions',
      'table[data-name="Broker.positions-table"]',
      'table[class*="positions"]',
      'table' // general fallback if there's only one table
    ];

    for (const searchDoc of searchDocs) {
      for (const selector of selectors) {
        const tables = querySelectorAllDeep(searchDoc.doc, selector);
        for (const table of tables) {
          // Verify it's the positions table by looking for specific headers or structure
          const headerHTML = table.querySelector("thead")?.textContent || "";
          if (headerHTML.includes("Symbol") && (headerHTML.includes("Unrealized") || headerHTML.includes("P&L"))) {
            return { table, doc: searchDoc.doc };
          }
        }
      }
    }
    return null;
  }

  /**
   * Scrapes Fyers open positions from the table DOM.
   */
  function getOpenPositions() {
    const searchDocs = getSearchDocuments();
    const tableInfo = findPositionsTable(searchDocs);

    if (!tableInfo) {
      return [];
    }

    const { table } = tableInfo;
    const rows = Array.from(table.querySelectorAll("tbody.ka-tbody tr.ka-row, tbody tr"));
    const positions = [];

    rows.forEach((row) => {
      if (isExtensionElement(row)) return;

      // Extract symbol
      const symbolCell = row.querySelector('td[data-label="Symbol"]');
      const symbolBtn = symbolCell?.querySelector("button");
      const symbol = (symbolBtn?.textContent || symbolCell?.textContent || "").trim();

      if (!symbol || symbol.includes("Total") || symbol.includes("P&L")) {
        return; // Skip total/summary rows
      }

      // Extract other columns using data-label attributes
      const product = (row.querySelector('td[data-label="Product"]')?.textContent || "").trim();
      const side = (row.querySelector('td[data-label="Buy/Sell"]')?.textContent || "").trim();
      const netQtyStr = (row.querySelector('td[data-label="Net Qty"]')?.textContent || "").trim();
      const avgPriceStr = (row.querySelector('td[data-label="Avg Price"]')?.textContent || "").trim();
      const ltpStr = (row.querySelector('td[data-label="LTP"]')?.textContent || "").trim();
      const realizedPlStr = (row.querySelector('td[data-label="Realized P&L"]')?.textContent || "").trim();
      const unrealizedPlStr = (row.querySelector('td[data-label="Unrealized P&L"]')?.textContent || "").trim();

      // Convert to numeric types
      const netQty = window.FyersSLCalculator.toNumber(netQtyStr);
      const avgPrice = window.FyersSLCalculator.toNumber(avgPriceStr);
      const ltp = window.FyersSLCalculator.toNumber(ltpStr);
      const realizedPl = window.FyersSLCalculator.toNumber(realizedPlStr);
      const unrealizedPl = window.FyersSLCalculator.toNumber(unrealizedPlStr);

      // Find the protect settings button
      const protectBtn = row.querySelector(
        'button[data-name="edit-settings-cell-button"], button[title*="Protect"], button[aria-label*="Protect"]'
      );

      // We only track open positions (Net Qty != 0)
      if (Number.isFinite(netQty) && netQty !== 0) {
        positions.push({
          symbol,
          product,
          side,
          netQty,
          avgPrice,
          ltp,
          realizedPl,
          unrealizedPl,
          rowId: row.getAttribute("data-row-id") || symbol,
          hasProtectBtn: !!protectBtn
        });
      }
    });

    return positions;
  }

  /**
   * Helper to retrieve labels and placeholders for an input field to identify it.
   */
  function getInputLabelText(input, doc) {
    const labels = [];
    const id = input.getAttribute("id");

    if (id) {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (labelEl) {
        labels.push(labelEl.innerText);
      }
    }

    let parent = input;
    for (let i = 0; i < 4 && parent; i++) {
      labels.push(parent.innerText);
      labels.push(parent.getAttribute("aria-label"));
      labels.push(parent.getAttribute("placeholder"));
      labels.push(parent.getAttribute("name"));
      parent = parent.parentElement;
    }

    return labels.filter(Boolean).join(" ").toLowerCase();
  }

  /**
   * Automatically opens Fyers' position protect modal and populates the calculated Stop Loss.
   * 
   * @param {string} symbol - Symbol name (e.g. NSE:HCC-EQ)
   * @param {number} targetSL - Calculated SL Price (e.g. 24.40)
   * @param {boolean} autoConfirm - Whether to automatically click click Modify button
   * @returns {Promise<Object>} Status result
   */
  async function triggerSLModification(symbol, targetSL, autoConfirm) {
    logDebug(`Triggering SL modification for ${symbol} to target SL ${targetSL}`);

    const searchDocs = getSearchDocuments();
    const tableInfo = findPositionsTable(searchDocs);
    if (!tableInfo) {
      return { ok: false, error: "Positions table not found on page." };
    }

    const { table, doc } = tableInfo;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    let targetRow = null;

    for (const row of rows) {
      const symbolCell = row.querySelector('td[data-label="Symbol"]');
      const symbolText = (symbolCell?.textContent || "").trim();
      if (symbolText.includes(symbol)) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      return { ok: false, error: `Could not find positions table row for ${symbol}.` };
    }

    const protectBtn = targetRow.querySelector(
      'button[data-name="edit-settings-cell-button"], button[title*="Protect"], button[aria-label*="Protect"]'
    );

    if (!protectBtn) {
      return { ok: false, error: `Could not find Protect/Edit button for ${symbol}.` };
    }

    // 1. Click the protect button to open modal
    simulateClick(protectBtn);
    logDebug(`Clicked protect button. Waiting for modal inputs...`);

    // 2. Poll for the inputs to appear in the DOM
    let slInputFields = [];
    let submitBtn = null;
    let found = false;

    // Check up to 15 times (3 seconds total)
    for (let attempt = 0; attempt < 15; attempt++) {
      await wait(200);

      // Search for inputs in all frames
      const currentDocs = getSearchDocuments();
      slInputFields = [];
      submitBtn = null;

      for (const item of currentDocs) {
        const inputs = querySelectorAllDeep(item.doc, "input");
        inputs.forEach((input) => {
          if (!isElementVisible(input) || isExtensionElement(input)) return;

          const descriptionText = getInputLabelText(input, item.doc);
          const isSLInput = descriptionText.includes("stop loss") || 
                            descriptionText.includes("trigger price") || 
                            descriptionText.includes("stop-loss") || 
                            descriptionText.includes("stoploss") || 
                            (descriptionText.includes("sl") && !descriptionText.includes("sltp"));

          if (isSLInput) {
            slInputFields.push({ input, doc: item.doc });
          }
        });

        // Search for submit/modify button
        const buttons = querySelectorAllDeep(item.doc, "button, input[type='button'], input[type='submit']");
        buttons.forEach((btn) => {
          if (!isElementVisible(btn) || isExtensionElement(btn)) return;
          const text = (btn.innerText || btn.textContent || btn.value || "").toLowerCase();
          if (text.includes("modify") || text.includes("protect") || text.includes("submit") || text.includes("save") || text.includes("confirm")) {
            submitBtn = btn;
          }
        });
      }

      if (slInputFields.length > 0) {
        found = true;
        break;
      }
    }

    if (!found || slInputFields.length === 0) {
      return { ok: false, error: "Protect modal opened, but Stop Loss input fields could not be found." };
    }

    logDebug(`Found ${slInputFields.length} SL input fields. Populating...`);

    // 3. Fill the Stop Loss input fields
    slInputFields.forEach(({ input }) => {
      input.focus();
      setNativeValue(input, targetSL.toFixed(2));
      dispatchInputEvents(input);
      
      // Visual feedback in the DOM
      input.style.transition = "background-color 0.3s ease";
      input.style.backgroundColor = "rgba(8, 153, 129, 0.25)"; // green tint
      input.style.border = "2px solid rgb(8, 153, 129)";
    });

    await wait(300);

    // 4. Auto confirm if checked, else alert user to complete manually
    if (autoConfirm && submitBtn) {
      logDebug(`Auto-confirm enabled. Clicking submit button...`);
      simulateClick(submitBtn);
      return { ok: true, msg: `Stop Loss price ${targetSL} filled and order submitted automatically!` };
    } else {
      logDebug(`Auto-confirm disabled. Input filled. Waiting for manual confirm.`);
      return { ok: true, msg: `Stop Loss price ${targetSL} filled! Please review and click Modify.` };
    }
  }

  // Bind to window for integration
  window.FyersSLDomHandler = {
    getOpenPositions,
    triggerSLModification
  };
})();
