/* ═══════════════════════════════════════════════════════════
   auth.js — Login, Register, Password Strength
═══════════════════════════════════════════════════════════ */

"use strict";

/* ── Tab Switcher ─────────────────────────────────────────── */
function switchAuthTab(tab) {
  const loginForm    = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const loginBtn     = document.getElementById("tab-login-btn");
  const registerBtn  = document.getElementById("tab-register-btn");

  clearFieldError("login-error");
  clearFieldError("register-error");

  if (tab === "login") {
    loginForm.style.display    = "block";
    registerForm.style.display = "none";
    loginBtn.classList.add("active");
    registerBtn.classList.remove("active");
  } else {
    loginForm.style.display    = "none";
    registerForm.style.display = "block";
    loginBtn.classList.remove("active");
    registerBtn.classList.add("active");
  }
}

/* ── Show / Hide Password ─────────────────────────────────── */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.textContent = isHidden ? "🙈" : "👁";
}

/* ── Password Strength ────────────────────────────────────── */
function checkPwStrength(pw) {
  const fill  = document.getElementById("strength-fill");
  const label = document.getElementById("strength-label");
  if (!fill || !label) return;

  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;

  const levels = ["", "weak", "fair", "good", "strong"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  fill.className  = "strength-fill " + (levels[score] || "");
  label.className = "strength-label " + (levels[score] || "");
  label.textContent = pw.length ? labels[score] : "";
}

/* ── Login ────────────────────────────────────────────────── */
async function doLogin() {
  clearFieldError("login-error");

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    showFieldError("login-error", "Both fields are required.");
    return;
  }

  setLoading("btn-login", true);
  document.getElementById("btn-login").dataset.label = "Sign In →";

  try {
    const { ok, data } = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!ok) {
      showFieldError("login-error", data.error || "Login failed.");
      return;
    }

    showToast("Welcome back, " + data.username + "! 👋", "success");
    // Small delay so toast is visible before redirect
    setTimeout(() => { window.location.href = "/"; }, 600);

  } catch (e) {
    showFieldError("login-error", "Network error. Please try again.");
  } finally {
    setLoading("btn-login", false);
  }
}

/* ── Register ─────────────────────────────────────────────── */
async function doRegister() {
  clearFieldError("register-error");

  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm  = document.getElementById("reg-confirm").value;

  // Client-side validation
  if (!username || !password || !confirm) {
    showFieldError("register-error", "All fields are required.");
    return;
  }
  if (password !== confirm) {
    showFieldError("register-error", "Passwords do not match.");
    return;
  }
  if (password.length < 8) {
    showFieldError("register-error", "Password must be at least 8 characters.");
    return;
  }
  if (!/[A-Z]/.test(password)) {
    showFieldError("register-error", "Password must contain at least one uppercase letter.");
    return;
  }
  if (!/[0-9]/.test(password)) {
    showFieldError("register-error", "Password must contain at least one number.");
    return;
  }

  setLoading("btn-register", true);
  document.getElementById("btn-register").dataset.label = "Create Account →";

  try {
    const { ok, status, data } = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!ok) {
      showFieldError("register-error", data.error || "Registration failed.");
      return;
    }

    showToast("Account created! Welcome, " + data.username + " 🎉", "success");
    setTimeout(() => { window.location.href = "/"; }, 700);

  } catch (e) {
    showFieldError("register-error", "Network error. Please try again.");
  } finally {
    setLoading("btn-register", false);
  }
}

/* ── Load Global Stats ────────────────────────────────────── */
async function loadStats() {
  try {
    const { ok, data } = await api("/api/stats");
    if (!ok) return;
    document.getElementById("stat-quizzes").textContent = data.total_quizzes;
    document.getElementById("stat-users").textContent   = data.total_users;
    document.getElementById("stat-topics").textContent  = data.top_topics.length;
  } catch (_) {}
}

/* ── Check session: redirect to dashboard if already logged in ── */
async function checkSession() {
  try {
    const { ok, data } = await api("/api/me");
    if (ok && data.logged_in) {
      window.location.href = "/";
    }
  } catch (_) {}
}

/* ── Init ─────────────────────────────────────────────────── */
loadStats();
checkSession();
