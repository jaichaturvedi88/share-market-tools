console.log('Its from content.js file')
// content.js
function countAndDisplayBank() {
    const text = document.body.innerText;
    const count = (text.match(/Bank/gi) || []).length;
    
    let displayDiv = document.createElement("div");
    displayDiv.innerText = `Word 'Bank' Count: ${count}`;
    displayDiv.classList.add("custom-count-box");
    
    document.body.appendChild(displayDiv);
}

// Inject CSS dynamically
function injectCSS() {
    const style = document.createElement("style");
    style.textContent = `
        
        .highlight-bank {
            background-color: yellow;
            color: red;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

function highlightBank() {
    const elements = document.querySelectorAll("body *:not(script):not(style):not(iframe):not(.custom-count-box)");
    elements.forEach(element => {
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.match(/Bank/gi)) {
                const span = document.createElement("span");
                span.innerHTML = node.nodeValue.replace(/(Bank)/gi, '<span class="highlight-bank">$1</span>');
                node.replaceWith(span);
            }
        });
    });
}

injectCSS();
countAndDisplayBank();
highlightBank();