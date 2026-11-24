self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('fetch', () => {
  // Canlı verilerin (örneğin alıntıların) her zaman güncel kalması için ağı kullanır
});
