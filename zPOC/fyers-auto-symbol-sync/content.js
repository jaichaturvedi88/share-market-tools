let lastEmittedSymbol = "";
let lastAppliedSymbol = "";
let isApplyingSymbol = false;
let currentRole = "none";

function normalizeSymbol(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^NSE:/, "NSE:");
}

function extractSymbolFromUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const directKeys = ["symbol", "scrip", "ticker", "tradingsymbol"];

  for (const key of directKeys) {
    const val = params.get(key);
    if (val) return normalizeSymbol(val);
  }

  const hash = window.location.hash || "";
  const nseLike = hash.match(/(NSE:[A-Z0-9\-_.]+)/i);
  if (nseLike?.[1]) return normalizeSymbol(nseLike[1]);

  const path = window.location.pathname || "";
  const pathNse = path.match(/(NSE:[A-Z0-9\-_.]+)/i);
  if (pathNse?.[1]) return normalizeSymbol(pathNse[1]);

  return "";
}

function extractSymbolFromTitle() {
  const title = document.title || "";
  if (!title) return "";

  const nseLike = title.match(/(NSE:[A-Z0-9\-_.]+)/i);
  if (nseLike?.[1]) return normalizeSymbol(nseLike[1]);

  const lhs = title.split("|")[0]?.trim();
  if (lhs && /^[A-Z][A-Z0-9\-_.]{1,20}$/.test(lhs)) return normalizeSymbol(lhs);

  return "";
}

function getCurrentSymbol() {
  return extractSymbolFromUrl() || extractSymbolFromTitle();
}

function getSymbolParts(symbol) {
  const normalized = normalizeSymbol(symbol);
  const noExchange = normalized.includes(":") ? normalized.split(":")[1] : normalized;
  const root = noExchange.replace(/-EQ$/i, "");
  return { normalized, noExchange, root };
}

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRouteCandidates(targetSymbol) {
  const href = window.location.href;
  const candidates = new Set();
  const current = getSymbolParts(getCurrentSymbol() || "");
  const target = getSymbolParts(targetSymbol);

  const currentTokens = [current.normalized, current.noExchange, current.root].filter(Boolean);
  const targetTokens = [target.normalized, target.noExchange, target.root].filter(Boolean);

  for (const currentToken of currentTokens) {
    for (const nextToken of targetTokens) {
      if (!currentToken || !nextToken || currentToken === nextToken) continue;
      const re = new RegExp(escapeForRegex(currentToken), "gi");
      const replaced = href.replace(re, nextToken);
      if (replaced !== href) candidates.add(replaced);
    }
  }

  try {
    const url = new URL(href);

    const keys = ["symbol", "scrip", "ticker", "tradingsymbol", "instrument", "tsym"];
    for (const key of keys) {
      const test = new URL(url.toString());
      test.searchParams.set(key, target.normalized);
      candidates.add(test.toString());
    }

    if (url.hash) {
      const hashRaw = url.hash.slice(1);
      const hashCandidates = [target.normalized, target.noExchange, target.root].filter(Boolean);

      if (/symbol=|scrip=|ticker=|tradingsymbol=/i.test(hashRaw)) {
        for (const key of ["symbol", "scrip", "ticker", "tradingsymbol"]) {
          for (const val of hashCandidates) {
            const replacedHash = hashRaw.replace(new RegExp(`(${key}=)[^&]+`, "i"), `$1${encodeURIComponent(val)}`);
            const test = new URL(url.toString());
            test.hash = replacedHash;
            candidates.add(test.toString());
          }
        }
      }

      for (const currentToken of currentTokens) {
        for (const nextToken of hashCandidates) {
          const re = new RegExp(escapeForRegex(currentToken), "gi");
          const replacedHash = hashRaw.replace(re, nextToken);
          if (replacedHash !== hashRaw) {
            const test = new URL(url.toString());
            test.hash = replacedHash;
            candidates.add(test.toString());
          }
        }
      }
    }
  } catch (error) {
    // Ignore malformed URL handling.
  }

  candidates.delete(href);
  return [...candidates];
}

function navigateWithoutReload(urlString) {
  try {
    const current = new URL(window.location.href);
    const next = new URL(urlString, current.href);
    if (current.origin !== next.origin) return false;

    const nextPath = `${next.pathname}${next.search}${next.hash}`;
    const currentPath = `${current.pathname}${current.search}${current.hash}`;
    if (nextPath === currentPath) return false;

    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));

    if (current.hash !== next.hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange", {
        oldURL: current.toString(),
        newURL: next.toString()
      }));
    }

    return true;
  } catch (error) {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return element.offsetWidth > 0 && element.offsetHeight > 0;
}

function collectSearchRootsFromRoot(root, roots, visited) {
  if (!root || visited.has(root)) return;
  visited.add(root);
  roots.push(root);

  const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;

    if (node.shadowRoot) {
      collectSearchRootsFromRoot(node.shadowRoot, roots, visited);
    }

    if (node.tagName === "IFRAME") {
      try {
        const frameDoc = node.contentDocument;
        if (frameDoc?.documentElement) {
          collectSearchRootsFromRoot(frameDoc, roots, visited);
        }
      } catch (error) {
        // Cross-origin iframe; cannot inspect.
      }
    }
  }
}

function getSearchRoots() {
  const roots = [];
  const visited = new Set();
  collectSearchRootsFromRoot(document, roots, visited);
  return roots;
}

function queryAllDeep(selector) {
  const roots = getSearchRoots();
  const results = [];

  for (const root of roots) {
    if (!root.querySelectorAll) continue;
    results.push(...root.querySelectorAll(selector));
  }

  return results;
}

function buildSymbolCandidates(symbol) {
  const normalized = normalizeSymbol(symbol);
  const noExchange = normalized.includes(":") ? normalized.split(":")[1] : normalized;
  const root = noExchange.replace(/-EQ$/i, "");
  return Array.from(new Set([normalized, noExchange, root].filter(Boolean)));
}

function setInputValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchKey(input, key) {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
}

function dispatchShortcut(key, options = {}) {
  const eventInit = {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: !!options.ctrlKey,
    metaKey: !!options.metaKey,
    shiftKey: !!options.shiftKey,
    altKey: !!options.altKey
  };

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  active.dispatchEvent(new KeyboardEvent("keydown", eventInit));
  active.dispatchEvent(new KeyboardEvent("keyup", eventInit));
}

function clickSearchTriggers() {
  const triggerSelectors = [
    'button[aria-label*="search" i]',
    '[role="button"][aria-label*="search" i]',
    'button[title*="search" i]',
    'button[aria-label*="symbol" i]',
    'button[title*="symbol" i]',
    '[class*="search"][role="button"]'
  ];

  for (const selector of triggerSelectors) {
    const trigger = queryAllDeep(selector).find((node) => node instanceof HTMLElement && isVisibleElement(node));
    if (trigger instanceof HTMLElement) {
      trigger.click();
      return true;
    }
  }

  return false;
}

function clickBestSuggestion(candidates) {
  const suggestionSelectors = [
    '[role="option"]',
    '[class*="suggest"] li',
    '[class*="suggest"] [class*="item"]',
    '[class*="result"] li',
    '[class*="result"] [class*="item"]',
    '[data-value]'
  ];

  const normalizedCandidates = candidates.map((item) => item.toUpperCase().replace(/\s+/g, ""));

  for (const selector of suggestionSelectors) {
    const nodes = queryAllDeep(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isVisibleElement(node)) continue;

      const text = (node.textContent || "").toUpperCase().replace(/\s+/g, "");
      if (!text) continue;

      const matched = normalizedCandidates.some((candidate) => text.includes(candidate) || candidate.includes(text));
      if (!matched) continue;

      node.click();
      return true;
    }
  }

  return false;
}

function clickFirstSuggestion() {
  const suggestionSelectors = [
    '[role="option"]',
    '[class*="suggest"] li',
    '[class*="result"] li'
  ];

  for (const selector of suggestionSelectors) {
    const first = queryAllDeep(selector).find((node) => node instanceof HTMLElement && isVisibleElement(node));
    if (first instanceof HTMLElement) {
      first.click();
      return true;
    }
  }

  return false;
}

function findSearchTarget() {
  const inputSelectors = [
    'input[type="search"]',
    'input[role="combobox"]',
    '[role="combobox"] input',
    'input[aria-label*="search" i]',
    'input[placeholder*="Search" i]',
    'input[placeholder*="symbol" i]',
    'input[name*="search" i]'
  ];

  for (const selector of inputSelectors) {
    const input = queryAllDeep(selector).find((node) => node instanceof HTMLInputElement && isVisibleElement(node));
    if (input instanceof HTMLInputElement) return input;
  }

  const editableSelectors = [
    '[contenteditable="true"][role="combobox"]',
    '[contenteditable="true"][aria-label*="search" i]',
    '[contenteditable="true"][placeholder*="Search" i]'
  ];

  for (const selector of editableSelectors) {
    const editable = queryAllDeep(selector).find((node) => node instanceof HTMLElement && isVisibleElement(node));
    if (editable instanceof HTMLElement) return editable;
  }

  return null;
}

function setEditableValue(element, value) {
  const ownerDoc = element.ownerDocument || document;
  element.focus();
  element.textContent = "";
  ownerDoc.execCommand("insertText", false, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
}

function buildDiagnostics(symbol) {
  const inputSelectors = [
    'input[type="search"]',
    'input[role="combobox"]',
    '[role="combobox"] input',
    'input[aria-label*="search" i]',
    'input[placeholder*="Search" i]',
    'input[placeholder*="symbol" i]',
    'input[name*="search" i]',
    '[contenteditable="true"][role="combobox"]'
  ];

  const triggerSelectors = [
    'button[aria-label*="search" i]',
    '[role="button"][aria-label*="search" i]',
    'button[title*="search" i]',
    '[class*="search"][role="button"]'
  ];

  const suggestionSelectors = ['[role="option"]', '[class*="suggest"] li', '[class*="result"] li'];
  const roots = getSearchRoots();
  const iframes = document.querySelectorAll("iframe");

  const visibleInputs = inputSelectors.reduce((count, selector) => {
    return count + queryAllDeep(selector).filter((node) => node instanceof HTMLElement && isVisibleElement(node)).length;
  }, 0);

  const visibleTriggers = triggerSelectors.reduce((count, selector) => {
    return count + queryAllDeep(selector).filter((node) => node instanceof HTMLElement && isVisibleElement(node)).length;
  }, 0);

  const visibleSuggestions = suggestionSelectors.reduce((count, selector) => {
    return count + queryAllDeep(selector).filter((node) => node instanceof HTMLElement && isVisibleElement(node)).length;
  }, 0);

  return `diag roots=${roots.length} iframes=${iframes.length} inputs=${visibleInputs} triggers=${visibleTriggers} suggestions=${visibleSuggestions} symbol=${symbol}`;
}

async function reportApply(stage, status, symbol, detail = "") {
  try {
    await chrome.runtime.sendMessage({
      type: "APPLY_REPORT",
      role: currentRole,
      stage,
      status,
      symbol,
      detail,
      url: window.location.href,
      title: document.title
    });
  } catch (error) {
    // Best-effort diagnostics only.
  }
}

function getClickableAncestor(node) {
  let current = node;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (!(current instanceof HTMLElement)) return null;
    const role = current.getAttribute("role") || "";
    const hasClick = typeof current.onclick === "function";
    const pointer = window.getComputedStyle(current).cursor === "pointer";
    const clickableTag = ["BUTTON", "A"].includes(current.tagName);
    if (hasClick || pointer || clickableTag || role === "button" || role === "option") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function clickSymbolFromDom(candidates) {
  const normalizedCandidates = candidates.map((item) => item.toUpperCase().replace(/\s+/g, ""));
  const selectors = [
    '[data-symbol]',
    '[data-name]',
    '[data-value]',
    '[title]',
    '[aria-label]',
    'li',
    'tr',
    'div',
    'span'
  ];

  for (const selector of selectors) {
    const nodes = queryAllDeep(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isVisibleElement(node)) continue;

      const sourceText = [
        node.getAttribute("data-symbol") || "",
        node.getAttribute("data-name") || "",
        node.getAttribute("data-value") || "",
        node.getAttribute("title") || "",
        node.getAttribute("aria-label") || "",
        node.textContent || ""
      ].join(" ");

      const normalizedText = sourceText.toUpperCase().replace(/\s+/g, "");
      if (!normalizedText) continue;

      const matched = normalizedCandidates.some((candidate) => normalizedText.includes(candidate));
      if (!matched) continue;

      const target = getClickableAncestor(node) || node;
      target.click();
      return true;
    }
  }

  return false;
}

async function refreshRole() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ROLE" });
    if (response?.ok) currentRole = response.role || "none";
  } catch (error) {
    currentRole = "none";
  }
}

async function emitSymbolIfChanged() {
  if (isApplyingSymbol) return;
  if (currentRole !== "leader") return;

  const symbol = getCurrentSymbol();
  if (!symbol) return;
  if (symbol === lastEmittedSymbol) return;

  lastEmittedSymbol = symbol;

  try {
    await chrome.runtime.sendMessage({
      type: "SYMBOL_CHANGED",
      symbol,
      fromUrl: window.location.href,
      sentAt: Date.now()
    });
  } catch (error) {
    // Ignore transient messaging failures.
  }
}

async function tryApplyViaUrl(symbol) {
  const url = new URL(window.location.href);
  const directKeys = ["symbol", "scrip", "ticker", "tradingsymbol", "instrument", "tsym"];

  for (const key of directKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, symbol);
      if (url.toString() !== window.location.href) {
        if (navigateWithoutReload(url.toString())) return true;
      }
      return false;
    }
  }

  const routeCandidates = buildRouteCandidates(symbol);
  for (const candidate of routeCandidates) {
    if (navigateWithoutReload(candidate)) return true;
  }

  return false;
}

async function tryApplyViaInput(symbol) {
  const candidates = buildSymbolCandidates(symbol);
  const preferredTerm = candidates[1] || candidates[0] || symbol;

  clickSearchTriggers();
  dispatchShortcut("k", { ctrlKey: true });
  dispatchShortcut("k", { metaKey: true });
  dispatchShortcut("/", {});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await wait(120 + attempt * 80);
    const target = findSearchTarget();
    if (!target) {
      clickSearchTriggers();
      continue;
    }

    if (target instanceof HTMLInputElement) {
      target.focus();
      setInputValue(target, preferredTerm);
    } else {
      setEditableValue(target, preferredTerm);
    }

    await wait(160);
    if (clickBestSuggestion(candidates) || clickFirstSuggestion()) {
      return true;
    }

    if (target instanceof HTMLInputElement) {
      dispatchKey(target, "ArrowDown");
      await wait(80);
      dispatchKey(target, "Enter");
    } else {
      dispatchShortcut("ArrowDown");
      await wait(80);
      dispatchShortcut("Enter");
    }
    return true;
  }

  return false;
}

async function applyIncomingSymbol(symbol) {
  if (!symbol) return;
  await refreshRole();
  if (currentRole !== "follower") {
    await reportApply("guard", "ignored", symbol, "not-follower");
    return;
  }
  if (symbol === lastAppliedSymbol) {
    await reportApply("guard", "ignored", symbol, "same-as-last");
    return;
  }

  isApplyingSymbol = true;
  lastAppliedSymbol = symbol;
  await reportApply("start", "received", symbol);

  const appliedByUrl = await tryApplyViaUrl(symbol);
  if (appliedByUrl) {
    await reportApply("url", "success", symbol, "url-param-updated");
  }

  let appliedByInput = false;
  if (!appliedByUrl) {
    appliedByInput = await tryApplyViaInput(symbol);
    if (appliedByInput) {
      await reportApply("input", "success", symbol, "search-flow-executed");
    }
  }

  if (!appliedByUrl && !appliedByInput) {
    const clickedDom = clickSymbolFromDom(buildSymbolCandidates(symbol));
    if (clickedDom) {
      await reportApply("dom-click", "success", symbol, "clicked-matching-text");
    } else {
      await reportApply("final", "failed", symbol, `no-applicable-target-found | ${buildDiagnostics(symbol)}`);
    }
  }

  setTimeout(() => {
    isApplyingSymbol = false;
  }, 500);
}

async function applySymbolDirect(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return { ok: false, stage: "validate", detail: "invalid-symbol" };
  }

  isApplyingSymbol = true;
  lastAppliedSymbol = normalized;
  await reportApply("manual-start", "received", normalized, "popup-direct-apply");

  const appliedByUrl = await tryApplyViaUrl(normalized);
  if (appliedByUrl) {
    await reportApply("url", "success", normalized, "url-param-updated");
    setTimeout(() => {
      isApplyingSymbol = false;
    }, 500);
    return { ok: true, stage: "url", detail: "url-param-updated" };
  }

  const appliedByInput = await tryApplyViaInput(normalized);
  if (appliedByInput) {
    await reportApply("input", "success", normalized, "search-flow-executed");
    setTimeout(() => {
      isApplyingSymbol = false;
    }, 500);
    return { ok: true, stage: "input", detail: "search-flow-executed" };
  }

  const clickedDom = clickSymbolFromDom(buildSymbolCandidates(normalized));
  if (clickedDom) {
    await reportApply("dom-click", "success", normalized, "clicked-matching-text");
    setTimeout(() => {
      isApplyingSymbol = false;
    }, 500);
    return { ok: true, stage: "dom-click", detail: "clicked-matching-text" };
  }

  await reportApply("final", "failed", normalized, `no-applicable-target-found | ${buildDiagnostics(normalized)}`);
  setTimeout(() => {
    isApplyingSymbol = false;
  }, 500);
  return { ok: false, stage: "final", detail: "no-applicable-target-found" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SYMBOL_SYNC_APPLY") {
    applyIncomingSymbol(normalizeSymbol(message.symbol));
    return;
  }

  if (message?.type === "LOCAL_TEST_APPLY") {
    (async () => {
      const result = await applySymbolDirect(message.symbol || "");
      sendResponse(result);
    })();
    return true;
  }
});

const observer = new MutationObserver(() => {
  emitSymbolIfChanged();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: false
});

window.addEventListener("popstate", emitSymbolIfChanged);
window.addEventListener("hashchange", emitSymbolIfChanged);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshRole().then(emitSymbolIfChanged);
  }
});

setInterval(() => {
  refreshRole().then(emitSymbolIfChanged);
}, 1000);

(async function init() {
  await refreshRole();
  emitSymbolIfChanged();

  if (currentRole === "follower") {
    const response = await chrome.runtime.sendMessage({ type: "GET_LAST_SYMBOL" });
    if (response?.ok && response.symbol) {
      applyIncomingSymbol(normalizeSymbol(response.symbol));
    }
  }
})();
