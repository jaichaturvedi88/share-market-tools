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

  // let screenerName = "Monthly %Ch > 10";
  var screenerName = prompt("Screener Name?");
  let screenerList = document.querySelectorAll("div.truncate:not(.text-gray-600)");
  // let stockList = [];
  let stockListAsTxt = "";

  screenerList.forEach(node => {
    if (node.innerText.trim() === screenerName.trim()) {
      // screenerNode = node.parentNode.parentNode.parentNode.parentNode;
      let screenerNode = node.closest(".vue-grid-item");
      let tableRows = screenerNode.querySelectorAll('tr')

      tableRows.forEach((row, idx) => {
        if (idx > 0) {
          let stock = row.querySelector('td>span>a').innerText;
          // stockList.push(stock);
          stockListAsTxt += "NSE:" + stock + "-EQ\n";
        }
      });
    }
  });
  navigator.clipboard.writeText(stockListAsTxt);
  console.log(stockListAsTxt)
  // createTextFile(stockListAsTxt);
}

function initiateWatchlistCreationCode() {

  let wrapper = document.createElement('div');
  wrapper.innerHTML = `<a title="Create Watchlist" onclick="createWatchlist()" 
    class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
    <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">
    Download Watchlist</span></a>`;
  let anchor = wrapper.firstChild;

  let refreshButton = document.querySelector('div[title="Toggle auto refresh"');
  refreshButton.insertAdjacentElement("afterend", anchor)

  console.log(refreshButton);
}

initiateWatchlistCreationCode();