import { getEls } from "./dom.js";
import { createState } from "./state.js";
import { parseCSV } from "./csv.js";
import { FIXED_COUNT } from "./config.js";
import { buildTable } from "./table.js";
import { setSearchValue } from "./search.js";
import { exportTableToCSV } from "./export.js";
import { captureTableAsImage } from "./screenshot.js";

const els = getEls();
const state = createState();

console.log("✅ app.js loaded");

function setStatus(text, isError = false) {
  if (isError) {
    els.status.innerHTML = `<span class="error">${text}</span>`;
  } else {
    els.status.textContent = text;
  }
}

function updateStrikeRangeUI(rows) {
  const el = document.getElementById("strikeRangeBar");
  if (!el) return;

  // rows are arrays, Strike is at index 2
  const strikes = rows
    .map(r => Number(r?.[2]))
    .filter(v => Number.isFinite(v));

  if (!strikes.length) {
    el.textContent = "Strike Range: --";
    return;
  }

  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);

  el.textContent = `Strike Range: ${minStrike} – ${maxStrike}`;
}



function loadCSVText(text) {
  const rows = parseCSV(text);
  updateStrikeRangeUI(rows);

  if (!rows.length) {
    setStatus("CSV is empty.", true);
    els.tableWrap.style.display = "none";
    return;
  }

  state.header = rows[0];

  if (state.header.length <= FIXED_COUNT) {
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

  buildTable(state, els);
}

// ✅ Events
els.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  state.loadedFileName = file.name;
  setStatus("Reading file...");

  const text = await file.text();
  loadCSVText(text);
});

els.lots.addEventListener("input", () => state.header.length && buildTable(state, els));
els.lotSize.addEventListener("input", () => state.header.length && buildTable(state, els));

els.searchBox.addEventListener("input", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0));
});

els.minusBtn.addEventListener("click", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0) - 50);
});

els.plusBtn.addEventListener("click", () => {
  setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0) + 50);
});

els.exportBtn.addEventListener("click", () => exportTableToCSV(state, els));

// ✅ initial
setSearchValue(els.searchBox, state, els.tbl, Number(els.searchBox.value || 0));

els.snapBtn = document.getElementById("snapBtn");

els.snapBtn.addEventListener("click", async () => {
  await captureTableAsImage(els.tableWrap);
});

document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = document.getElementById("themeToggle");

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    if (themeBtn) themeBtn.textContent = "☀️ Light";
  }

  themeBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    themeBtn.textContent = isDark ? "☀️ Light" : "🌙 Dark";
  });
});
