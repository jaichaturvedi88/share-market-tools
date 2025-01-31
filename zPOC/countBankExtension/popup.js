document.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: countALetters
        }, (results) => {
            if (results && results[0]) {
                document.getElementById("count").textContent = results[0].result;
            }
        });
    });
});

function countALetters() {
    const text = document.body.innerText;
    const count = (text.match(/Bank/gi) || []).length;
    return count;
}