import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('App needs a refresh to show updated content');
  },
  onOfflineReady() {
    console.log('App is ready to be used offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);