console.log('Its from content.js file')

function addPositionsReport() {
  let url = 'https://kite.zerodha.com/positions';
  if (url.includes("/positions")) {
    createPositionsPanel();
  }

  function createPositionsPanel() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = `    
      <div id="open-position-report" style="display:flex; justify-content:space-around">
          <div style=""><span>Booked: </span><span id="amount-booked">0</span></div>
          <div style=""><span>Invested: </span><span id="amount-invested">0</span></div>
          <div style=""><span>Cur PnL: </span><span id="current-pnl"></span></div>
          <div style=""><span>CE: </span><span id="count-ce"></span></div>
          <div style=""><span>PE: </span><span id="count-pe"></span></div>
          <input id="refreshPnl" class="refresh-button" type="button" value="&#x21bb;">
      </div>
    `;
  
    let refreshPnl = wrapper.querySelector('#refreshPnl');
    refreshPnl.onclick = function () {
      refreshPositionsPnl();
    };
  
    let openPositionsHeader = document.querySelector('section.open-positions.table-wrapper');
    openPositionsHeader.insertAdjacentElement("afterend", wrapper)
    refreshPositionsPnl();  // Refresh pnl on every click

    startAutoRefresOfPnl(1); // This will auto refresh the Pnl panel after n number of minutes
  }
  
  function startAutoRefresOfPnl(minutes) {
    console.log(`Auto refresh happens in every ${minutes} minutes`)
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Time in minutes
      const stopTime = 15 * 60 + 30; // 3:30 PM in minutes
      if (currentTime >= stopTime) {
        clearInterval(interval); // Stop the interval
        console.log("Stopped refreshing at:", now.toLocaleTimeString());
      } else {
        console.log("Started refreshing at:", now.toLocaleTimeString());
        refreshPositionsPnl(); // Execute the refresh function
      }
    }, minutes * 60 * 1000); // 3 minutes interval
  }
  
  function refreshPositionsPnl() {
    // console.log('Refreshing Pnl...')
  
    let positionsTable = document.querySelector('div.table-wrapper > table > tbody');
    let currentPositions = positionsTable.querySelectorAll('tr')
    let POSITIONS = {
      SYMBOL: '',
      BOOKED_PNL: 0,
      CURRENT_INVESTED: 0,
      CURRENT_PNL: 0,
      COUNT_CE: 0,
      COUNT_PE: 0
    }
  
    currentPositions.forEach(tr => {
      let symbol = tr.querySelector('td[data-label="Instrument"] > a > span.tradingsymbol').textContent;
      let quantity = tr.querySelector('td[data-label="Qty."] > span').textContent;
      let avgPrice = tr.querySelector('td[data-label="Avg."] > span').textContent;
      let pnl = parseFloat(tr.querySelector('td[data-label="P&L"] > span').textContent.replaceAll(',', ''));
  
      if (quantity != 0) {
        POSITIONS.CURRENT_INVESTED += quantity * avgPrice;
        POSITIONS.CURRENT_PNL += Number.isNaN(pnl) ? 0 : pnl;
        symbol.includes(" CE") ? POSITIONS.COUNT_CE += 1 : POSITIONS.COUNT_PE += 1;
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
    document.querySelector('#amount-booked').textContent = POSITIONS.BOOKED_PNL.toFixed(2);
    document.querySelector('#amount-invested').textContent = POSITIONS.CURRENT_INVESTED.toFixed(2);
    document.querySelector('#current-pnl').textContent = POSITIONS.CURRENT_PNL.toFixed(2);
    document.querySelector('#count-ce').textContent = POSITIONS.COUNT_CE;
    document.querySelector('#count-pe').textContent = POSITIONS.COUNT_PE;

  }
}

window.onload = function () {
  console.log("Page fully loaded.");
  // addPositionsReport();
};

setTimeout(() => {
  addPositionsReport(); // writing this in settimeout because sometimes it will not work from window.onload (in very few cases)
}, 1000);