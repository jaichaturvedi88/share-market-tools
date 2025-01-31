(async () => {
    console.log('atleast content js is loading')
    console.log('trying to load ', chrome.runtime.getURL("utils.js"))
    // const { greet } = await import(chrome.runtime.getURL("utils.js"));
    // greet("Chrome Extension");
    // console.log(greet)
})();
