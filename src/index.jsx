// src/index.js
// Polyfill pour éviter "ReferenceError: global is not defined"
if (typeof global === 'undefined') {
  window.global = window;
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import api from './api';
import './index.css';
import './theme.css';

// ---------- Safe non-destructive bridge installation (remplace l'ancien Proxy assign) ----------
(function safeInstallBridge() {
  if (typeof window === 'undefined') return;

  // Build the object we want to expose to renderers (methods from api)
  const toExpose = {};
  try {
    Object.keys(api || {}).forEach(k => {
      if (typeof api[k] === 'function') toExpose[k] = (...a) => api[k](...a);
      else toExpose[k] = api[k];
    });
  } catch (e) {
    // if api introspection fails, leave toExpose empty; safeElectronAPI will still be created
  }

  // Ensure safeElectronAPI exists
  try { if (!globalThis.safeElectronAPI) globalThis.safeElectronAPI = {} } catch (e) {}

  // Populate safeElectronAPI with any missing function from toExpose
  try {
    Object.keys(toExpose).forEach(k => {
      try { if (typeof globalThis.safeElectronAPI[k] !== 'function') globalThis.safeElectronAPI[k] = toExpose[k] } catch (e) {}
    });
  } catch (e) {}

  // Decide whether it's safe to replace window.electronAPI
  let desc = null;
  try { desc = Object.getOwnPropertyDescriptor(globalThis, 'electronAPI') } catch (e) { desc = null }
  const canReplace = !desc || desc.configurable === true || desc.writable === true;

  if (canReplace) {
    try {
      const existing = (typeof globalThis.electronAPI === 'object' && globalThis.electronAPI) ? globalThis.electronAPI : {};
      const merged = Object.assign({}, toExpose, existing);
      if (typeof merged.call !== 'function') merged.call = toExpose.call || (async () => null);
      try { globalThis.electronAPI = merged } catch (e) { /* fallback handled below */ }
    } catch (e) {
      /* fallthrough: safeElectronAPI already populated */
    }
  } else {
    // Do NOT overwrite: create a proxy that delegates to preload (existing) then toExpose
    try {
      const existing = globalThis.electronAPI;
      if (!globalThis._electronAPIProxy) {
        globalThis._electronAPIProxy = new Proxy({}, {
          get(_, prop) {
            if (existing && prop in existing) {
              const v = existing[prop]; return typeof v === 'function' ? v.bind(existing) : v;
            }
            if (prop in toExpose) return toExpose[prop];
            return undefined;
          },
          has(_, prop) { return (existing && prop in existing) || (prop in toExpose); },
          ownKeys() { return Array.from(new Set([...(Object.keys(existing || {})), ...Object.keys(toExpose)])); },
          getOwnPropertyDescriptor(_, prop) {
            if (existing && prop in existing) return Object.getOwnPropertyDescriptor(existing, prop) || { configurable: true, enumerable: true, value: existing[prop] };
            if (prop in toExpose) return { configurable: true, enumerable: true, value: toExpose[prop] };
            return undefined;
          }
        });
      }
    } catch (e) {
      /* ignore proxy creation errors */
    }
  }
})();

// ---------- ErrorBoundary pour capturer les erreurs runtime React ----------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Erreur capturée par ErrorBoundary :', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'red' }}>
          <h2>Une erreur est survenue</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- Montage de l’application ----------
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <App />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
