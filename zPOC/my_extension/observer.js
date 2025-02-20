function observeDOMChanges() {
    const observer = new MutationObserver(() => {
        highlightWord("Bank", "highlight-bank"); // Re-run highlighting when the page updates
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

observeDOMChanges();