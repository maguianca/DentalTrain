"""
=== VALIDATION MODE ===
Exports all validator questionnaire answers to a CSV file (one row per answer),
so they can be opened in Excel and grouped per disease to compute inter-rater
agreement.

Usage (from the DentalSimBackend folder, with serviceAccountKey.json present):
    python export_validation.py
Produces: validation_export.csv
"""
import csv
import os

import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_KEY_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'validation_export.csv')

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
db = firestore.client()

COLUMNS = [
    "created_at", "username", "email", "disease_name", "round",
    "submitted_diagnosis", "was_correct",
    "q1_targeted_answers", "q2_realistic_conversation", "q3_no_contradictions",
    "q4_complementary_exams", "q5_valid_for_training", "q6_comment",
    "disease_id", "user_id", "session_id",
]


def main():
    docs = db.collection("validation_response").stream()
    rows = []
    for doc in docs:
        d = doc.to_dict()
        answers = d.get("answers", {}) or {}
        rows.append({
            "created_at": d.get("created_at"),
            "username": d.get("username"),
            "email": d.get("email"),
            "disease_name": d.get("disease_name"),
            "round": d.get("round"),
            "submitted_diagnosis": d.get("submitted_diagnosis"),
            "was_correct": d.get("was_correct"),
            "q1_targeted_answers": answers.get("q1_targeted_answers"),
            "q2_realistic_conversation": answers.get("q2_realistic_conversation"),
            "q3_no_contradictions": answers.get("q3_no_contradictions"),
            "q4_complementary_exams": answers.get("q4_complementary_exams"),
            "q5_valid_for_training": answers.get("q5_valid_for_training"),
            "q6_comment": answers.get("q6_comment", ""),
            "disease_id": d.get("disease_id"),
            "user_id": d.get("user_id"),
            "session_id": d.get("session_id"),
        })

    # Sort by disease then round for easy comparison across validators.
    rows.sort(key=lambda r: (str(r.get("disease_name")), str(r.get("round"))))

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} responses to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
