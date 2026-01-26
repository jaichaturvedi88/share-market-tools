import { getEls } from "./dom.js";
import { createState } from "./state.js";
import { parseCSV } from "./csv.js";
import { FIXED_COUNT } from "./config.js";
import { buildTable } from "./table.js";
import { setSearchValue } from "./search.js";
import { exportTableToCSV } from "./export.js";
import { log, warn, error } from "./logger.js";

const els = getEls();
const state = createState();

function setStatus(text, isError = false) {
  if (isError) {
    els.status.innerHTML = `<span class="error">${text}</span>`;
  } else {
    els.status.textContent = text;
  }
}

function loadCSVText(text) {
  log("CSV file loaded. Characters:", text.length);

  const rows = parseCSV(text);
  log("Parsed rows:", rows.length);

  if (!rows.length) {
    warn("CSV empty");
    setStatus("CSV is empty.", true);
    els.tableWrap.style.display = "none";
    return;
  }

  state.header = rows[0];
  log("Header columns:", state.header.length);

  if (state.header.length <= FIXED_COUNT) {
    error("Invalid CSV, header too small:", state.header);
    setStatus("Invalid CSV: date columns not found.", true);
    els.tableWrap.style.display = "none";
    return;
  }

  const width = state.header.length;
  state.dataRows = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const padded = r.slice(0);
    while (padded.length < width) padded.push("");

    const buyDate = padded[0];
    const strike = padded[2];

    const dates = {};
    for (let c = FIXED_COUNT; c < width; c++) {
      dates[state.header[c]] = padded[c] || "";
    }

    state.dataRows.push({ buyDate, strike, dates });
  }

  log("Data rows created:", state.dataRows.length);

  buildTable(state, els);
}

// ✅ Events
els.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  state.loadedFileName = file.name;
  setStatus("Reading file...");
  log("Selected file:", file.name, "size:", file.size);

  const text = await file.text();
  loadCSVText(text);
});

els.lots.addEventListener("input", () => {
  if (!state.header.length) return;
  log("Lots changed:", els.lots.value);
  buildTable(state, els);
});

els.lotSize.addEventListener("input", () => {
  if (!state.header.length) return;
  log("LotSize changed:", els.lotSize.value);
  buildTable(state, els);
});

els.searchBox.addEventListener("input", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0));
});

els.minusBtn.addEventListener("click", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0) - 50);
});

els.plusBtn.addEventListener("click", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0) + 50);
});

els.exportBtn.addEventListener("click", () => {
  log("Export clicked");
  exportTableToCSV(state, els);
});

// ✅ initial
setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0));
log("App initialized");
