chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
});

// chrome.action.onClicked.addListener((tab) => {
//     chrome.scripting.executeScript({
//         target: { tabId: tab.id },
//         files: ["content.js"]
//     });
// });


chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectScript
    });
});

function injectScript() {
    console.log('chrome.action.onClicked.addListener  11') 
    // Dynamically import the utils.js file
    import(chrome.runtime.getURL("utils.js")).then(module => {
        const { greet } = module;
        greet("Hello from dynamically imported module!");
    }).catch(error => {
        console.error("Error loading module:", error);
    });
}