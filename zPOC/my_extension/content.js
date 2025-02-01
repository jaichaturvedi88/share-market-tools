document.addEventListener("DOMContentLoaded", () => {
    const count = countOccurrences("Bank");
    createCountBox(count);
    highlightWord("Bank", "highlight-bank");
});