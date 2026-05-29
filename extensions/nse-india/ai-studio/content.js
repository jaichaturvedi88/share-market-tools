// Create the UI Panel
const panel = document.createElement('div');
panel.id = 'pcr-tracker-panel';
panel.innerHTML = `
  <div class="pcr-header" id="pcr-drag-handle">
    <h3>PCR Tracker (AI Studio)</h3>
    <button id="pcr-close">×</button>
  </div>
  <div class="pcr-controls-row">
    <div class="pcr-scale-container">
      <div class="pcr-scale-labels">
        <span style="left: 10%">S.Bull</span>
        <span style="left: 30%">Bull</span>
        <span style="left: 50%">Neut</span>
        <span style="left: 70%">Bear</span>
        <span style="left: 90%">S.Bear</span>
      </div>
      <div class="pcr-scale-bar">
        <div class="pcr-segment s-bull" title="Strong Bullish (< 0.6)"></div>
        <div class="pcr-segment bull" title="Bullish (0.6 - 0.85)"></div>
        <div class="pcr-segment neut" title="Neutral (0.85 - 1.15)"></div>
        <div class="pcr-segment bear" title="Bearish (1.15 - 1.5)"></div>
        <div class="pcr-segment s-bear" title="Strong Bearish (> 1.5)"></div>
        <div id="pcr-indicator" class="pcr-indicator"></div>
      </div>
      <div class="pcr-scale-values">
        <span style="left: 20%">0.6</span>
        <span style="left: 40%">0.85</span>
        <span style="left: 60%">1.15</span>
        <span style="left: 80%">1.5</span>
      </div>
    </div>
  </div>
  <div class="pcr-controls-row">
    <div class="control-group">
      <label>Interval (sec):</label>
      <input type="number" id="pcr-interval" value="300" min="1">
    </div>
    <button id="pcr-toggle">Start</button>
    <button id="pcr-clear-db">Clear Db</button>
  </div>
  <div class="pcr-status-row">
    <div class="pcr-status">Status: <span id="pcr-status-text">Idle</span></div>
    <div class="pcr-sentiment">Sentiment: <span id="pcr-sentiment-text">-</span></div>
  </div>
  <div class="pcr-table-container">
    <table id="pcr-history-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>CE OI <span style="color: #ff7676; font-weight: 900; font-size: 1.2em; -webkit-text-stroke: 0.5px #ff7676;">⬇</span></th>
          <th>PE OI <span style="color: #66cc66; font-weight: 900; font-size: 1.2em; -webkit-text-stroke: 0.5px #66cc66;">⬆</span></th>
          <th>PCR</th>
        </tr>
      </thead>
      <tbody id="pcr-history-body"></tbody>
    </table>
  </div>
  <div class="pcr-pagination">
    <button id="pcr-prev" disabled>Prev</button>
    <span id="pcr-page-info">Page 1 of 1</span>
    <button id="pcr-next" disabled>Next</button>
  </div>
`;
document.body.appendChild(panel);

// Draggable Logic
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

const dragHandle = document.getElementById('pcr-drag-handle');

dragHandle.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
  initialX = e.clientX - xOffset;
  initialY = e.clientY - yOffset;

  if (e.target === dragHandle || dragHandle.contains(e.target)) {
    isDragging = true;
  }
}

function drag(e) {
  if (isDragging) {
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    setTranslate(currentX, currentY, panel);
  }
}

function setTranslate(xPos, yPos, el) {
  el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function dragEnd(e) {
  initialX = currentX;
  initialY = currentY;
  isDragging = false;
}

let isRunning = false;
let timer = null;
let currentPage = 1;
let rowsPerPage = 10;
let fullHistory = [];

// Load history from storage
chrome.storage.local.get(['pcr_history'], (result) => {
  if (result.pcr_history && result.pcr_history.length > 0) {
    fullHistory = result.pcr_history;
    updateTable();
    updateIndicator(fullHistory[0].pcr);
    document.getElementById('pcr-sentiment-text').innerText = getSentiment(fullHistory[0].pcr);
  }
});

document.getElementById('pcr-toggle').addEventListener('click', toggleExtension);
document.getElementById('pcr-close').addEventListener('click', () => panel.style.display = 'none');
document.getElementById('pcr-clear-db').addEventListener('click', () => {
  fullHistory = [];
  chrome.storage.local.set({ pcr_history: [] }, () => {
    currentPage = 1;
    updateTable();
    document.getElementById('pcr-sentiment-text').innerText = '-';
    const indicator = document.getElementById('pcr-indicator');
    if (indicator) indicator.style.display = 'none';
  });
});
document.getElementById('pcr-prev').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    updateTable();
  }
});
document.getElementById('pcr-next').addEventListener('click', () => {
  const maxPage = Math.ceil(fullHistory.length / rowsPerPage) || 1;
  if (currentPage < maxPage) {
    currentPage++;
    updateTable();
  }
});

function isContextValid() {
  return chrome.runtime && !!chrome.runtime.getManifest();
}

function toggleExtension() {
  isRunning = !isRunning;
  const btn = document.getElementById('pcr-toggle');
  const status = document.getElementById('pcr-status-text');
  
  if (isRunning) {
    btn.innerText = 'Stop';
    btn.style.backgroundColor = '#ff4444';
    status.innerText = 'Running';
    
    // Initial calculation
    calculatePCR();
    
    const seconds = parseInt(document.getElementById('pcr-interval').value) || 300;
    timer = setInterval(() => {
      if (!isContextValid()) {
        console.log('Extension context invalidated. Stopping timer.');
        clearInterval(timer);
        return;
      }
      refreshAndCalculate();
    }, seconds * 1000);
  } else {
    btn.innerText = 'Start';
    btn.style.backgroundColor = '#007bff';
    status.innerText = 'Idle';
    if (timer) clearInterval(timer);
    timer = null;
  }
}

function refreshAndCalculate() {
  if (!isContextValid()) return;

  // Find the refresh button on the NSE page
  const refreshBtn = document.querySelector('a[onclick*="refreshOCPage"]') || 
                     document.querySelector('.refreshIcon')?.closest('a');
  
  if (refreshBtn) {
    console.log('Refreshing NSE Table...');
    refreshBtn.click();
    
    // Wait for the table to update (AJAX call) before calculating
    setTimeout(() => {
      if (isContextValid()) {
        console.log('Calculating PCR after refresh...');
        calculatePCR();
      }
    }, 5000);
  } else {
    console.error('NSE Refresh button not found. Calculating anyway...');
    calculatePCR();
  }
}

function getSentiment(pcr) {
  const val = parseFloat(pcr);
  if (val > 1.50) return "Strong Bearish";
  if (val >= 1.15) return "Bearish";
  if (val >= 0.85) return "Neutral";
  if (val >= 0.60) return "Bullish";
  return "Strong Bullish";
}

function updateIndicator(pcr) {
  const val = parseFloat(pcr);
  const indicator = document.getElementById('pcr-indicator');
  if (!indicator) return;

  let position = 50; // Default to neutral center

  if (val <= 0.6) {
    // Strong Bullish (0 - 0.6) -> 0% to 20%
    position = (val / 0.6) * 20;
  } else if (val <= 0.85) {
    // Bullish (0.6 - 0.85) -> 20% to 40%
    position = 20 + ((val - 0.6) / (0.85 - 0.6)) * 20;
  } else if (val <= 1.15) {
    // Neutral (0.85 - 1.15) -> 40% to 60%
    position = 40 + ((val - 0.85) / (1.15 - 0.85)) * 20;
  } else if (val <= 1.5) {
    // Bearish (1.15 - 1.5) -> 60% to 80%
    position = 60 + ((val - 1.15) / (1.5 - 1.15)) * 20;
  } else {
    // Strong Bearish (1.5 - 2.5+) -> 80% to 100%
    // Cap at 2.5 for visualization
    const cappedVal = Math.min(val, 2.5);
    position = 80 + ((cappedVal - 1.5) / (2.5 - 1.5)) * 20;
  }

  indicator.style.left = `${Math.max(0, Math.min(100, position))}%`;
  indicator.style.display = 'block';
}

function calculatePCR() {
  if (!isContextValid()) return;

  // Target the specific total row table provided by user
  const totalRowTable = document.querySelector('#equityOptionChainTotalRow');
  if (!totalRowTable) {
    console.error('NSE Total Row Table (#equityOptionChainTotalRow) not found');
    return;
  }

  const cells = totalRowTable.querySelectorAll('td');
  if (cells.length < 2) {
    console.error('NSE Total Row Table has insufficient columns');
    return;
  }

  // User specified: 2nd column for CE (index 1), 2nd last for PE (index length - 2)
  const ceCell = cells[1];
  const peCell = cells[cells.length - 2];

  const totCE = parseInt(ceCell.innerText.replace(/,/g, '').trim()) || 0;
  const totPE = parseInt(peCell.innerText.replace(/,/g, '').trim()) || 0;

  console.log(`Extracted Totals - CE: ${totCE}, PE: ${totPE}`);

  if (totCE > 0) {
    const pcr = (totPE / totCE).toFixed(2);
    const time = new Date().toLocaleTimeString();
    const sentiment = getSentiment(pcr);
    
    document.getElementById('pcr-sentiment-text').innerText = sentiment;
    updateIndicator(pcr);

    try {
      chrome.storage.local.get(['pcr_history'], (result) => {
        if (chrome.runtime.lastError) return;
        let history = result.pcr_history || [];
        // Only save if it's a new data point or different from last one
        if (history.length === 0 || history[0].pcr !== pcr || history[0].ce !== totCE || history[0].pe !== totPE) {
          saveData({ time, ce: totCE, pe: totPE, pcr });
        }
      });
    } catch (e) {
      console.log('Storage access failed - context likely invalidated');
    }
  }
}

function saveData(newData) {
  if (!isContextValid()) return;

  try {
    chrome.storage.local.get(['pcr_history'], (result) => {
      if (chrome.runtime.lastError) return;
      let history = result.pcr_history || [];
      history.unshift(newData);
      history = history.slice(0, 500); // Keep more history for pagination
      chrome.storage.local.set({ pcr_history: history }, () => {
        if (!chrome.runtime.lastError) {
          fullHistory = history;
          updateTable();
        }
      });
    });
  } catch (e) {
    console.log('Save failed - context likely invalidated');
  }
}

function updateTable() {
  const body = document.getElementById('pcr-history-body');
  const pageInfo = document.getElementById('pcr-page-info');
  const prevBtn = document.getElementById('pcr-prev');
  const nextBtn = document.getElementById('pcr-next');

  const maxPage = Math.ceil(fullHistory.length / rowsPerPage) || 1;
  if (currentPage > maxPage) currentPage = maxPage;

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = fullHistory.slice(start, end);

  body.innerHTML = pageData.map(item => `
    <tr>
      <td>${item.time}</td>
      <td>${item.ce?.toLocaleString() || item.ce || '-'}</td>
      <td>${item.pe?.toLocaleString() || item.pe || '-'}</td>
      <td>${parseFloat(item.pcr).toFixed(2)}</td>
    </tr>
  `).join('');

  // Fill empty rows to maintain height if requested (optional, but helps UI stability)
  if (pageData.length < rowsPerPage && currentPage === maxPage && rowsPerPage <= 25) {
    for (let i = pageData.length; i < rowsPerPage; i++) {
      body.innerHTML += `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
    }
  }

  pageInfo.innerText = `Page ${currentPage} of ${maxPage}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === maxPage;
}
