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

  const LONG_POSITION_FIELDS = {
    buyPrice: "Risk/RewardlongEntryPrice",
    targetPrice: "Risk/RewardlongProfitLevelPrice",
    stopLoss: "Risk/RewardlongStopLevelPrice"
  };

  const SHORT_POSITION_FIELDS = {
    buyPrice: "Risk/RewardshortEntryPrice",
    targetPrice: "Risk/RewardshortProfitLevelPrice",
    stopLoss: "Risk/RewardshortStopLevelPrice"
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
    return Boolean(element.closest("#foc-root"));
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

  function clickElement(element) {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function getOrderRoot() {
    return document.querySelector("#tradefromdhan-modal.show, #tradefromdhan-modal, .modal.show") || document;
  }

  function getQueryableRoot(root) {
    return root && typeof root.querySelectorAll === "function" ? root : document;
  }

  function querySelectorAllDeep(root, selector) {
    const queryRoot = getQueryableRoot(root);
    const matches = Array.from(queryRoot.querySelectorAll(selector));
    const elements = Array.from(queryRoot.querySelectorAll("*"));

    elements.forEach((element) => {
      if (!element.shadowRoot) {
        return;
      }

      matches.push(...querySelectorAllDeep(element.shadowRoot, selector));
    });

    return matches;
  }

  function querySelectorAllDocuments(selector) {
    return getSearchDocuments()
      .flatMap((item) => querySelectorAllDeep(item.doc, selector));
  }

  function getClickableElements(root) {
    return querySelectorAllDeep(root, "button, [role='button'], a, label, [tabindex]")
      .filter((element) => isVisible(element) && !isExtensionElement(element));
  }

  function clickByText(words, root) {
    const candidates = getClickableElements(root);
    const exact = candidates.find((element) => words.includes(textOf(element)));
    const partial = candidates.find((element) => words.some((word) => textOf(element).includes(word)));
    const target = exact || partial;

    if (!target) {
      return false;
    }

    clickElement(target);
    return true;
  }

  function clickFirstVisible(selectors, root) {
    for (const selector of selectors) {
      const element = querySelectorAllDeep(root, selector)
        .find((candidate) => isVisible(candidate) && !isExtensionElement(candidate));

      if (element) {
        debugLog(`Clicked selector: ${selector}`, {
          text: element.textContent || "",
          className: element.className || ""
        });
        clickElement(element);
        return true;
      }
    }

    return false;
  }

  function isActiveElement(element) {
    return Boolean(element && (element.classList?.contains("active") || element.getAttribute("aria-selected") === "true"));
  }

  async function clickAndWaitActive(selectors, label, rootGetter) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const root = rootGetter ? rootGetter() : document;
      const element = selectors
        .flatMap((selector) => querySelectorAllDeep(root, selector))
        .find((candidate) => isVisible(candidate) && !isExtensionElement(candidate));

      if (!element) {
        await wait(150);
        continue;
      }

      if (!isActiveElement(element)) {
        clickElement(element);
      }

      await wait(300);
      debugLog(`${label} selection checked`, {
        attempt,
        active: isActiveElement(element),
        text: element.textContent || "",
        className: element.className || ""
      });

      if (isActiveElement(element)) {
        return true;
      }
    }

    return clickFirstVisible(selectors, rootGetter ? rootGetter() : document);
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event("focus", { bubbles: true }));
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: element.value || element.textContent || ""
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setNativeValue(element, value) {
    const valueText = String(value);
    const prototype = Object.getPrototypeOf(element);
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    const elementDescriptor = Object.getOwnPropertyDescriptor(element, "value");

    if (prototypeDescriptor?.set && elementDescriptor?.set !== prototypeDescriptor.set) {
      prototypeDescriptor.set.call(element, valueText);
    } else if (prototypeDescriptor?.set) {
      prototypeDescriptor.set.call(element, valueText);
    } else {
      element.value = valueText;
    }

    element.setAttribute("value", valueText);
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
    const root = getOrderRoot();
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

  async function waitForOrderInputCount(minCount) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const inputs = getOrderTicketInputs();
      if (inputs.length >= minCount) {
        return true;
      }

      await wait(250);
    }

    return false;
  }

  function fillInputElement(input, value, fieldName) {
    if (!input) {
      debugLog("Order ticket field missing", { fieldName, value });
      return false;
    }

    const valueText = String(value);
    clickElement(input);
    input.focus();

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

  function findDrawingToolInput(propertyId) {
    return querySelectorAllDocuments(`input[data-property-id="${propertyId}"]`)
      .find((input) => isVisible(input) && !isExtensionElement(input));
  }

  function openDrawingToolSettingsDialog() {
    const settingsButton = querySelectorAllDocuments('.floating-toolbar-react-widgets [data-name="settings"], [class*="floating-toolbar"] [data-name="settings"]')
      .find((el) => isVisible(el) && !isExtensionElement(el));

    if (settingsButton) {
      debugLog("Found drawing settings button, clicking it", settingsButton);
      clickElement(settingsButton);
      return true;
    }

    // Fallback: search for any visible [data-name="settings"] that is not an indicator settings button
    const fallbackButton = querySelectorAllDocuments('[data-name="settings"]')
      .find((el) => {
        if (!isVisible(el) || isExtensionElement(el)) return false;
        if (el.closest('[class*="legend"], [class*="status-line"]')) return false;
        return true;
      });

    if (fallbackButton) {
      debugLog("Found fallback drawing settings button, clicking it", fallbackButton);
      clickElement(fallbackButton);
      return true;
    }

    debugLog("Drawing settings button not found");
    return false;
  }

  async function waitForDrawingToolInputs() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const longBuy = findDrawingToolInput(LONG_POSITION_FIELDS.buyPrice);
      const longTarget = findDrawingToolInput(LONG_POSITION_FIELDS.targetPrice);
      const longStop = findDrawingToolInput(LONG_POSITION_FIELDS.stopLoss);
      if (longBuy && longTarget && longStop) {
        return { type: "long", buyPriceInput: longBuy, targetInput: longTarget, stopLossInput: longStop };
      }

      const shortBuy = findDrawingToolInput(SHORT_POSITION_FIELDS.buyPrice);
      const shortTarget = findDrawingToolInput(SHORT_POSITION_FIELDS.targetPrice);
      const shortStop = findDrawingToolInput(SHORT_POSITION_FIELDS.stopLoss);
      if (shortBuy && shortTarget && shortStop) {
        return { type: "short", buyPriceInput: shortBuy, targetInput: shortTarget, stopLossInput: shortStop };
      }

      await wait(250);
    }

    const longBuy = findDrawingToolInput(LONG_POSITION_FIELDS.buyPrice);
    const longTarget = findDrawingToolInput(LONG_POSITION_FIELDS.targetPrice);
    const longStop = findDrawingToolInput(LONG_POSITION_FIELDS.stopLoss);
    if (longBuy && longTarget && longStop) {
      return { type: "long", buyPriceInput: longBuy, targetInput: longTarget, stopLossInput: longStop };
    }

    const shortBuy = findDrawingToolInput(SHORT_POSITION_FIELDS.buyPrice);
    const shortTarget = findDrawingToolInput(SHORT_POSITION_FIELDS.targetPrice);
    const shortStop = findDrawingToolInput(SHORT_POSITION_FIELDS.stopLoss);
    if (shortBuy && shortTarget && shortStop) {
      return { type: "short", buyPriceInput: shortBuy, targetInput: shortTarget, stopLossInput: shortStop };
    }

    return null;
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
    console.log(`[Fyers One Click] ${message}`, data || "");
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

  function findCustomBuyButton() {
    const candidates = querySelectorAllDocuments('div[class*="customButton-"], [class*="customButton-"]')
      .filter((el) => isVisible(el) && !isExtensionElement(el));

    const buyButton = candidates.find((el) => {
      const rect = el.querySelector('rect[fill="#2962FF"], rect[fill="#22ab94"], rect[fill="#089981"]');
      return !!rect;
    });

    return buyButton || candidates[0];
  }

  async function openBuyOrderWindow() {
    const customBuy = findCustomBuyButton();
    if (customBuy) {
      debugLog("Found custom buy button, clicking it", customBuy);
      clickElement(customBuy);
      await wait(500);
      return;
    }

    const clickedBuy = clickByText(CLICK_TEXTS.buy);
    if (!clickedBuy) {
      clickByText(CLICK_TEXTS.order);
      await wait(250);
      clickByText(CLICK_TEXTS.buy);
    }

    await wait(500);
  }

  async function prepareTrade(trade) {
    debugLog("Prepare trade started", trade);
    await openBuyOrderWindow();
    const orderRoot = getOrderRoot();
    debugLog("Order root resolved", {
      tagName: orderRoot.tagName || "document",
      id: orderRoot.id || "",
      customProducts: querySelectorAllDeep(orderRoot, "custom-tfd-orderproducts").map((element) => ({
        id: element.id,
        selectedItem: element.getAttribute("selected-item")
      })),
      investingButtons: querySelectorAllDeep(orderRoot, '[data-itemname="C"]').length,
      superBetaButtons: querySelectorAllDeep(orderRoot, '[data-itemname="VTT"]').length
    });

    const investingSelected = await clickAndWaitActive([
      'button.tfdProductbutton[data-itemname="C"]',
      'button[data-itemname="C"]',
      '.tfdProductbutton[data-itemname="C"]'
    ], "Investing", getOrderRoot) || clickByText(["investing"], orderRoot);
    await wait(500);
    const superBetaSelected = await clickAndWaitActive([
      'button.orderButton[data-itemname="VTT"]',
      'button[data-itemname="VTT"]',
      '.orderButton[data-itemname="VTT"]'
    ], "Super beta", getOrderRoot) || clickByText(["superbeta", "super beta"], getOrderRoot);
    await wait(700);
    const limitChecked = checkCheckbox(["limit price"]);
    await wait(300);
    const superBetaInputsReady = await waitForOrderInputCount(4);

    const filled = {
      investing: investingSelected,
      superBeta: superBetaSelected,
      limitPrice: limitChecked,
      superBetaInputs: superBetaInputsReady
    };

    if (superBetaInputsReady) {
      const positionalFields = await fillOrderTicketByPosition(trade);
      if (positionalFields) {
        Object.assign(filled, positionalFields);
      }
    }

    const missing = Object.entries(filled)
      .filter(([, wasFilled]) => !wasFilled)
      .map(([name]) => name);

    const buyButton = querySelectorAllDeep(orderRoot, 'button#tfdbuysellbutton, button.tfdbuybutton, #tfdbuysellbutton')
      .find((btn) => isVisible(btn) && !isExtensionElement(btn));
    if (buyButton) {
      buyButton.focus();
      debugLog("Focused order form buy/sell button", buyButton);
    }

    return {
      ok: missing.length === 0,
      missing
    };
  }

  function findSubmitButton() {
    return querySelectorAllDocuments('button')
      .find((button) => {
        if (!isVisible(button) || isExtensionElement(button)) return false;
        const text = button.textContent.trim().toLowerCase();
        return text === "ok" || text === "submit" || button.name === "submit" || button.getAttribute("data-name") === "submit-button";
      });
  }

  async function prepareDrawingToolLevels(trade) {
    debugLog("Prepare drawing tool levels started", trade);

    // Step 1: Check if inputs are already visible
    let inputs = null;
    const longBuy = findDrawingToolInput(LONG_POSITION_FIELDS.buyPrice);
    const longTarget = findDrawingToolInput(LONG_POSITION_FIELDS.targetPrice);
    const longStop = findDrawingToolInput(LONG_POSITION_FIELDS.stopLoss);
    if (longBuy && longTarget && longStop) {
      inputs = { type: "long", buyPriceInput: longBuy, targetInput: longTarget, stopLossInput: longStop };
    } else {
      const shortBuy = findDrawingToolInput(SHORT_POSITION_FIELDS.buyPrice);
      const shortTarget = findDrawingToolInput(SHORT_POSITION_FIELDS.targetPrice);
      const shortStop = findDrawingToolInput(SHORT_POSITION_FIELDS.stopLoss);
      if (shortBuy && shortTarget && shortStop) {
        inputs = { type: "short", buyPriceInput: shortBuy, targetInput: shortTarget, stopLossInput: shortStop };
      }
    }

    if (!inputs) {
      debugLog("Drawing tool settings dialog not open. Opening it...");
      openDrawingToolSettingsDialog();
      inputs = await waitForDrawingToolInputs();
    }

    if (!inputs) {
      return {
        ok: false,
        error: "No active Drawing Tool (Long/Short Position) settings dialog visible."
      };
    }

    // Step 2: Fill form with delays so React/TradingView handles state changes
    const filled = {};
    filled.buyPrice = fillInputElement(inputs.buyPriceInput, trade.buyPrice, `${inputs.type} position entry price`);
    await wait(150);
    filled.targetPrice = fillInputElement(inputs.targetInput, trade.targetPrice, `${inputs.type} position profit price`);
    await wait(150);
    filled.stopLoss = fillInputElement(inputs.stopLossInput, trade.stopLoss, `${inputs.type} position stop price`);
    await wait(150);

    // Blur the stop loss input to trigger final updates
    try {
      inputs.stopLossInput.blur();
    } catch (e) {}
    await wait(150);

    const missing = Object.entries(filled)
      .filter(([, wasFilled]) => !wasFilled)
      .map(([name]) => name);

    // Step 3: Click ok
    const submitButton = findSubmitButton();
    if (submitButton) {
      submitButton.focus();
      await wait(150);
      debugLog("Found submit button, clicking it", submitButton);
      clickElement(submitButton);
    }

    return {
      ok: missing.length === 0,
      missing
    };
  }

  window.FyersOCODomHandler = {
    getActiveWatchlistScrip,
    prepareDrawingToolLevels,
    prepareTrade
  };
})();
