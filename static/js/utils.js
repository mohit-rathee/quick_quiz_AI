/* ═══════════════════════════════════════════════════════════
   utils.js — Shared utilities loaded on every page
═══════════════════════════════════════════════════════════ */

"use strict";

/* ── API Helper ───────────────────────────────────────────── */
async function api(url, options = {}) {
  const defaults = {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  };
  const merged = {
    ...defaults,
    ...options,
    headers: { ...defaults.headers, ...(options.headers || {}) },
  };
  const res  = await fetch(url, merged);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

/* ── Toast Notification ───────────────────────────────────── */
let _toastTimer = null;

function showToast(msg, type = "default", duration = 3000) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.className   = "show " + type;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, duration);
}

/* ── Form Helpers ─────────────────────────────────────────── */
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
}

function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  el.classList.remove("visible");
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  const span = btn.querySelector("span");
  if (span) span.textContent = isLoading ? "Please wait…" : btn.dataset.label || span.textContent;
}

/* ── Sanitise HTML output ─────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Format date ──────────────────────────────────────────── */
function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
