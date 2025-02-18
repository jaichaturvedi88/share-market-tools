function saveToStorage(key, value) {
    chrome.storage.local.set({ [key]: value });
}

function getFromStorage(key, callback) {
    chrome.storage.local.get([key], function(result) {
        callback(result[key]);
    });
}