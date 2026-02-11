/**
 * Parse stocks from textarea input
 * Handles format: NSE:EICHERMOT-EQ, NSE:JUBLFOOD-EQ, NSE:BHEL-EQ
 * Returns array of objects with full symbol and stock name
 */
function parseStocks(input) {
  if (!input.trim()) return [];
  
  // Split by comma and clean up
  const stocks = input.split(',')
    .map(stock => stock.trim())
    .filter(stock => stock.length > 0);
  
  // Extract stock name from format NSE:STOCKNAME-EQ
  return stocks.map(stock => {
    const parts = stock.split(':');
    if (parts.length === 2) {
      const name = parts[1].split('-')[0]; // Extract STOCKNAME from STOCKNAME-EQ
      return {
        fullSymbol: stock,
        name: name
      };
    }
    return null;
  }).filter(item => item !== null);
}

/**
 * Get unique stocks by name
 */
function getUniqueStocks(stocks) {
  const seen = new Set();
  return stocks.filter(stock => {
    if (seen.has(stock.name)) return false;
    seen.add(stock.name);
    return true;
  });
}

/**
 * Process and populate tables
 */
function processTables() {
  const textarea1 = document.getElementById('textarea1').value;
  const textarea2 = document.getElementById('textarea2').value;
  
  // Parse stocks
  const stocks1 = getUniqueStocks(parseStocks(textarea1));
  const stocks2 = getUniqueStocks(parseStocks(textarea2));
  
  // Get stock names for comparison
  const names1 = new Set(stocks1.map(s => s.name));
  const names2 = new Set(stocks2.map(s => s.name));
  
  // Calculate differences
  const onlyIn1 = stocks1.filter(s => !names2.has(s.name));
  
  // Populate tables
  populateTable('table1', stocks1);
  populateTable('table2', stocks2);
  populateTable('table3', onlyIn1);
}

/**
 * Populate table with stocks
 */
function populateTable(tableId, stocks) {
  const tbody = document.getElementById(tableId);
  tbody.innerHTML = '';
  
  stocks.forEach(stock => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${stock.name}</td>`;
    tbody.appendChild(row);
  });
  
  // Show empty message if no stocks
  if (stocks.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td class="text-muted text-center">No stocks</td>';
    tbody.appendChild(row);
  }
}

/**
 * Show toast notification
 */
function showToast(message, duration = 2000) {
  console.log('Toast called:', message);
  
  let container = document.querySelector('.toast-container');
  
  if (!container) {
    console.log('Creating toast container');
    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; pointer-events: none;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    background-color: #28a745;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    pointer-events: auto;
    margin-bottom: 0.5rem;
    font-weight: 500;
    max-width: 350px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.innerHTML = `<span class="toast-icon" style="font-size: 1.25rem; flex-shrink: 0;">✓</span> <span>${message}</span>`;
  
  console.log('Appending toast:', toast);
  container.appendChild(toast);
  
  // Force reflow
  toast.offsetHeight;
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * Copy watchlist to clipboard in NSE:STOCKNAME-EQ format
 */
function copyWatchlist(tableId) {
  console.log('Copy called for table:', tableId);
  const tbody = document.getElementById(tableId);
  const rows = tbody.querySelectorAll('tr');
  
  // Get all stock names from the table
  const stockNames = Array.from(rows)
    .map(row => row.querySelector('td')?.textContent.trim())
    .filter(name => name && name !== 'No stocks');
  
  console.log('Stock names:', stockNames);
  
  if (stockNames.length === 0) {
    console.log('No stocks to copy');
    showToast('No stocks to copy!', 2000);
    return;
  }
  
  // Convert to NSE:STOCKNAME-EQ format
  const watchlist = stockNames
    .map(name => `NSE:${name}-EQ`)
    .join(', ');
  
  console.log('Watchlist:', watchlist);
  
  // Copy to clipboard
  navigator.clipboard.writeText(watchlist).then(() => {
    console.log('Copy successful');
    showToast(`Copied ${stockNames.length} stocks!`, 2000);
  }).catch(err => {
    console.error('Copy error:', err);
    showToast(`Failed to copy ${stockNames.length} stocks!`, 2000);
  });
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.body.setAttribute('data-bs-theme', theme);
  localStorage.setItem('theme', theme);
}

// Process tables on textarea change/blur for real-time updates
document.addEventListener('DOMContentLoaded', function() {
  // Force dark theme on initial load
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  // Always set to dark theme first
  document.documentElement.setAttribute('data-bs-theme', 'dark');
  document.body.setAttribute('data-bs-theme', 'dark');
  
  // Set radio button to dark
  document.getElementById('themeDark').checked = true;
  
  // If there's a saved light theme preference, apply it
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-bs-theme', 'light');
    document.body.setAttribute('data-bs-theme', 'light');
    document.getElementById('themeLight').checked = true;
  }
  
  // Add event listeners to radio buttons
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', function() {
      toggleTheme(this.value);
    });
  });
  
  document.getElementById('textarea1').addEventListener('change', processTables);
  document.getElementById('textarea1').addEventListener('blur', processTables);
  document.getElementById('textarea2').addEventListener('change', processTables);
  document.getElementById('textarea2').addEventListener('blur', processTables);
});
