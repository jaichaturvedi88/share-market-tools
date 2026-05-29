(function () {
  const CLICK_TEXTS = {
    buy: ["buy"],
    order: ["order", "place order", "create order", "trade"]
  };

  const FIELD_HINTS = {
    quantity: ["qty", "quantity"],
    price: ["limit price", "price", "buy price"],
    stopLoss: ["sl", "stop loss", "stoploss", "trigger"],
    target: ["target", "profit"]
  };

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function isExtensionElement(element) {
    return Boolean(element.closest("#dhan-fast-trade-root"));
  }

  function textOf(element) {
    return normalize([
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid")
    ].filter(Boolean).join(" "));
  }

  function getClickableElements() {
    return Array.from(document.querySelectorAll("button, [role='button'], a, label, [tabindex]"))
      .filter((element) => isVisible(element) && !isExtensionElement(element));
  }

  function clickByText(words) {
    const candidates = getClickableElements();
    const exact = candidates.find((element) => words.includes(textOf(element)));
    const partial = candidates.find((element) => words.some((word) => textOf(element).includes(word)));
    const target = exact || partial;

    if (!target) {
      return false;
    }

    target.click();
    return true;
  }

  function clickFirstVisible(selectors) {
    for (const selector of selectors) {
      const element = Array.from(document.querySelectorAll(selector))
        .find((candidate) => isVisible(candidate) && !isExtensionElement(candidate));

      if (element) {
        debugLog(`Clicked selector: ${selector}`, {
          text: element.textContent || "",
          className: element.className || ""
        });
        element.click();
        return true;
      }
    }

    return false;
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: element.value || element.textContent || ""
    }));
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function labelTextFor(input) {
    const labels = [];
    const id = input.getAttribute("id");

    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) {
        labels.push(label.innerText);
      }
    }

    let current = input;
    for (let index = 0; index < 4 && current; index += 1) {
      labels.push(current.innerText);
      labels.push(current.getAttribute("aria-label"));
      labels.push(current.getAttribute("placeholder"));
      labels.push(current.getAttribute("name"));
      labels.push(current.getAttribute("data-testid"));
      current = current.parentElement;
    }

    return normalize(labels.filter(Boolean).join(" "));
  }

  function getInputs() {
    return Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"))
      .filter((element) => isVisible(element) && !isExtensionElement(element));
  }

  function findInputByHints(hints) {
    const inputs = getInputs();
    return inputs.find((input) => hints.some((hint) => labelTextFor(input).includes(hint)));
  }

  function fillField(hints, value) {
    const input = findInputByHints(hints);
    if (!input) {
      debugLog("Fill field failed", { hints, value });
      return false;
    }

    input.focus();
    const valueText = String(value);

    if (input.isContentEditable) {
      input.textContent = valueText;
    } else {
      setNativeValue(input, valueText);
    }

    dispatchInputEvents(input);
    debugLog("Filled field", {
      hints,
      value: valueText,
      label: labelTextFor(input)
    });
    return true;
  }

  function getOrderTicketInputs() {
    const root = document.querySelector("#tradefromdhan-modal.show, #tradefromdhan-modal, .modal.show") || document;
    const inputs = Array.from(root.querySelectorAll("input"))
      .filter((input) => {
        const type = normalize(input.getAttribute("type"));
        return type !== "checkbox" && type !== "radio" && type !== "hidden" && isVisible(input) && !isExtensionElement(input);
      });

    debugLog("Order ticket visible inputs", inputs.map((input, index) => ({
      index,
      value: input.value,
      type: input.getAttribute("type") || "",
      label: labelTextFor(input),
      className: input.className || ""
    })));

    return inputs;
  }

  function fillInputElement(input, value, fieldName) {
    if (!input) {
      debugLog("Order ticket field missing", { fieldName, value });
      return false;
    }

    input.focus();
    const valueText = String(value);

    if (input.isContentEditable) {
      input.textContent = valueText;
    } else {
      setNativeValue(input, valueText);
    }

    dispatchInputEvents(input);
    debugLog("Filled order ticket field", {
      fieldName,
      value: valueText,
      label: labelTextFor(input)
    });
    return true;
  }

  async function fillOrderTicketByPosition(trade) {
    const inputs = getOrderTicketInputs();

    if (inputs.length < 4) {
      debugLog("Not enough visible order inputs for positional fill", { count: inputs.length });
      return null;
    }

    const filled = {};
    filled.quantity = fillInputElement(inputs[0], trade.quantity, "quantity");
    await wait(160);
    filled.price = fillInputElement(inputs[1], trade.buyPrice, "limit price");
    await wait(160);
    filled.target = fillInputElement(inputs[2], trade.targetPrice, "target");
    await wait(160);
    filled.stopLoss = fillInputElement(inputs[3], trade.stopLoss, "stop loss");
    return filled;
  }

  function findCheckboxByHints(hints) {
    const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter((element) => isVisible(element) && !isExtensionElement(element));

    return inputs.find((input) => hints.some((hint) => labelTextFor(input).includes(hint)));
  }

  function checkCheckbox(hints) {
    const checkbox = findCheckboxByHints(hints);

    if (!checkbox) {
      return clickByText(hints);
    }

    if (!checkbox.checked) {
      checkbox.click();
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  }

  async function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function parsePrice(value) {
    const number = Number(String(value || "").replace(/,/g, "").replace(/\u2212/g, "-").replace(/\s/g, "").trim());
    return Number.isFinite(number) ? number : NaN;
  }

  function debugLog(message, data) {
    console.log(`[Dhan Fast Trade] ${message}`, data || "");
  }

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
        debugLog(`Frame skipped: ${index}`, {
          src: frame.src,
          error: error.message
        });
      }
    });

    debugLog("Search documents", docs.map((item) => ({
      label: item.label,
      href: item.href,
      symbolRows: item.doc.querySelectorAll("[data-symbol-short]").length,
      activeRows: item.doc.querySelectorAll('[data-active="true"]').length,
      selectedRows: item.doc.querySelectorAll('[data-selected="true"]').length
    })));

    return docs;
  }

  function findActiveWatchlistRow(searchDocs) {
    const selectors = [
      '.widgetbar-widget-watchlist [data-active="true"][data-symbol-short]',
      '[data-name="symbol-list-wrap"] [data-active="true"][data-symbol-short]',
      '[data-active="true"][data-symbol-short]',
      '.widgetbar-widget-watchlist [data-selected="true"][data-symbol-short]',
      '[data-name="symbol-list-wrap"] [data-selected="true"][data-symbol-short]',
      '[data-selected="true"][data-symbol-short]',
      '.widgetbar-widget-watchlist [class*="active-"][data-symbol-short]',
      '[class*="active-"][data-symbol-short]'
    ];

    for (const searchDoc of searchDocs) {
      for (const selector of selectors) {
        const row = searchDoc.doc.querySelector(selector);
        debugLog(`Selector checked: ${selector}`, {
          document: searchDoc.label,
          found: Boolean(row),
          symbol: row?.getAttribute("data-symbol-short") || ""
        });

        if (row) {
          return row;
        }
      }
    }

    return null;
  }

  function findLtpElement(row) {
    const selectors = [
      ".cell-RsFlttSS.last-RsFlttSS .inner-RsFlttSS",
      ".last-RsFlttSS .inner-RsFlttSS",
      ".cell-RsFlttSS.last-RsFlttSS",
      "[class*='last-'] [class*='inner-']",
      "[class*='last-']"
    ];

    for (const selector of selectors) {
      const element = row.querySelector(selector);
      debugLog(`LTP selector checked: ${selector}`, {
        found: Boolean(element),
        text: element?.textContent || ""
      });

      if (element) {
        return element;
      }
    }

    return null;
  }

  function getActiveWatchlistScrip() {
    const searchDocs = getSearchDocuments();
    const watchlistRows = searchDocs.flatMap((item) => Array.from(item.doc.querySelectorAll("[data-symbol-short]")));
    const activeRows = searchDocs.flatMap((item) => Array.from(item.doc.querySelectorAll('[data-active="true"]')));
    const selectedRows = searchDocs.flatMap((item) => Array.from(item.doc.querySelectorAll('[data-selected="true"]')));

    debugLog("Fetch LTP started", {
      href: window.location.href,
      documents: searchDocs.length,
      symbolRows: watchlistRows.length,
      activeRows: activeRows.length,
      selectedRows: selectedRows.length
    });

    const activeRow = findActiveWatchlistRow(searchDocs);

    if (!activeRow) {
      debugLog("No active watchlist row found. First symbol rows:", Array.from(watchlistRows).slice(0, 5).map((row) => ({
        symbol: row.getAttribute("data-symbol-short"),
        active: row.getAttribute("data-active"),
        selected: row.getAttribute("data-selected"),
        classes: row.className
      })));

      return {
        ok: false,
        error: "No active watchlist row found."
      };
    }

    const symbol = activeRow.getAttribute("data-symbol-short") || "";
    const ltpElement = findLtpElement(activeRow);
    const ltp = parsePrice(ltpElement?.textContent);

    debugLog("Active row resolved", {
      symbol,
      dataActive: activeRow.getAttribute("data-active"),
      dataSelected: activeRow.getAttribute("data-selected"),
      ltpText: ltpElement?.textContent || "",
      ltp
    });

    if (!symbol.trim()) {
      return {
        ok: false,
        error: "Active watchlist symbol was empty."
      };
    }

    if (!Number.isFinite(ltp) || ltp <= 0) {
      return {
        ok: false,
        error: "Could not read LTP from the active watchlist row."
      };
    }

    return {
      ok: true,
      symbol: symbol.trim().toUpperCase(),
      ltp
    };
  }

  async function openBuyOrderWindow() {
    const clickedBuy = clickByText(CLICK_TEXTS.buy);
    if (!clickedBuy) {
      clickByText(CLICK_TEXTS.order);
      await wait(250);
      clickByText(CLICK_TEXTS.buy);
    }

    await wait(500);
  }

  async function prepareTrade(trade) {
    await openBuyOrderWindow();
    const investingSelected = clickFirstVisible([
      'button.tfdProductbutton[data-itemname="C"]',
      'button[data-itemname="C"]',
      '.tfdProductbutton[data-itemname="C"]'
    ]) || clickByText(["investing"]);
    await wait(250);
    const superBetaSelected = clickByText(["super beta"]);
    await wait(250);
    const limitChecked = checkCheckbox(["limit price"]);
    await wait(150);

    const filled = {
      investing: investingSelected,
      superBeta: superBetaSelected,
      limitPrice: limitChecked
    };

    const positionalFields = await fillOrderTicketByPosition(trade);
    if (positionalFields) {
      Object.assign(filled, positionalFields);
    } else {
      filled.quantity = fillField(FIELD_HINTS.quantity, trade.quantity);
      await wait(180);
      filled.price = fillField(FIELD_HINTS.price, trade.buyPrice);
      await wait(180);
      filled.target = fillField(FIELD_HINTS.target, trade.targetPrice);
      await wait(180);
      filled.stopLoss = fillField(FIELD_HINTS.stopLoss, trade.stopLoss);
    }

    const missing = Object.entries(filled)
      .filter(([, wasFilled]) => !wasFilled)
      .map(([name]) => name);

    return {
      ok: missing.length === 0,
      missing
    };
  }

  window.DhanOrderDomHandler = {
    getActiveWatchlistScrip,
    prepareTrade
  };
})();
