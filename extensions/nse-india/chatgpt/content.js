(function () {
    console.log("PCR Extension Loaded");

    const STORAGE_KEY = "pcr_history";
    let interval = 10000;
    let loop;
    let isRunning = true;

    // ===== UI =====
    const panel = document.createElement("div");
    panel.innerHTML = `
        <div style="font-weight:bold;cursor:move;">PCR Tracker Chatgpt</div>

        <div style="margin:5px 0;">
            PCR: <span id="pcr-value">-</span>
        </div>

        <div style="margin-bottom:5px;">
            Interval: <input id="intervalInput" type="number" value="10" style="width:50px"/> sec
            <button id="toggleBtn">Stop</button>
        </div>

        <table id="pcr-table">
            <thead>
                <tr><th>Time</th><th>PCR</th></tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    Object.assign(panel.style, {
        position: "fixed",
        top: "100px",
        right: "20px",
        background: "#111",
        color: "#fff",
        padding: "10px",
        zIndex: 9999,
        width: "240px",
        fontSize: "12px",
        borderRadius: "6px",
        boxShadow: "0 0 10px rgba(0,0,0,0.5)"
    });

    document.body.appendChild(panel);

    // ===== TABLE STYLE =====
    const style = document.createElement("style");
    style.innerHTML = `
        #pcr-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
        }
        #pcr-table th {
            background: #222;
            padding: 4px;
        }
        #pcr-table td {
            padding: 4px;
            text-align: center;
        }
        #pcr-table tbody tr:nth-child(even) {
            background: #1a1a1a;
        }
        #pcr-table tbody tr:nth-child(odd) {
            background: #2a2a2a;
        }
        #pcr-table tbody tr:hover {
            background: #444;
        }
        button {
            margin-left: 5px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // ===== DRAG =====
    let isDragging = false, offsetX, offsetY;

    panel.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            panel.style.left = (e.clientX - offsetX) + "px";
            panel.style.top = (e.clientY - offsetY) + "px";
        }
    });

    document.addEventListener("mouseup", () => isDragging = false);

    // ===== GET PCR =====
    function getPCR() {
        const ce = document.querySelector("#equityOptionChainTotalRow-CE-totOI")?.innerText.replace(/,/g, "");
        const pe = document.querySelector("#equityOptionChainTotalRow-PE-totOI")?.innerText.replace(/,/g, "");

        if (!ce || !pe) return null;

        return (parseFloat(pe) / parseFloat(ce)).toFixed(2);
    }

    // ===== STORAGE =====
    function savePCR(pcr) {
        let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        data.unshift({ time: new Date().toLocaleTimeString(), value: pcr });
        data = data.slice(0, 10);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        renderTable(data);
    }

    function renderTable(data) {
        const tbody = document.querySelector("#pcr-table tbody");
        tbody.innerHTML = "";

        data.forEach(d => {
            tbody.innerHTML += `<tr><td>${d.time}</td><td>${d.value}</td></tr>`;
        });
    }

    function loadHistory() {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        renderTable(data);
    }

    // ===== REFRESH =====
    function clickRefresh() {
        const btn = document.querySelector("#optionchain_equity .refreshIcon");

        if (btn) {
            btn.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        }
    }

    // ===== OBSERVER =====
    function waitForUpdateAndRun() {
        const target = document.querySelector("#equityOptionChainTotalRow-CE-totOI");
        if (!target) return;

        let oldValue = target.innerText;

        const observer = new MutationObserver(() => {
            let newValue = target.innerText;

            if (newValue !== oldValue) {
                observer.disconnect();
                run();
            }
        });

        observer.observe(target, { childList: true, subtree: true });
    }

    // ===== MAIN =====
    let lastPCR = null;

    function run() {
        const pcr = getPCR();
        if (!pcr) return;

        const delta = lastPCR ? (pcr - lastPCR).toFixed(2) : "0.00";
        lastPCR = pcr;

        document.getElementById("pcr-value").innerText = `${pcr} (${delta})`;
        savePCR(pcr);
    }

    function executeCycle() {
        if (!isRunning) return;

        waitForUpdateAndRun();
        clickRefresh();
    }

    // ===== START / STOP =====
    document.getElementById("toggleBtn").addEventListener("click", () => {
        isRunning = !isRunning;

        document.getElementById("toggleBtn").innerText = isRunning ? "Stop" : "Start";

        if (isRunning) {
            loop = setInterval(executeCycle, interval);
        } else {
            clearInterval(loop);
        }
    });

    // ===== INTERVAL =====
    document.getElementById("intervalInput").addEventListener("change", (e) => {
        interval = parseInt(e.target.value) * 1000;

        if (isRunning) {
            clearInterval(loop);
            loop = setInterval(executeCycle, interval);
        }
    });

    // ===== INIT =====
    function init() {
        loadHistory();
        loop = setInterval(executeCycle, interval);
    }

    init();

})();