const APP_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const CANONICAL_ORIGIN = 'https://store.aarulya.com';
const STORE_BOOTSTRAP_URL = 'https://downloads.store.aarulya.com/v1/bootstrap/aarulya-store.apk';
const params = new URLSearchParams(window.location.search);
const appId = params.get('app') || '';
const onlyAppParameter = [...params.keys()].every((key) => key === 'app');
const valid = onlyAppParameter && APP_ID.test(appId) && window.location.hash === '';
const requested = document.getElementById('requestedApp');
const retry = document.getElementById('retryLink');
const message = document.getElementById('handoffMessage');
const securityNote = document.getElementById('securityNote');

if (valid) {
  requested.textContent = appId;
  const canonical = new URL('/install', CANONICAL_ORIGIN);
  canonical.searchParams.set('app', appId);
  if (appId === 'aarulya-store') {
    retry.href = STORE_BOOTSTRAP_URL;
    retry.textContent = 'Aarulya Store APK डाउनलोड करें';
    message.textContent = 'पहली installation के लिए केवल current safe, published और cryptographically verified Aarulya Store release दिया जाएगा। Android installation confirmation और browser install-source permission user के control में रहेंगे।';
    securityNote.textContent = 'यह public bootstrap केवल com.aarulya.store के लिए है। अन्य Aarulya apps Aarulya Store के authenticated one-time grant flow से ही install होंगे।';
  } else {
    retry.href = canonical.toString();
  }
} else {
  requested.textContent = 'Invalid or missing app identifier';
  retry.hidden = true;
  message.textContent = 'यह install request valid नहीं है। कोई download grant या APK जारी नहीं किया गया। Catalog पर वापस जाएँ।';
}
