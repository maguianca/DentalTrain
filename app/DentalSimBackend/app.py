
import os
import json
import datetime as dt
import random
import string
import requests
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import firebase_admin
from firebase_admin import credentials, firestore
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import university_config
from clinical_rules import resolve_clinical_test
import time
import threading
import csv

class PerformanceLogger:
    LOG_FILE = "performance_logs.csv"
    _lock = threading.Lock()
    _active_users = 0

    def __init__(self):
        self.start_time = time.time()
        self.session_id = "unknown"
        self.status = "PENDING"
        self.message_len = 0
        
        with PerformanceLogger._lock:
            PerformanceLogger._active_users += 1
            self.concurrent_users = PerformanceLogger._active_users
        
        self._init_file()

    def _init_file(self):
        if not os.path.exists(self.LOG_FILE):
            try:
                with open(self.LOG_FILE, "w", newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(["Timestamp", "SessionID", "Msg_Length", "Duration_Sec", "Concurrent_Users", "Status"])
            except:
                pass

    def set_session(self, session_id, message=""):
        """Setează detaliile sesiunii pe parcurs"""
        self.session_id = session_id
        self.message_len = len(message) if message else 0

    def success(self):
        self.status = "SUCCESS"

    def fail(self, error_msg):
        self.status = f"ERROR: {str(error_msg)}"

    def save(self):
        """Oprește cronometrul, scade userul și scrie în fișier"""
        duration = time.time() - self.start_time
        
        with PerformanceLogger._lock:
            PerformanceLogger._active_users -= 1
        
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            with open(self.LOG_FILE, "a", newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp, 
                    self.session_id, 
                    self.message_len, 
                    f"{duration:.2f}", 
                    self.concurrent_users, 
                    self.status
                ])
            print(f"[LOG] {duration:.2f}s | Users: {self.concurrent_users} | {self.status}")
        except Exception as e:
            print(f"Log Error: {e}")
            
BASE_URL = '/aiinference/4'
# --- APP CONFIGURATION ---
app = Flask(__name__, static_folder='static', static_url_path=BASE_URL)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Schimbă cheia la producție!
app.config['JWT_SECRET_KEY'] = 'super-secret-dental-key-change-me'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = dt.timedelta(hours=24)
jwt = JWTManager(app)

# --- FIREBASE INIT ---
SERVICE_ACCOUNT_KEY_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
firebase_db = firestore.client()

# --- LOCAL PROMPT OVERRIDES (for testing without touching Firebase) ---
_PROMPT_OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), 'prompt_overrides.json')
def get_prompt_override(disease_name: str):
    try:
        with open(_PROMPT_OVERRIDES_PATH, 'r', encoding='utf-8') as f:
            overrides = json.load(f)
        return overrides.get(disease_name)
    except Exception:
        return None

# --- EMAIL CONFIG ---
load_dotenv()
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


# --- LLM ENDPOINTS ---
# Folosim variabila de mediu pentru a gasi containerul AI
AI_SERVER_URL = os.getenv("AI_SERVER_URL")
HF_URL = f"{AI_SERVER_URL}/v1/chat/completions"
HF_HEADERS = {"Content-Type": "application/json"}
# --- ASSETS FOLDER ---
ASSETS_FOLDER = os.path.join(os.path.dirname(__file__), 'clinical_assets')


# --- HELPERS (Firestore) ---

def get_user_by_username(username: str):
    docs = firebase_db.collection("user").where("username", "==", username).limit(1).get()
    return docs[0] if docs else None

def get_user_doc(user_id: str):
    doc = firebase_db.collection("user").document(user_id).get()
    return doc if doc.exists else None

def get_classroom_by_join_code(join_code: str):
    docs = firebase_db.collection("classroom").where("join_code", "==", join_code).limit(1).get()
    return docs[0] if docs else None


def create_user(username, password_hash, email, university, classroom_id=None, role="Dental Student"):
    ref = firebase_db.collection("user").document()  # id auto

    verification_code = str(random.randint(100000, 999999))

    ref.set({
        "username": username,
        "email": email,
        "university": university,
        "password_hash": password_hash,
        "xp": 0,
        "classroom_id": classroom_id,
        "streak": 0,
        "last_active_date": None,
        "role": role,
        "consecutive_correct": 0,
        "is_verified": False,
        "verification_code": verification_code,
        # === ONBOARDING TUTORIAL (added) ===
        # New accounts have not seen the welcome tutorial yet.
        # Two separate flags: the home tutorial shows on first login,
        # the chat tutorial shows the first time the user opens a case.
        "has_seen_home_tutorial": False,
        "has_seen_chat_tutorial": False,
        # === END ONBOARDING TUTORIAL ===
    })
    return ref, verification_code

def get_user_by_email(email):
    docs = firebase_db.collection("user").where("email", "==", email).limit(1).get()
    return docs[0] if docs else None

# --- CLASSROOM & MEMBERSHIP HELPERS ---

def generate_join_code(length: int = 8) -> str:

    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(length))


def add_class_membership(user_id: str, classroom_id: str, role_in_class: str = "Student"):

    existing = firebase_db.collection("class_membership") \
        .where("user_id", "==", user_id) \
        .where("classroom_id", "==", classroom_id) \
        .limit(1).get()
    if existing:
        return existing[0].reference

    ref = firebase_db.collection("class_membership").document()
    ref.set({
        "user_id": user_id,
        "classroom_id": classroom_id,
        "role_in_class": role_in_class,
        "joined_at": firestore.SERVER_TIMESTAMP
    })
    return ref


def get_random_disease(allowed_names=None, allowed_categories=None, exclude_ids=None):
    docs = firebase_db.collection("disease").get()
    if not docs:
        return None

    exclude_ids = set(exclude_ids or [])
    pool = []
    for d in docs:
        if d.id in exclude_ids:
            continue
        data = d.to_dict()
        name = data.get("name")
        category = data.get("category", "")
        
        # Filtru nume
        if allowed_names and name not in allowed_names:
            continue
            
        # Filtru categorie
        if allowed_categories:
            matching_cat = False
            for ac in allowed_categories:
                if ac.lower() in category.lower():
                    matching_cat = True
                    break
            if not matching_cat:
                continue
        
        pool.append(d)

    if not pool:
        return None

    # Dacă nu avem filtre, păstrăm logica de balans Endodontic vs Non-Endodontic
    if not allowed_names and not allowed_categories:
        endo_docs = [d for d in pool if "non endodontic" not in d.to_dict().get("category", "").lower()]
        non_endo_docs = [d for d in pool if "non endodontic" in d.to_dict().get("category", "").lower()]
        
        if not non_endo_docs:
            return random.choice(pool)
            
        # 50/50 chance între endo și non-endo random
        if random.random() < 0.5 and endo_docs:
            return random.choice(endo_docs)
        return random.choice(non_endo_docs)

    return random.choice(pool)


def create_chat_session(user_id, disease_id, clinical_context, assignment_id=None):
    ref = firebase_db.collection("chat_session").document()

    ref.set({
        "user_id": user_id,
        "disease_id": disease_id,
        "assignment_id": assignment_id,
        "start_time": firestore.SERVER_TIMESTAMP,
        "end_time": None,
        "is_completed": 0,
        "was_correct": 0,

        "clinical_context": clinical_context
    })

    return ref


def add_chat_message(session_id, sender, content):
    # Colecție rădăcină, ca în SQLite (FK = session_id)
    ref = firebase_db.collection("chat_message_v2").document()
    ref.set({
        "session_id": session_id,
        "sender": sender,
        "content": content,
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    return ref

def get_last_messages(session_id, limit=10):
    # Filtrăm pe session_id și ordonăm desc după timestamp
    msgs = firebase_db.collection("chat_message_v2") \
        .where("session_id", "==", session_id) \
        .order_by("timestamp", direction=firestore.Query.DESCENDING) \
        .limit(limit).get()
    return list(reversed(msgs))  # pentru ordinea cronologică

def check_and_award_badge(user_id, badge_name, xp_bonus=0):
    existing = firebase_db.collection("user_badge") \
        .where("user_id", "==", user_id) \
        .where("badge_name", "==", badge_name) \
        .limit(1).get()
    if not existing:
        firebase_db.collection("user_badge").document().set({
            "user_id": user_id,
            "badge_name": badge_name,
            "awarded_at": firestore.SERVER_TIMESTAMP
        })
        firebase_db.collection("user").document(user_id).update({
            "xp": firestore.Increment(xp_bonus)
        })
        return f" [BADGE: {badge_name}]"
    return ""

def send_verification_email(to_email, code):
    subject = "Your DentalTrain Verification Code"
    body = f"Welcome! Your verification code is: {code}"

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SMTP_EMAIL
    msg['To'] = to_email

    try:
        # Example using Gmail's server (port 587)
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {e}")

# Use the university_config function directly
get_university_name = university_config.get_university_name

# --- OPTIONAL: endpoint generic de adăugare în Firestore ---
@app.route(BASE_URL+ "/firebase/add", methods=["POST"])
@jwt_required()
def add_to_firestore():
    data = request.get_json()
    collection_name = data.get("collection", "default_collection")
    document_data = data.get("data", {})
    try:
        doc_ref = firebase_db.collection(collection_name).add(document_data)
        # doc_ref = (update_time, ref)
        return jsonify({"message": "Document added", "doc_id": doc_ref[1].id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- ROUTES (Firestore-only) ---

@app.route(BASE_URL+"/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    email = data.get("email", "").strip().lower()
    class_code = data.get("class_code", "").strip()
    role = data.get("role", "Dental Student").strip()

    # 1. Check Institutional Domain
    try:
        domain = email.split('@')[1]
        detected_university = get_university_name(domain)
    except IndexError:
        detected_university = None

    if not detected_university:
        return jsonify({"error": "Please use a supported institutional email (.edu, .ro, etc)."}), 403

    # 2. Check Uniqueness
    if get_user_by_email(email):
        return jsonify({"error": "Email already registered", "code": "EMAIL_TAKEN"}), 409
    if get_user_by_username(username):
        return jsonify({"error": "Username taken"}), 409

    assigned_class_id = None
    if class_code:
        classroom_doc = get_classroom_by_join_code(class_code)
        if classroom_doc:
            assigned_class_id = classroom_doc.id

    user_ref, code = create_user(
        username=username,
        password_hash=generate_password_hash(password),
        email=email,
        university=detected_university,
        classroom_id=assigned_class_id,
        role=role
    )
    send_verification_email(email, code)

    if assigned_class_id:
        add_class_membership(user_ref.id, assigned_class_id, "Student")

    return jsonify({
        "message": "User created. Verification required.",
        "email": email,
        "needs_verification": True
    }), 201

@app.route(BASE_URL+"/auth/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    current_user_id = get_jwt_identity()
    user_ref = firebase_db.collection("user").document(current_user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    user_data = user_doc.to_dict()

    if not check_password_hash(user_data.get("password_hash", ""), current_password):
        return jsonify({"error": "Invalid current password"}), 401
        
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user_ref.update({
        "password_hash": generate_password_hash(new_password)
    })

    return jsonify({"message": "Password changed successfully"}), 200




@app.route(BASE_URL+"/auth/verify", methods=["POST"])
def verify_account():
    data = request.get_json()
    email = data.get("email")
    code = data.get("code")

    user_doc = get_user_by_email(email)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404

    user_data = user_doc.to_dict()

    # Check code
    if user_data.get("verification_code") == code:
        # Success! Mark as verified
        firebase_db.collection("user").document(user_doc.id).update({
            "is_verified": True,
            "verification_code": firestore.DELETE_FIELD  # Cleanup
        })
        return jsonify({"message": "Account verified successfully!"}), 200
    else:
        return jsonify({"error": "Invalid code"}), 400

@app.route(BASE_URL+"/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")

    user_doc = get_user_by_username(username)
    if not user_doc:
        user_doc = get_user_by_email(username)
        
    if not user_doc:
        return jsonify({"error": "Invalid credentials"}), 401

    user = user_doc.to_dict()

    if not user.get("is_verified", False):
        return jsonify({
            "error": "Account not verified. Please check your email.",
            "is_verified": False,
            "email": user.get("email")  # Return email so frontend can help verify
        }), 403

    if not check_password_hash(user.get("password_hash", ""), password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user_doc.id))
    return jsonify({
        "token": token,
        "user": {
            "id": str(user_doc.id),
            "username": user.get("username"),
            "xp": int(user.get("xp", 0)),
            "role": user.get("role", "Dental Student"),
            "email": user.get("email"),  # FIXED: Added email to response
            "university": user.get("university"),  # FIXED: Added university to response
        }
    })


# === VALIDATION MODE ===
def pick_validation_disease(user_id):
    """
    Round-based, no-repeat case delivery for validators.
    Counts how many times the user has COMPLETED each disease, then picks
    randomly among the diseases done the fewest times. This naturally delivers
    every case once per round, in random order, before any case repeats.
    Returns a dict with the chosen disease doc + progress, or None if no diseases.
    """
    diseases = firebase_db.collection("disease").get()
    if not diseases:
        return None

    total_cases = len(diseases)

    completed = firebase_db.collection("chat_session") \
        .where("user_id", "==", user_id) \
        .where("is_completed", "==", 1).stream()
    counts = {}
    for s in completed:
        did = s.to_dict().get("disease_id")
        if did:
            counts[did] = counts.get(did, 0) + 1

    min_count = min(counts.get(d.id, 0) for d in diseases)
    candidates = [d for d in diseases if counts.get(d.id, 0) == min_count]
    chosen = random.choice(candidates)

    round_number = min_count + 1
    done_this_round = sum(1 for d in diseases if counts.get(d.id, 0) >= round_number)
    return {
        "disease": chosen,
        "round": round_number,
        "case_number": done_this_round + 1,
        "total_cases": total_cases,
    }
# === END VALIDATION MODE ===


@app.route(BASE_URL+"/chat/start/random", methods=["POST"])
@jwt_required()
def start_random_chat():
    current_user_id = get_jwt_identity()

    # === VALIDATION MODE ===
    # Validators get round-based, no-repeat delivery; everyone else stays random.
    user_doc = get_user_doc(current_user_id)
    is_validator = bool(user_doc) and (user_doc.to_dict().get("role") == "validator")

    round_number = case_number = total_cases = None
    if is_validator:
        pick = pick_validation_disease(current_user_id)
        disease_doc = pick["disease"] if pick else None
        if pick:
            round_number = pick["round"]
            case_number = pick["case_number"]
            total_cases = pick["total_cases"]
    else:
        disease_doc = get_random_disease()
    # === END VALIDATION MODE ===

    if not disease_doc:
        return jsonify({"error": "No diseases in database"}), 500

    disease_id = disease_doc.id
    disease_data = disease_doc.to_dict()
    disease_name = disease_data.get("name")

    # --- NEW LOGIC START ---

    # 1. Select Random Images (Handle cases where array might be empty)
    examine_urls = disease_data.get("examine_images", [])
    selected_examine_img = random.choice(examine_urls) if examine_urls else None

    xray_urls = disease_data.get("xray_images", [])
    selected_xray_img = random.choice(xray_urls) if xray_urls else None

    # 2. Resolve Probabilistic Text Tests
    # This "freezes" the result for this specific session
    percussion_result = resolve_clinical_test(disease_name, "percussion")
    thermal_result = resolve_clinical_test(disease_name, "thermal")

    # --- NEW LOGIC END ---

    # 3. Save everything to the session
    # We add a 'clinical_context' map to the session document
    session_ref = firebase_db.collection("chat_session").document()
    session_ref.set({
        "user_id": current_user_id,
        "disease_id": disease_id,
        "disease_name": disease_name, # Store name for easier debugging
        "start_time": firestore.SERVER_TIMESTAMP,
        "end_time": None,
        "is_completed": 0,
        "was_correct": 0,
        "round": round_number,  # === VALIDATION MODE === round number (None for non-validators)

        # Storing the specific "truth" for this patient
        "clinical_context": {
            "examine_image": selected_examine_img,
            "xray_image": selected_xray_img,
            "percussion_result": percussion_result,
            "thermal_result": thermal_result
        }
    })

    print(f"Session {session_ref.id}: {disease_name}")

    resp = {
        "ok": True,
        "session_id": session_ref.id,
        "message": "** The patient has entered the office. **"
    }
    # === VALIDATION MODE === include round/progress info for validators
    if is_validator:
        resp["round"] = round_number
        resp["case_number"] = case_number
        resp["total_cases"] = total_cases
    return jsonify(resp)

@app.route(BASE_URL+"/classroom/<class_id>/delete", methods=["POST"])
@jwt_required()
def delete_classroom(class_id):
    """
    Deletes a class and its membership. Requires Professor role.
    """
    current_user_id = get_jwt_identity()

    memb = firebase_db.collection("class_membership") \
        .where("classroom_id", "==", class_id) \
        .where("user_id", "==", current_user_id) \
        .where("role_in_class", "==", "Professor") \
        .limit(1).get()

    if not memb:
        return jsonify({"error": "Only class professor can delete this classroom"}), 403

    # Delete the classroom
    firebase_db.collection("classroom").document(class_id).delete()

    return jsonify({"message": "Classroom deleted"}), 200


@app.route(BASE_URL+"/chat/greeting", methods=["POST"])
@jwt_required()
def chat_greeting():
    data = request.get_json()
    session_id = data.get("session_id")

    session_doc = firebase_db.collection("chat_session").document(session_id).get()
    if not session_doc.exists:
        return jsonify({"error": "Invalid session"}), 404
    session = session_doc.to_dict()

    disease_doc = firebase_db.collection("disease").document(session["disease_id"]).get()
    if not disease_doc.exists:
        return jsonify({"error": "Disease missing"}), 500
    disease = disease_doc.to_dict()

    conversation_history = [
        {"role": "system", "content": disease["system_prompt"]},
        {"role": "user", "content": "Begin the consultation. Greet the doctor naturally, like a real patient walking in. Do NOT mention any symptoms or details yet — just say hello and that you have a problem you'd like checked. Maximum 1 sentence."}
    ]
    payload = {
        "model": "dental-model",
        "messages": conversation_history,
        "max_tokens": 100,
        "temperature": 0.3
    }

    fallback = "Good morning, doctor. I came because I've been having some pain and I'd like to get it checked."
    try:
        response = requests.post(HF_URL, json=payload, headers=HF_HEADERS, timeout=60)
        response.raise_for_status()
        ai_data = response.json()
        greeting = ai_data['choices'][0]['message']['content'] if 'choices' in ai_data and ai_data['choices'] else fallback
        disease_name = disease.get("name", "")
        if disease_name and disease_name.lower() in greeting.lower():
            greeting = fallback
    except Exception:
        greeting = fallback

    add_chat_message(session_id, "patient", greeting)
    return jsonify({"reply": greeting})


@app.route(BASE_URL+"/chat", methods=["POST"])
@jwt_required()
def chat():
    tracker = PerformanceLogger()
    try:
      data = request.get_json()
      session_id = data.get("session_id")
      user_message = data.get("message", "")
      tracker.set_session(session_id, user_message)
      session_doc = firebase_db.collection("chat_session").document(session_id).get()
      if not session_doc.exists:
          tracker.fail("Invalid Session")
          return jsonify({"error": "Invalid session"}), 404
      session = session_doc.to_dict()

      # mesajul studentului
      add_chat_message(session_id, "student", user_message)

      # sistem prompt din boală
      disease_doc = firebase_db.collection("disease").document(session["disease_id"]).get()
      if not disease_doc.exists:
          tracker.fail("Disease Missing")
          return jsonify({"error": "Disease missing"}), 500
      disease = disease_doc.to_dict()

      recent_msgs = get_last_messages(session_id, limit=10)
      system_prompt = get_prompt_override(disease.get("name", "")) or disease["system_prompt"]
      conversation_history = [{"role": "system", "content": system_prompt}]
      for msg_doc in recent_msgs:
          m = msg_doc.to_dict()
          role = "user" if m["sender"] == "student" else "assistant"
          conversation_history.append({"role": role, "content": m["content"]})

      payload = {
        "model": "dental-model",
        "messages": conversation_history,
        "max_tokens": 150,
        "temperature": 0.2
      }

      response = requests.post(HF_URL, json=payload, headers=HF_HEADERS, timeout=180)
      response.raise_for_status() 
      ai_data = response.json()
        
      if 'choices' in ai_data and len(ai_data['choices']) > 0:
          bot_reply = ai_data['choices'][0]['message']['content']
      else:
          bot_reply = "Eroare: AI-ul nu a generat un răspuns valid."
          tracker.fail("Empty AI Response")
          print(f"Debug AI Response: {ai_data}") # Sa vezi in consola ce a venit gresit

      # Filter: if the reply contains the disease name, replace it with a deflection.
      disease_name = disease.get("name", "")
      if disease_name and disease_name.lower() in bot_reply.lower():
          bot_reply = "I'm not sure what's wrong with me, doctor. That's why I came to see you."

      add_chat_message(session_id, "patient", bot_reply)
      return jsonify({"reply": bot_reply})

    except requests.exceptions.ConnectionError:
        tracker.fail("Connection Error")
        print("⚠️ AI Server is down/restarting...")
        return jsonify({
            "error": "AI-ul se trezește... Te rog mai apasă o dată pe Send în 5 secunde!",
            "is_retryable": True 
        }), 503

    except Exception as e:
        # Orice alta eroare
        tracker.fail(e)
        print(f"Eroare generala: {e}")
        return jsonify({"error": str(e)}), 500
    finally: 
        tracker.save()


@app.route(BASE_URL +"/chat/diagnose", methods=["POST"])
@jwt_required()
def check_diagnosis():
    current_user_id = get_jwt_identity()
    user_doc = get_user_doc(current_user_id)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404
    user = user_doc.to_dict()

    data = request.get_json()
    session_id = data.get("session_id")
    student_diagnosis = data.get("diagnosis", "").strip().lower()

    session_ref = firebase_db.collection("chat_session").document(session_id)
    session_doc = session_ref.get()
    if not session_doc.exists or session_doc.to_dict().get("user_id") != current_user_id:
        return jsonify({"error": "Session not found"}), 404
    session = session_doc.to_dict()

    disease_doc = firebase_db.collection("disease").document(session["disease_id"]).get()
    if not disease_doc.exists:
        return jsonify({"error": "Disease not found"}), 404
    disease = disease_doc.to_dict()

    correct_name = disease.get("name", "").strip().lower()
    disease_category = disease.get("category", "").strip().lower()

    if student_diagnosis == "non endodontic issue" and disease_category == "non endodontic":
        is_correct = True
    elif correct_name in student_diagnosis:
        is_correct = True
    else:
        is_correct = False

    xp_gained = 0
    message = ""
    badge_alerts = ""

    batch = firebase_db.batch()
    user_ref = firebase_db.collection("user").document(current_user_id)

    # durata (Timestamp Firestore -> datetime)
    start_time = session.get("start_time")
    duration = 999_999  # fallback
    if isinstance(start_time, dt.datetime):
        try:
            now_utc = dt.datetime.now(dt.UTC)            # aware UTC
            start_utc = start_time.astimezone(dt.UTC)  # normalize Firestore timestamp
            duration = (now_utc - start_utc).total_seconds()
        except Exception as e:
            app.logger.warning(f"[diagnose] duration calc failed: {e}")

    # ---------------- CORE XP & BADGES ----------------
    if is_correct:
        xp_gained = 100
        message = f"Correct! The diagnosis was {disease['name']}."
        batch.update(user_ref, {"consecutive_correct": int(user.get("consecutive_correct", 0)) + 1})

        if duration < 120:
            badge_alerts += check_and_award_badge(current_user_id, "Speed Demon", 100)

        # Perfect Ten
        new_consec = int(user.get("consecutive_correct", 0)) + 1
        if new_consec >= 10:
            badge_alerts += check_and_award_badge(current_user_id, "Perfect Ten", 300)

        # Endodontist Expert (20 pulpal)
        if disease.get("category") == "Pulpal":
            pulpal_correct = 0
            s_docs = firebase_db.collection("chat_session") \
                .where("user_id", "==", current_user_id) \
                .where("was_correct", "==", 1).stream()
            for s_doc in s_docs:
                s = s_doc.to_dict()
                d2 = firebase_db.collection("disease").document(s["disease_id"]).get()
                if d2.exists and d2.to_dict().get("category") == "Pulpal":
                    pulpal_correct += 1
            if pulpal_correct + 1 >= 20:
                badge_alerts += check_and_award_badge(current_user_id, "Endodontist Expert", 500)

        # Periodontal Pro (20 perio)
        if disease.get("category") == "Periodontal":
            perio_correct = 0
            s_docs = firebase_db.collection("chat_session") \
                .where("user_id", "==", current_user_id) \
                .where("was_correct", "==", 1).stream()
            for s_doc in s_docs:
                s = s_doc.to_dict()
                d2 = firebase_db.collection("disease").document(s["disease_id"]).get()
                if d2.exists and d2.to_dict().get("category") == "Periodontal":
                    perio_correct += 1
            if perio_correct + 1 >= 20:
                badge_alerts += check_and_award_badge(current_user_id, "Periodontal Pro", 500)

    else:
        xp_gained = 10
        message = f"Incorrect. The correct diagnosis was {disease['name']}. (+10 XP for effort)"
        batch.update(user_ref, {"consecutive_correct": 0})

    # Global badges
    badge_alerts += check_and_award_badge(current_user_id, "First Steps", 50)

    total_cases_stream = firebase_db.collection("chat_session") \
        .where("user_id", "==", current_user_id) \
        .where("is_completed", "==", 1).stream()
    total_cases = sum(1 for _ in total_cases_stream)
    if total_cases + 1 >= 100:
        badge_alerts += check_and_award_badge(current_user_id, "Master Diagnostician", 2000)

    # Localize time to Romania (UTC+2)
    local_time = dt.datetime.now(dt.UTC) + dt.timedelta(hours=2)
    current_hour = local_time.hour
    
    if current_hour < 7:
        badge_alerts += check_and_award_badge(current_user_id, "Early Bird", 25)
    if current_hour >= 23:
        badge_alerts += check_and_award_badge(current_user_id, "Night Owl", 25)

    # ---------------- STREAK LOGIC ----------------
    def _to_aware_date(val) -> dt.date | None:
        """
        Normalizează diverse reprezentări de timp la date (YYYY-MM-DD), UTC-aware (plus offset RO).
        """
        if isinstance(val, dt.datetime):
            aware = val.astimezone(dt.UTC) if val.tzinfo else val.replace(tzinfo=dt.UTC)
            return (aware + dt.timedelta(hours=2)).date()
        if isinstance(val, str):
            try:
                d = dt.datetime.fromisoformat(val)
            except ValueError:
                d = None
                for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        d = dt.datetime.strptime(val, fmt)
                        break
                    except ValueError:
                        continue
                if d is None:
                    return None
            aware = d if d.tzinfo else d.replace(tzinfo=dt.UTC)
            return (aware + dt.timedelta(hours=2)).date()
        return None

    # --- în interiorul /chat/diagnose, după ce ai încărcat `user` și ai `user_ref` și `batch` ---
    streak = int(user.get("streak", 0))
    last_active_raw = user.get("last_active_date")

    today = local_time.date()
    last_date = _to_aware_date(last_active_raw)

    if last_date != today:
        yesterday = today - dt.timedelta(days=1)
        if last_date == yesterday:
            streak += 1
        else:
            streak = 1
        
        batch.update(user_ref, {
            "streak": streak,
            "last_active_date": firestore.SERVER_TIMESTAMP
        })

    if streak >= 7:
        badge_alerts += check_and_award_badge(current_user_id, "Week Warrior", 150)
    if streak >= 30:
        badge_alerts += check_and_award_badge(current_user_id, "Monthly Master", 1000)

    # ---------------- ASSIGNMENT PROGRESS ----------------
    assignment_id = session.get("assignment_id")
    if assignment_id:
        # durata sigură pentru raport (dacă nu am putut calcula, folosim 0)
        safe_duration = duration if isinstance(duration, (int, float)) and duration != 999_999 else 0

        # citim assignment-ul ca să știm required_sessions și classroom_id
        ass_doc = firebase_db.collection("assignment").document(assignment_id).get()
        required_sessions = 0
        classroom_id_for_assignment = None
        if ass_doc.exists:
            ass = ass_doc.to_dict()
            required_sessions = int(ass.get("required_sessions", 0))
            classroom_id_for_assignment = ass.get("classroom_id")

        prog_query = firebase_db.collection("assignment_progress") \
            .where("assignment_id", "==", assignment_id) \
            .where("user_id", "==", current_user_id) \
            .limit(1).get()
         
        if prog_query:
            prog_doc = prog_query[0]
            prog = prog_doc.to_dict()
            completed_sessions = int(prog.get("completed_sessions", 0)) + 1
            correct_sessions = int(prog.get("correct_sessions", 0)) + (1 if is_correct else 0)
            total_duration_sec = float(prog.get("total_duration_sec", 0)) + safe_duration
            is_completed_assignment = required_sessions > 0 and completed_sessions >= required_sessions

            prog_doc.reference.update({
                "completed_sessions": completed_sessions,
                "correct_sessions": correct_sessions,
                "total_duration_sec": total_duration_sec,
                "is_completed": is_completed_assignment,
                "last_update": firestore.SERVER_TIMESTAMP
            })
        else:
            completed_sessions = 1
            correct_sessions = 1 if is_correct else 0
            total_duration_sec = safe_duration
            is_completed_assignment = required_sessions > 0 and completed_sessions >= required_sessions

            firebase_db.collection("assignment_progress").document().set({
                "assignment_id": assignment_id,
                "user_id": current_user_id,
                "classroom_id": classroom_id_for_assignment,
                "completed_sessions": completed_sessions,
                "correct_sessions": correct_sessions,
                "total_duration_sec": total_duration_sec,
                "is_completed": is_completed_assignment,
                "last_update": firestore.SERVER_TIMESTAMP
            })

    # ---------------- FINAL XP & SESSION UPDATE ----------------
    user_updates = {
        "xp": firestore.Increment(xp_gained),
        "cases_completed": firestore.Increment(1)
    }
    if is_correct:
        user_updates["cases_correct"] = firestore.Increment(1)

    batch.update(user_ref, user_updates)
    batch.update(session_ref, {
        "is_completed": 1,
        "end_time": firestore.SERVER_TIMESTAMP,
        "was_correct": 1 if is_correct else 0
    })
    batch.commit()

    return jsonify({
        "correct": is_correct,
        "message": message + badge_alerts,
        "xp_gained": xp_gained,
        "correct_diagnosis": disease["name"]
    })

@app.route(BASE_URL+"/chat/clinical-test", methods=["POST"])
@jwt_required()
def get_clinical_data():
    data = request.get_json()
    session_id = data.get("session_id")
    test_type = data.get("test_type")  # 'examine', 'xray', 'percussion', 'thermal'

    if not session_id or not test_type:
        return jsonify({"error": "Missing parameters"}), 400

    # 1. Fetch the session to see what "reality" was generated for this patient
    session_doc = firebase_db.collection("chat_session").document(session_id).get()
    if not session_doc.exists:
        return jsonify({"error": "Invalid session"}), 404

    session_data = session_doc.to_dict()
    clinical_context = session_data.get("clinical_context", {})

    response_data = {}

    # 2. Logic: Return Text or Image info based on the test
    if test_type == "percussion":
        response_data["type"] = "text"
        response_data["content"] = clinical_context.get("percussion_result", "Normal.")

    elif test_type == "thermal":
        response_data["type"] = "text"
        response_data["content"] = clinical_context.get("thermal_result", "Normal.")

    elif test_type in ["examine", "xray"]:
        # Check if we actually have a file assigned for this case
        filename = clinical_context.get(f"{test_type}_image")

        if filename:
            response_data["type"] = "image"
            response_data["content"] = filename
        else:
            response_data["type"] = "text"
            if test_type == "xray":
                response_data["content"] = "An X-ray is not the relevant investigation for this diagnosis."
            else:
                response_data["content"] = "Clinical examination does not reveal specific findings for this diagnosis."

    else:
        return jsonify({"error": "Unknown test type"}), 400

    return jsonify(response_data)

@app.route(BASE_URL+"/auth/profile", methods=["GET"])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()
    user_doc = get_user_doc(current_user_id)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404
    user = user_doc.to_dict()

    completed = firebase_db.collection("chat_session") \
        .where("user_id", "==", current_user_id) \
        .where("is_completed", "==", 1).stream()
    completed_list = [s.to_dict() for s in completed]
    total_cases = len(completed_list)

    correct_cases = sum(1 for s in completed_list if s.get("was_correct"))

    accuracy = int((correct_cases / total_cases) * 100) if total_cases > 0 else 0

    user_xp = int(user.get("xp", 0))
    higher = firebase_db.collection("user").where("xp", ">", user_xp).stream()
    rank = sum(1 for _ in higher) + 1

    badges_stream = firebase_db.collection("user_badge").where("user_id", "==", current_user_id).stream()
    earned_badge_names = [b.to_dict().get("badge_name") for b in badges_stream]

    return jsonify({
        "id": current_user_id,
        "username": user.get("username"),
        "email": user.get("email"),  # FIXED: Added email
        "university": user.get("university"),  # FIXED: Added university
        "classroom_id": user.get("classroom_id"),  # FIXED: Added classroom_id
        "xp": user_xp,
        "cases_completed": total_cases,
        "accuracy": accuracy,
        "streak": int(user.get("streak", 0)),
        "last_active_date": user.get("last_active_date"),
        "consecutive_correct": int(user.get("consecutive_correct", 0)),  # FIXED: Added consecutive_correct
        "earned_badges": earned_badge_names,
        "rank": rank,
        "role": user.get("role", "Dental Student"),
        "is_verified": user.get("is_verified", False),  # FIXED: Added is_verified
        # === ONBOARDING TUTORIAL (added) ===
        # Tells the app whether to auto-start the welcome tutorial.
        # Missing field (older accounts) defaults to False -> tutorial will show once.
        "has_seen_home_tutorial": user.get("has_seen_home_tutorial", False),
        "has_seen_chat_tutorial": user.get("has_seen_chat_tutorial", False),
        # === END ONBOARDING TUTORIAL ===
    })


@app.route(BASE_URL+"/auth/update-profile", methods=["PUT"])
@jwt_required()
def update_profile():
    current_user_id = get_jwt_identity()
    user_ref = firebase_db.collection("user").document(current_user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    new_username = data.get("username", "").strip()
    new_role = data.get("role", "").strip()
    new_email = data.get("email", "").strip().lower()  # FIXED: Added email update support

    updates = {}
    if new_username:
        existing = get_user_by_username(new_username)
        if existing and existing.id != current_user_id:
            return jsonify({"error": "Username already taken"}), 409
        updates["username"] = new_username
    if new_role:
        updates["role"] = new_role
    if new_email:  # FIXED: Added email update logic
        existing_email = get_user_by_email(new_email)
        if existing_email and existing_email.id != current_user_id:
            return jsonify({"error": "Email already taken"}), 409
        updates["email"] = new_email
        updates["is_verified"] = False  

    if updates:
        user_ref.update(updates)

    return jsonify({"message": "Profile updated successfully"})


# ============================================================================
# === ONBOARDING TUTORIAL (added) ===
# Two endpoints supporting the welcome tutorial that shows only the first time:
#   GET  /auth/tutorial-status -> lightweight check of the two "seen" flags
#   POST /auth/tutorial-seen   -> mark one tutorial as seen (body: {"which": "home"|"chat"})
# The frontend reads the flag to decide whether to auto-start the tutorial,
# and calls tutorial-seen when the user finishes (or skips) it.
# ============================================================================
@app.route(BASE_URL+"/auth/tutorial-status", methods=["GET"])
@jwt_required()
def get_tutorial_status():
    current_user_id = get_jwt_identity()
    user_doc = get_user_doc(current_user_id)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404
    user = user_doc.to_dict()
    return jsonify({
        "home": user.get("has_seen_home_tutorial", False),
        "chat": user.get("has_seen_chat_tutorial", False),
    })


@app.route(BASE_URL+"/auth/tutorial-seen", methods=["POST"])
@jwt_required()
def mark_tutorial_seen():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    which = data.get("which", "")

    # Map the requested tutorial to the matching user field.
    field_by_which = {
        "home": "has_seen_home_tutorial",
        "chat": "has_seen_chat_tutorial",
    }
    field = field_by_which.get(which)
    if not field:
        return jsonify({"error": "Invalid 'which' value (expected 'home' or 'chat')"}), 400

    user_ref = firebase_db.collection("user").document(current_user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"}), 404

    user_ref.update({field: True})
    return jsonify({"message": "Tutorial marked as seen", "which": which})
# === END ONBOARDING TUTORIAL ===


# ============================================================================
# === VALIDATION MODE ===
# Saves one validator's questionnaire answers for one completed case.
# Each answer row is stored in the `validation_response` collection, tagged with
# the disease and round, so answers can be grouped per case and compared across
# validators (inter-rater agreement). See CHESTIONAR_VALIDARE.md for the questions.
# ============================================================================
@app.route(BASE_URL+"/chat/validation-feedback", methods=["POST"])
@jwt_required()
def save_validation_feedback():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session_doc = firebase_db.collection("chat_session").document(session_id).get()
    if not session_doc.exists:
        return jsonify({"error": "Session not found"}), 404
    session = session_doc.to_dict()

    # Only the owner of the session may submit feedback for it.
    if session.get("user_id") != current_user_id:
        return jsonify({"error": "Not your session"}), 403

    user_doc = get_user_doc(current_user_id)
    user = user_doc.to_dict() if user_doc else {}

    feedback_ref = firebase_db.collection("validation_response_v2").document()
    feedback_ref.set({
        # Who / which case / which round (denormalized so each row is self-contained)
        "user_id": current_user_id,
        "username": user.get("username"),
        "email": user.get("email"),
        "session_id": session_id,
        "disease_id": session.get("disease_id"),
        "disease_name": session.get("disease_name"),
        "round": session.get("round"),
        "submitted_diagnosis": data.get("submitted_diagnosis"),
        "was_correct": session.get("was_correct"),
        # Questionnaire answers
        "answers": {
            "q1_targeted_answers": data.get("q1_targeted_answers"),          # 1-5
            "q2_realistic_conversation": data.get("q2_realistic_conversation"),  # 1-5
            "q3_no_contradictions": data.get("q3_no_contradictions"),        # 1-5
            "q4_complementary_exams": data.get("q4_complementary_exams"),    # 1-5
            "q5_valid_for_training": data.get("q5_valid_for_training"),      # 1-5
            "q6_comment": data.get("q6_comment", ""),                        # text
        },
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    return jsonify({"message": "Feedback saved"}), 201
# === END VALIDATION MODE ===


@app.route(BASE_URL+"/auth/leaderboard", methods=["GET"])
def get_leaderboard():
    users = firebase_db.collection("user").order_by("xp", direction=firestore.Query.DESCENDING).limit(50).get()
    leaderboard_data = []
    for index, u_doc in enumerate(users):
        u = u_doc.to_dict()
        xp_val = int(u.get("xp", 0))
        cases_count = int(u.get("cases_completed", 0))
        cases_correct = int(u.get("cases_correct", 0))
        accuracy = int((cases_correct / cases_count) * 100) if cases_count > 0 else 0
        leaderboard_data.append({
            "id": u_doc.id,
            "username": u.get("username"),
            "xp": xp_val,
            "streak": int(u.get("streak", 0)),
            "rank": index + 1,
            "level": int(xp_val / 1000) + 1,
            "role": u.get("role", "Dental Student"),
            "cases_completed": cases_count,
            "accuracy": accuracy,
            "university": u.get("university")
        })
    return jsonify(leaderboard_data)

@app.route(BASE_URL+'/universities', methods=['GET'])
def list_universities():
    universities = university_config.get_list_of_universities()
    return jsonify({"universities": universities}), 200

@app.route(BASE_URL+"/chat/start/assignment", methods=["POST"])
@jwt_required()
def start_assignment_chat():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    assignment_id = data.get("assignment_id")

    if not assignment_id:
        return jsonify({"error": "assignment_id required"}), 400

    assignment_doc = firebase_db.collection("assignment").document(assignment_id).get()
    if not assignment_doc.exists:
        return jsonify({"error": "Assignment not found"}), 404

    assignment = assignment_doc.to_dict()
     # Check deadline
    due_at = assignment.get("due_at")
    if due_at:
        try:
            now = dt.datetime.now(dt.UTC)
            due_dt = dt.datetime.fromisoformat(due_at.replace('Z', '+00:00'))
            if due_dt.tzinfo is None:
                due_dt = due_dt.replace(tzinfo=dt.UTC)
            
            if now > due_dt:
                return jsonify({"error": "The deadline for this assignment has passed."}), 403
        except Exception as e:
            app.logger.warning(f"Deadline check failed for assignment {assignment_id}: {e}")
    allowed_names = assignment.get("allowed_names")
    allowed_categories = assignment.get("allowed_categories")

    past_sessions = firebase_db.collection("chat_session") \
        .where("user_id", "==", current_user_id) \
        .where("assignment_id", "==", assignment_id) \
        .where("is_completed", "==", 1) \
        .stream()
    seen_disease_ids = [s.to_dict().get("disease_id") for s in past_sessions]

    disease_doc = get_random_disease(
        allowed_names=allowed_names, 
        allowed_categories=allowed_categories, 
        exclude_ids=seen_disease_ids
    )

    if not disease_doc:
        return jsonify({"error": "You have already completed all available diseases for this assignment."}), 400

    disease_id = disease_doc.id
    disease_data = disease_doc.to_dict()
    disease_name = disease_data.get("name")

    possible_xrays = disease_data.get("xray_images", [])
    selected_xray = random.choice(possible_xrays) if possible_xrays else None

    possible_photos = disease_data.get("examine_images", [])
    selected_photo = random.choice(possible_photos) if possible_photos else None

    percussion_result = resolve_clinical_test(disease_name, "percussion")
    thermal_result = resolve_clinical_test(disease_name, "thermal")

    context_data = {
        "xray_image": selected_xray,
        "examine_image": selected_photo,
        "percussion_result": percussion_result,
        "thermal_result": thermal_result
    }

    session_ref = create_chat_session(
        user_id=current_user_id,
        disease_id=disease_id,
        clinical_context=context_data, 
        assignment_id=assignment_id
    )

    print(f"Assignment Session {session_ref.id} started. Disease: {disease_name}")

    return jsonify({
        "ok": True,
        "session_id": session_ref.id,
        "message": "Assignment case started."
    }), 200

@app.route(BASE_URL+"/classroom", methods=["POST"])
@jwt_required()
def create_classroom():
    current_user_id = get_jwt_identity()
    user_doc = firebase_db.collection("user").document(current_user_id).get()
    if not user_doc.exists:
        return jsonify({"error": "User not found"}), 404

    user_data = user_doc.to_dict()
    global_role = (user_data.get("role") or "").lower()
    if "prof" not in global_role:
        return jsonify({"error": "Only professors can create classrooms"}), 403

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    university = data.get("university", "").strip()
    course_category = data.get("course_category", "").strip()
    join_code = data.get("join_code", "").strip() or generate_join_code()

    if not name:
        return jsonify({"error": "Classroom name is required"}), 400

    ref = firebase_db.collection("classroom").document()
    ref.set({
        "name": name,
        "university": university,
        "course_category": course_category,
        "join_code": join_code,
        "created_by": current_user_id,
        "created_at": firestore.SERVER_TIMESTAMP
    })

    add_class_membership(current_user_id, ref.id, "Professor")

    return jsonify({
        "id": ref.id,
        "name": name,
        "university": university,
        "course_category": course_category,
        "join_code": join_code
    }), 201

@app.route(BASE_URL+"/classroom/join", methods=["POST"])
@jwt_required()
def join_classroom():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    class_code = data.get("class_code", "").strip()

    if not class_code:
        return jsonify({"error": "class_code required"}), 400

    classroom_doc = get_classroom_by_join_code(class_code)
    if not classroom_doc:
        return jsonify({"error": "Classroom not found"}), 404

    classroom_id = classroom_doc.id
    add_class_membership(current_user_id, classroom_id, "Student")

    firebase_db.collection("user").document(current_user_id).update({
        "classroom_id": classroom_id
    })

    return jsonify({
        "message": "Joined classroom",
        "classroom_id": classroom_id,
        "classroom_name": classroom_doc.to_dict().get("name")
    }), 200

@app.route(BASE_URL+"/classroom/my", methods=["GET"])
@jwt_required()
def get_my_classrooms():
    current_user_id = get_jwt_identity()

    memberships = firebase_db.collection("class_membership") \
        .where("user_id", "==", current_user_id).stream()

    classes = []
    for m_doc in memberships:
        m = m_doc.to_dict()
        c_id = m.get("classroom_id")
        role_in_class = m.get("role_in_class", "Student")
        c_doc = firebase_db.collection("classroom").document(c_id).get()
        if not c_doc.exists:
            continue
        c = c_doc.to_dict()
        classes.append({
            "id": c_id,
            "name": c.get("name"),
            "university": c.get("university"),
            "course_category": c.get("course_category"),
            "join_code": c.get("join_code"),
            "role_in_class": role_in_class
        })

    return jsonify(classes), 200

@app.route(BASE_URL+"/classroom/<classroom_id>/assignments", methods=["POST"])
@jwt_required()
def create_assignment(classroom_id):
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    required_sessions = int(data.get("required_sessions", 0) or 0)
    allowed_names = data.get("allowed_names") or []
    allowed_categories = data.get("allowed_categories") or []

    if not title or required_sessions <= 0:
        return jsonify({"error": "title and required_sessions > 0 are required"}), 400

    memb = (
        firebase_db.collection("class_membership")
        .where("classroom_id", "==", classroom_id)
        .where("user_id", "==", current_user_id)
        .where("role_in_class", "==", "Professor")
        .limit(1)
        .get()
    )
    if not memb:
        return jsonify({"error": "Only class instructor can create assignments"}), 403

    ref = firebase_db.collection("assignment").document()
    ref.set({
        "classroom_id": classroom_id,
        "title": title,
        "description": description,
        "required_sessions": required_sessions,
        "allowed_names": allowed_names,
        "allowed_categories": allowed_categories,
        "start_at": data.get("start_at"),
        "due_at": data.get("due_at"),
        "created_by": current_user_id,
        "created_at": firestore.SERVER_TIMESTAMP,
    })

    return jsonify({"id": ref.id, "message": "Assignment created"}), 201


@app.route(BASE_URL+"/classroom/<class_id>/assignments", methods=["GET"])
@jwt_required()
def list_class_assignments(class_id):
    current_user_id = get_jwt_identity()

    assignments = firebase_db.collection("assignment") \
        .where("classroom_id", "==", class_id).stream()

    result = []
    for a_doc in assignments:
        a = a_doc.to_dict()
        
        prog_query = firebase_db.collection("assignment_progress") \
            .where("assignment_id", "==", a_doc.id) \
            .where("user_id", "==", current_user_id) \
            .limit(1).get()

        completed_sessions = 0
        correct_sessions = 0
        is_completed = False
        avg_time_seconds = 0.0

        if prog_query:
            p = prog_query[0].to_dict()
            completed_sessions = int(p.get("completed_sessions", 0))
            correct_sessions = int(p.get("correct_sessions", 0))
            is_completed = bool(p.get("is_completed", False))
            total_duration_sec = float(p.get("total_duration_sec", 0))
            if completed_sessions > 0:
                avg_time_seconds = total_duration_sec / completed_sessions
            
        result.append({
            "id": a_doc.id,
            "title": a.get("title"),
            "description": a.get("description"),
            "required_sessions": int(a.get("required_sessions", 0)),
            "allowed_names": a.get("allowed_names", []),
            "allowed_categories": a.get("allowed_categories", []),
            "start_at": a.get("start_at"),
            "due_at": a.get("due_at"),
            "completed_sessions": completed_sessions,
            "correct_sessions": correct_sessions,
            "is_completed": is_completed,
            "avg_time_seconds": avg_time_seconds,
            "created_by": a.get("created_by")
        })

    return jsonify(result), 200


@app.route(BASE_URL+"/assignment/<assignment_id>/delete", methods=["POST"])
@jwt_required()
def delete_assignment(assignment_id):
    current_user_id = get_jwt_identity()

    assignment_doc = firebase_db.collection("assignment").document(assignment_id).get()
    if not assignment_doc.exists:
        return jsonify({"error": "Assignment not found"}), 404

    assignment_data = assignment_doc.to_dict()

    if assignment_data.get("created_by") != current_user_id:
        return jsonify({"error": "Only the professor who created this assignment can delete it"}), 403

    firebase_db.collection("assignment").document(assignment_id).delete()
    return jsonify({"message": "Assignment deleted successfully"}), 200


@app.route(BASE_URL+"/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user_doc = get_user_by_email(email)
    if not user_doc:
        return jsonify({"error": "No user found with this email"}), 404

    new_password = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    new_password_hash = generate_password_hash(new_password)

    firebase_db.collection("user").document(user_doc.id).update({
        "password_hash": new_password_hash
    })

    send_forgot_password_email(email, new_password)

    return jsonify({"message": "A new password has been sent to your email."}), 200

def send_forgot_password_email(to_email, new_password):
    subject = "Your New DentalTrain Password"
    body = f"Hello,\n\nYour password has been reset. Your new password is: {new_password}\n\nPlease log in https://dentaltrain.netlify.app/login and change it from your profile as soon as possible."

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SMTP_EMAIL
    msg['To'] = to_email

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"Forgot password email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send forgot password email: {e}")



@app.route(BASE_URL+"/classroom/<class_id>/leaderboard", methods=["GET"])
@jwt_required()
def classroom_leaderboard(class_id):
    memberships = firebase_db.collection("class_membership") \
        .where("classroom_id", "==", class_id).stream()

    users_data = []
    for m_doc in memberships:
        m = m_doc.to_dict()
        user_id = m.get("user_id")
        role_in_class = m.get("role_in_class", "Student")
        u_doc = firebase_db.collection("user").document(user_id).get()
        if not u_doc.exists:
            continue
        u = u_doc.to_dict()
        xp_val = int(u.get("xp", 0))
        cases_count = int(u.get("cases_completed", 0))
        cases_correct = int(u.get("cases_correct", 0))
        accuracy = int((cases_correct / cases_count) * 100) if cases_count > 0 else 0
        users_data.append({
            "user_id": user_id,
            "username": u.get("username"),
            "xp": xp_val,
            "streak": int(u.get("streak", 0)),
            "role_in_class": role_in_class,
            "cases_completed": cases_count,
            "accuracy": accuracy
        })

    users_data.sort(key=lambda x: x["xp"], reverse=True)
    for idx, u in enumerate(users_data, start=1):
        u["rank"] = idx
        u["level"] = int(u["xp"] / 1000) + 1

    return jsonify(users_data), 200

@app.route(BASE_URL+"/assignment/<assignment_id>/progress", methods=["GET"])
@jwt_required()
def assignment_progress(assignment_id):
    ass_doc = firebase_db.collection("assignment").document(assignment_id).get()
    if not ass_doc.exists:
        return jsonify({"error": "Assignment not found"}), 404

    ass = ass_doc.to_dict()
    classroom_id = ass.get("classroom_id")
    required_sessions = int(ass.get("required_sessions", 0))

    memberships = firebase_db.collection("class_membership") \
        .where("classroom_id", "==", classroom_id).stream()
    result = []
    for m_doc in memberships:
        m = m_doc.to_dict()
        user_id = m.get("user_id")

        u_doc = firebase_db.collection("user").document(user_id).get()
        if not u_doc.exists:
            continue
        u = u_doc.to_dict()

        prog_query = firebase_db.collection("assignment_progress") \
            .where("assignment_id", "==", assignment_id) \
            .where("user_id", "==", user_id) \
            .limit(1).get()

        completed_sessions = 0
        correct_sessions = 0
        total_duration_sec = 0.0
        is_completed_flag = False

        if prog_query:
            p = prog_query[0].to_dict()
            completed_sessions = int(p.get("completed_sessions", 0))
            correct_sessions = int(p.get("correct_sessions", 0))
            total_duration_sec = float(p.get("total_duration_sec", 0))
            is_completed_flag = bool(p.get("is_completed", False))

        avg_time = total_duration_sec / completed_sessions if completed_sessions > 0 else 0.0

        result.append({
            "user_id": user_id,
            "username": u.get("username"),
            "completed_sessions": completed_sessions,
            "correct_sessions": correct_sessions,
            "required_sessions": required_sessions,
            "is_completed": is_completed_flag,
            "avg_time_seconds": avg_time
        })

    return jsonify(result), 200

@app.route(BASE_URL+"/chat/media/<session_id>/<image_type>", methods=["GET"])
def serve_clinical_image(session_id, image_type):
    session_doc = firebase_db.collection("chat_session").document(session_id).get()

    if not session_doc.exists:
        return abort(404)

    session_data = session_doc.to_dict()
    clinical_context = session_data.get("clinical_context", {})

    if image_type == "xray":
        filename = clinical_context.get("xray_image")
        subfolder = "xrays"
    elif image_type == "examine":
        filename = clinical_context.get("examine_image")
        subfolder = "examine"
    else:
        return abort(400) 

    if not filename:
        return abort(404) 

    try:
        return send_from_directory(
            directory=os.path.join(ASSETS_FOLDER, subfolder),
            path=filename
        )
    except FileNotFoundError:
        return abort(404)

@app.route(BASE_URL+"/chat/submit-treatment", methods=["POST"])
@jwt_required()
def submit_treatment_plan():
    data = request.get_json()
    session_id = data.get("session_id")
    treatment_text = data.get("treatment_text")

    if not session_id or not treatment_text:
        return jsonify({"error": "Missing data"}), 400

    session_ref = firebase_db.collection("chat_session").document(session_id)
    session = session_ref.get()

    if not session.exists:
        return jsonify({"error": "Session not found"}), 404

    session_ref.update({
        "treatment_plan": treatment_text,
    })

    return jsonify({"ok": True, "message": "Treatment plan saved."})

@app.route(BASE_URL + '/')
def serve_frontend_root():
    return send_from_directory(app.static_folder, 'index.html')

@app.route(BASE_URL + '/<path:path>')
def serve_static_files(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


@app.route(BASE_URL+"/diseases", methods=["GET"])
@jwt_required()
def list_diseases():
    docs = firebase_db.collection("disease").get()
    diseases = []
    for d in docs:
        data = d.to_dict()
        diseases.append({
            "id": d.id,
            "name": data.get("name")
        })
    diseases.sort(key=lambda x: x["name"])
    return jsonify(diseases)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 9004))
    print(f"Starting DentalSim Backend on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
