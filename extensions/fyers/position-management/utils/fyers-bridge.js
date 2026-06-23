(function () {
  const BRIDGE_LOG_PREFIX = "[Fyers Bridge PageContext]";
  const PAGE_ORDERS_EVENT = "fyers-orders-updated";
  const PAGE_POSITIONS_EVENT = "fyers-positions-updated";
  const MOVE_SL_REQUEST_EVENT = "fyers-move-sl-request";
  const MOVE_SL_RESPONSE_EVENT = "fyers-move-sl-response";
  const REFRESH_REQUEST_EVENT = "fyers-refresh-request";

  if (window.__fyersSLBridgeInitialized) return;
  window.__fyersSLBridgeInitialized = true;

  window.__fyersAuthToken = null;
  window.__fyersApiBaseUrl = null; // Dynamically captured to avoid hardcoded domain mismatches

  function logDebug(message, data) {
    console.log(`${BRIDGE_LOG_PREFIX} ${message}`, data || "");
  }

  // Hook into WebSocket to intercept all incoming/outgoing messages
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    logDebug(`New WebSocket connection initiated to: ${url}`);

    async function processMessage(data, isOutgoing) {
      // 1. Filter out price ticker feeds
      const lowerUrl = String(url || "").toLowerCase();
      if (lowerUrl.includes("data") || lowerUrl.includes("ticker") || lowerUrl.includes("tick")) {
        return;
      }

      // 2. Filter out ping/pong heartbeats
      let text = "";
      if (typeof data === "string") {
        text = data;
      } else if (data instanceof Blob) {
        try { text = await data.text(); } catch (e) {}
      } else if (data instanceof ArrayBuffer) {
        try { text = new TextDecoder().decode(data); } catch (e) {}
      } else if (ArrayBuffer.isView(data)) {
        try { text = new TextDecoder().decode(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)); } catch (e) {}
      }
      
      const cleanText = text.trim();
      if (!cleanText) {
        return;
      }
      
      const lowerText = cleanText.toLowerCase();
      if (
        lowerText === "2" || 
        lowerText === "3" || 
        lowerText === "ping" || 
        lowerText === "pong" || 
        lowerText === "heartbeat" || 
        lowerText === "keepalive" ||
        lowerText.length <= 3 ||
        lowerText.includes("ping") || 
        lowerText.includes("pong") || 
        lowerText.includes("heartbeat") || 
        lowerText.includes("keepalive")
      ) {
        return;
      }

      let parsed = null;
      if (typeof data === "string") {
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
      } else if (data instanceof Blob) {
        try {
          const text = await data.text();
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        } catch (e) {
          parsed = "[Blob data: " + data.size + " bytes]";
        }
      } else if (data instanceof ArrayBuffer) {
        try {
          const text = new TextDecoder().decode(data);
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        } catch (e) {
          parsed = "[ArrayBuffer data: " + data.byteLength + " bytes]";
        }
      } else {
        parsed = String(data);
      }

      window.dispatchEvent(new CustomEvent("fyers-ws-message", {
        detail: {
          url: url,
          direction: isOutgoing ? "outgoing" : "incoming",
          data: parsed
        }
      }));
    }

    // Wrap send to intercept outgoing messages
    const originalSend = ws.send;
    ws.send = function (data) {
      processMessage(data, true);
      return originalSend.apply(this, arguments);
    };

    // Wrap addEventListener for incoming messages
    const originalAddEventListener = ws.addEventListener;
    ws.addEventListener = function (type, listener, options) {
      if (type === "message") {
        const wrappedListener = function (event) {
          processMessage(event.data, false);
          return listener.apply(this, arguments);
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.apply(this, arguments);
    };

    // Wrap onmessage property setter
    let onmessageWrapper = null;
    Object.defineProperty(ws, "onmessage", {
      get: function () {
        return onmessageWrapper;
      },
      set: function (listener) {
        if (!listener) {
          onmessageWrapper = null;
          originalAddEventListener.call(ws, "message", null);
          return;
        }
        onmessageWrapper = function (event) {
          processMessage(event.data, false);
          return listener.apply(this, arguments);
        };
        originalAddEventListener.call(ws, "message", onmessageWrapper);
      },
      configurable: true,
      enumerable: true
    });

    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  for (const key in OriginalWebSocket) {
    if (OriginalWebSocket.hasOwnProperty(key)) {
      window.WebSocket[key] = OriginalWebSocket[key];
    }
  }

  // Scan localStorage and sessionStorage for JWT or Bearer tokens
  function findTokenInStorage() {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        try {
          const key = storage.key(i);
          const val = storage.getItem(key);
          if (!val) continue;

          // 1. Direct Bearer token check
          if (val.startsWith("Bearer ")) {
            return val;
          }

          // 2. JWT token check (starts with eyJ and has 3 parts)
          if (val.startsWith("eyJ") && val.split(".").length === 3) {
            return "Bearer " + val;
          }

          // 3. Nested JSON check
          if (val.trim().startsWith("{") || val.trim().startsWith("[")) {
            const obj = JSON.parse(val);
            if (obj && typeof obj === "object") {
              const tokenKeys = ["accessToken", "access_token", "token", "jwtToken", "jwt", "authorization"];
              for (const tk of tokenKeys) {
                if (obj[tk] && typeof obj[tk] === "string") {
                  const subVal = obj[tk];
                  if (subVal.startsWith("Bearer ")) return subVal;
                  if (subVal.startsWith("eyJ") && subVal.split(".").length === 3) return "Bearer " + subVal;
                  return "Bearer " + subVal;
                }
              }
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    return null;
  }

  // Scan cookies for token
  function findTokenInCookies() {
    try {
      const cookies = document.cookie.split("; ");
      for (const cookie of cookies) {
        const parts = cookie.split("=");
        const val = decodeURIComponent(parts.slice(1).join("="));
        if (val.startsWith("Bearer ")) {
          return val;
        }
        if (val.startsWith("eyJ") && val.split(".").length === 3) {
          return "Bearer " + val;
        }
      }
    } catch (err) {
      // Ignore cookie errors
    }
    return null;
  }

  // Scan for token
  function scanForToken() {
    return findTokenInStorage() || findTokenInCookies();
  }

// Hook into window.fetch to capture Authorization Token and API Domain dynamically
  const originalFetch = window.fetch;
  window.fetch = async function (resource, options) {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    
    // Skip interception for Fyers internal telemetry/logging endpoints.
    // These URLs are rate-limited and our interception only causes console noise.
    const isSkippedUrl = url.includes("/fe_hwk_logs/") || url.includes("/fe_logs/") || url.includes("/analytics/") || url.includes("/telemetry/");
    if (isSkippedUrl) {
      return originalFetch.apply(this, arguments);
    }
    
    // Keep the authorization value paired with the domain from the same request.
    // Fyers' trading UI sends its JWT without a "Bearer " prefix. Other page
    // services (for example Hawkeye) use unrelated Bearer tokens and must not
    // replace an already captured raw trading token.
    const requestHeaders = options?.headers || resource?.headers;
    let auth = null;
    if (requestHeaders instanceof Headers) {
      auth = requestHeaders.get("Authorization");
    } else if (Array.isArray(requestHeaders)) {
      const authHeader = requestHeaders.find(([name]) => String(name).toLowerCase() === "authorization");
      auth = authHeader?.[1] || null;
    } else if (requestHeaders && typeof requestHeaders === "object") {
      auth = requestHeaders.Authorization || requestHeaders.authorization || null;
    }

    const domainMatch = url.match(/https:\/\/[a-zA-Z0-9\-\.]+\.fyers\.in/);
    const isRawTradingToken = auth?.startsWith("eyJ") && auth.split(".").length === 3;
    const hasRawTradingToken = window.__fyersAuthToken?.startsWith("eyJ");
    const shouldCaptureAuth = isRawTradingToken || (auth?.startsWith("Bearer ") && !hasRawTradingToken);

    if (shouldCaptureAuth && domainMatch) {
      const domain = domainMatch[0];
      if (window.__fyersAuthToken !== auth || window.__fyersApiBaseUrl !== domain) {
        window.__fyersAuthToken = auth;
        window.__fyersApiBaseUrl = domain;
        logDebug(`Captured paired trading authorization and API domain: ${domain}`);
        dispatchTokenCaptured();
      }
    }

    // Capture request payload for logging
    let requestBody = null;
    if (options && options.body) {
      try {
        if (typeof options.body === "string") {
          requestBody = JSON.parse(options.body);
        } else {
          requestBody = options.body;
        }
      } catch (e) {
        requestBody = String(options.body);
      }
    }

    // Always re-throw network-level errors cleanly so Fyers' own error handlers
    // are not disrupted by our interception layer.
    let response;
    try {
      response = await originalFetch.apply(this, arguments);
    } catch (networkError) {
      throw networkError;
    }

    // Passive Interception: Read responses of successful page fetches
    try {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      let resBody = null;
      try {
        resBody = text ? JSON.parse(text) : null;
      } catch (e) {
        resBody = text;
      }

      // Log Fyers API network calls
      if (url.includes("fyers.in")) {
        window.dispatchEvent(new CustomEvent("fyers-network-call", {
          detail: {
            url: url,
            payload: {
              method: options?.method || "GET",
              requestBody: requestBody,
              responseStatus: response.status,
              responseBody: resBody
            }
          }
        }));

        // Special: capture order POST requests from the Fyers UI so we can learn the exact format
        if (url.includes("/orders") && options?.method === "POST") {
          logDebug("[ORDER CAPTURE] Fyers UI placed order!", { url, requestBody, status: response.status, responseBody: resBody });
          window.dispatchEvent(new CustomEvent("fyers-order-request-captured", {
            detail: { url, requestBody, status: response.status, responseBody: resBody }
          }));
        }
      }

      if (response.ok && (url.includes("/orders") || url.includes("/positions"))) {
        const body = resBody;
        if (body) {
          // If it is the order book (GET)
          if (url.includes("/orders") && !url.includes("/orders/bo") && (!options || options.method === "GET" || !options.method)) {
            window.dispatchEvent(new CustomEvent(PAGE_ORDERS_EVENT, { detail: body }));
          } 
          // If it is positions (GET)
          else if (url.includes("/positions") && (!options || options.method === "GET" || !options.method)) {
            window.dispatchEvent(new CustomEvent(PAGE_POSITIONS_EVENT, { detail: body }));
          }
        }
      }
    } catch (err) {
      // Interception errors suppressed — never let our hook break Fyers' page
    }

    return response;
  };

  function dispatchTokenCaptured() {
    if (window.__fyersAuthToken) {
      window.dispatchEvent(new CustomEvent("fyers-token-captured", {
        detail: {
          token: window.__fyersAuthToken,
          baseUrl: window.__fyersApiBaseUrl || "https://api.fyers.in"
        }
      }));
    }
  }

  // Run initial scan on load
  const initialToken = scanForToken();
  if (initialToken) {
    window.__fyersAuthToken = initialToken;
    logDebug("Found token in storage/cookies on startup!");
    setTimeout(dispatchTokenCaptured, 200);
  } else {
    logDebug("Waiting for Fyers page fetch requests to capture token...");
  }
})();
