/*
 * copy-watchlist.js
 * Paste this file's contents into the Chrome DevTools console on the page
 * containing the table (or include it on the page) to add a floating button
 * that copies the watchlist as comma-separated values like:
 *   NSE:BHARATWIRE-EQ, NSE:HNDFDS-EQ
 * 
 * https://chartink.com/screener/j-temp-3
 */

(function(){
  if (window.__copyWatchlistButton) return window.__copyWatchlistButton; // avoid duplicates

  function createButton() {
    const btn = document.createElement('button');
    btn.textContent = 'Copy Watchlist';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 999999,
      padding: '10px 14px',
      background: '#0b5cff',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(11,92,255,0.2)',
      fontSize: '13px',
      fontWeight: '600'
    });
    btn.title = 'Copy watchlist to clipboard';
    return btn;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch(e){ /* fallthrough to fallback */ }

    // fallback for pages without clipboard permission
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (err) {
      document.body.removeChild(ta);
      return false;
    }
  }

  function extractSymbols() {
    // Find the table in the page and the symbol cells.
    // This targets the "Symbol" column (third <td> in each row) from the provided HTML.
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const symbols = rows.map(row => {
      const tds = row.querySelectorAll('td');
      const td = tds[2];
      if (!td) return null;
      const a = td.querySelector('a');
      const txt = (a ? a.innerText : td.innerText).trim();
      return txt.replace(/\s+/g, '');
    }).filter(Boolean);
    return symbols;
  }

  function formatList(symbols, trailingComma=false) {
    const list = symbols.map(s => `NSE:${s}-EQ`).join(', ');
    return trailingComma ? (list + ', ') : list;
  }

  const btn = createButton();
  btn.addEventListener('click', async () => {
    const symbols = extractSymbols();
    if (!symbols.length) {
      alert('No symbols found in table.');
      return;
    }
    const text = formatList(symbols);
    const ok = await copyText(text);
    if (ok) {
      btn.textContent = 'Copied!';
      setTimeout(()=> btn.textContent = 'Copy Watchlist', 1500);
    } else {
      alert('Copy failed. Selected text:\n\n' + text);
    }
  });

  document.body.appendChild(btn);
  window.__copyWatchlistButton = {
    button: btn,
    remove() { btn.remove(); delete window.__copyWatchlistButton; }
  };
  return window.__copyWatchlistButton;
})();
