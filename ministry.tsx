import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Mark runtime as Ministry variant for config selection
;(globalThis as any).__APP_VARIANT__ = 'ministry';

// Optional: set default display name on first load if not set
try {
  const key = 'app.displayName';
  const existing = window.localStorage.getItem(key);
  if (!existing) {
    window.localStorage.setItem(key, 'Ministry App');
    (window as any).__APP_NAME__ = 'Ministry App';
  }
} catch {}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
