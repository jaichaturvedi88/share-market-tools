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
    wrapper.innerHTML = `<a id="downloadWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
                            <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">Fyers WL</span>
                        </a>
                        <a id="createTvWL" class="bg-blue-500 cursor-pointer hover:bg-blue-700 text-white font-bold py-1 px-2 md:py-2 md:px-4 rounded mr-2">
                            <i class="fas fa-arrows-alt"></i><span class="hidden md:inline">Copy TV Watchlist</span>
                        </a>
                      `;
    // let anchor = wrapper.firstChild;
    let downloadWL = wrapper.querySelector('#downloadWL');
    downloadWL.onclick = function () {
      console.log('creating watchlist...');
      var screenerName = prompt("Screener Name?");
      let screenerList = document.querySelectorAll("div.truncate:not(.text-gray-600)");
      let stockListAsTxt = "";
  
      stockListAsTxt = getWatchlist(screenerList, screenerName, true);
      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
    };

    let copyTvWL = wrapper.querySelector('#createTvWL');
    copyTvWL.onclick = function() {
      var screenerName = prompt("Screener Name?");
      let screenerList = document.querySelectorAll("div.truncate:not(.text-gray-600)");
      let stockListAsTxt = "";
  
      stockListAsTxt = getWatchlist(screenerList, screenerName, false);
      navigator.clipboard.writeText(stockListAsTxt);
      console.log(stockListAsTxt)
    }
  
    let refreshButton = document.querySelector('div[title="Toggle auto refresh"');
    refreshButton.insertAdjacentElement("afterend", downloadWL)
    refreshButton.insertAdjacentElement("afterend", copyTvWL)
  
    console.log(refreshButton);
  }

  function getWatchlist(screenerList, screenerName, isDownloadWatchList = true) {
    stockListAsTxt = '';
    screenerList.forEach(node => {
      if (node.innerText.trim() === screenerName.trim()) {
        let screenerNode = node.closest(".vue-grid-item");
        let tableRows = screenerNode.querySelectorAll('tr')

        tableRows.forEach((row, idx) => {
          if (idx > 0) {
            let stock = row.querySelector('td>span>a').innerText;
            if (isDownloadWatchList) 
              stockListAsTxt += "NSE:" + stock + "-EQ\n";
            else
              stockListAsTxt += "NSE:" + stock + ",";
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

  function copyScanWatchlist(platform){
    let stockListAsTxt = "";
    let tableRows = document.querySelectorAll('table.scan_results_table tr')
    tableRows.forEach((row, idx) => {
      if (idx > 0) {  //Exclude header row
        let stockSymbol = row.querySelectorAll("td")[2].innerText; //Symbol is the 3rd column
        if(platform === platform.FYERS){
          stockListAsTxt += "NSE:" + stockSymbol + "-EQ\n";
        }else{
          stockListAsTxt += "NSE:" + stockSymbol + "-EQ,";
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