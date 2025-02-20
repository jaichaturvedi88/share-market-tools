function createCountBox(count) {
    let displayDiv = document.createElement("div");
    displayDiv.innerText = `Word 'Bank' Count: ${count}`;
    displayDiv.classList.add("custom-count-box");

    document.body.appendChild(displayDiv);
}