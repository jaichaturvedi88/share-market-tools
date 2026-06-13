// db-viewer.js - IndexedDB Viewer Logic

const DB_NAME = "FyersSLDatabase";
const DB_VERSION = 2;

// App State
const state = {
  activeTable: "events",
  searchQuery: "",
  currentPage: 1,
  pageSize: 25,
  records: [],
  filteredRecords: [],
  expandedRows: new Set(), // stores row IDs that are expanded to show JSON
  columnFilters: {}, // tracks column-specific filters: { headerName: filterText }
  currentSort: {
    column: null,
    direction: "desc"
  }
};

// No focus tracking needed as inputs are not destroyed


// Database Connection Helper
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      // In case the DB is accessed before background initializes it
      const db = request.result;
      if (!db.objectStoreNames.contains("events")) {
        db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("events_filtered")) {
        db.createObjectStore("events_filtered", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("sl_movements")) {
        db.createObjectStore("sl_movements", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("orders")) {
        db.createObjectStore("orders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("positions")) {
        db.createObjectStore("positions", { keyPath: "id" });
      }
    };
  });
}

// Fetch all records from an object store
async function fetchStoreRecords(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let data = request.result || [];
      // Sort latest first based on timestamp or ID
      data.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (timeA && timeB) return timeB - timeA;
        return (b.id && a.id) ? (b.id - a.id) : 0;
      });
      resolve(data);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear a specific store
async function clearStore(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Initialize Page and Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  setupSidebarListeners();
  setupActionListeners();
  setupPaginationListeners();
  setupSidebarCollapse();
  renderHeaders();
  loadAllData();
});

// Sidebar Collapse Handler
function setupSidebarCollapse() {
  const sidebar = document.querySelector(".sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (!sidebarToggle) return;
  
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    sidebarToggle.textContent = isCollapsed ? "▶" : "◀";
    sidebarToggle.title = isCollapsed ? "Expand Sidebar" : "Collapse Sidebar";
  });
}

// Update record badges on the sidebar
async function updateSidebarCounts() {
  const tables = ["events", "events_filtered", "sl_movements", "orders", "positions"];
  for (const table of tables) {
    try {
      const records = await fetchStoreRecords(table);
      const badge = document.getElementById(`count-${table}`);
      if (badge) {
        badge.textContent = records.length;
      }
    } catch (err) {
      console.warn(`Could not get count for table ${table}:`, err);
    }
  }
}

// Sidebar Navigation
function setupSidebarListeners() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      const tableName = item.getAttribute("data-table");
      state.activeTable = tableName;
      state.currentPage = 1;
      state.expandedRows.clear();
      state.columnFilters = {}; // Reset column filters on table change
      state.currentSort = { column: null, direction: "desc" }; // Reset sort state
      document.getElementById("table-search").value = "";
      state.searchQuery = "";
      
      updateHeaderDetails();
      renderHeaders();
      loadActiveTableData();
    });
  });
}

// Action Buttons: Refresh, Clear, Search
function setupActionListeners() {
  document.getElementById("btn-refresh").addEventListener("click", () => {
    loadAllData();
  });

  document.getElementById("btn-clear-table").addEventListener("click", async () => {
    const confirmClear = confirm(`Are you sure you want to clear all data in the "${state.activeTable}" table?`);
    if (confirmClear) {
      await clearStore(state.activeTable);
      state.expandedRows.clear();
      loadAllData();
    }
  });

  document.getElementById("clear-all-db").addEventListener("click", async () => {
    const confirmClearAll = confirm("CRITICAL: Are you sure you want to clear ALL tables in the database?");
    if (confirmClearAll) {
      const tables = ["events", "events_filtered", "sl_movements", "orders", "positions"];
      for (const table of tables) {
        await clearStore(table);
      }
      state.expandedRows.clear();
      loadAllData();
    }
  });

  const searchInput = document.getElementById("table-search");
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    state.currentPage = 1;
    applyFilterAndRender();
  });
}

// Pagination Controls
function setupPaginationListeners() {
  document.getElementById("page-size").addEventListener("change", (e) => {
    state.pageSize = parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderTable();
  });

  document.getElementById("btn-prev-page").addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });

  document.getElementById("btn-next-page").addEventListener("click", () => {
    const totalPages = Math.ceil(state.filteredRecords.length / state.pageSize) || 1;
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderTable();
    }
  });
}

// Update Active Title and Description in UI
function updateHeaderDetails() {
  const titles = {
    events: {
      title: "Events & Logs (All)",
      desc: "Logs of raw WebSocket updates and captured HTTP API network traffic (excludes price ticks and heartbeats)"
    },
    events_filtered: {
      title: "Events & Logs (Filtered)",
      desc: "Staged event logs where repetitive messages can be analyzed and filtered out"
    },
    sl_movements: {
      title: "SL Trail Movements",
      desc: "Historical records of every Stop Loss modification attempt during a trade lifecycle"
    },
    orders: {
      title: "Latest Orders Snapshot",
      desc: "Fyers orders captured from API sync (updates or adds on order book polling)"
    },
    positions: {
      title: "Latest Positions Snapshot",
      desc: "Current positions captured from API sync"
    }
  };

  const info = titles[state.activeTable] || { title: state.activeTable, desc: "" };
  document.getElementById("active-table-title").textContent = info.title;
  document.getElementById("table-description").textContent = info.desc;
}

// Global Loader
async function loadAllData() {
  await updateSidebarCounts();
  await loadActiveTableData();
}

// Load data for the active table
async function loadActiveTableData() {
  try {
    state.records = await fetchStoreRecords(state.activeTable);
    applyFilterAndRender();
  } catch (err) {
    console.error("Error loading active table data:", err);
    document.getElementById("table-body").innerHTML = `
      <tr>
        <td class="no-data" colspan="100">Failed to load database content: ${err.message}</td>
      </tr>
    `;
  }
}

// Helper to extract clean field values based on column headers for sorting/filtering
function getRecordFieldValueForHeader(record, tableName, headerName) {
  if (!record) return "";
  switch (tableName) {
    case "events":
    case "events_filtered":
      if (headerName === "ID") return String(record.id || "");
      if (headerName === "Time") return formatTime(record.timestamp);
      if (headerName === "Type") return record.type === "ws" ? "WS Feed" : "HTTP Fetch";
      if (headerName === "Source URL") return String(record.url || "").split("?")[0].replace("https://", "");
      if (headerName === "Direction") return record.payload && record.payload.direction === "outgoing" ? "outgoing" : "incoming";
      if (headerName === "Payload Preview") return JSON.stringify(record.payload || "");
      break;
    case "sl_movements":
      if (headerName === "ID") return String(record.id || "");
      if (headerName === "Time") return formatTime(record.timestamp);
      if (headerName === "Symbol") return String(record.symbol || "").replace("NSE:", "");
      if (headerName === "Qty") return String(record.qty ?? "");
      if (headerName === "Old SL") return record.oldSL ? String(Number(record.oldSL).toFixed(2)) : "-";
      if (headerName === "New SL") return record.newSL ? String(Number(record.newSL).toFixed(2)) : "-";
      if (headerName === "LTP") return record.ltp ? String(Number(record.ltp).toFixed(2)) : "-";
      if (headerName === "P&L") return record.unrealizedPl ? String(Number(record.unrealizedPl).toFixed(2)) : "0";
      if (headerName === "Method") return String(record.method || "");
      if (headerName === "Status") return String(record.status || "");
      break;
    case "orders":
      if (headerName === "Order ID") return String(record.id || "");
      if (headerName === "Logged At") return formatTime(record.timestamp);
      if (headerName === "Symbol") return String(record.symbol || "").replace("NSE:", "");
      if (headerName === "Qty") return String(record.qty ?? "");
      if (headerName === "Price") return record.price ? String(Number(record.price).toFixed(2)) : "-";
      if (headerName === "Side") return String(record.side || "");
      if (headerName === "Status") return String(record.status || "");
      if (headerName === "Order Preview") return JSON.stringify(record.raw || "");
      break;
    case "positions":
      if (headerName === "Symbol") return String(record.id || "").replace("NSE:", "");
      if (headerName === "Logged At") return formatTime(record.timestamp);
      if (headerName === "Net Qty") return String(record.netQty ?? "");
      if (headerName === "Avg Price") return record.avgPrice ? String(Number(record.avgPrice).toFixed(2)) : "-";
      if (headerName === "LTP") return record.ltp ? String(Number(record.ltp).toFixed(2)) : "-";
      if (headerName === "Unrealized P&L") return record.unrealizedPl ? String(Number(record.unrealizedPl).toFixed(2)) : "0";
      if (headerName === "Product") return String(record.raw ? (record.raw.productType || record.raw.product) : "INTRADAY");
      break;
  }
  return "";
}

// Sort filtered records based on active column and direction
function sortFilteredRecords() {
  const colName = state.currentSort.column;
  const direction = state.currentSort.direction;
  if (!colName) return; // If null, use default IndexedDB latest-first sort (which is already state.records order)

  const factor = direction === "asc" ? 1 : -1;
  state.filteredRecords.sort((a, b) => {
    const valA = getRecordFieldValueForHeader(a, state.activeTable, colName);
    const valB = getRecordFieldValueForHeader(b, state.activeTable, colName);

    // Try parsing as number to sort numerically (strip currency symbol, comma, and signs)
    const cleanA = valA.replace(/[^\d\.-]/g, "");
    const cleanB = valB.replace(/[^\d\.-]/g, "");
    const numA = parseFloat(cleanA);
    const numB = parseFloat(cleanB);

    if (cleanA && cleanB && !isNaN(numA) && !isNaN(numB)) {
      return (numA - numB) * factor;
    }

    // String locale comparison
    return valA.localeCompare(valB) * factor;
  });
}

// Apply Search Query to Filter Records
function applyFilterAndRender() {
  state.filteredRecords = state.records.filter(record => {
    // 1. Apply global search query supporting exclusions (e.g. -wss)
    if (state.searchQuery) {
      const terms = state.searchQuery.split(/[\s,]+/).filter(t => t.length > 0);
      let hasPositive = false;
      let matchesAllPositive = true;
      
      for (const term of terms) {
        if (term.startsWith("-") && term.length > 1) {
          const negTerm = term.substring(1).toLowerCase();
          if (checkObjectMatchesQuery(record, negTerm)) {
            return false; // Exclude if negative term is matched in the record
          }
        } else {
          hasPositive = true;
          const posTerm = term.toLowerCase();
          if (!checkObjectMatchesQuery(record, posTerm)) {
            matchesAllPositive = false;
          }
        }
      }
      
      if (hasPositive && !matchesAllPositive) {
        return false;
      }
    }
    
    // 2. Apply column-specific filters (trimmed, supporting exclusions like -wss)
    for (const [headerName, filterVal] of Object.entries(state.columnFilters)) {
      const trimmedVal = filterVal.trim();
      if (!trimmedVal) continue;
      
      const cellValue = getRecordFieldValueForHeader(record, state.activeTable, headerName).toLowerCase();
      const terms = trimmedVal.split(/[\s,]+/).filter(t => t.length > 0);
      let hasPositive = false;
      let matchesAllPositive = true;
      let excluded = false;
      
      for (const term of terms) {
        if (term.startsWith("-") && term.length > 1) {
          const negTerm = term.substring(1).toLowerCase();
          if (cellValue.includes(negTerm)) {
            excluded = true;
            break;
          }
        } else {
          hasPositive = true;
          const posTerm = term.toLowerCase();
          if (!cellValue.includes(posTerm)) {
            matchesAllPositive = false;
          }
        }
      }
      
      if (excluded || (hasPositive && !matchesAllPositive)) {
        return false;
      }
    }
    
    return true;
  });

  // 3. Sort the filtered records
  sortFilteredRecords();
  
  renderTable();
}

function checkObjectMatchesQuery(obj, query) {
  if (obj === null || obj === undefined) return false;
  
  if (typeof obj === "object") {
    return Object.values(obj).some(val => {
      if (typeof val === "object") {
        return checkObjectMatchesQuery(val, query);
      }
      return String(val).toLowerCase().includes(query);
    });
  }
  return String(obj).toLowerCase().includes(query);
}

// Helper to classify columns for styling and fixed width properties
function getColumnClass(hText) {
  const norm = hText.toLowerCase();
  if (norm === "id" || norm === "order id") return "col-id";
  if (norm === "time" || norm === "logged at") return "col-time";
  if (norm === "type" || norm === "side") return "col-type";
  if (norm === "direction") return "col-direction";
  if (
    norm === "qty" ||
    norm === "net qty" ||
    norm === "old sl" ||
    norm === "new sl" ||
    norm === "ltp" ||
    norm === "p&l" ||
    norm === "unrealized p&l" ||
    norm === "avg price" ||
    norm === "price"
  ) {
    return "col-numeric";
  }
  return "";
}

// Render table headers and column filters once per table type
function renderHeaders() {
  const tableHead = document.getElementById("table-head");
  tableHead.innerHTML = "";

  const headers = getHeadersForTable(state.activeTable);

  // Row 1: Header names with sort triggers
  const trHead = document.createElement("tr");
  trHead.className = "header-row";
  headers.forEach(hText => {
    const th = document.createElement("th");
    th.style.cursor = "pointer";
    th.style.userSelect = "none";
    th.title = `Click to sort by ${hText}`;
    th.setAttribute("data-header-name", hText);
    
    // Add column class for sizing
    const colClass = getColumnClass(hText);
    if (colClass) th.classList.add(colClass);
    
    const textSpan = document.createElement("span");
    textSpan.textContent = hText;
    th.appendChild(textSpan);
    
    // Render arrow indicator
    const indicator = document.createElement("span");
    indicator.className = "sort-indicator";
    th.appendChild(indicator);
    
    // Click event to toggle/apply sort
    th.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      
      if (state.currentSort.column === hText) {
        state.currentSort.direction = state.currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.currentSort.column = hText;
        state.currentSort.direction = "asc";
      }
      updateSortIndicators();
      applyFilterAndRender();
    });
    
    trHead.appendChild(th);
  });
  tableHead.appendChild(trHead);

  // Row 2: Column filters
  const trFilter = document.createElement("tr");
  trFilter.className = "filter-row";
  headers.forEach((hText, index) => {
    const th = document.createElement("th");
    
    // Add column class for sizing
    const colClass = getColumnClass(hText);
    if (colClass) th.classList.add(colClass);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "column-filter-input";
    input.placeholder = `Filter ${hText}...`;
    input.setAttribute("data-header-name", hText);
    input.setAttribute("data-col-index", index);
    input.value = state.columnFilters[hText] || "";
    
    input.addEventListener("input", (e) => {
      const val = e.target.value;
      if (val) {
        state.columnFilters[hText] = val;
      } else {
        delete state.columnFilters[hText];
      }
      state.currentPage = 1;
      applyFilterAndRender();
    });
    
    th.appendChild(input);
    trFilter.appendChild(th);
  });
  tableHead.appendChild(trFilter);

  // Initial call to update indicators
  updateSortIndicators();
}

// Update the sort indicators without rebuilding the DOM
function updateSortIndicators() {
  const tableHead = document.getElementById("table-head");
  const headers = getHeadersForTable(state.activeTable);
  
  headers.forEach(hText => {
    const th = tableHead.querySelector(`.header-row th[data-header-name="${hText}"]`);
    if (!th) return;
    
    const indicator = th.querySelector(".sort-indicator");
    if (!indicator) return;
    
    if (state.currentSort.column === hText) {
      indicator.textContent = state.currentSort.direction === "asc" ? " ▲" : " ▼";
      indicator.style.color = "var(--primary)";
      indicator.style.opacity = "1";
      th.classList.add("sorted");
    } else {
      indicator.textContent = " ⇅";
      indicator.style.color = "";
      indicator.style.opacity = "0.3";
      th.classList.remove("sorted");
    }
  });
}

// Render data rows based on current active table, filters and pagination
function renderTable() {
  const tableBody = document.getElementById("table-body");
  tableBody.innerHTML = "";

  const filtered = state.filteredRecords;
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, filtered.length);
  const paginatedRecords = filtered.slice(startIdx, endIdx);
  
  const headers = getHeadersForTable(state.activeTable);

  // Update Footer pagination details
  const totalPages = Math.ceil(filtered.length / state.pageSize) || 1;
  document.getElementById("current-page").textContent = state.currentPage;
  document.getElementById("total-pages").textContent = totalPages;
  document.getElementById("btn-prev-page").disabled = state.currentPage === 1;
  document.getElementById("btn-next-page").disabled = state.currentPage === totalPages;
  
  if (filtered.length === 0) {
    document.getElementById("page-records-info").textContent = "Showing 0-0 of 0 records";
    tableBody.innerHTML = `
      <tr>
        <td class="no-data" colspan="${headers.length}">No records found matching criteria.</td>
      </tr>
    `;
    return;
  }
  
  document.getElementById("page-records-info").textContent = 
    `Showing ${startIdx + 1}-${endIdx} of ${filtered.length} records`;

  // Render Rows
  paginatedRecords.forEach((record, index) => {
    const rowId = record.id || record.symbol || `row-${index}`;
    const trData = document.createElement("tr");
    trData.className = "data-row";
    if (state.expandedRows.has(rowId)) {
      trData.classList.add("active-row");
    }

    populateRowCells(trData, state.activeTable, record);
    
    // Assign column classes to data cells matching headers
    Array.from(trData.children).forEach((td, cellIdx) => {
      const hText = headers[cellIdx];
      if (hText) {
        const colClass = getColumnClass(hText);
        if (colClass) td.classList.add(colClass);
      }
    });

    // Toggle expand detail view on click
    trData.addEventListener("click", () => {
      toggleRowExpansion(rowId, record, headers.length);
    });

    tableBody.appendChild(trData);

    // If row is expanded, render the details row right underneath
    if (state.expandedRows.has(rowId)) {
      const trDetails = document.createElement("tr");
      trDetails.className = "details-row";
      
      const tdDetails = document.createElement("td");
      tdDetails.className = "details-cell";
      tdDetails.colSpan = headers.length;
      
      const detailsWrap = document.createElement("div");
      detailsWrap.className = "details-wrapper";
      
      const title = document.createElement("h4");
      title.textContent = "Raw Payload / Details";
      
      const pre = document.createElement("pre");
      pre.className = "json-pre";
      
      // Determine what to display
      let payloadToFormat = record.payload || record.raw || record;
      pre.textContent = JSON.stringify(payloadToFormat, null, 2);
      
      detailsWrap.appendChild(title);
      detailsWrap.appendChild(pre);
      tdDetails.appendChild(detailsWrap);
      trDetails.appendChild(tdDetails);
      tableBody.appendChild(trDetails);
    }
  });
}

// Toggle Row Details Expanded Status
function toggleRowExpansion(rowId, record, colCount) {
  if (state.expandedRows.has(rowId)) {
    state.expandedRows.delete(rowId);
  } else {
    // If not events table, we can still toggle, but let's allow multiple expansions
    state.expandedRows.add(rowId);
  }
  renderTable();
}

// Return Column Headers based on Table Type
function getHeadersForTable(tableName) {
  switch (tableName) {
    case "events":
    case "events_filtered":
      return ["ID", "Time", "Type", "Source URL", "Direction", "Payload Preview"];
    case "sl_movements":
      return ["ID", "Time", "Symbol", "Qty", "Old SL", "New SL", "LTP", "P&L", "Method", "Status"];
    case "orders":
      return ["Order ID", "Logged At", "Symbol", "Qty", "Price", "Side", "Status", "Order Preview"];
    case "positions":
      return ["Symbol", "Logged At", "Net Qty", "Avg Price", "LTP", "Unrealized P&L", "Product"];
    default:
      return ["ID", "Timestamp", "Data"];
  }
}

// Format date helper
function formatTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString();
}

// Populate row fields based on table type
function populateRowCells(tr, tableName, record) {
  switch (tableName) {
    case "events":
    case "events_filtered": {
      const cId = document.createElement("td");
      cId.style.fontWeight = "bold";
      cId.textContent = record.id;
      
      const cTime = document.createElement("td");
      cTime.textContent = formatTime(record.timestamp);
      
      const cType = document.createElement("td");
      const typeSpan = document.createElement("span");
      typeSpan.className = `status-pill ${record.type === "ws" ? "info" : "warning"}`;
      typeSpan.textContent = record.type === "ws" ? "WS Feed" : "HTTP Fetch";
      cType.appendChild(typeSpan);
      
      const cUrl = document.createElement("td");
      cUrl.textContent = String(record.url).split("?")[0].replace("https://", "");
      cUrl.title = record.url;
      
      const cDir = document.createElement("td");
      const dirIndicator = document.createElement("span");
      const isOut = record.payload && record.payload.direction === "outgoing";
      dirIndicator.className = `direction-indicator ${isOut ? "outgoing" : "incoming"}`;
      dirIndicator.textContent = isOut ? "Out 📤" : "In 📥";
      cDir.appendChild(dirIndicator);
      
      const cPayload = document.createElement("td");
      cPayload.style.color = "var(--text-secondary)";
      const rawText = JSON.stringify(record.payload);
      cPayload.textContent = rawText.length > 80 ? rawText.substring(0, 80) + "..." : rawText;
      
      tr.append(cId, cTime, cType, cUrl, cDir, cPayload);
      break;
    }
    case "sl_movements": {
      const cId = document.createElement("td");
      cId.style.fontWeight = "bold";
      cId.textContent = record.id;
      
      const cTime = document.createElement("td");
      cTime.textContent = formatTime(record.timestamp);
      
      const cSymbol = document.createElement("td");
      cSymbol.style.fontWeight = "600";
      cSymbol.textContent = String(record.symbol).replace("NSE:", "");
      
      const cQty = document.createElement("td");
      cQty.textContent = record.qty;
      
      const cOldSL = document.createElement("td");
      cOldSL.textContent = record.oldSL ? Number(record.oldSL).toFixed(2) : "-";
      
      const cNewSL = document.createElement("td");
      cNewSL.style.color = "var(--primary)";
      cNewSL.style.fontWeight = "600";
      cNewSL.textContent = record.newSL ? Number(record.newSL).toFixed(2) : "-";
      
      const cLtp = document.createElement("td");
      cLtp.textContent = record.ltp ? Number(record.ltp).toFixed(2) : "-";
      
      const cPnl = document.createElement("td");
      const pnlVal = Number(record.unrealizedPl || 0);
      cPnl.className = pnlVal >= 0 ? "success" : "danger";
      cPnl.style.fontWeight = "600";
      cPnl.textContent = pnlVal >= 0 ? `+₹${pnlVal.toFixed(2)}` : `-₹${Math.abs(pnlVal).toFixed(2)}`;
      if (pnlVal > 0) cPnl.style.color = "var(--success)";
      else if (pnlVal < 0) cPnl.style.color = "var(--danger)";
      
      const cMethod = document.createElement("td");
      cMethod.textContent = record.method;
      
      const cStatus = document.createElement("td");
      const statSpan = document.createElement("span");
      statSpan.className = `status-pill ${record.status === "SUCCESS" ? "success" : "danger"}`;
      statSpan.textContent = record.status;
      if (record.error) {
        statSpan.title = record.error;
      }
      cStatus.appendChild(statSpan);
      
      tr.append(cId, cTime, cSymbol, cQty, cOldSL, cNewSL, cLtp, cPnl, cMethod, cStatus);
      break;
    }
    case "orders": {
      const cId = document.createElement("td");
      cId.style.fontWeight = "bold";
      cId.textContent = record.id;
      
      const cTime = document.createElement("td");
      cTime.textContent = formatTime(record.timestamp);
      
      const cSymbol = document.createElement("td");
      cSymbol.style.fontWeight = "600";
      cSymbol.textContent = String(record.symbol).replace("NSE:", "");
      
      const cQty = document.createElement("td");
      cQty.textContent = record.qty;
      
      const cPrice = document.createElement("td");
      cPrice.textContent = record.price ? Number(record.price).toFixed(2) : "-";
      
      const cSide = document.createElement("td");
      const sideSpan = document.createElement("span");
      const isBuy = String(record.side).toUpperCase() === "BUY";
      sideSpan.className = `status-pill ${isBuy ? "success" : "danger"}`;
      sideSpan.textContent = record.side;
      cSide.appendChild(sideSpan);
      
      const cStatus = document.createElement("td");
      cStatus.textContent = record.status;
      
      const cRaw = document.createElement("td");
      cRaw.style.color = "var(--text-secondary)";
      const rawText = JSON.stringify(record.raw);
      cRaw.textContent = rawText.length > 60 ? rawText.substring(0, 60) + "..." : rawText;
      
      tr.append(cId, cTime, cSymbol, cQty, cPrice, cSide, cStatus, cRaw);
      break;
    }
    case "positions": {
      const cId = document.createElement("td");
      cId.style.fontWeight = "bold";
      cId.textContent = String(record.id).replace("NSE:", "");
      
      const cTime = document.createElement("td");
      cTime.textContent = formatTime(record.timestamp);
      
      const cQty = document.createElement("td");
      cQty.textContent = record.netQty;
      
      const cAvgPrice = document.createElement("td");
      cAvgPrice.textContent = record.avgPrice ? Number(record.avgPrice).toFixed(2) : "-";
      
      const cLtp = document.createElement("td");
      cLtp.textContent = record.ltp ? Number(record.ltp).toFixed(2) : "-";
      
      const cPnl = document.createElement("td");
      const pnlVal = Number(record.unrealizedPl || 0);
      cPnl.style.fontWeight = "600";
      cPnl.textContent = pnlVal >= 0 ? `+₹${pnlVal.toFixed(2)}` : `-₹${Math.abs(pnlVal).toFixed(2)}`;
      if (pnlVal > 0) cPnl.style.color = "var(--success)";
      else if (pnlVal < 0) cPnl.style.color = "var(--danger)";
      
      const cProduct = document.createElement("td");
      const product = record.raw ? (record.raw.productType || record.raw.product) : "INTRADAY";
      cProduct.textContent = product;
      
      tr.append(cId, cTime, cQty, cAvgPrice, cLtp, cPnl, cProduct);
      break;
    }
    default: {
      const cId = document.createElement("td");
      cId.textContent = record.id;
      const cTime = document.createElement("td");
      cTime.textContent = formatTime(record.timestamp);
      const cData = document.createElement("td");
      cData.textContent = JSON.stringify(record);
      tr.append(cId, cTime, cData);
    }
  }
}
