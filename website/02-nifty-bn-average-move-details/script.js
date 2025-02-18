let fileNameDiv = document.querySelector('.fileName');

function readCSVFile() {
    var files = document.querySelector("#file").files;
  
    if (files.length > 0) {
      // Selected file
      var file = files[0];
      fileNameDiv.innerText = file.name;
  
      // FileReader Object
      var reader = new FileReader();
  
      // Read file as string
      reader.readAsText(file);
  
      // Load event
      reader.onload = function (event) {
        // Read file data
        var csvdata = event.target.result;
  
        // Split by line break to gets rows Array
        var data = csvdata.split("\n");
  
        document.body.append(data)
      };
    } else {
      alert("Please select a file.");
    }
  }
