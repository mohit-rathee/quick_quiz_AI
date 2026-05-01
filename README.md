# QuizMaster AI 🧠⚡

A full-stack AI-powered MCQ quiz web app built with Flask + SQLite3.

## Project Structure

```
quizapp/
├── app.py              ← Flask backend + all API routes
├── quiz.db             ← SQLite database (auto-created)
├── requirements.txt    ← Python dependencies
└── templates/
    └── index.html      ← Single-page frontend (HTML/CSS/JS)
```

## Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the server
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

## Features

- 🤖 **AI Question Generation** — Questions generated via OpenRouter API (any topic)
- 👤 **Username-based auth** — No password needed, sessions via Flask
- 🏆 **Global Leaderboard** — All scores visible to everyone, filterable by topic
- 📋 **Personal History** — Track your past quiz attempts
- 📊 **Live Stats** — Total quizzes, players, topics on login screen
- 🎨 **Dark UI** — Cyberpunk-inspired responsive design
- 🔄 **No repeated questions** — Tracks asked questions per session

## Database Schema

### `users`
| Column | Type |
|--------|------|
| id | INTEGER PK |
| username | TEXT UNIQUE |
| created_at | TIMESTAMP |

### `quiz_sessions`
| Column | Type |
|--------|------|
| id | INTEGER PK |
| user_id | INTEGER FK |
| topic | TEXT |
| score | INTEGER |
| total | INTEGER |
| completed | INTEGER (0/1) |
| started_at | TIMESTAMP |
| finished_at | TIMESTAMP |

### `answers`
| Column | Type |
|--------|------|
| id | INTEGER PK |
| session_id | INTEGER FK |
| question | TEXT |
| selected_text | TEXT |
| correct_text | TEXT |
| is_correct | INTEGER (0/1) |
| answered_at | TIMESTAMP |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/login` | Login / create user |
| POST | `/api/logout` | Clear session |
| POST | `/api/start_quiz` | Start new quiz session |
| GET | `/api/get_question` | Fetch next AI question |
| POST | `/api/submit_answer` | Submit answer, get feedback |
| POST | `/api/finish_quiz` | Mark session complete |
| GET | `/api/leaderboard` | Get top scores (filterable) |
| GET | `/api/my_history` | Get current user's history |
| GET | `/api/stats` | Global site statistics |

## Configuration

Update `API_KEY` in `app.py` with your OpenRouter API key:
```python
API_KEY = "your-openrouter-api-key-here"
```

## Tech Stack

- **Backend**: Python / Flask
- **Database**: SQLite3 (via standard library)
- **AI**: OpenRouter API (`openrouter/auto` model)
- **Frontend**: Vanilla HTML + CSS + JavaScript (zero dependencies)
- **Fonts**: Space Mono + Syne (Google Fonts)
