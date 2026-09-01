const APP_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const CANONICAL_ORIGIN = 'https://store.aarulya.com';
const params = new URLSearchParams(window.location.search);
const appId = params.get('app') || '';
const onlyAppParameter = [...params.keys()].every((key) => key === 'app');
const valid = onlyAppParameter && APP_ID.test(appId) && window.location.hash === '';
const requested = document.getElementById('requestedApp');
const retry = document.getElementById('retryLink');
const message = document.getElementById('handoffMessage');

if (valid) {
  requested.textContent = appId;
  const canonical = new URL('/install', CANONICAL_ORIGIN);
  canonical.searchParams.set('app', appId);
  retry.href = canonical.toString();
} else {
  requested.textContent = 'Invalid or missing app identifier';
  retry.hidden = true;
  message.textContent = 'यह install request valid नहीं है। कोई download grant या APK जारी नहीं किया गया। Catalog पर वापस जाएँ।';
}
