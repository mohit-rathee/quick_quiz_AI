from flask import Flask, render_template, request, jsonify, session
import sqlite3
import requests
import json
import re
import random
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "quizmaster_AI")

# ─── Database ────────────────────────────────────────────────────────────────

def get_db():
    db = sqlite3.connect("quiz.db")
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT UNIQUE NOT NULL,
                password   TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quiz_sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                topic       TEXT NOT NULL,
                score       INTEGER DEFAULT 0,
                total       INTEGER DEFAULT 0,
                completed   INTEGER DEFAULT 0,
                started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS answers (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id    INTEGER NOT NULL,
                question      TEXT NOT NULL,
                selected_text TEXT,
                correct_text  TEXT,
                is_correct    INTEGER DEFAULT 0,
                answered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
            );
        """)

init_db()

# ─── Helpers ─────────────────────────────────────────────────────────────────

def logged_in():
    return "user_id" in session

def validate_password(pw):
    """Returns (ok, error_message)"""
    if len(pw) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", pw):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[0-9]", pw):
        return False, "Password must contain at least one number."
    return True, ""

# ─── AI Question Generator ───────────────────────────────────────────────────

def extract_mcq(response_json):
    try:
        content = response_json["choices"][0]["message"]["content"]
        cleaned = re.sub(r"```json\s*|\s*```", "", content.strip())
        return json.loads(cleaned)
    except Exception as e:
        print("MCQ parse error:", e)
        return None

def get_question(topic, asked_questions):
    prompt = f"""
Generate exactly 1 multiple-choice question (MCQ) about {topic}.
Avoid repeating any of these questions: {asked_questions}

Return ONLY valid JSON in this exact format:
{{
  "question": "string",
  "options": [
    {{"id": "A", "text": "string", "is_correct": true,  "explanation": "Why this is correct",   "hint": "Helpful hint"}},
    {{"id": "B", "text": "string", "is_correct": false, "explanation": "Why this is wrong",     "hint": "Helpful hint"}},
    {{"id": "C", "text": "string", "is_correct": false, "explanation": "Why this is wrong",     "hint": "Helpful hint"}},
    {{"id": "D", "text": "string", "is_correct": false, "explanation": "Why this is wrong",     "hint": "Helpful hint"}}
  ]
}}

Rules: Only JSON. Exactly one correct answer. New concept each time. No repetition.
"""
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "openrouter/auto",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7
            },
            timeout=30
        )
        mcq = extract_mcq(resp.json())
        if mcq:
            random.shuffle(mcq["options"])
        return mcq
    except Exception as e:
        print("API error:", e)
        return None

# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/auth")
def auth():
    return render_template("auth.html")

@app.route("/api/register", methods=["POST"])
def register():
    data     = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    # Validate username
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400
    if len(username) > 20:
        return jsonify({"error": "Username too long (max 20 chars)."}), 400
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return jsonify({"error": "Username can only contain letters, numbers, and underscores."}), 400

    # Validate password
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400

    pw_hash = generate_password_hash(password)       # bcrypt via werkzeug

    try:
        with get_db() as db:
            db.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, pw_hash))
            db.commit()
            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already taken. Please choose another."}), 409

    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    return jsonify({"success": True, "username": user["username"]}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password."}), 401

    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    return jsonify({"success": True, "username": user["username"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/api/me", methods=["GET"])
def me():
    if not logged_in():
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "username": session["username"]})

# ─── Quiz Routes ──────────────────────────────────────────────────────────────

@app.route("/api/start_quiz", methods=["POST"])
def start_quiz():
    if not logged_in():
        return jsonify({"error": "Not authenticated."}), 401

    data  = request.json or {}
    topic = data.get("topic", "").strip()
    total = int(data.get("total", 5))
    if not topic:
        return jsonify({"error": "Topic is required."}), 400
    if total not in [5, 10, 15]:
        total = 5

    with get_db() as db:
        cur = db.execute(
            "INSERT INTO quiz_sessions (user_id, topic, total) VALUES (?,?,?)",
            (session["user_id"], topic, total)
        )
        db.commit()
        session_id = cur.lastrowid

    session["quiz_session_id"]  = session_id
    session["topic"]            = topic
    session["asked_questions"]  = []
    session["current_q"]        = 0
    session["total_q"]          = total
    return jsonify({"success": True, "session_id": session_id, "total": total})


@app.route("/api/get_question", methods=["GET"])
def get_next_question():
    if not logged_in() or "quiz_session_id" not in session:
        return jsonify({"error": "No active quiz."}), 401

    q_num = session.get("current_q", 0) + 1
    total = session.get("total_q", 5)
    if q_num > total:
        return jsonify({"done": True})

    mcq = get_question(session["topic"], session.get("asked_questions", []))
    if not mcq:
        return jsonify({"error": "Failed to generate question."}), 500

    session["asked_questions"] = session.get("asked_questions", []) + [mcq["question"]]
    session["current_q"]       = q_num
    session["current_mcq"]     = mcq

    return jsonify({
        "question_number": q_num,
        "total":           total,
        "question":        mcq["question"],
        "options": [{"index": i + 1, "text": opt["text"]} for i, opt in enumerate(mcq["options"])]
    })


@app.route("/api/submit_answer", methods=["POST"])
def submit_answer():
    if not logged_in() or "current_mcq" not in session:
        return jsonify({"error": "No active question."}), 401

    data   = request.json or {}
    choice = int(data.get("choice", 0))
    mcq    = session["current_mcq"]

    if choice < 1 or choice > 4:
        return jsonify({"error": "Invalid choice."}), 400

    selected   = mcq["options"][choice - 1]
    correct    = next(opt for opt in mcq["options"] if opt["is_correct"])
    is_correct = selected["is_correct"]

    with get_db() as db:
        db.execute(
            "INSERT INTO answers (session_id, question, selected_text, correct_text, is_correct) VALUES (?,?,?,?,?)",
            (session["quiz_session_id"], mcq["question"], selected["text"], correct["text"], int(is_correct))
        )
        if is_correct:
            db.execute("UPDATE quiz_sessions SET score = score + 1 WHERE id=?", (session["quiz_session_id"],))
        db.commit()
        score_row     = db.execute("SELECT score FROM quiz_sessions WHERE id=?", (session["quiz_session_id"],)).fetchone()
        current_score = score_row["score"]

    return jsonify({
        "is_correct":           is_correct,
        "selected_text":        selected["text"],
        "selected_explanation": selected["explanation"],
        "correct_text":         correct["text"],
        "correct_explanation":  correct["explanation"],
        "current_score":        current_score
    })


@app.route("/api/finish_quiz", methods=["POST"])
def finish_quiz():
    if "quiz_session_id" not in session:
        return jsonify({"error": "No session."}), 401

    sid = session["quiz_session_id"]
    with get_db() as db:
        db.execute(
            "UPDATE quiz_sessions SET completed=1, finished_at=? WHERE id=?",
            (datetime.now(), sid)
        )
        db.commit()
        row = db.execute("SELECT score, total, topic FROM quiz_sessions WHERE id=?", (sid,)).fetchone()

    result = {"score": row["score"], "total": row["total"], "topic": row["topic"]}
    for k in ["quiz_session_id", "current_mcq", "asked_questions", "current_q", "total_q", "topic"]:
        session.pop(k, None)
    return jsonify(result)

# ─── Leaderboard / Stats ──────────────────────────────────────────────────────

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    topic_filter = request.args.get("topic", "")
    with get_db() as db:
        if topic_filter:
            rows = db.execute("""
                SELECT u.username, qs.topic, qs.score, qs.total,
                       ROUND(qs.score * 100.0 / qs.total) AS pct, qs.finished_at
                FROM quiz_sessions qs
                JOIN users u ON u.id = qs.user_id
                WHERE qs.completed = 1 AND LOWER(qs.topic) LIKE ?
                ORDER BY pct DESC, qs.score DESC
                LIMIT 50
            """, (f"%{topic_filter.lower()}%",)).fetchall()
        else:
            rows = db.execute("""
                SELECT u.username, qs.topic, qs.score, qs.total,
                       ROUND(qs.score * 100.0 / qs.total) AS pct, qs.finished_at
                FROM quiz_sessions qs
                JOIN users u ON u.id = qs.user_id
                WHERE qs.completed = 1
                ORDER BY pct DESC, qs.score DESC
                LIMIT 50
            """).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/my_history", methods=["GET"])
def my_history():
    if not logged_in():
        return jsonify({"error": "Not authenticated."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT topic, score, total, ROUND(score * 100.0 / total) AS pct, finished_at
            FROM quiz_sessions
            WHERE user_id = ? AND completed = 1
            ORDER BY finished_at DESC
            LIMIT 20
        """, (session["user_id"],)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/stats", methods=["GET"])
def stats():
    with get_db() as db:
        total_quizzes = db.execute("SELECT COUNT(*) AS c FROM quiz_sessions WHERE completed=1").fetchone()["c"]
        total_users   = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        top_topics    = db.execute("""
            SELECT topic, COUNT(*) AS cnt FROM quiz_sessions
            WHERE completed=1 GROUP BY LOWER(topic) ORDER BY cnt DESC LIMIT 5
        """).fetchall()
    return jsonify({
        "total_quizzes": total_quizzes,
        "total_users":   total_users,
        "top_topics":    [dict(r) for r in top_topics]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
