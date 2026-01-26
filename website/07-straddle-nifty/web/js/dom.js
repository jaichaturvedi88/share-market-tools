export const $ = (id) => document.getElementById(id);

export function getEls() {
  return {
    fileInput: $("fileInput"),
    lots: $("lots"),
    lotSize: $("lotSize"),
    status: $("status"),
    monthLabel: $("monthLabel"),
    tableWrap: $("tableWrap"),
    tbl: $("tbl"),
    searchBox: $("searchBox"),
    exportBtn: $("exportBtn"),
    minusBtn: $("minusBtn"),
    plusBtn: $("plusBtn"),
  };
}
