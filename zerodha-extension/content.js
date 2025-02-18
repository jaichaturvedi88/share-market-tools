console.log('Its from content.js file')

function addPositionsReport() {
  let url = 'https://kite.zerodha.com/positions';
  if (url.includes("/positions")) {
    createPositionsPanel();
  }
}

setTimeout(() => {
  addPositionsReport(); // writing this in settimeout because sometimes window.onload won't work(in very few cases)
  
}, 1000);