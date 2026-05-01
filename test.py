import requests
import json
import re
import random
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")

def shuffle_options(mcq):
    options = mcq["options"]
    random.shuffle(options)

    # Reassign IDs after shuffle (1,2,3,4 mapping)
    for idx, opt in enumerate(options):
        opt["display_id"] = idx + 1

    return mcq

asked_questions = []

def extract_mcq(response):
    content = response["choices"][0]["message"]["content"]
    cleaned = re.sub(r"```json\s*|\s*```", "", content.strip())

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print("JSON parsing failed:", e)
        return None

    return data


def get_question(topic):
    prompt = f"""
Generate exactly 1 multiple-choice question (MCQ) about {topic}.

Avoid repeating any of these questions:
{asked_questions}

Return ONLY valid JSON in the following format:

{{
  "question": "string",
  "options": [
    {{
      "id": "A",
      "text": "string",
      "is_correct": true,
      "explanation": "Why this option is correct or incorrect",
      "hint": "Helpful hint"
    }},
    {{
      "id": "B",
      "text": "string",
      "is_correct": false,
      "explanation": "Why this option is correct or incorrect",
      "hint": "Helpful hint"
    }},
    {{
      "id": "C",
      "text": "string",
      "is_correct": false,
      "explanation": "Why this option is correct or incorrect",
      "hint": "Helpful hint"
    }},
    {{
      "id": "D",
      "text": "string",
      "is_correct": false,
      "explanation": "Why this option is correct or incorrect",
      "hint": "Helpful hint"
    }}
  ]
}}

Rules:
- Only JSON
- One correct answer
- Do NOT repeat or rephrase similar questions
- Ask a completely new concept each time
"""

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "openrouter/auto",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
    )

    return extract_mcq(response.json())


def play_quiz():
    topic = input("Enter topic (e.g. OS, DBMS, Python): ")
    ques_count=5
    score = 0


    for i in range(1, ques_count+1):
        print(f"\n--- Question {i} ---")

        mcq = get_question(topic)
        asked_questions.append(mcq["question"])
        if not mcq:
            print("Failed to fetch question")
            continue

        print("\n" + mcq["question"])


        # Jumbel options
        shuffle_options(mcq)
        # Display options
        for idx, opt in enumerate(mcq["options"], start=1):
            print(f"{idx}) {opt['text']}")

        # Input validation
        while True:
            try:
                choice = input("Enter your answer (1-4, x to cancel): ")
                if choice == 'x':
                    return
                choice=int(choice)
                if choice in [1, 2, 3, 4]:
                    break
                else:
                    print("Enter a number between 1 and 4")
            except:
                print("Invalid input")

        selected = mcq["options"][choice - 1]
        correct = next(opt for opt in mcq["options"] if opt["is_correct"])

        # Result
        if selected["is_correct"]:
            print("✅ Correct! 🎉")
            print("Reason:", selected["explanation"])
            score += 1
        else:
            print("❌Wrong! 😵")
            print("Your answer reason:", selected["explanation"])
            print(f"Correct answer: {correct['id']}) {correct['text']}")
            print("Correct reason:", correct["explanation"])

    print(f"\n🏁 Final Score: {score}/5")


# Run game
play_quiz()
