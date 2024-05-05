// let allTds = "";
let noOfDays = 5;
let rowsData = [];
let dataInTable = [];
let fileNameDiv = document.querySelector('.fileName');

function readCSVFile() {
  var files = document.querySelector("#file").files;

  if (files.length > 0) {
    // Selected file
    var file = files[0];
    fileNameDiv.innerText = getFileName(file.name);

    // FileReader Object
    var reader = new FileReader();

    // Read file as string
    reader.readAsText(file);

    // Load event
    reader.onload = function (event) {
      // Read file data
      var csvdata = event.target.result;

      // Split by line break to gets rows Array
      // var rowsData = csvdata.split("\n");
      rowsData = csvdata.split("\n");
      rowsData.length = rowsData[rowsData.length-1] === "" ? rowsData.length-1 : rowsData.length; // Remove last row if it is empty


      createTable(rowsData);
      // allTds = document.querySelectorAll("td");
    };
  } else {
    alert("Please select a file.");
  }
}

function getFileName(filename){
  return filename.replace('Backtest', '').replace(', Technical Analysis Scanner', '').replace('.csv', '').split('-').join(' ');
}
function createTable(allRowsData, direction_btn) {
  dataInTable = getTransformedData(allRowsData, noOfDays);
  renderTable(dataInTable);
}


function getTransformedData(rowsData, noOfDays) {
  let rowindex = rowsData.length - 1;

  let rowData = rowsData[rowindex].split(",");
  let prevDate = rowData[0];
  let currentDate = "";

  let transformedData = [];
  let curRowData = [prevDate];
  while (noOfDays > 0) {
    let rowData = rowsData[rowindex--].split(",");
    currentDate = rowData[0];
    if (currentDate === prevDate) {
      curRowData.push(rowData[1]);
    } else {
      transformedData.push(curRowData);
      prevDate = currentDate;
      curRowData = [prevDate];
      curRowData.push(rowData[1]);
      noOfDays -= 1;
    }
  }
  return transformedData;
}

function renderTable(dataInTable) {
  // <table > <tbody>
  var tbodyEl = document
    .getElementById("tblcsvdata")
    .getElementsByTagName("tbody")[0];
  tbodyEl.innerHTML = "";

  // Loop on the row Array (change row=0 if you also want to read 1st row)
  for (var row = 0; row < dataInTable.length; row++) {
    // Insert a row at the end of table
    var newRow = tbodyEl.insertRow();

    // Split by comma (,) to get column Array
    // rowColData = rowsData[row].split(",");
    rowColData = dataInTable[row];

    // Loop on the row column Array
    for (var col = 0; col < rowColData.length; col++) {
      // Insert a cell at the end of the row
      var newCell = newRow.insertCell();
      newCell.innerHTML = rowColData[col];
    }
  }
}

function highlightShare(event) {
  let allTds = document.querySelectorAll("td");

  let selectedShare = event.srcElement.innerText;

  console.log(selectedShare);
  // console.log(allTds);

  allTds.forEach((td) => {
    if (td.innerText && td.innerText === selectedShare) {
      navigator.clipboard.writeText(selectedShare);
      td.style.backgroundColor = "#8c8c00";
    } else {
      td.style.backgroundColor = "";
    }
  });
}

document.querySelector("#daysBtnGroup").addEventListener('click', (event) => {
  noOfDays = event.target.innerText;
  createTable(rowsData);
});

document.querySelector("#filterBtnGroup").addEventListener('click', (event) => {
  let filter_btn = event.target.innerText;
      let minAscii = filter_btn.charCodeAt(0);
      let maxAscii = filter_btn.charCodeAt(2);
      filterStocks(minAscii, maxAscii);
});
function filterStocks(minAscii, maxAscii) {
let filteredTableData = [];
for (let rowIndex = 0; rowIndex < dataInTable.length; rowIndex++) {
  filteredTableData[rowIndex] = [];
  for (let colIndex = 0; colIndex < dataInTable[rowIndex].length; colIndex++) {
    let asciiChar = dataInTable[rowIndex][colIndex].charCodeAt(0);
    if(((asciiChar >= 48 && asciiChar <= 57) || (asciiChar >= +minAscii && asciiChar <= +maxAscii))){
         filteredTableData[rowIndex].push(dataInTable[rowIndex][colIndex]);
        }
      }
    }
renderTable(filteredTableData);
}


function toggleCssClass(){
  let tds = document.querySelectorAll('td');
  // console.log(td);
  tds.forEach(td => {
    td.classList.toggle('row-wrap');
  });
}
