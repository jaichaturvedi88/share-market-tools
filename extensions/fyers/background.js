// background.js for Fyers Stop Loss Manager
const LOG_PREFIX = "[Fyers SL Background]";

function logDebug(message, data) {
  console.log(`${LOG_PREFIX} ${message}`, data || "");
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logDebug("Received action:", message.action);

  if (message.action === "fetchData") {
    handleFetchData(message.token, message.baseUrl)
      .then(res => sendResponse(res))
      .catch(err => {
        logDebug("FetchData error:", err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === "moveSL") {
    handleMoveSL(message.token, message.baseUrl, message.orderId, message.newSL, message.qty)
      .then(res => sendResponse(res))
      .catch(err => {
        logDebug("MoveSL error:", err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Fetch Positions and Orders
async function handleFetchData(token, baseUrl) {
  let base = baseUrl || "https://api-t1.fyers.in";
  if (base.includes("trade.fyers.in")) {
    base = "https://api-t1.fyers.in";
  }

  // Include Referer and Origin to bypass Fyers' Cloudflare/WAF blocks
  const headers = {
    "Accept": "*/*",
    "Authorization": token,
    "Origin": "https://trade.fyers.in",
    "Referer": "https://trade.fyers.in/"
  };

  // Fetch positions
  let positions = [];
  let posError = null;
  const posPaths = ["/trade/v3/positions/v2", "/api/v3/positions", "/trade/v3/positions"];
  let posSuccess = false;

  for (const path of posPaths) {
    try {
      const url = base.endsWith("/") ? base.slice(0, -1) + path : base + path;
      logDebug(`Fetching positions from: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        positions = data.data || data.netPositions || data.positions || (Array.isArray(data) ? data : []);
        posSuccess = true;
        break;
      } else {
        posError = `Status ${res.status}: ${res.statusText}`;
      }
    } catch (err) {
      posError = err.message;
    }
  }

  if (!posSuccess && base !== "https://api.fyers.in") {
    // Retry with api.fyers.in as ultimate fallback
    try {
      const url = "https://api.fyers.in/api/v3/positions";
      logDebug(`Retrying positions from fallback: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        positions = data.data || data.netPositions || data.positions || (Array.isArray(data) ? data : []);
        posSuccess = true;
      }
    } catch (err) {
      posError = err.message;
    }
  }

  // Fetch orders
  let orders = [];
  let ordError = null;
  const ordPaths = ["/trade/v3/orders/v2", "/api/v3/orders", "/trade/v3/orders"];
  let ordSuccess = false;

  for (const path of ordPaths) {
    try {
      const url = base.endsWith("/") ? base.slice(0, -1) + path : base + path;
      logDebug(`Fetching orders from: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        orders = data.data || data.orders || (Array.isArray(data) ? data : []);
        ordSuccess = true;
        break;
      } else {
        ordError = `Status ${res.status}: ${res.statusText}`;
      }
    } catch (err) {
      ordError = err.message;
    }
  }

  if (!ordSuccess && base !== "https://api.fyers.in") {
    try {
      const url = "https://api.fyers.in/api/v3/orders";
      logDebug(`Retrying orders from fallback: ${url}`);
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        orders = data.data || data.orders || (Array.isArray(data) ? data : []);
        ordSuccess = true;
      }
    } catch (err) {
      ordError = err.message;
    }
  }

  if (posSuccess || ordSuccess) {
    return {
      success: true,
      positions,
      orders
    };
  } else {
    throw new Error(`Failed to fetch positions (${posError}) or orders (${ordError})`);
  }
}

// Modify Bracket Order (BO) or SL order Stop Loss
async function handleMoveSL(token, baseUrl, orderId, newSL, qty) {
  let base = baseUrl || "https://api-t1.fyers.in";
  if (base.includes("trade.fyers.in")) {
    base = "https://api-t1.fyers.in";
  }

  const headers = {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Authorization": token,
    "Origin": "https://trade.fyers.in",
    "Referer": "https://trade.fyers.in/"
  };

  const payload = {
    id: orderId,
    stopLoss: Number(newSL),
    qty: Number(qty)
  };

  const paths = ["/trade/v3/orders/bo", "/api/v3/orders/bo", "/api/v3/orders"];
  let lastError = null;

  for (const path of paths) {
    try {
      const url = base.endsWith("/") ? base.slice(0, -1) + path : base + path;
      const method = path.includes("/bo") ? "PATCH" : "PUT";
      logDebug(`Modifying order at ${url} using method ${method}`);
      
      const res = await fetch(url, {
        method: method,
        headers,
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }

      if (res.ok) {
        return { success: true, body };
      } else {
        lastError = body?.message || text || `Status ${res.status}`;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  // Fallback to backup base URLs if the captured baseUrl failed
  const backupBases = ["https://api-t1.fyers.in", "https://api.fyers.in"];
  for (const backupBase of backupBases) {
    if (backupBase === base) continue;
    try {
      const url = `${backupBase}/trade/v3/orders/bo`;
      logDebug(`Retrying order modification from fallback: ${url}`);
      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }
      if (res.ok) {
        return { success: true, body };
      }
    } catch (err) {
      // Ignore backup failures
    }
  }

  throw new Error(lastError || "Failed to modify Stop Loss");
}
