console.log('Its from content.js file')

function createUi(url) {
  const holdingsUI = document.querySelector('div.calculator');
  if (url.includes("/positions")) {
    positions.createPositionsPanel();
    holdingsUI.remove();
  } else if (url.includes("/holdings")){
    holdings.createHoldingsUi()
  }
}

setTimeout(() => {
  createUi(location.href); // writing this in settimeout because sometimes window.onload won't work(in very few cases)
  
}, 3000);

let currentUrl = location.href;

const observer = new MutationObserver(() => {
  if (location.href !== currentUrl) {
    console.log("URL changed:", location.href);
    currentUrl = location.href;

    // Run your logic here
    onUrlChange(location.href);
  }
});

observer.observe(document, { subtree: true, childList: true });

function onUrlChange(newUrl) {
  console.log("Reacting to new URL:", newUrl);
  createUi(newUrl);
}