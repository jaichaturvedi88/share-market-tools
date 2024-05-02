let rowsData = "";
function readCSVFile() {
  var files = document.querySelector("#file").files;

  if (files.length > 0) {
    // Selected file
    var file = files[0];
    //   fileNameDiv.innerText = getFileName(file.name);

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

      createHeaderDropDown(rowsData[0]);
    };
  } else {
    alert("Please select a file.");
  }
}

function createHeaderDropDown(headerRowData) {
  // split by comma to get row arrar
  let headerRow = headerRowData.split(",");
  let select = document.createElement("select");
  for (let index = 0; index < headerRow.length; index++) {
    let option = document.createElement("option");
    option.innerText = headerRow[index];
    select.appendChild(option);
  }
  select.setAttribute("class", "columnDropdown");
  // select.setAttribute("onChange", "getHeaderOption()");
  document.querySelector(".fileSelector").appendChild(select);
  document.querySelector(".fileSelector").innerHTML += '<input type="button" value="Generate WatchList" onclick="getHeaderOption();" />';
}
let selectedHeaderName = "";
function getHeaderOption() {
  let selectHeader = document.querySelector(".columnDropdown");
  // read selected option from dropdown
  selectedHeaderName = selectHeader.options[selectHeader.selectedIndex].text;
  getColumnData(selectedHeaderName);
}

function getColumnData(selectedHeaderName) {
  let columnData = "";
  let SelectedHeaderNameIndex = "";
  for (let rowIndex = 0; rowIndex < rowsData.length; rowIndex++) {
    // split by comma to get row array
    let rowData = rowsData[rowIndex].split(",");
    for (let colIndex = 0; colIndex < rowData.length; colIndex++) {
      if (rowData[colIndex] === selectedHeaderName) {
        SelectedHeaderNameIndex = rowData.indexOf(selectedHeaderName);
      }
    }
    if (rowIndex >= 1) {
      columnData += `NSE:${rowData[SelectedHeaderNameIndex]}-EQ\n`;
    }
  }

  createTextFile(columnData);
}

function createTextFile(columnData) {
  let link = document.createElement("a");
  // add content in fileof type text using blob object
  let file = new Blob([columnData], { type: "text/plain" });
  link.href = URL.createObjectURL(file);
  // download and name of file
  link.download = "sample.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}
