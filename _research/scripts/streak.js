//This script extracts all stock symbols from the first column of the results table on the Streak scanner page, 
// formats them either for Fyers (NSE:SYMBOL-EQ,) or TradingView (NSE:SYMBOL,), 
// and then automatically copies the formatted output to clipboard and prints it in the console for easy use.

// It works on the below Streak scanner page:
//https://www.streak.tech/explore/scanner/possible-uptrend?tab=discover

function getSymbols(src, type) {
  const result = [...document.querySelectorAll('tbody tr td:first-child p:first-child')]
    .map(el => type === "Fyers" 
      ? `NSE:${el.textContent.trim()}-EQ,`
      : `NSE:${el.textContent.trim()},`)
    .join('\n');
  copy(result);
  console.log(result);
}


getSymbols("anything","Fyers");
getSymbols("anything","TV");
