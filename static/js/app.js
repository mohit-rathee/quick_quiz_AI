/* ═══════════════════════════════════════════════════════════
   app.js — Dashboard, Quiz, Leaderboard, Results
═══════════════════════════════════════════════════════════ */

"use strict";

/* ── State ────────────────────────────────────────────────── */
const state = {
  currentScore: 0,
  currentQ:     0,
  totalQ:       0,
  answered:     false,
  topic:        "",
};

/* ════════════════════════════════════════════════════════════
   SCREEN MANAGEMENT
════════════════════════════════════════════════════════════ */
const App = {

  showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  },

  /* ── Logout ───────────────────────────────────────────── */
  async logout() {
    await api("/api/logout", { method: "POST" });
    window.location.href = "/auth";
  },

  /* ── Topic chip ───────────────────────────────────────── */
  selectTopic(el, topic) {
    document.querySelectorAll(".topic-chip").forEach(c => c.classList.remove("selected"));
    el.classList.add("selected");
    document.getElementById("topic-input").value = topic;
  },

  /* ════════════════════════════════════════════════════════
     QUIZ
  ════════════════════════════════════════════════════════ */
  async startQuiz() {
    const topic = document.getElementById("topic-input").value.trim();
    const total = parseInt(document.getElementById("count-select").value, 10);

    if (!topic) { showToast("Please enter or select a topic.", "error"); return; }

    const { ok, data } = await api("/api/start_quiz", {
      method: "POST",
      body: JSON.stringify({ topic, total }),
    });
    if (!ok) { showToast(data.error || "Failed to start quiz.", "error"); return; }

    state.currentScore = 0;
    state.currentQ     = 0;
    state.totalQ       = data.total;
    state.topic        = topic;

    document.getElementById("q-topic-badge").textContent = topic.toUpperCase();
    document.getElementById("q-score").textContent       = "0";

    this.showScreen("screen-quiz");
    this._loadQuestion();
  },

  async _loadQuestion() {
    state.answered = false;

    // Show loading, hide content
    document.getElementById("quiz-loading").style.display = "flex";
    document.getElementById("quiz-content").style.display = "none";
    document.getElementById("btn-next").style.display     = "none";
    document.getElementById("q-feedback").style.display   = "none";

    const { ok, data } = await api("/api/get_question");

    if (!ok)      { showToast("Error fetching question.", "error"); return; }
    if (data.done) { this._finishQuiz(); return; }

    state.currentQ = data.question_number;

    // Update meta
    document.getElementById("q-counter").textContent = `Question ${state.currentQ} of ${state.totalQ}`;
    const pct = ((state.currentQ - 1) / state.totalQ) * 100;
    const bar = document.getElementById("q-progress");
    bar.style.width = pct + "%";
    bar.parentElement.setAttribute("aria-valuenow", pct);

    // Question text
    document.getElementById("q-text").textContent = data.question;

    // Options
    const optContainer = document.getElementById("q-options");
    optContainer.innerHTML = "";
    const letters = ["A", "B", "C", "D"];

    data.options.forEach((opt, i) => {
      const div = document.createElement("div");
      div.className       = "option";
      div.dataset.index   = opt.index;
      div.innerHTML = `
        <div class="opt-letter">${letters[i]}</div>
        <div class="opt-text">${esc(opt.text)}</div>
        <div class="opt-icon"></div>
      `;
      div.addEventListener("click", () => App._submitAnswer(opt.index));
      optContainer.appendChild(div);
    });

    // Show content
    document.getElementById("quiz-loading").style.display = "none";
    document.getElementById("quiz-content").style.display = "block";
  },

  async _submitAnswer(choice) {
    if (state.answered) return;
    state.answered = true;

    // Disable all options
    document.querySelectorAll(".option").forEach(o => o.classList.add("disabled"));

    const { ok, data } = await api("/api/submit_answer", {
      method: "POST",
      body: JSON.stringify({ choice }),
    });
    if (!ok) { showToast("Error submitting answer.", "error"); return; }

    // Update score
    state.currentScore = data.current_score;
    document.getElementById("q-score").textContent = state.currentScore;

    // Highlight options
    document.querySelectorAll(".option").forEach(opt => {
      const text = opt.querySelector(".opt-text").textContent;
      const icon = opt.querySelector(".opt-icon");

      if (text === data.correct_text) {
        opt.classList.add("correct-highlight");
        icon.textContent = "✅";
      }
      if (text === data.selected_text && !data.is_correct) {
        opt.classList.add("wrong");
        icon.textContent = "❌";
      }
      if (text === data.selected_text && data.is_correct) {
        opt.classList.add("correct");
        icon.textContent = "✅";
      }
    });

    // Feedback
    const fb     = document.getElementById("q-feedback");
    const fbHead = document.getElementById("fb-head");
    const fbBody = document.getElementById("fb-body");

    fb.className = "feedback-box " + (data.is_correct ? "correct" : "wrong");
    fbHead.textContent = data.is_correct ? "✅ Correct! Well done!" : "❌ Incorrect!";
    fbBody.innerHTML   = data.is_correct
      ? esc(data.selected_explanation)
      : `<strong>Your answer:</strong> ${esc(data.selected_explanation)}<br><br><strong>Correct answer (${esc(data.correct_text)}):</strong> ${esc(data.correct_explanation)}`;
    fb.style.display = "block";

    // Next / Finish button
    const isLast = state.currentQ >= state.totalQ;
    const btn    = document.getElementById("btn-next");
    btn.textContent  = isLast ? "See Results 🏁" : "Next Question →";
    btn.style.display = "block";
    btn.onclick = isLast ? () => App._finishQuiz() : () => App._loadQuestion();
  },

  async _finishQuiz() {
    const { ok, data } = await api("/api/finish_quiz", { method: "POST" });
    if (!ok) { showToast("Error saving results.", "error"); return; }

    const pct    = Math.round((data.score / data.total) * 100);
    const emoji  = pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : pct >= 40 ? "😅" : "💪";
    const title  = pct >= 80 ? "Outstanding!" : pct >= 60 ? "Great job!" : pct >= 40 ? "Not bad!" : "Keep practising!";

    document.getElementById("result-emoji").textContent = emoji;
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-score").textContent = `${data.score}/${data.total}`;
    document.getElementById("result-sub").textContent   = `Topic: ${data.topic} • ${pct}% accuracy`;

    document.getElementById("q-progress").style.width = "100%";
    this.showScreen("screen-result");
    this.loadLeaderboard();
  },

  /* ════════════════════════════════════════════════════════
     TABS
  ════════════════════════════════════════════════════════ */
  switchTab(el, panelId) {
    // Update tab buttons
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    el.classList.add("active");

    // Update panels
    document.querySelectorAll(".tab-panel").forEach(p => { p.style.display = "none"; });
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = "block";

    if (panelId === "tab-leaderboard") this.loadLeaderboard();
    if (panelId === "tab-history")     this.loadHistory();
  },

  goLeaderboard() {
    this.showScreen("screen-home");
    // Activate leaderboard tab
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(t => {
      const isLb = t.getAttribute("onclick")?.includes("tab-leaderboard");
      t.classList.toggle("active", !!isLb);
    });
    document.querySelectorAll(".tab-panel").forEach(p => { p.style.display = "none"; });
    document.getElementById("tab-leaderboard").style.display = "block";
    this.loadLeaderboard();
  },

  /* ════════════════════════════════════════════════════════
     LEADERBOARD
  ════════════════════════════════════════════════════════ */
  async loadLeaderboard(filter = "") {
    const body = document.getElementById("lb-body");
    body.innerHTML = `<tr><td colspan="6" class="table-empty">Loading…</td></tr>`;

    const { ok, data } = await api(`/api/leaderboard?topic=${encodeURIComponent(filter)}`);
    if (!ok) { body.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>`; return; }

    if (!data.length) {
      body.innerHTML = `<tr><td colspan="6" class="table-empty">No results yet — be the first!</td></tr>`;
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    body.innerHTML = data.map((r, i) => `
      <tr>
        <td class="rank-cell ${i===0?"gold":i===1?"silver":i===2?"bronze":""}">
          ${i < 3 ? medals[i] : i + 1}
        </td>
        <td><strong>${esc(r.username)}</strong></td>
        <td><span class="text-muted" style="font-size:.8rem;">${esc(r.topic)}</span></td>
        <td>${r.score}/${r.total}</td>
        <td>
          <div class="pct-bar">
            <div class="pct-track"><div class="pct-fill" style="width:${r.pct}%"></div></div>
            <span class="pct-num">${r.pct}%</span>
          </div>
        </td>
        <td style="color:var(--muted);font-size:.78rem;">${fmtDate(r.finished_at)}</td>
      </tr>
    `).join("");
  },

  /* ════════════════════════════════════════════════════════
     MY HISTORY
  ════════════════════════════════════════════════════════ */
  async loadHistory() {
    const body = document.getElementById("history-body");
    body.innerHTML = `<tr><td colspan="4" class="table-empty">Loading…</td></tr>`;

    const { ok, data } = await api("/api/my_history");
    if (!ok) { body.innerHTML = `<tr><td colspan="4" class="table-empty">Failed to load.</td></tr>`; return; }

    if (!data.length) {
      body.innerHTML = `<tr><td colspan="4" class="table-empty">No quizzes taken yet.</td></tr>`;
      return;
    }

    body.innerHTML = data.map(r => `
      <tr>
        <td>${esc(r.topic)}</td>
        <td>${r.score}/${r.total}</td>
        <td>
          <div class="pct-bar">
            <div class="pct-track"><div class="pct-fill" style="width:${r.pct}%"></div></div>
            <span class="pct-num">${r.pct}%</span>
          </div>
        </td>
        <td style="color:var(--muted);font-size:.78rem;">${fmtDate(r.finished_at)}</td>
      </tr>
    `).join("");
  },
};

/* ── Init ─────────────────────────────────────────────────── */
(async function init() {
  // Verify session — redirect to auth if not logged in
  const { ok, data } = await api("/api/me");
  if (!ok || !data.logged_in) {
    window.location.href = "/auth";
    return;
  }

  // Set username in UI
  document.getElementById("nav-username").textContent  = data.username;
  document.getElementById("home-username").textContent = data.username;

  // Load initial leaderboard
  App.loadLeaderboard();
})();
