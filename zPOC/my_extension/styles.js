function injectCSS() {
    const style = document.createElement("style");
    style.textContent = `
        .custom-count-box {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: black;
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 10000;
        }
        .highlight-bank {
            background-color: yellow;
            color: red;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

injectCSS();