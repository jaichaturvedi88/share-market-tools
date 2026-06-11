const STORAGE_KEY = 'zerodha_gtt_sl_history';
let allHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-history').addEventListener('click', loadHistory);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
  document.getElementById('stock-filter').addEventListener('input', applyFilters);
  loadHistory();
});

function loadHistory() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    allHistory = result[STORAGE_KEY] || [];
    applyFilters();
  });
}

function clearHistory() {
  chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
    allHistory = [];
    applyFilters();
  });
}

function applyFilters() {
  const stockFilter = document.getElementById('stock-filter').value.trim().toUpperCase();
  const filteredHistory = stockFilter
    ? allHistory.filter((entry) => String(entry.symbol || '').toUpperCase().includes(stockFilter))
    : allHistory;

  renderHistory(filteredHistory);
}

function renderHistory(history) {
  const tbody = document.getElementById('history-rows');
  const status = document.getElementById('history-status');

  status.textContent = `${history.length} of ${allHistory.length} SL movement records`;

  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="9">No history yet.</td></tr>';
    return;
  }

  tbody.innerHTML = history.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDate(entry.movedAt))}</td>
      <td>${escapeHtml(entry.symbol)}</td>
      <td>${escapeHtml(entry.triggerId)}</td>
      <td>${formatNumber(entry.oldTrigger)}</td>
      <td>${formatNumber(entry.newTrigger)}</td>
      <td>${formatNumber(entry.ltp)}</td>
      <td>${escapeHtml(entry.triggerPercent || '-')}</td>
      <td>${formatNumber(entry.quantity, 0)}</td>
      <td>${formatNumber(entry.buy)}</td>
    </tr>
  `).join('');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatNumber(value, digits = 2) {
  const number = parseFloat(value);
  return Number.isNaN(number) ? '-' : number.toFixed(digits);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
