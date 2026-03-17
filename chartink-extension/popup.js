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
    const targetContainer = document.querySelector('#root > div > section:nth-child(2) > div.mt-4 > div.mx-5 > div');
    if (!targetContainer) {
      console.error('ChartInk extension: target container not found for dashboard controls.');
      return;
    }

    const existingWrapper = targetContainer.querySelector('#ci-dashboard-tools');
    if (existingWrapper) {
      existingWrapper.remove();
    }

    let wrapper = document.createElement('div');
    wrapper.id = 'ci-dashboard-tools';
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
      marginLeft: '16px',
      flexWrap: 'wrap',
      order: '999'
    });

    // <input type="text" name="" id="watchlistName"></input>
    wrapper.innerHTML = `
                        <select id="screeners"> </select>
                        <a id="createTvWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-1 md:px-2 rounded mr-2">
                            <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">TV Watchlist</span>
                        </a>
              <a id="createFyersWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
                <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">Fyers WL</span>
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

    targetContainer.appendChild(wrapper);

    function getScreenerListNodes() {
      const invalidLabels = new Set(["symbol", "ltp", "% ch", "volume"]);
      const isValidScreenerTitle = (node) => {
        if (!node) return false;
        const text = (node.innerText || '').trim();
        if (!text) return false;
        if (invalidLabels.has(text.toLowerCase())) return false;
        if (node.closest('table, thead, tbody, tr, th, td')) return false;
        return true;
      };

      const widgetTitles = [];
      const widgets = document.querySelectorAll('.vue-grid-item');
      widgets.forEach((widget) => {
        const candidates = widget.querySelectorAll('.truncate.font-semibold.leading-4, .truncate.font-semibold, .truncate');
        for (const node of candidates) {
          if (isValidScreenerTitle(node)) {
            widgetTitles.push(node);
            break;
          }
        }
      });

      if (widgetTitles.length > 0) {
        return widgetTitles;
      }

      const fallback = document.querySelectorAll('.truncate.font-semibold.leading-4');
      return Array.from(fallback).filter(isValidScreenerTitle);
    }

    const maxRetries = 25;
    const retryDelayMs = 250;

    const initializeWatchlistControls = (retryCount = 0) => {
      const screenerList = getScreenerListNodes();

      if (!screenerList || screenerList.length === 0) {
        if (retryCount < maxRetries) {
          setTimeout(() => initializeWatchlistControls(retryCount + 1), retryDelayMs);
        } else {
          console.warn('ChartInk extension: screener list is empty after retries.');
        }
        return;
      }

      console.log(screenerList);

      createWatchlistDropdown(screeners, screenerList)

      let screenerName = screeners.value || '';
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
      console.log('ChartInk extension: dashboard controls appended.', targetContainer);
    };

    initializeWatchlistControls();
  }

  function createWatchlistDropdown(screeners, screenerList) {
    screeners.innerHTML = '';
    const seen = new Set();
    screenerList.forEach(screener => {
      let screenerName = screener.innerText.trim();
      if (!screenerName || seen.has(screenerName)) {
        return;
      }
      seen.add(screenerName);
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