chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_logs") {
    chrome.tabs.create({ url: chrome.runtime.getURL("logs.html") });
    sendResponse({ ok: true });
  }
});
