const statusNode = document.querySelector('[data-network-status]');

function renderNetworkStatus() {
  if (!statusNode) return;
  statusNode.textContent = navigator.onLine ? 'Online' : 'Offline';
  statusNode.dataset.state = navigator.onLine ? 'online' : 'offline';
}

window.addEventListener('online', renderNetworkStatus);
window.addEventListener('offline', renderNetworkStatus);
renderNetworkStatus();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The app remains usable without service-worker support.
    });
  });
}
