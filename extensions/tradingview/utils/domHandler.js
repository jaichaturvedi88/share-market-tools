(function () {
  function isVisible(element) {
    if (!element) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function isExtensionElement(element) {
    return Boolean(element.closest("#tv-fast-trade-root"));
  }

  function querySelectorAllDeep(root, selector) {
    const queryRoot = root && typeof root.querySelectorAll === "function" ? root : document;
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

  function getSearchDocuments() {
    const docs = [{ doc: document }];
    const frames = Array.from(document.querySelectorAll("iframe, frame"));

    frames.forEach((frame) => {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc) {
          docs.push({ doc: frameDoc });
        }
      } catch (error) {
        // Skip cross-origin frames
      }
    });

    return docs;
  }

  function querySelectorAllDocuments(selector) {
    return getSearchDocuments()
      .flatMap((item) => querySelectorAllDeep(item.doc, selector));
  }

  function fetchBuyPrice() {
    // 1. Try finding Limit Price input first
    const limitInput = querySelectorAllDocuments('input[data-qa-id*="price-input"], input[data-qa-id*="limit-price"]')
      .find(el => isVisible(el) && !isExtensionElement(el));
    if (limitInput && limitInput.value) {
      const price = parseFloat(limitInput.value.replace(/,/g, ''));
      if (Number.isFinite(price) && price > 0) {
        return price;
      }
    }

    // 2. Try the quantity dropdown button value divided by quantity
    const btn = querySelectorAllDocuments('button[data-qa-id="quantity-input-equivalent-dropdown-button"]')
      .find(el => isVisible(el) && !isExtensionElement(el));
    if (btn) {
      const qtyInput = querySelectorAllDocuments('input[data-qa-id*="quantity-field"], input[data-qa-id*="quantity-input"], input[data-qa-id*="qty-input"], input[name*="qty"], input[name*="quantity"], input[id="quantity-field"]')
        .find(el => isVisible(el) && !isExtensionElement(el));
      const valSpan = btn.querySelector('[class*="value-"]');
      const totalValue = valSpan ? parseFloat(valSpan.textContent.replace(/,/g, '')) : parseFloat(btn.textContent.replace(/[^0-9.]/g, ''));
      const qty = qtyInput ? parseFloat(qtyInput.value.replace(/,/g, '')) : 100;
      if (Number.isFinite(totalValue) && Number.isFinite(qty) && qty > 0) {
        return totalValue / qty;
      }
    }

    // 3. Fallback: Ask/Bid buttons
    const buyBtn = querySelectorAllDocuments('[class*="buyButton-"], [data-qa-id*="buy-button"], [class*="buy-button"]')
      .find(el => isVisible(el) && !isExtensionElement(el));
    if (buyBtn) {
      const num = parseFloat(buyBtn.textContent.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(num) && num > 0) {
        return num;
      }
    }

    return null;
  }

  function findToggleFor(labelText) {
    const elements = querySelectorAllDocuments('span, div, label, p');
    const label = elements.find(el => el.textContent.trim().toLowerCase().includes(labelText.toLowerCase()) && isVisible(el) && !isExtensionElement(el));
    if (!label) {
      return null;
    }

    let parent = label.parentElement;
    for (let i = 0; i < 3; i++) {
      if (!parent) {
        break;
      }
      const checkbox = parent.querySelector('input[type="checkbox"], [role="checkbox"], [role="switch"], button[class*="switch"], div[class*="switch"], [class*="toggle"] input');
      if (checkbox) {
        return checkbox;
      }
      const siblingToggle = parent.querySelector('button[role="switch"], [class*="toggle-button"], [class*="switch"]');
      if (siblingToggle) {
        return siblingToggle;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function enableToggle(labelText) {
    const toggle = findToggleFor(labelText);
    if (toggle) {
      const isChecked = toggle.checked || toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('checked') || toggle.classList.contains('active');
      if (!isChecked) {
        toggle.click();
        return true;
      }
    }
    return false;
  }

  function ensureExitsEnabled() {
    enableToggle("Take profit");
    enableToggle("Stop loss");
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

  function fillInputElement(input, value, name) {
    if (!input) {
      return false;
    }
    input.focus();
    setNativeValue(input, value);
    dispatchInputEvents(input);
    return true;
  }

  async function fillOrderTicket(trade) {
    ensureExitsEnabled();
    await new Promise(r => setTimeout(r, 250)); // Wait for inputs to render

    const qtyInput = querySelectorAllDocuments('input[data-qa-id*="quantity-field"], input[data-qa-id*="quantity-input"], input[data-qa-id*="qty-input"], input[name*="qty"], input[name*="quantity"], input[id="quantity-field"]')
      .find(el => isVisible(el) && !isExtensionElement(el));

    const tpInput = querySelectorAllDocuments('input[data-qa-id*="take-profit-input"]')
      .find(el => isVisible(el) && !isExtensionElement(el));

    const slInput = querySelectorAllDocuments('input[data-qa-id*="stop-loss-input"]')
      .find(el => isVisible(el) && !isExtensionElement(el));

    const filled = {
      qty: fillInputElement(qtyInput, trade.quantity, "quantity"),
      tp: fillInputElement(tpInput, trade.targetPrice.toFixed(2), "take profit"),
      sl: fillInputElement(slInput, trade.stopLoss.toFixed(2), "stop loss")
    };

    return {
      ok: Object.values(filled).every(Boolean),
      filled
    };
  }

  function clickElement(element) {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function clickBuyButton() {
    // 1. Try finding explicitly by place-and-modify-button (Buy)
    let btn = querySelectorAllDocuments('[data-name="place-and-modify-button"]')
      .find(el => isVisible(el) && !isExtensionElement(el));

    // 2. Try finding by data-qa-id next
    if (!btn) {
      btn = querySelectorAllDocuments('[data-qa-id*="submit"], [data-qa-id*="buy-button"], [data-qa-id*="place-order"]')
        .find(el => isVisible(el) && !isExtensionElement(el));
    }
      
    if (btn) {
      const clickable = btn.closest('button, [role="button"], a, [tabindex]') || btn;
      clickElement(clickable);
      return true;
    }

    // 2. Try finding by text content in order of specificity
    const searchTexts = ["start creating order", "place order", "submit"];
    for (const text of searchTexts) {
      const textEl = querySelectorAllDocuments('button, [role="button"], span, div, a')
        .find((el) => {
          if (!isVisible(el) || isExtensionElement(el)) return false;
          const content = el.textContent.trim().toLowerCase();
          return content === text || content.includes(text);
        });

      if (textEl) {
        const clickable = textEl.closest('button, [role="button"], a, [tabindex]') || textEl;
        clickElement(clickable);
        return true;
      }
    }

    // 3. Try matching "buy" or "sell" prefixes or words
    const buySellEl = querySelectorAllDocuments('button, [role="button"], span, div, a')
      .find((el) => {
        if (!isVisible(el) || isExtensionElement(el)) return false;
        const content = el.textContent.trim().toLowerCase();
        
        if (content === 'buy' || content === 'sell') {
          return true;
        }
        
        if (content.startsWith('buy ') || content.startsWith('sell ')) {
          return true;
        }
        
        if (/\b(buy|sell)\b/.test(content)) {
          if (content.includes('price') || content.includes('limit') || content.includes('stop')) {
            return false;
          }
          return true;
        }
        
        return false;
      });

    if (buySellEl) {
      const clickable = buySellEl.closest('button, [role="button"], a, [tabindex]') || buySellEl;
      clickElement(clickable);
      return true;
    }

    return false;
  }

  function switchTradeSide(side) {
    const term = side.toLowerCase(); // 'buy' or 'sell'
    
    // 1. Try finding explicitly by data-name attribute as per elements.txt
    let tab = querySelectorAllDocuments(`[data-name="side-control-${term}"]`)
      .find(el => isVisible(el) && !isExtensionElement(el));

    // 2. Try finding by QA ID next
    if (!tab) {
      tab = querySelectorAllDocuments(`[data-qa-id*="side-${term}"], [data-qa-id*="${term}-tab"]`)
        .find(el => isVisible(el) && !isExtensionElement(el));
    }

    if (!tab) {
      // 3. Try finding by button, switcher classes, or other clickable tab candidates
      const candidates = querySelectorAllDocuments('button, [role="button"], [class*="tab"], [class*="button"]')
        .filter(el => isVisible(el) && !isExtensionElement(el));

      tab = candidates.find(el => {
        const text = el.textContent.trim().toLowerCase();
        // Exclude the bottom submit/place button
        if (el.closest('[class*="doneButton-"]') || el.closest('[data-name="place-and-modify-button"]') || el.closest('[class*="submit"]')) {
          return false;
        }
        return text === term || text.startsWith(term + '\n') || text.startsWith(term + ' ');
      });
    }

    if (tab) {
      const clickable = tab.closest('button, [role="button"], a, [tabindex]') || tab;
      clickElement(clickable);
      return true;
    }
    return false;
  }

  function fetchAnalyticsData() {
    const data = {
      tPnl: "-",
      mDd: "-",
      wr: "-",
      pf: "-"
    };

    // Find all container cells in all documents
    const allCells = querySelectorAllDocuments('.containerCell-tT6DSV6p, [class*="containerCell-"]')
      .filter(el => isVisible(el) && !isExtensionElement(el));

    // Find the cell representing Total PnL to locate the Overview tab's main summary row
    const pnlCell = allCells.find(cell => {
      const titleEl = cell.querySelector('.title-zDosnhC8, [class*="title-"]');
      if (!titleEl) return false;
      const title = titleEl.textContent.trim().toLowerCase();
      return title.includes("total pnl") || title.includes("total profit");
    });

    if (!pnlCell) {
      return data;
    }

    // The parent/container of the pnlCell holds the 4 main summary cards
    const container = pnlCell.closest('[class*="items-"]') || pnlCell.parentElement;
    if (!container) {
      return data;
    }

    // Query container cells only within this specific container
    const cells = Array.from(container.querySelectorAll('.containerCell-tT6DSV6p, [class*="containerCell-"]'))
      .filter(el => isVisible(el) && !isExtensionElement(el));

    cells.forEach(cell => {
      const titleEl = cell.querySelector('.title-zDosnhC8, [class*="title-"]');
      if (!titleEl) return;
      const title = titleEl.textContent.trim().toLowerCase();

      const valEl = cell.querySelector('.value-h8CiKuR5, [class*="value-"]');
      const curEl = cell.querySelector('.currency-h8CiKuR5, [class*="currency-"]');
      const chgEl = cell.querySelector('.change-h8CiKuR5, [class*="change-"]');

      let value = valEl ? valEl.textContent.trim() : "";
      let currency = curEl ? curEl.textContent.trim() : "";
      let change = chgEl ? chgEl.textContent.trim() : "";

      // Fallback parser if standard CSS classes are not found or return empty
      if (!value) {
        const textElements = Array.from(cell.querySelectorAll('span, div'))
          .map(el => el.textContent.trim())
          .filter(txt => txt && txt !== titleEl.textContent.trim());
        
        const uniqueTexts = [];
        textElements.forEach(txt => {
          if (!uniqueTexts.some(existing => existing.includes(txt) || txt.includes(existing))) {
            uniqueTexts.push(txt);
          }
        });

        if (uniqueTexts.length > 0) {
          value = uniqueTexts[0];
          if (uniqueTexts.length > 1) {
            if (uniqueTexts[1].length <= 4) {
              currency = uniqueTexts[1];
            } else {
              change = uniqueTexts[1];
            }
          }
          if (uniqueTexts.length > 2) {
            change = uniqueTexts[2];
          }
        }
      }

      if (title.includes("total pnl") || title.includes("total profit")) {
        data.tPnl = value + (currency ? " " + currency : "") + (change ? ` (${change})` : "");
      } else if (title.includes("drawdown") || title.includes("dd")) {
        data.mDd = value + (currency ? " " + currency : "") + (change ? ` (${change})` : "");
      } else if (title.includes("profitable") || title.includes("win rate") || title.includes("ratio")) {
        data.wr = value + (change ? ` (${change})` : "");
      } else if (title.includes("factor") || title.includes("profit factor")) {
        data.pf = value;
      }
    });

    return data;
  }

  function isTradingViewOrderPanelOpen() {
    const submitBtn = querySelectorAllDocuments('[data-name="place-and-modify-button"], [data-qa-id*="submit"], [data-qa-id*="place-order"]')
      .find(el => isVisible(el) && !isExtensionElement(el));
    if (submitBtn) return true;

    const qtyInput = querySelectorAllDocuments('input[data-qa-id*="quantity-field"], input[data-qa-id*="quantity-input"], input[data-qa-id*="qty-input"], input[id="quantity-field"]')
      .find(el => isVisible(el) && !isExtensionElement(el));
    if (qtyInput) return true;

    return false;
  }

  function triggerShiftT() {
    const keys = [
      { key: "T", code: "KeyT", keyCode: 84, shiftKey: true },
      { key: "t", code: "KeyT", keyCode: 84, shiftKey: true }
    ];

    keys.forEach(k => {
      const eventDown = new KeyboardEvent("keydown", {
        key: k.key,
        code: k.code,
        keyCode: k.keyCode,
        which: k.keyCode,
        shiftKey: k.shiftKey,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(eventDown);
      window.dispatchEvent(eventDown);

      const eventUp = new KeyboardEvent("keyup", {
        key: k.key,
        code: k.code,
        keyCode: k.keyCode,
        which: k.keyCode,
        shiftKey: k.shiftKey,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(eventUp);
      window.dispatchEvent(eventUp);
    });
  }

  async function ensureOrderPanelOpen() {
    if (isTradingViewOrderPanelOpen()) {
      return true;
    }

    // Try key events
    triggerShiftT();

    // Try finding order panel widget button on sidebar as fallback
    const buttons = querySelectorAllDocuments('[class*="widget-"], [class*="button-"], button, [role="button"]')
      .filter(el => isVisible(el) && !isExtensionElement(el));
    
    const orderBtn = buttons.find(el => {
      const title = el.getAttribute("title") || "";
      const label = el.getAttribute("aria-label") || "";
      const text = el.textContent || "";
      const testStr = (title + " " + label + " " + text).toLowerCase();
      return testStr.includes("order panel") || testStr.includes("order ticket") || testStr.includes("dom") || (testStr.includes("shift+t") || testStr.includes("shift + t"));
    });

    if (orderBtn && !isTradingViewOrderPanelOpen()) {
      const clickable = orderBtn.closest('button, [role="button"], [tabindex]') || orderBtn;
      clickElement(clickable);
    }

    // Poll to wait for the panel to open (up to 1000ms)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (isTradingViewOrderPanelOpen()) {
        await new Promise(r => setTimeout(r, 150)); // Settle rendering
        return true;
      }
    }

    return false;
  }

  window.TvDomHandler = {
    fetchBuyPrice,
    fillOrderTicket,
    clickBuyButton,
    switchTradeSide,
    fetchAnalyticsData,
    ensureOrderPanelOpen
  };
})();
