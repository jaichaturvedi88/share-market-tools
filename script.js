// let allTds = "";
let noOfDays = 5;
let rowsData = "";
let direction_btn = "";

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
      rowsData = csvdata.split("\n");
      // console.log(rowsData);
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
  // let filteredData = filterData(rowsData);

  if (!direction_btn || direction_btn === "horizontal") {
    let rowsData = getTransformedData(allRowsData, noOfDays);
    // console.log(rowsData);
    renderTable(rowsData);
  }
  if (direction_btn === "vertical") {
    let rowsData = getTransformedDataColWise(allRowsData, noOfDays);
    renderTable(rowsData);
  }
  // let rowsData = getTransformedData(allRowsData, noOfDays);
  // renderTable(rowsData);
}

function getTransformedDataColWise(rowsData, noOfDays) {
  let colsCount = noOfDays;
  let totalRowsToRead = 0,
    rowsCount = 0;

  let rowIndex = rowsData.length - 1;
  let prevDate = rowsData[rowIndex].split(",")[0];
  let maxShareLength = 0;
  while (colsCount > 0) {
    let rowData = rowsData[rowIndex--].split(",");
    totalRowsToRead++;
    let currentDate = rowData[0];

    if (prevDate === currentDate) {
      maxShareLength++;
    } else {
      colsCount--;
      rowsCount = maxShareLength > rowsCount ? maxShareLength : rowsCount;
      prevDate = currentDate;
      maxShareLength = 1;
    }
  }

  // console.log(totalRowsToRead, rowsCount);

  let data = extractDataColWise(rowsData, noOfDays, rowsCount);
  return data;
}

function extractDataColWise(rowsData, colCount, rowCount) {
  let rowIndex = rowsData.length - 1;
  let prevDate = "";
  rowCount++; //increase one more row to accomodate date in first row
  let data = initializeArray(rowCount, colCount);

  for (let col = -1; col < colCount; col++) {
    for (let row = 2; row < rowCount; row++) {
      let rowData = rowsData[rowIndex--].split(",");
      let currentDate = rowData[0];
      if (prevDate === currentDate) {
        data[row][col] = rowData[1];
      } else {
        prevDate = currentDate;
        data[0][col + 1] = rowData[0];
        data[1][col + 1] = rowData[1];
        break;
      }
    }
  }
  return data;
}

const initializeArray = (rows, columns) =>
  [...Array(rows).keys()].map((i) => Array(columns).fill(""));

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

function renderTable(rowsData) {
  // <table > <tbody>
  var tbodyEl = document
    .getElementById("tblcsvdata")
    .getElementsByTagName("tbody")[0];
  tbodyEl.innerHTML = "";

  

  // Loop on the row Array (change row=0 if you also want to read 1st row)
  for (var row = 0; row < rowsData.length; row++) {
    // Insert a row at the end of table
    var newRow = tbodyEl.insertRow();

    // Split by comma (,) to get column Array
    // rowColData = rowsData[row].split(",");
    rowColData = rowsData[row];
    // console.log(rowColData);

    // Loop on the row column Array
    for (var col = 0; col < rowColData.length; col++) {
      // Insert a cell at the end of the row
      var newCell = newRow.insertCell();
      newCell.innerHTML = rowColData[col];
    }
  }
 
}
function highlightShare(event) {
  let selectedShare = event.srcElement.innerText;

  console.log(selectedShare);
  let allTds = document.querySelectorAll("td");
  allTds.forEach((td) => {
    if (td.innerText && td.innerText === selectedShare) {
      navigator.clipboard.writeText(selectedShare);
      td.style.backgroundColor = "#8c8c00";
    } else {
      td.style.backgroundColor = "";
    }
  });
}

// change direction of table (horizontal or vertical)
let days_buttons = document.querySelectorAll(".days-btn");
days_buttons.forEach((bt) => {
  bt.addEventListener("click", (e) => {
    noOfDays = e.target.innerHTML;
    createTable(rowsData, noOfDays);
  });
});

let direction_buttons = document.querySelectorAll(".direction-btn");
direction_buttons.forEach((bt) => {
  bt.addEventListener("click", (e) => {
    direction_btn = e.target.value;
    createTable(rowsData, direction_btn);
  });
});


// filter stocks by name
let filter_buttons = document.querySelectorAll(".filter-btn");
filter_buttons.forEach((bt) => {
  bt.addEventListener("click", (e) => {
    let filter_btn = e.target.innerText;
    let minAscii = filter_btn.charCodeAt(0);
    let maxAscii = filter_btn.charCodeAt(2);
    filterStocks(minAscii, maxAscii);
  });
});

function filterStocks(minAscii, maxAscii) {
  let allTds = document.querySelectorAll("td");
  allTds.forEach((td) => {
    let asciiChar = td.innerText.charCodeAt(0);
    if(asciiChar >= 48 && asciiChar <= 57){
      td.style.display = "table-cell";
    }
    else if (asciiChar >= +minAscii && asciiChar <= +maxAscii
    ) {
      td.style.display = "table-cell";
    } 
    else {
      td.style.display = "none";
    }
  });
}