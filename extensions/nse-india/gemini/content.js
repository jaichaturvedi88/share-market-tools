// Configuration Defaults
let refreshInterval = 5; // minutes
let pcrHistory = [];

// Create UI Elements
const floatingDiv = document.createElement('div');
floatingDiv.id = 'pcr-floating-window';
floatingDiv.innerHTML = `
    <div id="pcr-header">PCR Tracker (NIFTY)</div>
    <div id="pcr-current">Calculating...</div>
    <div id="pcr-history-container">
        <table id="pcr-history-table">
            <thead><tr><th>Time</th><th>PCR</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>
    <div class="pcr-controls">
        <small>Interval (min): </small>
        <input type="number" id="pcr-interval-input" value="${refreshInterval}" style="width:40px">
    </div>
`;
document.body.appendChild(floatingDiv);

// --- Functions ---

function calculatePCR() {
    // Select total OI cells based on the IDs in your HTML
    const callOIStr = document.getElementById('equityOptionChainTotalRow-CE-totOI')?.innerText.replace(/,/g, '');
    const putOIStr = document.getElementById('equityOptionChainTotalRow-PE-totOI')?.innerText.replace(/,/g, '');

    const callOI = parseFloat(callOIStr);
    const putOI = parseFloat(putOIStr);

    if (callOI && putOI) {
        const pcr = (putOI / callOI).toFixed(3);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateHistory(time, pcr);
    }
}

function updateHistory(time, pcr) {
    chrome.storage.local.get(['pcrData'], (result) => {
        let history = result.pcrData || [];
        
        // Only add if the last entry isn't identical (prevents duplicates on manual refresh)
        if (history.length === 0 || history[history.length - 1].pcr !== pcr) {
            history.push({ time, pcr });
            if (history.length > 10) history.shift(); // Keep last 10
            
            chrome.storage.local.set({ pcrData: history }, () => {
                renderTable(history, pcr);
            });
        } else {
            renderTable(history, pcr);
        }
    });
}

function renderTable(history, currentPcr) {
    document.getElementById('pcr-current').innerText = `Current PCR: ${currentPcr}`;
    const tbody = document.querySelector('#pcr-history-table tbody');
    tbody.innerHTML = history.slice().reverse().map(row => 
        `<tr><td>${row.time}</td><td>${row.pcr}</td></tr>`
    ).join('');
}

function triggerRefresh() {
    const refreshBtn = document.querySelector('.refreshIcon');
    if (refreshBtn) {
        refreshBtn.click();
        // Wait 3 seconds for data to load after click before calculating
        setTimeout(calculatePCR, 3000);
    }
}

// Draggable Logic
let isDragging = false;
floatingDiv.querySelector('#pcr-header').onmousedown = (e) => {
    isDragging = true;
    let offset = [floatingDiv.offsetLeft - e.clientX, floatingDiv.offsetTop - e.clientY];
    document.onmousemove = (ev) => {
        if (!isDragging) return;
        floatingDiv.style.left = (ev.clientX + offset[0]) + 'px';
        floatingDiv.style.top = (ev.clientY + offset[1]) + 'px';
    };
};
document.onmouseup = () => { isDragging = false; };

// Initialize
chrome.storage.local.get(['pcrData', 'interval'], (result) => {
    if (result.interval) refreshInterval = result.interval;
    if (result.pcrData) renderTable(result.pcrData, result.pcrData[result.pcrData.length-1].pcr);
    
    calculatePCR();
    setInterval(triggerRefresh, refreshInterval * 60 * 1000);
});

// Update interval on change
document.getElementById('pcr-interval-input').addEventListener('change', (e) => {
    const newInterval = parseInt(e.target.value);
    chrome.storage.local.set({ interval: newInterval });
    window.location.reload(); // Reload to apply new timer
});
