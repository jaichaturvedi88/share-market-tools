let rowsData = "";
let selectedHeaderName = "";
let selectedHeaderNameIndex = "";
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
      // console.log(rowsData);
      createHeaderDropDown(rowsData[0]);
    };
  } else {
    alert("Please select a file.");
  }
}

function createHeaderDropDown(headerRowData) {
  let dropDownContainer = document.querySelector(".headerDropDown");
  dropDownContainer.innerHTML = "";
  // split by comma to get row arrar
  let headerRow = headerRowData.split(",");
  let select = document.createElement("select");
  let createFIleButton = document.createElement("button");
  createFIleButton.innerText = "Create Text File";
  for (let index = 0; index < headerRow.length; index++) {
    let option = document.createElement("option");
    option.innerText = headerRow[index].replace(/"/g, "");
    // console.log(option.innerText);
    select.appendChild(option);
  }
  select.setAttribute("class", "columnDropdown");
  select.setAttribute("onChange", "getHeaderOption()");
  createFIleButton.setAttribute("onClick", "getColumnData()");
  dropDownContainer.appendChild(select);
  dropDownContainer.appendChild(createFIleButton);
}
function getHeaderOption() {
  let selectHeader = document.querySelector(".columnDropdown");
  // read selected option from dropdown
  selectedHeaderName = selectHeader.options[selectHeader.selectedIndex].text;
  // getColumnData(selectedHeaderName);
}

function getColumnData() {
  let headerDataArray = [];
  let columnData = "";
  let headerRow = rowsData[0].split(",");
  for (let index = 0; index < headerRow.length; index++) {
    let headerRowData = headerRow[index].replace(/"/g, "");
    headerDataArray.push(headerRowData);
    if (headerRowData === selectedHeaderName) {
      selectedHeaderNameIndex = headerDataArray.indexOf(selectedHeaderName);
      console.log(selectedHeaderNameIndex);
      break;
    }
  }
  

  let stockSymbolSet = new Set();
  for (let rowIndex = 1; rowIndex < rowsData.length; rowIndex++) {
    let rowData = rowsData[rowIndex].split(",");
    stockSymbolSet.add(
      `NSE:${rowData[selectedHeaderNameIndex].replace(/"/g, "")}-EQ\n`
    );
  }

  for (const symbol of stockSymbolSet) {
    columnData += symbol;
  }

  createTextFile(columnData);
}

function createTextFile(columnData) {
  console.log(columnData);
  let link = document.createElement("a");
  // add content in fileof type text using blob object
  let file = new Blob([columnData], { type: "text/plain" });
  link.href = URL.createObjectURL(file);
  // download and name of file
  link.download = "sample.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}
