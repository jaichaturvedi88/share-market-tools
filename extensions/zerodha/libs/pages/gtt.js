console.log("Hi! It's from gtt.js")

const gtt = (function () {
  const STORAGE_KEYS = {
    positions: 'zerodha_gtt_positions',
    triggers: 'zerodha_gtt_triggers',
    rows: 'zerodha_gtt_rows',
    slHistory: 'zerodha_gtt_sl_history',
    syncedAt: 'zerodha_gtt_synced_at'
  };

  const ENDPOINTS = {
    positions: '/oms/portfolio/positions',
    triggers: '/oms/gtt/triggers'
  };

  const PAGE_FETCH_EVENT = 'zerodha-gtt-helper-fetch';
  const PAGE_FETCH_RESPONSE_EVENT = 'zerodha-gtt-helper-fetch-response';
  const MONITOR_INTERVAL_MINUTES = 5;
  let currentRows = [];
  let currentPositions = [];
  let monitorInterval = null;
  let gttTableObserver = null;
  let gttTableObserverTimer = null;
  let currentSort = {
    key: 'symbol',
    direction: 'asc'
  };
  let hideCompletedTrades = true;

  function createGttUi() {
    if (document.querySelector('#gtt-helper-root')) return;

    const root = document.createElement('div');
    root.id = 'gtt-helper-root';
    root.innerHTML = `
      <button id="gtt-helper-toggle" type="button" title="Open GTT trades">
        <span class="gtt-helper-icon">&#9889;</span>
        <span>trades</span>
      </button>
      <section id="gtt-helper-panel" aria-label="GTT helper panel" hidden>
        <div class="gtt-helper-header">
          <strong>GTT Details</strong>
          <div>
            <label class="gtt-helper-toggle-completed" title="Hide completed trades">
              <input id="gtt-helper-hide-completed" type="checkbox" checked>
              <span>Hide 0</span>
            </label>
            <button id="gtt-helper-history" type="button" title="Open SL history">H</button>
            <button id="gtt-helper-refresh" type="button" title="Refresh GTT details">&#x21bb;</button>
            <button id="gtt-helper-close" type="button" title="Close GTT helper">&times;</button>
          </div>
        </div>
        <div id="gtt-helper-status">Open panel to sync latest data.</div>
        <div class="gtt-helper-table-wrap">
          <table>
            <thead>
              <tr>
                <th><button type="button" data-sort-key="symbol">Symbol</button></th>
                <th><button type="button" data-sort-key="buyQuantity">Qty</button></th>
                <th><button type="button" data-sort-key="averagePrice">Buy</button></th>
                <th><button type="button" data-sort-key="panelTriggerValue">Trigr</button></th>
                <th><button type="button" data-sort-key="ltpValue">LTP</button></th>
                <th><button type="button" data-sort-key="triggerPercentValue">Trigr %</button></th>
                <th><button type="button" data-sort-key="status">Result</button></th>
                <th>SL</th>
              </tr>
            </thead>
            <tbody id="gtt-helper-rows">
              <tr><td colspan="8">No data loaded.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    document.body.appendChild(root);
    attachEvents();
    startMonitor();
    startGttTableObserver();
    loadSavedRows();
  }

  function attachEvents() {
    document.querySelector('#gtt-helper-toggle').addEventListener('click', async () => {
      const panel = document.querySelector('#gtt-helper-panel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        await syncAndRender();
      }
    });

    document.querySelector('#gtt-helper-refresh').addEventListener('click', refreshGttAndRender);
    document.querySelector('#gtt-helper-close').addEventListener('click', () => {
      document.querySelector('#gtt-helper-panel').hidden = true;
    });
    document.querySelector('#gtt-helper-hide-completed').addEventListener('change', (event) => {
      hideCompletedTrades = event.target.checked;
      renderRows(currentRows);
    });
    document.querySelector('#gtt-helper-history').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'open-gtt-history' });
    });
    document.querySelector('#gtt-helper-panel thead').addEventListener('click', (event) => {
      const button = event.target.closest('[data-sort-key]');
      if (!button) return;

      sortRows(button.dataset.sortKey);
    });
    document.querySelector('#gtt-helper-rows').addEventListener('click', handleRowsClick);
    makePanelDraggable();
  }

  async function handleRowsClick(event) {
    const button = event.target.closest('[data-sl-action]');
    if (!button) return;

    const row = currentRows.find((item) => normalizeSymbol(item.symbol) === button.dataset.rowKey);
    if (!row) return;

    const targetStopLoss = calculateTargetStopLoss(row);
    if (targetStopLoss === null) {
      setStatus('SL move unavailable: LTP is missing.');
      return;
    }

    button.disabled = true;
    setStatus(`Moving SL for ${row.symbol} to ${targetStopLoss.toFixed(2)}...`);

    try {
      const rowWithTrigger = row.triggerId ? row : await hydrateTriggerDetails(row);
      await moveStopLoss(rowWithTrigger, targetStopLoss);
      await saveSlMovement(rowWithTrigger, targetStopLoss);
      setStatus(`SL moved for ${row.symbol} to ${targetStopLoss.toFixed(2)}.`);
      clickZerodhaGttNav();
      await wait(1200);
      await refreshGttAndRender({ silent: true });
    } catch (error) {
      console.error('GTT helper SL move failed', error);
      setStatus(`SL move failed: ${error.message}`);
      button.disabled = false;
    }
  }

  function makePanelDraggable() {
    const root = document.querySelector('#gtt-helper-root');
    const panel = document.querySelector('#gtt-helper-panel');
    const header = document.querySelector('.gtt-helper-header');
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    header.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) return;

      const rect = root.getBoundingClientRect();
      isDragging = true;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.classList.add('gtt-helper-dragging');
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.left = `${rect.left}px`;
      root.style.top = `${rect.top}px`;
    });

    document.addEventListener('mousemove', (event) => {
      if (!isDragging) return;

      const nextLeft = Math.max(8, Math.min(window.innerWidth - root.offsetWidth - 8, event.clientX - offsetX));
      const nextTop = Math.max(8, Math.min(window.innerHeight - root.offsetHeight - 8, event.clientY - offsetY));
      root.style.left = `${nextLeft}px`;
      root.style.top = `${nextTop}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.classList.remove('gtt-helper-dragging');
    });
  }

  async function syncAndRender() {
    setStatus('Syncing positions and GTT triggers...');

    try {
      const [positionsResult, triggersResult] = await Promise.allSettled([
        fetchJsonFromPage(ENDPOINTS.positions),
        fetchJsonFromPage(ENDPOINTS.triggers)
      ]);

      if (positionsResult.status === 'rejected' && triggersResult.status === 'rejected') {
        throw new Error(`positions and triggers failed: ${positionsResult.reason.message}; ${triggersResult.reason.message}`);
      }

      let positions = [];
      if (positionsResult.status === 'fulfilled') {
        positions = extractPositions(positionsResult.value);
      } else {
        const saved = await readFromDb([STORAGE_KEYS.positions]);
        positions = currentPositions.length ? currentPositions : saved[STORAGE_KEYS.positions] || [];
        console.warn('GTT helper positions sync failed; using saved positions', positionsResult.reason);
      }

      const triggers = triggersResult.status === 'fulfilled' ? extractTriggers(triggersResult.value) : [];
      const gttPanelTriggers = readGttPanelTriggers([...positions, ...triggers].map((item) => item.symbol));
      const rows = buildRows(positions, triggers, gttPanelTriggers);
      const syncedAt = new Date().toISOString();

      currentPositions = positions;
      await saveToDb({ positions, triggers, rows, syncedAt });
      renderRows(rows);
      const note = positionsResult.status === 'rejected' ? ' using saved positions' : '';
      setStatus(`Synced ${rows.length} symbols${note} at ${new Date(syncedAt).toLocaleTimeString()}.`);
    } catch (error) {
      console.error('GTT helper sync failed', error);
      setStatus(`Sync failed: ${error.message}`);
    }
  }

  async function refreshGttAndRender({ silent = false } = {}) {
    if (!silent) setStatus('Refreshing GTT triggers...');

    try {
      if (!currentPositions.length) {
        const saved = await readFromDb([STORAGE_KEYS.positions]);
        currentPositions = saved[STORAGE_KEYS.positions] || [];
      }

      const triggersResponse = await fetchJsonFromPage(ENDPOINTS.triggers);
      const triggers = extractTriggers(triggersResponse);
      const gttPanelTriggers = readGttPanelTriggers([...currentPositions, ...triggers].map((item) => item.symbol));
      const rows = buildRows(currentPositions, triggers, gttPanelTriggers);
      const syncedAt = new Date().toISOString();

      await saveToDb({ positions: currentPositions, triggers, rows, syncedAt });
      renderRows(sortRowsForCurrentSort(rows));
      setStatus(`${silent ? 'Auto refreshed' : 'Refreshed'} ${rows.length} symbols at ${new Date(syncedAt).toLocaleTimeString()}.`);
    } catch (error) {
      console.error('GTT helper refresh failed', error);
      setStatus(`Refresh failed: ${error.message}`);
    }
  }

  function startMonitor() {
    if (monitorInterval) return;

    monitorInterval = setInterval(() => {
      if (!document.querySelector('#gtt-helper-root')) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        return;
      }

      refreshGttAndRender({ silent: true });
    }, MONITOR_INTERVAL_MINUTES * 60 * 1000);
  }

  function startGttTableObserver() {
    const app = document.querySelector('#app');
    if (!app) {
      setTimeout(startGttTableObserver, 1000);
      return;
    }

    gttTableObserver?.disconnect();
    gttTableObserver = new MutationObserver((mutations) => {
      if (!mutations.some(isGttTableMutation)) return;

      clearTimeout(gttTableObserverTimer);
      gttTableObserverTimer = setTimeout(refreshRowsFromGttTable, 150);
    });

    gttTableObserver.observe(app, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function isGttTableMutation(mutation) {
    const wrapper = getGttPanelWrapper();
    if (!wrapper) return false;

    return wrapper.contains(mutation.target) ||
      [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (wrapper.contains(node) || node.contains(wrapper)));
  }

  function refreshRowsFromGttTable() {
    if (!currentRows.length) return;

    const gttPanelTriggers = readGttPanelTriggers(currentRows.map((row) => row.symbol));
    const panelTriggersBySymbol = new Map(gttPanelTriggers.map((item) => [normalizeSymbol(item.symbol), item]));
    const rows = currentRows.map((row) => {
      const panelTrigger = panelTriggersBySymbol.get(normalizeSymbol(row.symbol)) || findMatchingPanelTrigger(panelTriggersBySymbol, row.symbol);
      if (!panelTrigger) return row;

      return {
        ...row,
        ltpText: panelTrigger.ltpText,
        ltpValue: panelTrigger.ltpValue,
        gttStatus: panelTrigger.gttStatus,
        panelTriggerText: panelTrigger.triggerText,
        panelTriggerValue: panelTrigger.triggerValue,
        triggerPercentText: panelTrigger.percentText,
        triggerPercentValue: panelTrigger.percentValue,
        status: getTradeStatus(row.averagePrice, panelTrigger.triggerValue ?? row.primaryTrigger),
        isDisabled: isTriggeredStatus(panelTrigger.gttStatus)
      };
    });

    renderRows(rows);
  }

  function fetchJsonFromPage(url, options = {}) {
    ensurePageFetchBridge();

    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => {
        window.removeEventListener(PAGE_FETCH_RESPONSE_EVENT, handleResponse);
        reject(new Error(`${url.split('/').pop()} timed out`));
      }, 45000);

      function handleResponse(event) {
        const response = event.detail || {};
        if (response.requestId !== requestId) return;

        clearTimeout(timeout);
        window.removeEventListener(PAGE_FETCH_RESPONSE_EVENT, handleResponse);

        if (response.ok) {
          resolve(response.body);
        } else {
          reject(new Error(`${url.split('/').pop()} returned ${response.status}: ${response.error || response.preview || 'no response body'}`));
        }
      }

      window.addEventListener(PAGE_FETCH_RESPONSE_EVENT, handleResponse);
      window.dispatchEvent(new CustomEvent(PAGE_FETCH_EVENT, {
        detail: { requestId, url, options }
      }));
    });
  }

  function ensurePageFetchBridge() {
    if (document.querySelector('#zerodha-gtt-helper-fetch-bridge')) return;

    const script = document.createElement('script');
    script.id = 'zerodha-gtt-helper-fetch-bridge';
    script.src = chrome.runtime.getURL('libs/pages/gtt-fetch-bridge.js');
    document.documentElement.appendChild(script);
  }

  function extractPositions(response) {
    const data = response?.data || {};
    const positionRows = [
      ...(Array.isArray(data.net) ? data.net : []),
      ...(Array.isArray(data.day) ? data.day : [])
    ];

    const positionsBySymbol = new Map();

    positionRows.forEach((position) => {
      const symbol = readSymbol(position);
      if (!symbol) return;

      const averagePrice = readNumber(
        position.day_buy_price ??
        position.dayBuyPrice ??
        position.day_buy_price_display
      );

      positionsBySymbol.set(symbol, {
        symbol,
        averagePrice,
        buyQuantity: readNumber(
          position.buy_quantity ??
          position.buy_qty ??
          position.buyQuantity
        )
      });
    });

    return Array.from(positionsBySymbol.values());
  }

  function extractTriggers(response) {
    const triggerRows = readArray(response?.data) || readArray(response);

    return triggerRows.map((trigger) => {
      const symbol = readSymbolDeep(trigger);
      const triggerValues = readTriggerValues(trigger);
      const condition = trigger.condition || {};
      const orders = Array.isArray(trigger.orders) ? trigger.orders : [];

      return {
        symbol,
        triggerId: readTriggerId(trigger),
        triggerValues: Array.isArray(triggerValues) ? triggerValues : [triggerValues],
        triggerCondition: condition,
        triggerOrders: orders,
        triggerType: trigger.type || 'single',
        expiresAt: trigger.expires_at || trigger.expiresAt || ''
      };
    }).filter((trigger) => trigger.symbol);
  }

  function buildRows(positions, triggers, gttPanelTriggers = []) {
    const rowsBySymbol = new Map();
    const panelTriggersBySymbol = new Map(gttPanelTriggers.map((item) => [normalizeSymbol(item.symbol), item]));

    positions.forEach((position) => {
      rowsBySymbol.set(normalizeSymbol(position.symbol), {
        symbol: position.symbol,
        averagePrice: position.averagePrice,
        buyQuantity: position.buyQuantity,
        ltpText: '',
        ltpValue: null,
        gttStatus: '',
        triggerId: null,
        triggerCondition: null,
        triggerOrders: [],
        triggerType: '',
        expiresAt: '',
        panelTriggerText: '',
        panelTriggerValue: null,
        triggerPercentText: '',
        triggerPercentValue: null,
        triggerValues: []
      });
    });

    triggers.forEach((trigger) => {
      const existingKey = findMatchingSymbolKey(rowsBySymbol, trigger.symbol);
      const rowKey = existingKey || normalizeSymbol(trigger.symbol);
      const row = rowsBySymbol.get(rowKey) || {
        symbol: trigger.symbol,
        averagePrice: null,
        buyQuantity: null,
        ltpText: '',
        ltpValue: null,
        gttStatus: '',
        triggerId: trigger.triggerId,
        triggerCondition: trigger.triggerCondition,
        triggerOrders: trigger.triggerOrders,
        triggerType: trigger.triggerType,
        expiresAt: trigger.expiresAt,
        panelTriggerText: '',
        panelTriggerValue: null,
        triggerPercentText: '',
        triggerPercentValue: null,
        triggerValues: []
      };

      row.triggerValues = [...row.triggerValues, ...trigger.triggerValues];
      row.triggerId = trigger.triggerId || row.triggerId;
      row.triggerCondition = trigger.triggerCondition || row.triggerCondition;
      row.triggerOrders = trigger.triggerOrders?.length ? trigger.triggerOrders : row.triggerOrders;
      row.triggerType = trigger.triggerType || row.triggerType;
      row.expiresAt = trigger.expiresAt || row.expiresAt;
      row.primaryTrigger = readPrimaryTrigger(row.triggerValues);
      row.status = getTradeStatus(row.averagePrice, row.panelTriggerValue ?? row.primaryTrigger);
      rowsBySymbol.set(rowKey, row);
    });

    gttPanelTriggers.forEach((panelTrigger) => {
      const matchingKey = findMatchingSymbolKey(rowsBySymbol, panelTrigger.symbol);
      if (matchingKey) {
        const row = rowsBySymbol.get(matchingKey);
        row.panelTriggerText = panelTrigger.triggerText;
        row.panelTriggerValue = panelTrigger.triggerValue;
        row.triggerPercentText = panelTrigger.percentText;
        row.triggerPercentValue = panelTrigger.percentValue;
        row.gttStatus = panelTrigger.gttStatus;
        rowsBySymbol.set(matchingKey, row);
        return;
      }

      rowsBySymbol.set(normalizeSymbol(panelTrigger.symbol), {
        symbol: panelTrigger.symbol,
        averagePrice: null,
        buyQuantity: null,
        ltpText: panelTrigger.ltpText,
        ltpValue: panelTrigger.ltpValue,
        gttStatus: panelTrigger.gttStatus,
        triggerId: null,
        triggerCondition: null,
        triggerOrders: [],
        triggerType: '',
        expiresAt: '',
        panelTriggerText: panelTrigger.triggerText,
        panelTriggerValue: panelTrigger.triggerValue,
        triggerPercentText: panelTrigger.percentText,
        triggerPercentValue: panelTrigger.percentValue,
        triggerValues: []
      });
    });

    return Array.from(rowsBySymbol.values()).map((row) => {
      const primaryTrigger = readPrimaryTrigger(row.triggerValues);
      const panelTrigger = panelTriggersBySymbol.get(normalizeSymbol(row.symbol)) || {};

      return {
        ...row,
        primaryTrigger,
        ltpText: panelTrigger.ltpText || row.ltpText || '',
        ltpValue: panelTrigger.ltpValue ?? row.ltpValue ?? null,
        gttStatus: panelTrigger.gttStatus || row.gttStatus || '',
        panelTriggerText: panelTrigger.triggerText || row.panelTriggerText || '',
        panelTriggerValue: panelTrigger.triggerValue ?? row.panelTriggerValue ?? null,
        triggerPercentText: panelTrigger.percentText || row.triggerPercentText || '',
        triggerPercentValue: panelTrigger.percentValue ?? row.triggerPercentValue ?? null,
        status: getTradeStatus(row.averagePrice, panelTrigger.triggerValue ?? row.panelTriggerValue ?? primaryTrigger),
        isDisabled: isTriggeredStatus(panelTrigger.gttStatus || row.gttStatus)
      };
    }).sort((left, right) => left.symbol.localeCompare(right.symbol));
  }

  function findMatchingSymbolKey(rowsBySymbol, symbol) {
    const target = normalizeSymbol(symbol);
    return [...rowsBySymbol.keys()].find((key) => {
      const source = key;
      return source === target || source.includes(target) || target.includes(source);
    });
  }

  function findMatchingPanelTrigger(panelTriggersBySymbol, symbol) {
    const target = normalizeSymbol(symbol);
    const matchingKey = [...panelTriggersBySymbol.keys()].find((key) => {
      return key === target || key.includes(target) || target.includes(key);
    });

    return matchingKey ? panelTriggersBySymbol.get(matchingKey) : null;
  }

  function readSymbol(row) {
    return (
      row?.tradingsymbol ||
      row?.trading_symbol ||
      row?.symbol ||
      row?.instrument?.tradingsymbol ||
      row?.instrument?.symbol ||
      ''
    ).toString().trim();
  }

  function readSymbolDeep(row) {
    if (!row || typeof row !== 'object') return '';

    const directSymbol = readSymbol(row);
    if (directSymbol) return directSymbol;

    const nestedCandidates = [
      row.condition,
      row.order,
      ...(Array.isArray(row.orders) ? row.orders : [])
    ];

    for (const candidate of nestedCandidates) {
      const symbol = readSymbol(candidate);
      if (symbol) return symbol;
    }

    return '';
  }

  function readTriggerValues(trigger) {
    const values =
      trigger?.condition?.trigger_values ??
      trigger?.trigger_values ??
      trigger?.condition?.trigger_value ??
      trigger?.trigger_value ??
      [];

    return Array.isArray(values) ? values : [values];
  }

  function readTriggerId(trigger) {
    return (
      trigger?.id ??
      trigger?.trigger_id ??
      trigger?.triggerId ??
      trigger?.gtt_id ??
      trigger?.gttId ??
      trigger?.meta?.id ??
      trigger?.data?.id ??
      ''
    );
  }

  function readArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.triggers)) return value.triggers;
    if (Array.isArray(value?.items)) return value.items;
    return null;
  }

  function readGttPanelTriggers(symbols) {
    const wrapper = getGttPanelWrapper();
    if (!wrapper) return [];

    const uniqueSymbols = [...new Set((symbols || []).filter(Boolean))];
    const rowCandidates = [...wrapper.querySelectorAll('tbody tr, tr, .gtt-list-item, .gtt-row, li')];
    const rows = rowCandidates.length ? rowCandidates : [...wrapper.children];
    const headerMap = readHeaderMap(wrapper);

    return rows.map((row) => {
      const rowText = normalizeSpace(row.textContent);
      const symbol = readGttRowSymbol(row) || findSymbolInText(rowText, uniqueSymbols);
      const triggerText = readTriggerText(row, rowText, headerMap);
      const ltpText = readLtpText(row, headerMap);
      const gttStatus = readGttStatus(row, headerMap);
      const percentText = readPercentText(rowText);

      if (!symbol || (!triggerText && !percentText)) return null;

      return {
        symbol,
        ltpText,
        ltpValue: readNumber(ltpText),
        gttStatus,
        triggerText,
        triggerValue: readNumber(triggerText),
        percentText,
        percentValue: readNumber(percentText)
      };
    }).filter(Boolean);
  }

  function getGttPanelWrapper() {
    return document.querySelector('.gtt-list-wrap.table-wrapper') ||
      document.evaluate('//*[@id="app"]/div[2]/div[2]/div/div/section', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  function readHeaderMap(wrapper) {
    const headers = [...wrapper.querySelectorAll('thead th')];

    return headers.reduce((map, header, index) => {
      map[normalizeSpace(header.textContent).toLowerCase()] = index;
      return map;
    }, {});
  }

  function readTriggerText(row, rowText, headerMap) {
    const labelledCell = row.querySelector('[data-label*="Trigger" i], [class*="trigger" i]');
    if (labelledCell) return readPriceText(labelledCell.textContent);

    const cells = [...row.querySelectorAll('td')];
    const triggerColumn = Object.entries(headerMap).find(([label]) => label.includes('trigger'));
    if (triggerColumn && cells[Number(triggerColumn[1])]) {
      return readPriceText(cells[Number(triggerColumn[1])].textContent);
    }

    return readPriceBeforePercent(rowText) || readLastPriceText(rowText);
  }

  function readLtpText(row, headerMap) {
    const labelledCell = row.querySelector('td.last-price, [data-label*="LTP" i], [data-label*="Last" i]');
    if (labelledCell) return readPriceText(labelledCell.textContent);

    const cells = [...row.querySelectorAll('td')];
    const ltpColumn = Object.entries(headerMap).find(([label]) => label.includes('ltp') || label.includes('last'));
    if (ltpColumn && cells[Number(ltpColumn[1])]) {
      return readPriceText(cells[Number(ltpColumn[1])].textContent);
    }

    return '';
  }

  function readGttStatus(row, headerMap) {
    const labelledCell = row.querySelector('td.status, [data-label*="Status" i], [class*="status" i]');
    if (labelledCell) return normalizeSpace(labelledCell.textContent).toUpperCase();

    const cells = [...row.querySelectorAll('td')];
    const statusColumn = Object.entries(headerMap).find(([label]) => label.includes('status'));
    if (statusColumn && cells[Number(statusColumn[1])]) {
      return normalizeSpace(cells[Number(statusColumn[1])].textContent).toUpperCase();
    }

    return '';
  }

  function readPriceBeforePercent(text) {
    const percentIndex = text.search(/[+-]?\d+(?:\.\d+)?\s*%/);
    if (percentIndex < 0) return '';

    return readLastPriceText(text.slice(0, percentIndex));
  }

  function readLastPriceText(text) {
    const matches = normalizeSpace(text).match(/\b\d[\d,]*(?:\.\d+)?\b/g);
    return matches?.length ? matches[matches.length - 1] : '';
  }

  function readPriceText(text) {
    return readPriceBeforePercent(text) || readLastPriceText(text);
  }

  function findSymbolInText(text, symbols) {
    const upperText = text.toUpperCase();
    return symbols.find((symbol) => upperText.includes(symbol.toUpperCase())) || '';
  }

  function readGttRowSymbol(row) {
    const symbol = normalizeSpace(row.querySelector('.tradingsymbol span')?.textContent || row.querySelector('.tradingsymbol')?.textContent || '');
    if (symbol) return symbol;

    return normalizeSpace(row.querySelector('td.instrument a')?.textContent || row.querySelector('td.instrument')?.textContent || '');
  }

  function readPercentText(text) {
    const matches = normalizeSpace(text).match(/[+-]?\d+(?:\.\d+)?\s*%/g);
    return matches?.length ? matches[matches.length - 1].replace(/\s+/g, '') : '';
  }

  function normalizeSymbol(symbol) {
    return normalizeSpace(symbol)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/(NFO|NSE|BSE|MCX)$/g, '')
      .replace(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/g, '$2');
  }

  function normalizeSpace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readNumber(value) {
    const number = parseFloat(String(value ?? '').replaceAll(',', ''));
    return Number.isNaN(number) ? null : number;
  }

  function saveToDb(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.positions]: data.positions,
        [STORAGE_KEYS.triggers]: data.triggers,
        [STORAGE_KEYS.rows]: data.rows,
        [STORAGE_KEYS.syncedAt]: data.syncedAt
      }, () => {
        const error = chrome.runtime.lastError;
        error ? reject(new Error(error.message)) : resolve();
      });
    });
  }

  async function loadSavedRows() {
    const saved = await readFromDb([STORAGE_KEYS.rows, STORAGE_KEYS.positions, STORAGE_KEYS.syncedAt]);
    const rows = saved[STORAGE_KEYS.rows] || [];
    currentPositions = saved[STORAGE_KEYS.positions] || [];

    if (rows.length) {
      renderRows(rows);
      setStatus(`Loaded saved data from ${new Date(saved[STORAGE_KEYS.syncedAt]).toLocaleTimeString()}.`);
    }
  }

  function readFromDb(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const error = chrome.runtime.lastError;
        error ? reject(new Error(error.message)) : resolve(result);
      });
    });
  }

  function renderRows(rows) {
    const tbody = document.querySelector('#gtt-helper-rows');
    const normalizedRows = normalizeRows(rows);
    const displayRows = sortRowsForCurrentSort(normalizedRows);
    const visibleRows = hideCompletedTrades
      ? displayRows.filter((row) => !row.isDisabled)
      : displayRows;

    if (!tbody) return;
    currentRows = normalizedRows;
    if (!visibleRows.length) {
      tbody.innerHTML = '<tr><td colspan="8">No positions or GTT triggers found.</td></tr>';
      return;
    }

    tbody.innerHTML = visibleRows.map((row) => `
      <tr class="${row.isDisabled ? 'gtt-helper-disabled-row' : ''}">
        <td>${escapeHtml(row.symbol)}</td>
        <td>${formatNumber(row.buyQuantity, 0)}</td>
        <td>${formatNumber(row.averagePrice)}</td>
        <td>${escapeHtml(row.panelTriggerText || formatTriggerValues(row.triggerValues))}</td>
        <td>${formatNumber(row.ltpValue)}</td>
        <td>${renderTriggerPercentCell(row)}</td>
        <td><span class="gtt-helper-status-text ${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${renderMoveSlCell(row)}</td>
      </tr>
    `).join('');
    updateSortIndicators();
  }

  function normalizeRows(rows) {
    const rowsBySymbol = new Map();

    (rows || []).forEach((row) => {
      const key = normalizeSymbol(row.symbol);
      const existing = rowsBySymbol.get(key);
      rowsBySymbol.set(key, mergeRows(existing, row));
    });

    return [...rowsBySymbol.values()].map((row) => {
      const primaryTrigger = row.primaryTrigger ?? readPrimaryTrigger(row.triggerValues);
      const status = getTradeStatus(row.averagePrice, row.panelTriggerValue ?? primaryTrigger);
      const averagePrice = readNumber(row.averagePrice);

      return {
        ...row,
        primaryTrigger,
        status,
        ltpText: row.ltpText || '',
        ltpValue: row.ltpValue ?? readNumber(row.ltpText),
        gttStatus: row.gttStatus || '',
        panelTriggerText: row.panelTriggerText || '',
        panelTriggerValue: row.panelTriggerValue ?? readNumber(row.panelTriggerText),
        triggerPercentText: row.triggerPercentText || '',
        triggerPercentValue: row.triggerPercentValue ?? readNumber(row.triggerPercentText),
        isDisabled: row.gttStatus ? isTriggeredStatus(row.gttStatus) : averagePrice === null || averagePrice <= 0
      };
    });
  }

  function mergeRows(existing, incoming) {
    if (!existing) return incoming;

    const existingAverage = readNumber(existing.averagePrice);
    const incomingAverage = readNumber(incoming.averagePrice);
    const existingHasAverage = existingAverage !== null && existingAverage > 0;
    const incomingHasAverage = incomingAverage !== null && incomingAverage > 0;
    const preferredSymbol = existingHasAverage ? existing.symbol : incoming.symbol;
    const averagePrice = existingHasAverage ? existing.averagePrice : incoming.averagePrice;
    const buyQuantity = existingHasAverage ? existing.buyQuantity : incoming.buyQuantity;

    return {
      ...existing,
      ...incoming,
      symbol: preferredSymbol,
      averagePrice,
      buyQuantity: buyQuantity ?? existing.buyQuantity ?? incoming.buyQuantity,
      panelTriggerText: incoming.panelTriggerText || existing.panelTriggerText,
      panelTriggerValue: incoming.panelTriggerValue ?? existing.panelTriggerValue,
      ltpText: incoming.ltpText || existing.ltpText,
      ltpValue: incoming.ltpValue ?? existing.ltpValue,
      gttStatus: incoming.gttStatus || existing.gttStatus,
      triggerId: incoming.triggerId || existing.triggerId,
      triggerCondition: incoming.triggerCondition || existing.triggerCondition,
      triggerOrders: incoming.triggerOrders?.length ? incoming.triggerOrders : existing.triggerOrders,
      triggerType: incoming.triggerType || existing.triggerType,
      expiresAt: incoming.expiresAt || existing.expiresAt,
      triggerPercentText: incoming.triggerPercentText || existing.triggerPercentText,
      triggerPercentValue: incoming.triggerPercentValue ?? existing.triggerPercentValue,
      triggerValues: [
        ...new Set([
          ...(existing.triggerValues || []),
          ...(incoming.triggerValues || [])
        ])
      ],
      isDisabled: isTriggeredStatus(incoming.gttStatus || existing.gttStatus)
    };
  }

  function sortRows(key) {
    const direction = currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    currentSort = { key, direction };

    const sortedRows = sortRowsForCurrentSort(currentRows);

    renderRows(sortedRows);
  }

  function sortRowsForCurrentSort(rows) {
    const activeRows = rows.filter((row) => !row.isDisabled);
    const disabledRows = rows.filter((row) => row.isDisabled);
    const sortedActiveRows = activeRows.sort((left, right) => {
      const result = compareValues(left[currentSort.key], right[currentSort.key]);
      return currentSort.direction === 'asc' ? result : -result;
    });

    return [...sortedActiveRows, ...disabledRows];
  }

  function compareValues(leftValue, rightValue) {
    const leftNumber = readNumber(leftValue);
    const rightNumber = readNumber(rightValue);
    const leftIsNumber = leftNumber !== null;
    const rightIsNumber = rightNumber !== null;

    if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber;
    return String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
  }

  function updateSortIndicators() {
    document.querySelectorAll('#gtt-helper-panel [data-sort-key]').forEach((button) => {
      const isActive = button.dataset.sortKey === currentSort.key;
      button.dataset.sortDirection = isActive ? currentSort.direction : '';
    });
  }

  function readPrimaryTrigger(values) {
    const numbers = (values || [])
      .map(readNumber)
      .filter((value) => value !== null);

    return numbers.length ? Math.max(...numbers) : null;
  }

  function getTradeStatus(averagePrice, triggerValue) {
    const buy = readNumber(averagePrice);
    const trigger = readNumber(triggerValue);

    if (!buy || trigger === null) return 'loss';
    if (trigger > buy) return 'profit';
    return 'loss';
  }

  function getStatusClass(status) {
    return `gtt-helper-status-${normalizeStatus(status)}`;
  }

  function isTriggeredStatus(status) {
    return normalizeStatus(status) === 'triggered';
  }

  function normalizeStatus(status) {
    return normalizeSpace(status).toLowerCase();
  }

  function renderTriggerPercentCell(row) {
    const className = row.triggerPercentValue < -25 ? 'gtt-helper-trigger-percent-low' : '';
    return row.triggerPercentText
      ? `<span class="gtt-helper-trigger-percent ${className}">${escapeHtml(row.triggerPercentText)}</span>`
      : '<span class="gtt-helper-trigger-percent">-</span>';
  }

  function renderMoveSlCell(row) {
    const targetStopLoss = calculateTargetStopLoss(row);
    const canMoveStopLoss = !row.isDisabled && row.triggerPercentValue < -25 && targetStopLoss !== null;
    const disabledReason = getMoveSlDisabledReason(row, targetStopLoss);

    return `
      <button
        class="gtt-helper-move-sl"
        type="button"
        title="${canMoveStopLoss ? `Move SL to ${targetStopLoss.toFixed(2)}` : disabledReason}"
        data-sl-action="move"
        data-row-key="${escapeHtml(normalizeSymbol(row.symbol))}"
        ${canMoveStopLoss ? '' : 'disabled'}
      >&#8593;</button>
    `;
  }

  function getMoveSlDisabledReason(row, targetStopLoss) {
    if (row.isDisabled) return 'SL move unavailable: row is not active.';
    if (!(row.triggerPercentValue < -25)) return 'SL move available when Trigr % is below -25%.';
    if (targetStopLoss === null) return 'SL move unavailable: LTP is missing.';
    return 'SL move unavailable.';
  }

  function calculateTargetStopLoss(row) {
    const ltp = readNumber(row.ltpValue);
    return ltp === null ? null : ltp * 0.8;
  }

  async function moveStopLoss(row, targetStopLoss) {
    if (!row.triggerId) {
      throw new Error(`trigger id is missing for ${row.symbol}`);
    }

    const condition = {
      ...(row.triggerCondition || {}),
      trigger_values: [roundPrice(targetStopLoss)],
      last_price: readNumber(row.ltpValue)
    };
    const orders = (row.triggerOrders || []).map((order) => ({
      ...order,
      price: roundPrice(targetStopLoss)
    }));
    const body = new URLSearchParams();

    body.set('condition', JSON.stringify(condition));
    body.set('orders', JSON.stringify(orders));
    body.set('type', row.triggerType || 'single');
    if (row.expiresAt) body.set('expires_at', row.expiresAt);

    return fetchJsonFromPage(`${ENDPOINTS.triggers}/${row.triggerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
  }

  function clickZerodhaGttNav() {
    const gttLink = [...document.querySelectorAll('a[href="/orders/gtt"], a[href*="/orders/gtt"]')]
      .find((link) => normalizeSpace(link.textContent).toUpperCase().includes('GTT'));

    gttLink?.click();
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  async function hydrateTriggerDetails(row) {
    const triggersResponse = await fetchJsonFromPage(ENDPOINTS.triggers);
    const triggers = extractTriggers(triggersResponse);
    const trigger = triggers.find((item) => isSameSymbol(item.symbol, row.symbol));

    if (!trigger?.triggerId) {
      throw new Error(`trigger id is missing for ${row.symbol}`);
    }

    const updatedRow = {
      ...row,
      triggerId: trigger.triggerId,
      triggerCondition: trigger.triggerCondition,
      triggerOrders: trigger.triggerOrders,
      triggerType: trigger.triggerType,
      expiresAt: trigger.expiresAt,
      triggerValues: trigger.triggerValues
    };

    currentRows = currentRows.map((item) => (
      isSameSymbol(item.symbol, row.symbol) ? updatedRow : item
    ));

    return updatedRow;
  }

  function isSameSymbol(left, right) {
    const source = normalizeSymbol(left);
    const target = normalizeSymbol(right);
    return source === target || source.includes(target) || target.includes(source);
  }

  function roundPrice(value) {
    return Number(readNumber(value).toFixed(2));
  }

  async function saveSlMovement(row, targetStopLoss) {
    const saved = await readFromDb([STORAGE_KEYS.slHistory]);
    const history = saved[STORAGE_KEYS.slHistory] || [];
    const entry = {
      id: `${Date.now()}-${row.triggerId}`,
      movedAt: new Date().toISOString(),
      symbol: row.symbol,
      triggerId: row.triggerId,
      oldTrigger: readNumber(row.panelTriggerValue ?? row.primaryTrigger),
      newTrigger: roundPrice(targetStopLoss),
      ltp: readNumber(row.ltpValue),
      triggerPercent: row.triggerPercentText || '',
      triggerPercentValue: row.triggerPercentValue,
      quantity: readNumber(row.buyQuantity),
      buy: readNumber(row.averagePrice)
    };

    history.unshift(entry);
    await writeToDb({
      [STORAGE_KEYS.slHistory]: history.slice(0, 300)
    });
  }

  function writeToDb(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        const error = chrome.runtime.lastError;
        error ? reject(new Error(error.message)) : resolve();
      });
    });
  }

  function formatTriggerValues(values) {
    const cleanValues = (values || []).filter((value) => value !== null && value !== undefined && value !== '');
    return cleanValues.length ? cleanValues.map(formatNumber).join(', ') : '-';
  }

  function formatNumber(value, digits = 2) {
    const number = readNumber(value);
    return number === null ? '-' : number.toFixed(digits);
  }

  function setStatus(message) {
    const status = document.querySelector('#gtt-helper-status');
    if (status) status.textContent = message;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  return { createGttUi };
})();
