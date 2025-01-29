document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let activeTab = tabs[0];
    let activeTabUrl = activeTab.url;
    document.getElementById('url').textContent = activeTabUrl;

    document.getElementById('add-position-report').addEventListener('click', function () {
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          function: addPositionsReport,
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

function addPositionsReport(url) {
  if (url.includes("/positions")) {
    createPositionsPanel();
  } else {
    createScreenerButton();
  }

  function createPositionsPanel() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = `    
      <div id="open-position-report" style="display:flex; justify-content:center">
          <div style="width:25%"><span>Booked: </span><span id="amount-booked">0</span></div>
          <div style="width:25%"><span>Invested: </span><span id="amount-invested">0</span></div>
          <div style="width:25%"><span>Cur PnL: </span><span id="current-pnl"></span></div>
          <button id="refreshPnl" class="refresh-button">🔄</button>
      </div>
    `;

    startAutoRefresOfPnl();

    let refreshPnl = wrapper.querySelector('#refreshPnl');
    refreshPnl.onclick = function () {
      refreshPositionsPnl();
    };

    let openPositionsHeader = document.querySelector('section.open-positions.table-wrapper');
    openPositionsHeader.insertAdjacentElement("afterend", wrapper)
    refreshPositionsPnl();  // Refresh pnl very first time
  }

  function startAutoRefresOfPnl() {
    
    const interval = setInterval(() => {
      const now = new Date();
      console.log("Started refreshing at:", now.toLocaleTimeString());
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Time in minutes
      const stopTime = 15 * 60 + 30; // 3:30 PM in minutes

      if (currentTime >= stopTime) {
        clearInterval(interval); // Stop the interval
        console.log("Stopped refreshing at:", now.toLocaleTimeString());
      } else {
        refreshPositionsPnl(); // Execute the refresh function
      }
    }, 3 * 60 * 1000); // 5 minutes interval
  }

  function refreshPositionsPnl() {
    // console.log('Refreshing Pnl...')

    let positionsTable = document.querySelector('div.table-wrapper > table > tbody');
    let currentPositions = positionsTable.querySelectorAll('tr')
    let POSITIONS = {
      SYMBOL: '',
      BOOKED_PNL: 0,
      CURRENT_INVESTED: 0,
      CURRENT_PNL: 0
    }

    currentPositions.forEach(tr => {
      // POSITIONS.SYMBOL = tr.querySelector('td[data-label="Instrument"] > a > span.tradingsymbol').textContent;
      let quantity = tr.querySelector('td[data-label="Qty."] > span').textContent;
      let avgPrice = tr.querySelector('td[data-label="Avg."] > span').textContent;
      let pnl = parseFloat(tr.querySelector('td[data-label="P&L"] > span').textContent.replaceAll(',', ''));

      if (quantity != 0) {
        POSITIONS.CURRENT_INVESTED += quantity * avgPrice;
        POSITIONS.CURRENT_PNL += Number.isNaN(pnl) ? 0 : pnl;
      } else {
        POSITIONS.BOOKED_PNL += Number.isNaN(pnl) ? 0 : pnl;
      }
      // console.log(POSITIONS.SYMBOL);
    });

    console.log(POSITIONS)

    updatePositionsPanel(POSITIONS);
  }

  function updatePositionsPanel(POSITIONS) {
    console.log('UPDATING Pnl Panle....');
    document.querySelector('#amount-booked').textContent = POSITIONS.BOOKED_PNL;
    document.querySelector('#amount-invested').textContent = POSITIONS.CURRENT_INVESTED;
    document.querySelector('#current-pnl').textContent = POSITIONS.CURRENT_PNL;
  }
}
