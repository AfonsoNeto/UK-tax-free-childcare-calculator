import { App } from './App.js';

const app = new App();
app.init();

// Offline support is a bonus; registration can fail on plain file:// etc.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
