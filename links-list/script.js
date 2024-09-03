function fetchJSONData() {
  fetch("links.json")
    .then((response) => response.json())
    .then((data) => displayDataAsLink(data));
}
fetchJSONData();

function displayDataAsLink(data) {
  let ulList = document.querySelector("ul");
  let objLength = Object.keys(data).length;

  for (let index = 0; index < objLength; index++) {
    let listItem = document.createElement("li");
    let anchor = document.createElement("a");
    let title = Object.keys(data)[index];
    anchor.innerHTML = title;
    anchor.href = Object.values(data)[index];
    listItem.appendChild(anchor);
    ulList.appendChild(listItem);
  }
}
