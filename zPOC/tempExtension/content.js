// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === "sendData") {
//         console.log("Received data in content script:", message.data);

//         // Example: Modify webpage based on received data
//         document.body.style.backgroundColor = message.data;
//     }
// });


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendData") {
        document.body.style.backgroundColor = message.data;
    }
});
