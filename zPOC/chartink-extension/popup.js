document.getElementById('color-button').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: changeBodyColor
    });
  });
});

function changeBodyColor() {
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  document.body.style.backgroundColor = getRandomColor();    // somehow this line is not working
  // document.body.style.backgroundColor = 'red';
}

