const ROLE_KEY_PREFIX = "tabRole:";
const LAST_SYMBOL_KEY = "lastSymbol";
const LAST_APPLY_REPORT_KEY = "lastApplyReport";

async function setApplyReport(payload) {
  await chrome.storage.local.set({
    [LAST_APPLY_REPORT_KEY]: {
      at: Date.now(),
      ...payload
    }
  });
}

function roleKey(tabId) {
  return `${ROLE_KEY_PREFIX}${tabId}`;
}

async function getTabRole(tabId) {
  const key = roleKey(tabId);
  const data = await chrome.storage.local.get(key);
  return data[key] || "none";
}

async function setTabRole(tabId, role) {
  const key = roleKey(tabId);
  await chrome.storage.local.set({ [key]: role });
}

async function clearTabRole(tabId) {
  const key = roleKey(tabId);
  await chrome.storage.local.remove(key);
}

async function getFollowerTabs(excludeTabId) {
  const tabs = await chrome.tabs.query({});
  const followerTabs = [];

  for (const tab of tabs) {
    if (!tab.id || tab.id === excludeTabId) continue;
    if (!tab.url || !tab.url.includes("fyers.in")) continue;
    const role = await getTabRole(tab.id);
    if (role === "follower") followerTabs.push(tab);
  }

  return followerTabs;
}

async function sendMessageWithInjectRetry(tabId, payload) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    return { ok: true, response, retried: false };
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });

      const response = await chrome.tabs.sendMessage(tabId, payload);
      return { ok: true, response, retried: true };
    } catch (retryError) {
      return {
        ok: false,
        retried: true,
        error: String(retryError?.message || retryError || "send-failed")
      };
    }
  }
}

async function trySendToFollower(tab, symbol, sourceTabId) {
  const payload = {
    type: "SYMBOL_SYNC_APPLY",
    symbol,
    sourceTabId,
    sentAt: Date.now()
  };

  if (!tab.url || !tab.url.includes("fyers.in")) {
    return { ok: false, retried: false, reason: "non-fyers-url" };
  }

  const result = await sendMessageWithInjectRetry(tab.id, payload);
  if (result.ok) {
    return { ok: true, retried: result.retried };
  }

  return { ok: false, retried: result.retried, reason: "inject-or-retry-failed" };
}

async function broadcastToFollowers(symbol, sourceTabId) {
  const followerTabs = await getFollowerTabs(sourceTabId);
  let attempted = 0;
  let sent = 0;
  const failedTabIds = [];
  const recoveredTabIds = [];

  for (const tab of followerTabs) {
    attempted += 1;
    const result = await trySendToFollower(tab, symbol, sourceTabId);
    if (result.ok) {
      sent += 1;
      if (result.retried) recoveredTabIds.push(tab.id);
    } else {
      failedTabIds.push(tab.id);
    }
  }

  return {
    attempted,
    sent,
    failed: attempted - sent,
    failedTabIds,
    recoveredTabIds
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "SET_ROLE") {
      const tabId = message.tabId || sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "Missing tab id" });
        return;
      }
      await setTabRole(tabId, message.role || "none");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GET_ROLE") {
      const tabId = message.tabId || sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, role: "none" });
        return;
      }
      const role = await getTabRole(tabId);
      sendResponse({ ok: true, role });
      return;
    }

    if (message?.type === "SYMBOL_CHANGED") {
      const sourceTabId = message.tabId || sender?.tab?.id;
      if (!sourceTabId || !message.symbol) {
        await setApplyReport({
          role: "relay",
          stage: "validate",
          status: "failed",
          symbol: message?.symbol || "",
          detail: "missing-tab-or-symbol"
        });
        sendResponse({ ok: false, reason: "missing-tab-or-symbol" });
        return;
      }

      const role = await getTabRole(sourceTabId);
      if (role !== "leader") {
        await setApplyReport({
          role: "relay",
          stage: "validate",
          status: "ignored",
          symbol: message.symbol,
          detail: "source-not-leader"
        });
        sendResponse({ ok: false, ignored: true, reason: "source-not-leader" });
        return;
      }

      await chrome.storage.local.set({ [LAST_SYMBOL_KEY]: message.symbol });
      const relay = await broadcastToFollowers(message.symbol, sourceTabId);

      const detail = relay.attempted === 0
        ? "no-follower-tabs"
        : relay.failed > 0
          ? `partial-send failedTabs=${relay.failedTabIds.join(",")}`
          : relay.recoveredTabIds.length > 0
            ? `sent-with-recovery recoveredTabs=${relay.recoveredTabIds.join(",")}`
            : "sent-to-all-followers";

      await setApplyReport({
        role: "relay",
        stage: "broadcast",
        status: relay.attempted === 0 ? "failed" : relay.failed > 0 ? "partial" : "success",
        symbol: message.symbol,
        detail
      });

      sendResponse({ ok: true, relay });
      return;
    }

    if (message?.type === "GET_LAST_SYMBOL") {
      const data = await chrome.storage.local.get(LAST_SYMBOL_KEY);
      sendResponse({ ok: true, symbol: data[LAST_SYMBOL_KEY] || "" });
      return;
    }

    if (message?.type === "APPLY_REPORT") {
      const payload = {
        tabId: sender?.tab?.id || null,
        role: message.role || "unknown",
        symbol: message.symbol || "",
        stage: message.stage || "",
        status: message.status || "",
        detail: message.detail || "",
        url: message.url || sender?.tab?.url || "",
        title: message.title || sender?.tab?.title || "",
        at: Date.now()
      };
      await chrome.storage.local.set({ [LAST_APPLY_REPORT_KEY]: payload });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GET_LAST_APPLY_REPORT") {
      const data = await chrome.storage.local.get(LAST_APPLY_REPORT_KEY);
      sendResponse({ ok: true, report: data[LAST_APPLY_REPORT_KEY] || null });
      return;
    }

    if (message?.type === "LOCAL_TEST_APPLY_RELAY") {
      const tabId = message.tabId;
      const symbol = message.symbol || "";

      if (!tabId || !symbol) {
        sendResponse({ ok: false, detail: "missing-tab-or-symbol" });
        return;
      }

      const tab = await chrome.tabs.get(tabId);
      if (!tab?.url || !tab.url.includes("fyers.in")) {
        sendResponse({ ok: false, detail: "active-tab-not-fyers" });
        return;
      }

      const relay = await sendMessageWithInjectRetry(tabId, {
        type: "LOCAL_TEST_APPLY",
        symbol
      });

      if (!relay.ok) {
        sendResponse({ ok: false, detail: relay.error || "inject-or-send-failed" });
        return;
      }

      sendResponse({ ok: true, ...relay.response, retried: relay.retried });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabRole(tabId);
});
