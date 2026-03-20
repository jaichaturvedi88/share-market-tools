async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function showMessage(text, isError = false) {
  const msg = document.getElementById("msg");
  msg.textContent = text;
  msg.style.color = isError ? "#b91c1c" : "#065f46";
}

async function setRole(role) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    showMessage("No active tab", true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "SET_ROLE",
    tabId: tab.id,
    role
  });

  if (!response?.ok) {
    showMessage("Failed to set role", true);
    return;
  }

  await refreshStatus();
  showMessage(`Role updated to ${role}`);
}

async function refreshStatus() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const roleRes = await chrome.runtime.sendMessage({ type: "GET_ROLE", tabId: tab.id });
  document.getElementById("roleValue").textContent = roleRes?.role || "none";

  const symbolRes = await chrome.runtime.sendMessage({ type: "GET_LAST_SYMBOL" });
  document.getElementById("lastSymbol").textContent = symbolRes?.symbol || "-";

  const applyRes = await chrome.runtime.sendMessage({ type: "GET_LAST_APPLY_REPORT" });
  const report = applyRes?.report;
  const statusText = report
    ? `${report.status || "-"}${report.stage ? ` @ ${report.stage}` : ""}${report.symbol ? ` (${report.symbol})` : ""}${report.detail ? ` - ${report.detail}` : ""}`
    : "-";
  document.getElementById("applyStatus").textContent = statusText;
}

let refreshTimerId = null;

function startLiveRefresh() {
  if (refreshTimerId) clearInterval(refreshTimerId);
  refreshTimerId = setInterval(() => {
    refreshStatus();
  }, 700);
}

function stopLiveRefresh() {
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
    refreshTimerId = null;
  }
}

async function sendTestSymbol() {
  const tab = await getActiveTab();
  const symbol = document.getElementById("testSymbol").value.trim().toUpperCase();

  if (!tab?.id || !symbol) {
    showMessage("Enter symbol and keep active tab open", true);
    return;
  }

  const roleRes = await chrome.runtime.sendMessage({ type: "GET_ROLE", tabId: tab.id });
  if (roleRes?.role !== "leader") {
    showMessage("Set active tab as Leader first", true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "SYMBOL_CHANGED",
    tabId: tab.id,
    symbol,
    source: "popup-test"
  });

  if (!response?.ok) {
    const reason = response?.reason ? ` (${response.reason})` : "";
    showMessage(`Broadcast failed${reason}`, true);
    return;
  }

  await refreshStatus();
  showMessage(`Sent ${symbol}`);
}

async function applySymbolHere() {
  const tab = await getActiveTab();
  const symbol = document.getElementById("directSymbol").value.trim().toUpperCase();

  if (!tab?.id || !symbol) {
    showMessage("Enter symbol and keep active tab open", true);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "LOCAL_TEST_APPLY_RELAY",
      tabId: tab.id,
      symbol
    });

    if (!response?.ok) {
      const detail = response?.detail ? ` - ${response.detail}` : "";
      showMessage(`Apply failed${detail}`, true);
      return;
    }

    await refreshStatus();
    const stage = response?.stage ? ` @ ${response.stage}` : "";
    showMessage(`Applied ${symbol}${stage}`);
  } catch (error) {
    showMessage("Apply failed - open trade.fyers.in tab and reload extension", true);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("setLeader").addEventListener("click", () => setRole("leader"));
  document.getElementById("setFollower").addEventListener("click", () => setRole("follower"));
  document.getElementById("setNone").addEventListener("click", () => setRole("none"));
  document.getElementById("sendTest").addEventListener("click", sendTestSymbol);
  document.getElementById("applyHere").addEventListener("click", applySymbolHere);

  chrome.storage.onChanged.addListener(() => {
    refreshStatus();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "POPUP_REFRESH_STATUS") {
      refreshStatus();
    }
  });

  await refreshStatus();
  startLiveRefresh();
});

window.addEventListener("beforeunload", stopLiveRefresh);
