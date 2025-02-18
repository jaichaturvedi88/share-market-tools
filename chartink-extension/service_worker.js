chrome.action.onClicked.addListener(tab => {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        console.log('log from tabs')
        // console.log(tabs[0].url);
    });

    console.log('service worker code')  // This area belongs to service worker. The log will be shown in service worker. This can be opened from extension manager page.
    chrome.scripting.executeScript({
        target: { tabId: tab.id },    // Here we can m,anipulate actual website tab. Log will appear in actual tab console.
        func: () => {
            console.log('log from ext');
            // let text = document.querySelector(`#atlas-grid-layout > div > div.v-cloak--hidden.flex.flex-col.leading-relaxed.flex-1 > div:nth-child(2) > div > div:nth-child(3) > 
            //     div > div.flex.flex-col > div.flex.items-center.text-sm.font-semibold.ml-1.mr-1.justify-between > div.truncate`).innerText;

            // console.log(text)
            // window.scrollBy(0, 200)
            // document.body.style.backgroundColor = "red";
            // alert("Hello from ext!")

        }
    })
})

chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('1111');
    chrome.scripting.executeScript({
        target: { tabId: activeInfo.tabId },
        function: scrollPage
    });
});

function scrollPage() {
    console.log('2222');
    if(window.location.href.includes('chartink.com/stocks/')){
        console.log('3333');
        window.scrollTo(0, 160);
    }
}