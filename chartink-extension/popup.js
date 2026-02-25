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
    // <input type="text" name="" id="watchlistName"></input>
    wrapper.innerHTML = `
                        <select id="screeners"> </select>
                        <a id="createFyersWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
                            <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">Fyers WL</span>
                        </a>
                        <a id="createTvWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-1 md:px-2 rounded mr-2">
                            <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">TV Watchlist</span>
                        </a>
                      `;

    let screeners = wrapper.querySelector('#screeners');
    let createFyersWL = wrapper.querySelector('#createFyersWL');
    let copyTvWL = wrapper.querySelector('#createTvWL');

    Object.assign(screeners.style, {
      backgroundColor: '#111827',
      color: '#e5e7eb',
      border: '1px solid #626a75',
      borderRadius: '6px',
      padding: '6px 10px',
      marginRight: '8px',
      minWidth: '220px'
    });

    let refreshButton = document.querySelector('div[title="Toggle Auto Refresh"');
    refreshButton.insertAdjacentElement("afterend", createFyersWL)
    refreshButton.insertAdjacentElement("afterend", copyTvWL)
    refreshButton.insertAdjacentElement("afterend", screeners)

    let screenerList = document.querySelectorAll("div.truncate:not(.text-gray-600)");

    createWatchlistDropdown(screeners, screenerList)

    let screenerName = '';
    screeners.addEventListener("change", () => {
      screenerName = screeners.value;
    });

    let stockListAsTxt = "";

    createFyersWL.onclick = function () {
      console.log('creating watchlist...');
      // var screenerName = document.querySelector('#watchlistName').value;

      stockListAsTxt = getWatchlist(screenerList, screenerName, "Fyers");
      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
    };


    copyTvWL.onclick = function () {
      // var screenerName = document.querySelector('#watchlistName').value;

      stockListAsTxt = getWatchlist(screenerList, screenerName, "TradingView");
      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
    }

    console.log(refreshButton);
  }

  function createWatchlistDropdown(screeners, screenerList) {
    screenerList.forEach(screener => {
      let screenerName = screener.innerText;;
      const option = document.createElement("option");
      option.value = screenerName;
      option.textContent = screenerName;
      option.style.backgroundColor = '#111827';
      option.style.color = '#e5e7eb';
      screeners.appendChild(option);
    });
  }

  function getWatchlist(screenerList, screenerName, watchlistType = "Fyers") {
    stockListAsTxt = '';
    screenerList.forEach(node => {
      if (node.innerText.trim() === screenerName.trim()) {
        let screenerNode = node.closest(".vue-grid-item");
        let tableRows = screenerNode.querySelectorAll('tr')

        tableRows.forEach((row, idx) => {
          if (idx > 0) {
            // let stock = row.querySelector('td > span > div > a').innerText;
            if (row.querySelector('td[data-field="symbol"] a')) {
              let stock = row.querySelector('td[data-field="symbol"] a').innerText;
              console.log(stock)
              if (watchlistType === "Fyers")
                stockListAsTxt += "NSE:" + stock + "-EQ, ";
              else
                stockListAsTxt += "NSE:" + stock + ", ";
            }
          }
        });
      }
    });
    return stockListAsTxt;
  }

  function createScreenerButton() {
    const Platform = Object.freeze({
      FYERS: "fyers",
      TRADING_VIEW: "tradingview"
    });

    let wrapper = document.createElement('div');
    wrapper.innerHTML = `<button type="button" data-toggle="tooltip" id="copy-scan-as-fyers-wl" class="btn bg-blue-500" style="color:antiquewhite">
                          <i aria-hidden="true" ></i>Copy WL
                        </button>
                        <button type="button" data-toggle="tooltip" id="copy-scan-as-tv-wl" class="btn bg-blue-500" style="color:antiquewhite">
                          <i aria-hidden="true" ></i>Copy TV Wl
                        </button>
                      `;

    let btnScanAsFyersWl = wrapper.querySelector('#copy-scan-as-fyers-wl');
    let btnScanAsTvWl = wrapper.querySelector('#copy-scan-as-tv-wl');
    btnScanAsFyersWl.onclick = function () {
      console.log('creating watchlist...');
      let stockListAsTxt = copyScanWatchlist(Platform.FYERS)

      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
      // createTextFile(stockListAsTxt);
    }

    btnScanAsTvWl.onclick = function () {
      let stockListAsTxt = copyScanWatchlist(Platform.FYERS)

      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
    }
    let refreshButton = document.querySelector('button#view_backtest');
    refreshButton.insertAdjacentElement("afterend", btnScanAsFyersWl)
    refreshButton.insertAdjacentElement("afterend", btnScanAsTvWl)

    console.log(refreshButton);
  }

  function copyScanWatchlist(platform) {
    let stockListAsTxt = "";
    let tableRows = document.querySelectorAll('table.scan_results_table tr')
    tableRows.forEach((row, idx) => {
      if (idx > 0) {  //Exclude header row
        let stockSymbol = row.querySelectorAll("td")[2].innerText; //Symbol is the 3rd column
        if (platform === platform.FYERS) {
          stockListAsTxt += "NSE:" + stockSymbol + "-EQ\n";
        } else {
          // This -EQ will give Composite Symbols. The result is quite different than actual NSE symbol's data
          // stockListAsTxt += "NSE:" + stockSymbol + "-EQ,"; 
          stockListAsTxt += "NSE:" + stockSymbol + ",";
        }
      }
    });
    return stockListAsTxt;
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