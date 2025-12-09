const listEl = document.getElementById("snippetList");
const previewEl = document.getElementById("previewArea");
const searchEl = document.getElementById("search");
const copyBtn = document.getElementById("copyBtn");
const hiddenSnippets = document.querySelectorAll(".hiddenSnippet");


let snippets = [];

// Load snippet names and content
hiddenSnippets.forEach(s => {
  snippets.push({
    name: s.dataset.name,
    code: s.innerText
  });
});

function displayList(arr) {
  listEl.innerHTML = "";
  arr.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.name;
    li.addEventListener("click", () => {
      previewEl.textContent = item.code;
    });
    listEl.appendChild(li);
  });
}

// Copy to clipboard
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(previewArea.textContent).then(() => {
    copyBtn.textContent = "✔";
    setTimeout(() => (copyBtn.textContent = "📋"), 1200);
  });
});

// Search filter
searchEl.addEventListener("keyup", e => {
  const value = e.target.value.toLowerCase();
  displayList(snippets.filter(s => s.name.toLowerCase().includes(value)));
});

// Initial load
displayList(snippets);