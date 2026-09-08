(() => {
  'use strict';

  const DATA_VERSION = '20260908.2';
  const CACHEABLE_DATA = /(?:^|\/)data\/(?:egw-index|egw-official-books|bible-egw-relations|bible-source|bible-books|bible-search)\.json(?:[?#]|$)/i;
  const nativeFetch = window.fetch.bind(window);

  function versionedUrl(value) {
    const raw = String(value || '');
    if (!CACHEABLE_DATA.test(raw)) return raw;
    if (/[?&]v=/.test(raw)) return raw;
    return `${raw}${raw.includes('?') ? '&' : '?'}v=${encodeURIComponent(DATA_VERSION)}`;
  }

  window.fetch = function jingguangCachedFetch(input, init) {
    if (typeof input === 'string' && CACHEABLE_DATA.test(input)) {
      return nativeFetch(versionedUrl(input), {...(init || {}), cache:'force-cache'});
    }
    return nativeFetch(input, init);
  };

  window.jgDataVersion = DATA_VERSION;
})();
