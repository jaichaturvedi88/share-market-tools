// USAGE: This script will be used on chartink. Once it is executed, it will create a button ion chartink. 
// On clicking the button it will ask which table to read data from. Once we tell the table by mention the table name, 
// it will create a watchlist and copy to clipboard as well as print in console.
// We can also download the files as csv if we call createTextFile function.

function createTextFile(columnData) {
  let link = document.createElement("a");
  let file = new Blob([columnData], { type: "text/plain" });
  link.href = URL.createObjectURL(file);
  link.download = "sample.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

function createWatchlist() {
  console.log('creating watchlist...');

  let tableRows = document.querySelectorAll('table.scan_results_table tr')
  // let stockList = [];
  let stockListAsTxt = "";

  tableRows.forEach((row,idx) => {
    if (idx>0) {  //Exclude header row
      // screenerNode = node.parentNode.parentNode.parentNode.parentNode;
      let stockSymbol = row.querySelectorAll("td")[2].innerText; //Symbol is the 3rd column
      stockListAsTxt += "NSE:" + stockSymbol + "-EQ\n";
    }
  });
  navigator.clipboard.writeText(stockListAsTxt);
  console.log(stockListAsTxt)
  // createTextFile(stockListAsTxt);
}

function initiateWatchlistCreationCode() {

  let wrapper = document.createElement('div');
  wrapper.innerHTML = `<button type="button" onclick="createWatchlist()" data-toggle="tooltip" id="save_as_scan" class="btn bg-blue-500" style="color:antiquewhite">
    <i aria-hidden="true" ></i>Create Watchlist </button>`;
  
  let anchor = wrapper.firstChild;
  let refreshButton = document.querySelector('button#view_backtest');
  refreshButton.insertAdjacentElement("afterend", anchor)

  console.log(refreshButton);
}

initiateWatchlistCreationCode();