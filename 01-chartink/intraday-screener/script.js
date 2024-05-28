let allTds = "";
let noOfDays = 50;
let noOfDaysToDisplayData = noOfDaysToDisplayDataINTable();
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
      var rowsData = csvdata.split("\n");

      createTable(rowsData.reverse());
      allTds = document.querySelectorAll("td");
      showRecordsCountDayWise(rowsData);
    };
  } else {
    alert("Please select a file.");
  }
}

function getFileName(filename) {
  return filename.replace('Backtest', '').replace(', Technical Analysis Scanner', '').replace('.csv', '').split('-').join(' ');
}

function createTable(allRowsData) {
  let rowsData = getTransformedData(allRowsData);
  renderTable(rowsData);
}


const initializeArray = (rows, columns) =>
  [...Array(rows).keys()].map((i) => Array(columns).fill(""));

function getTransformedData(rowsData) {
  return rowsData.map(rowData => rowData.split(",").slice(0, 2))
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

  allTds.forEach((td) => {
    if (td.innerText && td.innerText === selectedShare) {
      navigator.clipboard.writeText(selectedShare);
      // td.style.backgroundColor = "#8c8c00";
      td.classList.add('highlight');
    } else {
      // td.style.backgroundColor = "";
      td.classList.remove('highlight');
    }
  });
}

function noOfDaysToDisplayDataINTable() {
  let all_buttons = document.querySelectorAll('.days-btn');
  all_buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      let noOfDays = '';
      noOfDays = e.target.innerHTML;
      console.log(noOfDays);
    })
  });
}

function showRecordsCountDayWise(rowsData) {
  let counter = {};
  rowsData.forEach((row, idx) => {
    if (idx < rowsData.length - 1) {       // to exclude last row which is excel header
      let date = row.substr(0, row.indexOf('2024') + 4);
      if (!counter[date]) {
        counter[date] = 1;
      } else {
        counter[date] += 1;
      }
    }
  })
  console.log(counter);
  console.log('Total Rows: ', rowsData.length - 1)

  let counterDataStr = '';
  Object.keys(counter).forEach(date => {
    counterDataStr += `<div><span class='date'>${date}: </span><span class='count'>${counter[date]}</span></div>`
  })

  document.querySelector('#table-stats').innerHTML = counterDataStr;
}