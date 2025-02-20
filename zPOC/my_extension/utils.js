function countOccurrences(word) {
    return (document.body.innerText.match(new RegExp(word, "gi")) || []).length;
}

function highlightWord(word, className) {
    const elements = document.querySelectorAll("body *:not(script):not(style):not(iframe):not(.custom-count-box)");
    elements.forEach(element => {
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.match(new RegExp(word, "gi"))) {
                const span = document.createElement("span");
                span.innerHTML = node.nodeValue.replace(new RegExp(`(${word})`, "gi"), `<span class="${className}">$1</span>`);
                node.replaceWith(span);
            }
        });
    });
}