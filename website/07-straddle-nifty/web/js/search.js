import { STEP_STRIKE } from "./config.js";

export function applySearchHighlight(tbl, searchQuery) {
  if (!tbl) return;

  tbl.querySelectorAll(".match").forEach(el => el.classList.remove("match"));

  const q = (searchQuery || "").trim();
  if (!q) return;

  tbl.querySelectorAll("th, td").forEach(cell => {
    const txt = (cell.textContent || "").toLowerCase();
    if (txt.includes(q)) cell.classList.add("match");
  });
}

export function setSearchValue(searchBoxEl, state, tbl, newVal) {
  const v = Math.max(0, Math.round(newVal / STEP_STRIKE) * STEP_STRIKE);
  searchBoxEl.value = v;
  state.searchQuery = String(v).trim().toLowerCase();
  applySearchHighlight(tbl, state.searchQuery);
}
