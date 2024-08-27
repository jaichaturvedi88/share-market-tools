document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let activeTab = tabs[0];
    let activeTabUrl = activeTab.url;
    document.getElementById('url').textContent = activeTabUrl;

    document.getElementById('addButton').addEventListener('click', function () {
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          function: addButtonToPage,
          args: [activeTabUrl]
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          } else {
            console.log('Script executed successfully', results);
          }
        }
      );
    });
  });
});

function addButtonToPage(url) {
  if (url.includes("/dashboard")) {
    createDashboardButton();
  } else {
    createScreenerButton();
  }

  function createDashboardButton() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = `<a title="Create Watchlist"
      class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
      <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">
      Download Watchlist</span></a>`;
    let anchor = wrapper.firstChild;
    anchor.onclick = function () {
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
    };
  
    let refreshButton = document.querySelector('div[title="Toggle auto refresh"');
    refreshButton.insertAdjacentElement("afterend", anchor)
  
    console.log(refreshButton);
  }
  
  function createScreenerButton() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = `<button type="button" data-toggle="tooltip" id="save_as_scan" class="btn bg-blue-500" style="color:antiquewhite">
      <i aria-hidden="true" ></i>Create Watchlist </button>`;
  
    let anchor = wrapper.firstChild;
    anchor.onclick = function () {
      console.log('creating watchlist...');
  
      let tableRows = document.querySelectorAll('table.scan_results_table tr')
      // let stockList = [];
      let stockListAsTxt = "";
  
      tableRows.forEach((row, idx) => {
        if (idx > 0) {  //Exclude header row
          // screenerNode = node.parentNode.parentNode.parentNode.parentNode;
          let stockSymbol = row.querySelectorAll("td")[2].innerText; //Symbol is the 3rd column
          stockListAsTxt += "NSE:" + stockSymbol + "-EQ\n";
        }
      });
      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
      // createTextFile(stockListAsTxt);
    }
  
    let refreshButton = document.querySelector('button#view_backtest');
    refreshButton.insertAdjacentElement("afterend", anchor)
  
    console.log(refreshButton);
  }
}

document.getElementById('color-button').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: changeBodyColor
    });
  });
});

function changeBodyColor() {
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  // document.body.style.backgroundColor = getRandomColor();    // This will generate random colors
  document.body.style.backgroundColor = '#1d4f4a';
  document.body.style.color = '#244a26';
}