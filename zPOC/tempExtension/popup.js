// document.addEventListener("DOMContentLoaded", function () {
//     document.getElementById("sendDataBtn").addEventListener("click", function () {
//         const dataToSend = "lightblue"; // Example data (background color)

//         // Send message to content script
//         chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//             chrome.scripting.executeScript({
//                 target: { tabId: tabs[0].id },
//                 function: (data) => {
//                     chrome.runtime.sendMessage({ action: "sendData", data });
//                 },
//                 args: [dataToSend]
//             });
//         });
//     });
// });


chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "sendData", data: "lightblue" });
});