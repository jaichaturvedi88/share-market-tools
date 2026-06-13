(function () {
  let allLogs = [];

  const refs = {
    tbody: document.getElementById("logs-tbody"),
    search: document.getElementById("logs-search"),
    filter: document.getElementById("logs-type-filter"),
    clearBtn: document.getElementById("logs-clear-btn"),
    refreshBtn: document.getElementById("logs-refresh-btn")
  };

  async function loadLogs() {
    try {
      const data = await chrome.storage.local.get("tv_trade_logs");
      allLogs = data.tv_trade_logs || [];
      // Show newest logs at the top
      allLogs.sort((a, b) => b.timestamp - a.timestamp);
      renderLogs();
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  }

  function renderLogs() {
    const query = refs.search.value.toLowerCase().trim();
    const typeFilter = refs.filter.value;

    const filtered = allLogs.filter((log) => {
      const matchesSearch = log.message.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || log.type === typeFilter;
      return matchesSearch && matchesType;
    });

    refs.tbody.innerHTML = "";

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.style.textAlign = "center";
      cell.style.color = "#868993";
      cell.textContent = "No log records found.";
      row.appendChild(cell);
      refs.tbody.appendChild(row);
      return;
    }

    filtered.forEach((log) => {
      const row = document.createElement("tr");

      // Timestamp
      const timeCell = document.createElement("td");
      timeCell.textContent = new Date(log.timestamp).toLocaleString();
      timeCell.style.color = "#868993";

      // Type Badge
      const typeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge badge-${log.type}`;
      badge.textContent = log.type;
      typeCell.appendChild(badge);

      // Message
      const msgCell = document.createElement("td");
      msgCell.textContent = log.message;

      row.append(timeCell, typeCell, msgCell);
      refs.tbody.appendChild(row);
    });
  }

  async function clearLogs() {
    if (confirm("Are you sure you want to clear all logs?")) {
      try {
        await chrome.storage.local.set({ tv_trade_logs: [] });
        allLogs = [];
        renderLogs();
      } catch (err) {
        console.error("Failed to clear logs:", err);
      }
    }
  }

  // Bind Events
  refs.search.addEventListener("input", renderLogs);
  refs.filter.addEventListener("change", renderLogs);
  refs.clearBtn.addEventListener("click", clearLogs);
  refs.refreshBtn.addEventListener("click", loadLogs);

  // Init
  loadLogs();
})();
