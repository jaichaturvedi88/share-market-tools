console.log("Hi! from content-utils.js");
const POSITIONS = {
  SYMBOL: '',
  BOOKED_PNL: 0,
  CURRENT_INVESTED: 0,
  CURRENT_PNL: 0,
  COUNT_CE: 0,
  COUNT_PE: 0
}
let PRODUCT_TYPE = {
  NRML: 'NRML'
}

function createPositionsPanel() {
  let wrapper = document.createElement('div');
  wrapper.innerHTML = `    
<div id="open-position-report" class="open-position-report-in-tabular-form">
    <div><span>Book: </span><span id="amount-booked">0</span></div>
    <div><span>Invest: </span><span id="amount-invested">0</span></div>
    <div><span>Cur PnL: </span><span id="current-pnl"></span></div>
    <div><span>CE: </span><span id="count-ce"></span></div>
    <div><span>PE: </span><span id="count-pe"></span></div>
    
    <div class="border border-success">
      <span class="">
        <label class="form-check-label" for="hide-completed-trades">Hide 0</label>      
        <input class="form-check-input" type="checkbox" role="switch" id="hide-completed-trades" >
      </span>
      <span class="">
        <label class="form-check-label" for="display-in-table-form">Table</label>      
        <input class="form-check-input" type="checkbox" role="switch" id="display-in-table-form" checked>
      </span>
    </div>

    <input id="refreshPnl" class="refresh-button" type="button" value="&#x21bb;">
</div>
`;

  //        
  //  style="width:50%"

  let refreshPnl = wrapper.querySelector('#refreshPnl');
  refreshPnl.onclick = function () {
    refreshPositionsPnl();
  };

  let openPositionsHeader = document.querySelector('section.open-positions.table-wrapper');
  openPositionsHeader.insertAdjacentElement("afterend", wrapper)

  makeDivDraggable();
  refreshPositionsPnl();  // Refresh pnl on every click
  startAutoRefresOfPnl(2); // This will auto refresh the Pnl panel after n number of minutes
  showDataInTableFormat();
  hideCompletedTrades();
}

function hideCompletedTrades() {
  const checkbox = document.getElementById('hide-completed-trades');

  checkbox.addEventListener('change', () => {
    let positionsTable = document.querySelector('div.table-wrapper > table > tbody');
    let currentPositions = positionsTable.querySelectorAll('tr')

    currentPositions.forEach(tr => {
      let productType = tr.querySelector('td[data-label="Product"] > span').textContent?.toUpperCase()?.trim();
      let quantity = readNumberFromTableCell(tr, 'td[data-label="Qty."] > span');

      if (productType === PRODUCT_TYPE.NRML) {
        if (quantity === 0 & checkbox.checked) {
          tr.style.display = 'none';
        } else {
          tr.style.display = "table-row";
        }
      }

      // console.log(POSITIONS.SYMBOL);
    });
  });
}

function showDataInTableFormat() {
  const checkbox = document.getElementById('display-in-table-form');
  const reportDiv = document.getElementById('open-position-report');

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      reportDiv.classList.remove('open-position-report-horizontal');
      reportDiv.classList.add('open-position-report-in-tabular-form');
    } else {
      reportDiv.classList.add('open-position-report-horizontal');
      reportDiv.classList.remove('open-position-report-in-tabular-form');
    }
  });
}

function makeDivDraggable() {
  const dragElement = document.getElementById("open-position-report");
  let offsetX = 0, offsetY = 0, isDragging = false;

  // Dragging Functionality
  dragElement.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - dragElement.getBoundingClientRect().left;
    offsetY = e.clientY - dragElement.getBoundingClientRect().top;
    dragElement.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      dragElement.style.left = e.clientX - offsetX + "px";
      dragElement.style.top = e.clientY - offsetY + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    dragElement.style.cursor = "grab";
  });
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
  let positions = { ...POSITIONS };
  let positionsTable = document.querySelector('div.table-wrapper > table > tbody');
  let currentPositions = positionsTable.querySelectorAll('tr')


  currentPositions.forEach(tr => {

    let productType = tr.querySelector('td[data-label="Product"] > span').textContent?.toUpperCase()?.trim();
    let symbol = tr.querySelector('td[data-label="Instrument"] > a > span.tradingsymbol').textContent;
    let quantity = readNumberFromTableCell(tr, 'td[data-label="Qty."] > span');
    let avgPrice = readNumberFromTableCell(tr, 'td[data-label="Avg."] > span');
    let pnl = readNumberFromTableCell(tr, 'td[data-label="P&L"] > span')

    if (productType === PRODUCT_TYPE.NRML) {
      if (quantity > 0) {
        positions.CURRENT_INVESTED += quantity * avgPrice;
        positions.CURRENT_PNL += Number.isNaN(pnl) ? 0 : pnl;
        symbol.includes(" CE") ? positions.COUNT_CE += 1 : positions.COUNT_PE += 1;
      } else {
        positions.BOOKED_PNL += Number.isNaN(pnl) ? 0 : pnl;
      }
    }

    // console.log(positions.SYMBOL);
  });

  console.log(positions)

  updatePositionsPanel(positions);
}

function readNumberFromTableCell(row, selector) {
  return parseFloat(row.querySelector(selector).textContent.replaceAll(',', ''));
}

function updatePositionsPanel(POSITIONS) {
  console.log('UPDATING Pnl Panle....');
  document.querySelector('#amount-booked').textContent = POSITIONS.BOOKED_PNL.toFixed(2);
  document.querySelector('#amount-invested').textContent = POSITIONS.CURRENT_INVESTED.toFixed(2);
  document.querySelector('#current-pnl').textContent = POSITIONS.CURRENT_PNL.toFixed(2);
  document.querySelector('#count-ce').textContent = POSITIONS.COUNT_CE;
  document.querySelector('#count-pe').textContent = POSITIONS.COUNT_PE;
  updateSpanColor(); // Call function on page load
}

function updateSpanColor() {
  const span = document.getElementById("current-pnl");
  const value = parseFloat(span.textContent); // Convert text to number

  if (value > 0) {
    span.classList.add("positive");
    span.classList.remove("negative");
  } else if (value < 0) {
    span.classList.add("negative");
    span.classList.remove("positive");
  }
}