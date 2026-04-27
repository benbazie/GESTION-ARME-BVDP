// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import App from './App';
import 'antd/dist/reset.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Router>
    <App />
  </Router>
);

function renderDashboardBanner() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash || "";
  const isDashboard = hash.replace(/^#/, "").startsWith("/dashboard");
  const existing = document.getElementById("dashboard-banner");
  if (isDashboard) {
    if (existing) return;
    const banner = document.createElement("div");
    banner.id = "dashboard-banner";
    banner.textContent = "VOICI LA BONNE APPLICATION";
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 18px 24px;
      background: #001529;
      color: #fff;
      font-size: 32px;
      font-weight: 700;
      text-align: center;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      letter-spacing: 2px;
    `;
    document.body.appendChild(banner);
  } else if (existing) {
    existing.remove();
  }
}

window.addEventListener("hashchange", renderDashboardBanner);
window.addEventListener("popstate", renderDashboardBanner);
renderDashboardBanner();

console.log("Renderer.js (index.js) chargé et application React rendue.");
