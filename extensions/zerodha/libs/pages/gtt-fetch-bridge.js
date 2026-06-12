(function () {
  const PAGE_FETCH_EVENT = 'zerodha-gtt-helper-fetch';
  const PAGE_FETCH_RESPONSE_EVENT = 'zerodha-gtt-helper-fetch-response';

  if (window.__zerodhaGttHelperFetchBridge) return;
  window.__zerodhaGttHelperFetchBridge = true;

  window.addEventListener(PAGE_FETCH_EVENT, async (event) => {
    const { requestId, url, options = {} } = event.detail || {};

    try {
      const enctoken = cookieValue('enctoken');
      const userId = cookieValue('user_id') || findStorageValue(['user_id', 'userid', 'userId']);
      const appUuid = findStorageValue(['kite-app-uuid', 'app_uuid', 'appUuid']);
      const headers = {
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {})
      };

      if (enctoken) headers.Authorization = 'enctoken ' + enctoken;
      if (userId) headers['x-kite-userid'] = userId;
      if (appUuid) headers['x-kite-app-uuid'] = appUuid;
      headers['x-kite-version'] = '3.0.0';

      const response = await window.fetch(url, {
        method: options.method || 'GET',
        credentials: 'include',
        headers,
        body: options.body
      });
      const text = await response.text();
      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch (error) {
        body = text;
      }

      window.dispatchEvent(new CustomEvent(PAGE_FETCH_RESPONSE_EVENT, {
        detail: {
          requestId,
          ok: response.ok,
          status: response.status,
          body,
          preview: typeof body === 'string' ? body.slice(0, 160) : ''
        }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent(PAGE_FETCH_RESPONSE_EVENT, {
        detail: {
          requestId,
          ok: false,
          status: 0,
          error: error.message
        }
      }));
    }
  });

  function cookieValue(name) {
    const cookie = document.cookie
      .split('; ')
      .find((item) => item.startsWith(name + '='));

    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
  }

  function findStorageValue(keys) {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of keys) {
        const directValue = storage.getItem(key);
        if (directValue) return directValue;
      }

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        const value = storage.getItem(key) || '';
        const matchedKey = keys.some((needle) => key.toLowerCase().includes(needle.toLowerCase()));
        if (matchedKey && value) return value;
      }
    }

    return '';
  }
})();
