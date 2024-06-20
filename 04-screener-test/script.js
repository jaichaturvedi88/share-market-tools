let noOfDays = 5;
let leftSideRowsData = [];
let rightSideRowsData = [];
let dataInTable = [];
let parentEleOfcurrentBtn = '';
// let fileNameDiv = document.querySelector(".fileName");

let inputFile = '';
document.querySelector('.fileSelector').addEventListener('click',(event) =>{
  inputFile = event.target;
});
function readCSVFile() {
  var files = inputFile.files;

  if (files.length > 0) {
    // Selected file
    var file = files[0];
    // fileNameDiv.innerText = getFileName(file.name);

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
          if(inputFile.id === 'leftSideFile'){
            leftSideRowsData = rowsData;
            createTable(leftSideRowsData);
          }
          if(inputFile.id === 'rightSideFile'){
            rightSideRowsData = rowsData;
            createTable(rightSideRowsData);
          }
    };
  } else {
    alert("Please select a file.");
  }
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
  // <table > <tbody>
  let tbodyEl = '';
  if(inputFile.id === 'leftSideFile' || parentEleOfcurrentBtn.id === 'leftSideDaysBtnGroup'){
    tbodyEl = document
    .getElementById("leftSideTablecsvdata")
    .getElementsByTagName("tbody")[0];
  }
  else{
    tbodyEl = document
    .getElementById("rightSideTablecsvdata")
    .getElementsByTagName("tbody")[0];
  }
  
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
      newCell.innerHTML.includes('2024') ? newCell.classList.add('date-cell-background') : '';

    }
  }
console.log(noOfDays);

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

daysButtonGroup.addEventListener('click', highLightActiveDaysButtons);

function highLightActiveDaysButtons (event) {
  let currentBtn = event.target;
  parentEleOfcurrentBtn = currentBtn.parentNode;
  let daysButtons = parentEleOfcurrentBtn.querySelectorAll(".days-btn");

    for (let index = 0; index < daysButtons.length; index++) {
      daysButtons[index].classList.remove('active-btn');
    }

   currentBtn.classList.add('active-btn');
   noOfDays = currentBtn.innerText;
   if(parentEleOfcurrentBtn.id === 'leftSideDaysBtnGroup'){
    createTable(leftSideRowsData);
   }
   if(parentEleOfcurrentBtn.id === 'rightSideDaysBtnGroup'){
    createTable(rightSideRowsData);
   }
}

