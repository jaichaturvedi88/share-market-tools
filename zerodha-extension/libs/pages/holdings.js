console.log("Hi! It's from positions.js")

const holdings = (function () {
  function createHoldingsUi() {
    createQuantityCalculator();
    createCopyButtonForTradingView();

  }

  function createCopyButtonForTradingView() {
    let wrapper = document.createElement('span');
    wrapper.innerHTML = `<button id="copyTvWatchlist">Copy TV WL</button>`

    let openPositionsHeader = document.querySelector('span.download');
    openPositionsHeader.insertAdjacentElement("afterend", wrapper)

    const button = document.querySelector('#copyTvWatchlist');
    const stocksContainer = document.querySelector('div.table-wrapper')

    button.addEventListener('click', () => {
      copyWatchlist(stocksContainer);
    })

  }

  function copyWatchlist(stocksContainer) {
    let watchList = "";
    const stocks = stocksContainer.querySelectorAll('tr')
    stocks.forEach((row, idx) => {
      if (idx > 0 && idx < stocks.length - 1) {
        watchList += "NSE:" + row.querySelector('td > a > span').textContent + ",";
      }
    });
    navigator.clipboard.writeText(watchList);
    console.log('Watchlist copied to clipboard');
  }

  function createQuantityCalculator() {
    let wrapper = document.createElement('div');
    wrapper.innerHTML = getCalculatorInnerHtml()

    let openPositionsHeader = document.querySelector('#app');
    openPositionsHeader.insertAdjacentElement("afterend", wrapper)

    attachEvents();
    makeDivDraggable();
  }

  function getCalculatorInnerHtml() {
    return `    
    <div class="calculator">
        <label for="amount">Amt:</label>
        <input type="number" id="amount" placeholder="Amount" value="10000">
        <br>

        <label for="price">Price:</label>
        <input type="number" id="price" placeholder="Price">

        <p id="result">Qty: <strong>0</strong> shares</p>
    </div>    
`;
  }

  function makeDivDraggable() {
    console.log("holdings.js >> makeDivDraggable");
    const dragElement = document.querySelector(".calculator");
    let offsetX = 0, offsetY = 0, isDragging = false;

    // Dragging Functionality
    dragElement.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - dragElement.getBoundingClientRect().left;
      offsetY = e.clientY - dragElement.getBoundingClientRect().top;
      dragElement.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        dragElement.style.left = e.clientX - offsetX + "px";
        dragElement.style.top = e.clientY - offsetY + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      dragElement.style.cursor = "grab";
    });
  }

  function attachEvents() {
    const amountInput = document.getElementById("amount");
    const priceInput = document.getElementById("price");
    const result = document.getElementById("result");

    // Multiply amount by 1000 on blur (focus out)
    amountInput.addEventListener("blur", () => {
      let amount = parseFloat(amountInput.value);
      if (!isNaN(amount)) {
        amount *= 1000;
        amountInput.value = amount;
        calculateShares(); // Recalculate after update
      }
    });

    amountInput.addEventListener("focus", () => {
      amountInput.select();
    });

    priceInput.addEventListener("focus", () => {
      priceInput.select();
    });

    function calculateShares() {
      const amount = parseFloat(amountInput.value);
      const price = parseFloat(priceInput.value);

      if (!amount || !price || price === 0) {
        result.innerHTML = `Qty: <strong>0</strong>`;
        return;
      }

      const shares = Math.floor(amount / price);
      result.innerHTML = `Qty: <strong>${shares}</strong>`;
    }

    // Attach listeners to both inputs
    amountInput.addEventListener("input", calculateShares);
    priceInput.addEventListener("input", calculateShares);
  }

  return { createHoldingsUi }

})();

