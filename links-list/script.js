function fetchJSONData() {
  fetch("links.json")
    .then((response) => response.json())
    .then((jsonData) => displayDataAsLinks(jsonData));
}
fetchJSONData();

function displayDataAsLinks(data) {
  let normalLinksContainer = document.querySelector(".normalLinksDiv");
  let intradayLinksContainer = document.querySelector(".intradaylinksdiv");
  let shortTermLinksContainer = document.querySelector(".shortTermLinksDiv");
  let longTermLinksContainer = document.querySelector(".longTermLinksDiv");
  let dataLength = Object.getOwnPropertyNames(data).length; // required for terminating condition of outer loop
  for (let outerIndex = 0; outerIndex < dataLength; outerIndex++) {
    let subObjectName = Object.getOwnPropertyNames(data)[outerIndex];
    let subObjectLength = Object.keys(data[`${subObjectName}`]).length; // required for terminating condition inner loop
    for (let innerIndex = 0; innerIndex < subObjectLength; innerIndex++) {
      let anchor = document.createElement("a");
      anchor.style.display = "block";
       if (!Array.isArray(data[`${subObjectName}`])) { //this line will check if direct child of data is an array or an object
        anchor.innerHTML = Object.keys(data[`${subObjectName}`])[innerIndex];
        anchor.href = Object.values(data[`${subObjectName}`])[innerIndex];
        normalLinksContainer.appendChild(anchor);
      } 
      else {
        anchor.innerHTML = data[`${subObjectName}`][innerIndex].title;
        anchor.href = data[`${subObjectName}`][innerIndex].url;
        if (subObjectName === "intraday") {
          intradayLinksContainer.appendChild(anchor);
        }
        if (subObjectName === "short-term") {
          shortTermLinksContainer.appendChild(anchor);
        }
        if (subObjectName === "long-term") {
          longTermLinksContainer.appendChild(anchor);
        }
      }
    }
  }
}
