const STORAGE_KEY = 'zerodha_gtt_sl_history';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-history').addEventListener('click', loadHistory);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
  loadHistory();
});

function loadHistory() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const history = result[STORAGE_KEY] || [];
    renderHistory(history);
  });
}

function clearHistory() {
  chrome.storage.local.set({ [STORAGE_KEY]: [] }, loadHistory);
}

function renderHistory(history) {
  const tbody = document.getElementById('history-rows');
  const status = document.getElementById('history-status');

  status.textContent = `${history.length} SL movement records`;

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
