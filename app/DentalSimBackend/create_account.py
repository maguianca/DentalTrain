"""
Creare cont manual fara email.
Folosire:
  python3 create_account.py <username> <parola> [rol]

Roluri disponibile:
  validator       - doctor care valideaza cazurile
  Dental Student  - student (implicit)
  professor       - profesor

Exemple:
  python3 create_account.py dr_ionescu parola123 validator
  python3 create_account.py student01 parola123
"""

import sys
import os
from werkzeug.security import generate_password_hash
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_KEY_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
db = firestore.client()

VALID_ROLES = ["validator", "Dental Student", "professor"]

def create_account(username, password, role="Dental Student"):
    username = username.strip().lower()

    # verificare username existent
    existing = db.collection("user").where("username", "==", username).limit(1).get()
    if existing:
        print(f"EROARE: username-ul '{username}' exista deja.")
        return

    if role not in VALID_ROLES:
        print(f"EROARE: rol invalid '{role}'. Roluri valide: {VALID_ROLES}")
        return

    fake_email = f"{username}@local.internal"
    password_hash = generate_password_hash(password)

    ref = db.collection("user").document()
    ref.set({
        "username": username,
        "email": fake_email,
        "university": "UMF",
        "password_hash": password_hash,
        "xp": 0,
        "classroom_id": None,
        "streak": 0,
        "last_active_date": None,
        "role": role,
        "consecutive_correct": 0,
        "is_verified": True,
        "verification_code": None,
        "has_seen_home_tutorial": False,
        "has_seen_chat_tutorial": False,
    })

    print(f"Cont creat cu succes!")
    print(f"  Username: {username}")
    print(f"  Parola:   {password}")
    print(f"  Rol:      {role}")
    print(f"  ID:       {ref.id}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Folosire: python3 create_account.py <username> <parola> [rol]")
        print("  Rol implicit: Dental Student")
        print("  Roluri: validator / Dental Student / professor")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    role = sys.argv[3] if len(sys.argv) >= 4 else "Dental Student"

    create_account(username, password, role)
