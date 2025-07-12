console.log('Its from content.js file')

function createUi() {
  // let url = 'https://kite.zerodha.com/positions';
  let url = location.href;

  if (url.includes("/positions")) {
    createPositionsPanel();
  } else if (url.includes("/holdings")){
    createHoldingsUi()
  }
}

setTimeout(() => {
  createUi(); // writing this in settimeout because sometimes window.onload won't work(in very few cases)
  
}, 3000);