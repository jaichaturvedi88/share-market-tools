(function() {
  // Create floating window
  const win = document.createElement("div");
  win.id = "pcrWindow";
  win.innerHTML = "<h4>PCR Tracker</h4><div id='pcrData'></div>";
  document.body.appendChild(win);

  // Make draggable
  let isDragging = false, offsetX, offsetY;
  win.addEventListener("mousedown", e => {
    isDragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
  });
  document.addEventListener("mousemove", e => {
    if (isDragging) {
      win.style.left = (e.pageX - offsetX) + "px";
      win.style.top = (e.pageY - offsetY) + "px";
    }
  });
  document.addEventListener("mouseup", () => isDragging = false);

  // Function to calculate PCR
  function calculatePCR() {
    console.log("🔍 Starting PCR calculation...");

    const table = document.querySelector("table"); 
    if (!table) {
      console.warn("⚠️ Table not found!");
      return;
    }

    const rows = table.querySelectorAll("tr");
    console.log("📊 Total rows found:", rows.length);

    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      console.warn("⚠️ Last row not found!");
      return;
    }

    const cells = lastRow.querySelectorAll("td");
    console.log("📋 Last row cells:", cells.length, cells);

    // Adjust indices if needed depending on table structure
    const callOI = parseInt(cells[1]?.innerText.replace(/,/g, "")) || 0;
    const putOI = parseInt(cells[cells.length - 1]?.innerText.replace(/,/g, "")) || 0;

    console.log("📈 Call OI:", callOI, "Put OI:", putOI);

    if (callOI === 0) {
      console.warn("⚠️ Call OI is zero, PCR cannot be calculated.");
      return;
    }

    const pcr = (putOI / callOI).toFixed(2);
    console.log("✅ Calculated PCR:", pcr);

    const entry = { time: new Date().toLocaleTimeString(), pcr };
    updateStorage(entry);
    renderData();
  }

  // Store last 10 entries in localStorage
  function updateStorage(entry) {
    let data = JSON.parse(localStorage.getItem("pcrData")) || [];
    data.push(entry);
    if (data.length > 10) data.shift();
    localStorage.setItem("pcrData", JSON.stringify(data));
    console.log("💾 Updated storage:", data);
  }

  function renderData() {
    let data = JSON.parse(localStorage.getItem("pcrData")) || [];
    console.log("🖼 Rendering data:", data);
    const container = document.getElementById("pcrData");
    container.innerHTML = data.map(d => `<div>${d.time} → ${d.pcr}</div>`).join("");
  }

  // Refresh button click
  function refreshPage() {
    const btn = document.querySelector(".refreshIcon");
    if (btn) {
      console.log("🔄 Clicking refresh button...");
      btn.click();
    } else {
      console.warn("⚠️ Refresh button not found!");
    }
    calculatePCR();
  }

  // Configurable interval (default 60s)
  let interval = 60000;
  setInterval(refreshPage, interval);

  // Initial load
  renderData();
  calculatePCR();
})();
