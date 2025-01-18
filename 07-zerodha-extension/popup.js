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
    createPositionPanel();
  } else {
    createScreenerButton();
  }

  function createPositionPanel() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = `    
      <div id="open-position-report" style="display:flex; justify-content:center">
          <div style="width:25%"><span>Booked: </span><span id="amount-booked">5000</span></div>
          <div style="width:25%"><span>Invested: </span><span id="amount-invested">157863</span></div>
          <div style="width:25%"><span>PnL: </span><span id="amount-pnl">-45678</span></div>
          <button id="refreshPnl">Refresh</button>
      </div>
    `;
    
    let refreshPnl = wrapper.querySelector('#refreshPnl');
    refreshPnl.onclick = function () {
      refreshPositionsPnl();
    };
  
    let openPositionsHeader = document.querySelector('section.open-positions.table-wrapper');
    openPositionsHeader.insertAdjacentElement("afterend", wrapper)

  }

  function refreshPositionsPnl(){
    console.log('Refreshing Pnl...')
  }
}

