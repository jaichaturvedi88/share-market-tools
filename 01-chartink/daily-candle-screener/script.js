// let allTds = "";
let noOfDays = 5;
let rowsData = [];
let dataInTable = [];
let stocksModalPoupArray = [];

let fileNameDiv = document.querySelector(".fileName");

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
      rowsData.length =
        rowsData[rowsData.length - 1] === ""
          ? rowsData.length - 1
          : rowsData.length; // Remove last row if it is empty

      createTable(rowsData);
      // allTds = document.querySelectorAll("td");
    };
  } else {
    alert("Please select a file.");
  }
}

function getFileName(filename) {
  return filename
    .replace("Backtest", "")
    .replace(", Technical Analysis Scanner", "")
    .replace(".csv", "")
    .split("-")
    .join(" ");
}
function createTable(allRowsData) {
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
  // console.log(dataInTable);
  // <table > <tbody>
  var tbodyEl = document
    .getElementById("tblcsvdata")
    .getElementsByTagName("tbody")[0];
  tbodyEl.innerHTML = "";

  let rowWrapSwitchBtn = document.querySelector('.row-wrap-container').querySelector('input');

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
      newCell.innerHTML.includes('2024') ? newCell.classList.add('date-cell-background') : '';

      if (
        newCell.innerHTML[0].charCodeAt() < 48 ||
        newCell.innerHTML[0].charCodeAt() > 57
      ) {
        stocksModalPoupArray.push(newCell.innerHTML);
      }
      if (rowWrapSwitchBtn.checked === true){
        newCell.classList.add('row-wrap');
      } 
      
    }
  }
}

function highlightShare(event) {
  let allTds = document.querySelectorAll("td");
  let selectedShare = event.srcElement.innerText;

  allTds.forEach((td) => {
    if (td.innerText && td.innerText === selectedShare) {
      navigator.clipboard.writeText(selectedShare);
      td.style.backgroundColor = "#8c8c00";
    } else {
      td.style.backgroundColor = "";
    }
  });
}

let daysButtonGroup = document.querySelector('#daysBtnGroup');
let daysButtons = daysButtonGroup.querySelectorAll(".days-btn");

daysButtonGroup.addEventListener('click', highLightActiveDaysButtons);
function highLightActiveDaysButtons (event) {
  for (let index = 0; index < daysButtons.length; index++) {
     daysButtons[index].classList.remove('active-btn');
   }
   let currentBtn = event.target;
   currentBtn.classList.add('active-btn');
   noOfDays = currentBtn.innerText;
   stocksModalPoupArray.length = 0;
   createTable(rowsData);
}

let filterButtonGroup = document.querySelector('#filterBtnGroup');
let filterButtons = filterButtonGroup.querySelectorAll('.filter-btn');

filterButtonGroup.addEventListener('click', highLightActiveFilterButtons);
function highLightActiveFilterButtons (event) {
  stocksModalPoupArray.length = 0;
  for (let index = 0; index < filterButtons.length; index++) {
    filterButtons[index].classList.remove('active-btn');
   }
   let currentFilterBtn = event.target;
   let filter_btn = currentFilterBtn.innerText;
   currentFilterBtn.classList.add('active-btn');
    let minAscii = filter_btn.charCodeAt(0);
    let maxAscii = filter_btn.charCodeAt(2);
    if (filter_btn !== "All") {
      filterStocks(minAscii, maxAscii);
    }
    else {
      createTable(rowsData);
    }
}

function filterStocks(minAscii, maxAscii) {
  let filteredTableData = [];
  for (let rowIndex = 0; rowIndex < dataInTable.length; rowIndex++) {
    filteredTableData[rowIndex] = [];
    for (
      let colIndex = 0;
      colIndex < dataInTable[rowIndex].length;
      colIndex++
    ) {
      let asciiChar = dataInTable[rowIndex][colIndex].charCodeAt(0);
      if (
        (asciiChar >= 48 && asciiChar <= 57) ||
        (asciiChar >= +minAscii && asciiChar <= +maxAscii)
      ) {
        filteredTableData[rowIndex].push(dataInTable[rowIndex][colIndex]);
      }
    }
  }
  renderTable(filteredTableData);
}

function toggleRowWrap() {
  let tds = document.querySelectorAll('td');
  tds.forEach(td => {
    td.classList.toggle('row-wrap');
  });
}


function stocksCounter() {
  console.log(stocksModalPoupArray);  
  let stocksCount = stocksModalPoupArray.reduce(function (acc, currentValue) {
    return (acc[currentValue] ? ++acc[currentValue] : (acc[currentValue] = 1), acc);
  }, {});

  let stocksSortedArray = [];
  for (var key in stocksCount) {
    stocksSortedArray.push([key, stocksCount[key]]);
  }

  stocksSortedArray.sort(function (a, b) {
    return b[1] - a[1];
  });

  createStocksCounterTable(stocksSortedArray);
}

function createStocksCounterTable(stocksSortedArray) {
  let stocksCounterContainer = document.querySelector(".stocksCounterContainer");
  stocksCounterContainer.innerHTML = "";
  let stocksModalPopup = document.querySelector(".fade").querySelector(".modal-body");
  // stocksModalPopup.innerHTML = "";
  let stocksCounterTable = document.createElement("table");
  stocksCounterTable.setAttribute('onclick', 'highlightShare(event)');
  for (let index = 0; index < stocksSortedArray.length; index++) {
    // Create row.
    var tr = document.createElement("tr");
    stocksCounterTable.appendChild(tr);

    // Create first column with value from key.
    var td = document.createElement("td");
    td.appendChild(document.createTextNode(stocksSortedArray[index][0]));
    tr.appendChild(td);

    // Create second column with value from value.
    var td2 = document.createElement("td");
    td2.appendChild(document.createTextNode(stocksSortedArray[index][1]));
    tr.appendChild(td2);
  }
  // console.log(stocksCounterTable);
  stocksCounterContainer.appendChild(stocksCounterTable);
  stocksModalPopup.appendChild(stocksCounterContainer);
}
function generateWatchlist() {
  let stocksRows = [...dataInTable];
  let stocks = new Set();

  stocksRows.forEach(stocksRow => {
    stocksRow.forEach((data, idx) => {
      if (idx > 0) {
        stocks.add(data);
      }
    });
  });

  let watchList = ''
  for (const stock of stocks) {
    watchList += "NSE:" + stock + "-EQ\n";
  }

  console.log(watchList);
  console.log('Total Stocks: ', stocks.size);
}

let stocksModalContainer = document.querySelector('#exampleModal');
let tableContainer = document.querySelector('.table-container');
stocksModalContainer.addEventListener('show.bs.modal', function (e) {
  tableContainer.style.width = "88vw";
});
stocksModalContainer.addEventListener('hide.bs.modal', function (e) {
  tableContainer.style.width = '99vw';
});