// State Management
let dbData = {};
let selectedTable = '';
let tableRows = [];
let filteredRows = [];
let currentPage = 1;
let pageSize = 20;
let sortKey = '';
let sortDirection = 'asc';

// DOM Elements
const tablesList = document.getElementById('tables-list');
const selectedTableTitle = document.getElementById('selected-table-title');
const recordCountBadge = document.getElementById('record-count-badge');
const tableSearch = document.getElementById('table-search');
const refreshBtn = document.getElementById('refresh-btn');
const clearTableBtn = document.getElementById('clear-table-btn');
const gridContainer = document.getElementById('grid-container');
const loadingOverlay = document.getElementById('loading-overlay');

// Pagination Elements
const rowsRangeStart = document.getElementById('rows-range-start');
const rowsRangeEnd = document.getElementById('rows-range-end');
const rowsTotalCount = document.getElementById('rows-total-count');
const pageSizeSelect = document.getElementById('page-size-select');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');

// Theme Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  attachEventListeners();
  loadDbData();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('kite_db_theme') || 'dark-theme';
  document.body.className = savedTheme;
  updateThemeButton(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.body.className;
  const newTheme = currentTheme === 'dark-theme' ? 'light-theme' : 'dark-theme';
  document.body.className = newTheme;
  localStorage.setItem('kite_db_theme', newTheme);
  updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
  const icon = themeToggleBtn.querySelector('.theme-icon');
  const label = themeToggleBtn.querySelector('.theme-label');
  if (theme === 'dark-theme') {
    icon.innerHTML = '&#9788;'; // Sun icon
    label.textContent = 'Light Mode';
  } else {
    icon.innerHTML = '&#9790;'; // Moon icon
    label.textContent = 'Dark Mode';
  }
}

// Load Storage Data
function loadDbData() {
  showLoader();
  chrome.storage.local.get(null, (items) => {
    dbData = items || {};
    populateTablesSidebar();
    
    if (selectedTable && dbData[selectedTable] !== undefined) {
      displayTable(selectedTable);
    } else {
      renderEmptyState();
    }
    hideLoader();
  });
}

// Sidebar Setup
function populateTablesSidebar() {
  tablesList.innerHTML = '';
  const keys = Object.keys(dbData).sort();

  if (keys.length === 0) {
    tablesList.innerHTML = '<li class="loading-text">No tables found</li>';
    return;
  }

  keys.forEach((key) => {
    const li = document.createElement('li');
    li.dataset.key = key;
    if (key === selectedTable) {
      li.className = 'active';
    }

    const displayName = formatTableName(key);
    const value = dbData[key];
    const size = Array.isArray(value) ? value.length : (value !== null && typeof value === 'object' ? Object.keys(value).length : 1);

    li.innerHTML = `
      <span>${escapeHtml(displayName)}</span>
      <span class="table-badge">${size}</span>
    `;

    li.addEventListener('click', () => {
      document.querySelectorAll('.tables-list li').forEach((el) => el.classList.remove('active'));
      li.classList.add('active');
      displayTable(key);
    });

    tablesList.appendChild(li);
  });
}

function formatTableName(key) {
  // Translate storage keys to cleaner display names
  return key
    .replace('zerodha_gtt_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Render Table Data
function displayTable(tableName) {
  selectedTable = tableName;
  const value = dbData[tableName];
  selectedTableTitle.textContent = formatTableName(tableName);
  clearTableBtn.removeAttribute('disabled');
  tableSearch.value = '';
  sortKey = '';
  sortDirection = 'asc';
  currentPage = 1;

  if (Array.isArray(value)) {
    tableRows = value;
    filteredRows = [...tableRows];
    tableSearch.removeAttribute('disabled');
    renderGridTable();
  } else {
    tableRows = [];
    filteredRows = [];
    tableSearch.setAttribute('disabled', 'true');
    renderJsonViewer(value);
  }
}

function renderGridTable() {
  gridContainer.innerHTML = '';
  
  if (filteredRows.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128269;</div>
        <h3>No Matching Records</h3>
        <p>No rows in ${formatTableName(selectedTable)} matched your search term.</p>
      </div>
    `;
    recordCountBadge.textContent = '0 records';
    updatePaginationControls();
    return;
  }

  recordCountBadge.textContent = `${tableRows.length} record${tableRows.length === 1 ? '' : 's'}`;

  // Find all keys present in the row objects to form headers
  const headersSet = new Set();
  filteredRows.forEach((row) => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((key) => headersSet.add(key));
    }
  });

  const headers = Array.from(headersSet);
  if (headers.length === 0) {
    renderJsonViewer(filteredRows);
    return;
  }

  // Create Table elements
  const tableWrap = document.createElement('div');
  tableWrap.className = 'data-table-wrap';
  
  const table = document.createElement('table');
  table.className = 'data-table';

  // Table Headers
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = formatHeaderName(header);
    th.dataset.headerKey = header;
    
    if (header === sortKey) {
      th.className = sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    th.addEventListener('click', () => handleSort(header));
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  // Table Body (Paginated)
  const tbody = document.createElement('tbody');
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredRows.length);
  const pageRows = filteredRows.slice(startIdx, endIdx);

  pageRows.forEach((row) => {
    const trRow = document.createElement('tr');
    headers.forEach((header) => {
      const td = document.createElement('td');
      const cellVal = row[header];
      td.innerHTML = formatCellValue(header, cellVal);
      trRow.appendChild(td);
    });
    tbody.appendChild(trRow);
  });
  
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  gridContainer.appendChild(tableWrap);

  updatePaginationControls();
}

function renderJsonViewer(value) {
  gridContainer.innerHTML = '';
  recordCountBadge.textContent = '1 item';
  
  const wrap = document.createElement('div');
  wrap.className = 'json-view-wrap';
  
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(value, null, 2);
  wrap.appendChild(pre);
  gridContainer.appendChild(wrap);

  // Reset pagination info for non-array views
  rowsRangeStart.textContent = '0';
  rowsRangeEnd.textContent = '0';
  rowsTotalCount.textContent = '0';
  prevPageBtn.setAttribute('disabled', 'true');
  nextPageBtn.setAttribute('disabled', 'true');
  pageIndicator.textContent = 'Page 1 of 1';
}

function renderEmptyState() {
  gridContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">&#128196;</div>
      <h3>No Table Selected</h3>
      <p>Please select a database table from the sidebar list to inspect its contents.</p>
    </div>
  `;
  selectedTableTitle.textContent = 'Select a Table';
  recordCountBadge.textContent = '0 records';
  clearTableBtn.setAttribute('disabled', 'true');
  tableSearch.setAttribute('disabled', 'true');
  
  rowsRangeStart.textContent = '0';
  rowsRangeEnd.textContent = '0';
  rowsTotalCount.textContent = '0';
  prevPageBtn.setAttribute('disabled', 'true');
  nextPageBtn.setAttribute('disabled', 'true');
  pageIndicator.textContent = 'Page 1 of 1';
}

// Utility Formatting Functions
function formatHeaderName(key) {
  // Convert camelCase or snake_case headers to Title Case
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatCellValue(header, val) {
  if (val === null || val === undefined) return '<span style="opacity: 0.3">-</span>';
  
  // Format timestamps
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    return escapeHtml(new Date(val).toLocaleString());
  }

  // Format Status pills
  if (header.toLowerCase().includes('status')) {
    const statusText = String(val).toLowerCase().trim();
    if (statusText === 'profit' || statusText === 'active') {
      return `<span class="status-pill status-profit">${escapeHtml(String(val).toUpperCase())}</span>`;
    }
    if (statusText === 'loss' || statusText === 'triggered') {
      return `<span class="status-pill status-loss">${escapeHtml(String(val).toUpperCase())}</span>`;
    }
  }

  // Format floats/numbers
  if (typeof val === 'number' && !Number.isInteger(val)) {
    return escapeHtml(val.toFixed(2));
  }

  if (typeof val === 'object') {
    return `<span style="font-size: 11px; font-family: monospace;">${escapeHtml(JSON.stringify(val))}</span>`;
  }

  return escapeHtml(String(val));
}

// Event Handlers
function attachEventListeners() {
  themeToggleBtn.addEventListener('click', toggleTheme);
  refreshBtn.addEventListener('click', loadDbData);
  clearTableBtn.addEventListener('click', handleClearTable);
  tableSearch.addEventListener('input', handleSearch);
  
  // Pagination
  pageSizeSelect.addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    if (filteredRows.length > 0) renderGridTable();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGridTable();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRows.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderGridTable();
    }
  });
}

function handleSort(key) {
  if (sortKey === key) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDirection = 'asc';
  }

  filteredRows.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];

    // Handle null/undefined values
    if (valA === undefined || valA === null) return sortDirection === 'asc' ? 1 : -1;
    if (valB === undefined || valB === null) return sortDirection === 'asc' ? -1 : 1;

    // Convert strings to dates if format matches
    if (typeof valA === 'string' && valA.match(/^\d{4}-\d{2}-\d{2}T\d{2}/)) {
      valA = new Date(valA);
      valB = new Date(valB);
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  currentPage = 1;
  renderGridTable();
}

function handleSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  
  if (!query) {
    filteredRows = [...tableRows];
  } else {
    filteredRows = tableRows.filter((row) => {
      return Object.values(row || {}).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    });
  }

  currentPage = 1;
  renderGridTable();
}

function handleClearTable() {
  if (!selectedTable) return;
  
  const name = formatTableName(selectedTable);
  const confirmClear = confirm(`Are you sure you want to clear all data in ${name}? This action cannot be undone.`);
  if (!confirmClear) return;

  showLoader();
  chrome.storage.local.remove(selectedTable, () => {
    hideLoader();
    alert(`${name} table cleared successfully.`);
    selectedTable = '';
    loadDbData();
  });
}

// Pagination Helpers
function updatePaginationControls() {
  const totalRecords = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Range text
  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(startIdx + pageSize - 1, totalRecords);

  rowsRangeStart.textContent = startIdx;
  rowsRangeEnd.textContent = endIdx;
  rowsTotalCount.textContent = totalRecords;

  // Nav buttons
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;

  pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
}

// UI Loader Helpers
function showLoader() {
  loadingOverlay.classList.remove('hidden');
}

function hideLoader() {
  loadingOverlay.classList.add('hidden');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
