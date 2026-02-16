
import os
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


# --- APP CONFIGURATION ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Schimbă cheia la producție!
app.config['JWT_SECRET_KEY'] = 'super-secret-dental-key-change-me'
jwt = JWTManager(app)

# --- FIREBASE INIT ---
SERVICE_ACCOUNT_KEY_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
firebase_db = firestore.client()

# --- EMAIL CONFIG ---
load_dotenv()
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
if not SMTP_EMAIL:
    raise ValueError("Error: SMTP_EMAIL not found in .env file")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
if not SMTP_PASSWORD:
    raise ValueError("Error: SMTP_PASSWORD not found in .env file")


# --- LLM ENDPOINTS ---
#COLAB_URL = os.getenv("NGROK_DOMAIN")
#if not COLAB_URL:
#    raise ValueError("Error: NGROK_DOMAIN not found in .env file")
AI_SERVER_URL = "http://127.0.0.1:5000"
HF_URL = f"{AI_SERVER_URL}/generate"
#HF_URL = f"https://{COLAB_URL}/generate"
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


def get_random_disease(allowed_names=None):
    docs = firebase_db.collection("disease").get()
    if not docs:
        return None

    # daca nu avem filtru, alegem direct
    if allowed_names is None:
        endo_docs = []
        non_endo_docs = []

        for d in docs:
            data = d.to_dict()
            category = data.get("category", "").lower()

            if "non endodontic" in category:
                non_endo_docs.append(d)
            else:
                endo_docs.append(d)

        # Handle edge case: if we have no non-endo diseases in DB, just pick from all
        if not non_endo_docs:
            return random.choice(docs)

        selection_pool = list(endo_docs)
        selection_pool.append("NON_ENDO_GROUP_MARKER")

        choice = random.choice(selection_pool)

        # If the placeholder is picked, select a random Non-Endo disease
        if choice == "NON_ENDO_GROUP_MARKER":
            return random.choice(non_endo_docs)

        return choice

    # filtrăm documentele care au name în allowed_names
    allowed_set = set(allowed_names)
    filtered = []
    for d in docs:
        data = d.to_dict()
        if data.get("name") in allowed_set:
            filtered.append(d)

    if not filtered:
        # nu există boli care să se potrivească cu allowed_names
        return None

    return random.choice(filtered)


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
    ref = firebase_db.collection("chat_message").document()
    ref.set({
        "session_id": session_id,
        "sender": sender,
        "content": content,
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    return ref

def get_last_messages(session_id, limit=10):
    # Filtrăm pe session_id și ordonăm desc după timestamp
    msgs = firebase_db.collection("chat_message") \
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
    subject = "Your DentalSim Verification Code"
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
@app.route("/firebase/add", methods=["POST"])
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

@app.route("/auth/register", methods=["POST"])
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


@app.route("/auth/verify", methods=["POST"])
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

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")

    user_doc = get_user_by_username(username)
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
            "username": user.get("username"),
            "xp": int(user.get("xp", 0)),
            "role": user.get("role", "Dental Student"),
            "email": user.get("email"),  # FIXED: Added email to response
            "university": user.get("university"),  # FIXED: Added university to response
        }
    })


@app.route("/chat/start/random", methods=["POST"])
@jwt_required()
def start_random_chat():
    current_user_id = get_jwt_identity()

    disease_doc = get_random_disease()
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

        # Storing the specific "truth" for this patient
        "clinical_context": {
            "examine_image": selected_examine_img,
            "xray_image": selected_xray_img,
            "percussion_result": percussion_result,
            "thermal_result": thermal_result
        }
    })

    print(f"Session {session_ref.id}: {disease_name}")

    return jsonify({
        "ok": True,
        "session_id": session_ref.id,
        "message": "** The patient has entered the office. **"
    })


@app.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    data = request.get_json()
    session_id = data.get("session_id")
    user_message = data.get("message", "")

    session_doc = firebase_db.collection("chat_session").document(session_id).get()
    if not session_doc.exists:
        return jsonify({"error": "Invalid session"}), 404
    session = session_doc.to_dict()

    # mesajul studentului
    add_chat_message(session_id, "student", user_message)

    # sistem prompt din boală
    disease_doc = firebase_db.collection("disease").document(session["disease_id"]).get()
    if not disease_doc.exists:
        return jsonify({"error": "Disease missing"}), 500
    disease = disease_doc.to_dict()

    recent_msgs = get_last_messages(session_id, limit=10)
    conversation_history = [{"role": "system", "content": disease["system_prompt"]}]
    for msg_doc in recent_msgs:
        m = msg_doc.to_dict()
        role = "user" if m["sender"] == "student" else "assistant"
        conversation_history.append({"role": role, "content": m["content"]})

    payload = {
        "messages": conversation_history,
        "max_new_tokens": 150,
        "temperature": 0.2
    }

    try:
        response = requests.post(HF_URL, json=payload, headers=HF_HEADERS, timeout=120)
        if response.status_code == 200:
            ai_data = response.json()
            bot_reply = ai_data.get("generated_text", "")
            add_chat_message(session_id, "patient", bot_reply)
            return jsonify({"reply": bot_reply})
        else:
            return jsonify({"error": f"LLM Error: {response.status_code}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/chat/diagnose", methods=["POST"])
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

    current_hour = dt.datetime.now(dt.UTC).hour
    if current_hour < 7:
        badge_alerts += check_and_award_badge(current_user_id, "Early Bird", 25)
    if current_hour >= 23:
        badge_alerts += check_and_award_badge(current_user_id, "Night Owl", 25)

    # ---------------- STREAK LOGIC ----------------
    def _to_aware_date(val) -> dt.date | None:
        """
        Normalizează diverse reprezentări de timp la date (YYYY-MM-DD), UTC-aware.
        Acceptă: Firestore Timestamp (dt.datetime), string ISO / 'YYYY-MM-DD HH:MM:SS[.ffffff]'.
        """
        if isinstance(val, dt.datetime):
            aware = val.astimezone(dt.UTC) if val.tzinfo else val.replace(tzinfo=dt.UTC)
            return aware.date()
        if isinstance(val, str):
            # încearcă ISO 8601
            try:
                d = dt.datetime.fromisoformat(val)
            except ValueError:
                # fallback pe format clasic
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
            return aware.date()
        return None

    # --- în interiorul /chat/diagnose, după ce ai încărcat `user` și ai `user_ref` și `batch` ---
    streak = int(user.get("streak", 0))
    last_active_raw = user.get("last_active_date")  # poate fi Timestamp, string, None

    today = dt.datetime.now(dt.UTC).date()
    last_date = _to_aware_date(last_active_raw)

    if last_date != today:
        yesterday = today - dt.timedelta(days=1)
        if last_date == yesterday:
            streak += 1
        else:
            streak = 1
        # Stochează ca Timestamp (momentul serverului). Firestore îl va arăta ca 'December X, 2025 ...'
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
    batch.update(user_ref, {"xp": firestore.Increment(xp_gained)})
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

@app.route("/chat/clinical-test", methods=["POST"])
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
            # We return the filename so the frontend knows something exists.
            # The frontend doesn't show this filename to the user;
            # it just uses it to decide to open the modal.
            response_data["content"] = filename
        else:
            # Case has no X-ray/Photo
            response_data["content"] = ""

    else:
        return jsonify({"error": "Unknown test type"}), 400

    return jsonify(response_data)

@app.route("/auth/profile", methods=["GET"])
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

    def is_truthy_number(x):
        try:
            return int(x) == 1
        except Exception:
            return False

    correct_cases = sum(1 for s in completed_list if s.get("was_correct"))

    accuracy = int((correct_cases / total_cases) * 100) if total_cases > 0 else 0

    user_xp = int(user.get("xp", 0))
    higher = firebase_db.collection("user").where("xp", ">", user_xp).stream()
    rank = sum(1 for _ in higher) + 1

    badges_stream = firebase_db.collection("user_badge").where("user_id", "==", current_user_id).stream()
    earned_badge_names = [b.to_dict().get("badge_name") for b in badges_stream]

    return jsonify({
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
        "is_verified": user.get("is_verified", False)  # FIXED: Added is_verified
    })


@app.route("/auth/update-profile", methods=["PUT"])
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
        # When changing email, might want to re-verify
        updates["email"] = new_email
        updates["is_verified"] = False  # Require re-verification
        # Optionally send new verification code here

    if updates:
        user_ref.update(updates)

    return jsonify({"message": "Profile updated successfully"})


@app.route("/auth/leaderboard", methods=["GET"])
def get_leaderboard():
    # Poate necesita index pentru order_by('xp' DESC). Creezi din Firebase console când îți sugerează.
    users = firebase_db.collection("user").order_by("xp", direction=firestore.Query.DESCENDING).limit(50).get()
    leaderboard_data = []
    for index, u_doc in enumerate(users):
        u = u_doc.to_dict()
        xp_val = int(u.get("xp", 0))
        leaderboard_data.append({
            "id": u_doc.id,
            "username": u.get("username"),
            "xp": xp_val,
            "streak": int(u.get("streak", 0)),
            "rank": index + 1,
            "level": int(xp_val / 1000) + 1,
            "role": u.get("role", "Dental Student"),  # FIXED: Added role to leaderboard
            "university": u.get("university")  # FIXED: Added university to leaderboard (optional)
        })
    return jsonify(leaderboard_data)

@app.route('/universities', methods=['GET'])
def list_universities():
    universities = university_config.get_list_of_universities()
    return jsonify({"universities": universities}), 200

@app.route("/chat/start/assignment", methods=["POST"])
@jwt_required()
def start_assignment_chat():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    assignment_id = data.get("assignment_id")

    if not assignment_id:
        return jsonify({"error": "assignment_id required"}), 400

    # luam assignment-ul din Firestore
    assignment_doc = firebase_db.collection("assignment").document(assignment_id).get()
    if not assignment_doc.exists:
        return jsonify({"error": "Assignment not found"}), 404

    assignment = assignment_doc.to_dict()
    allowed_names = assignment.get("allowed_names")

    # alegem boala random doar dintre allowed_names (sau None = toate)
    disease_doc = get_random_disease(allowed_names=allowed_names)
    if not disease_doc:
        return jsonify({"error": "No diseases match assignment filters"}), 500

    disease_id = disease_doc.id
    disease_data = disease_doc.to_dict()
    disease_name = disease_data.get("name")

    possible_xrays = disease_data.get("xray_images", [])
    selected_xray = random.choice(possible_xrays) if possible_xrays else None

    possible_photos = disease_data.get("examine_images", [])
    selected_photo = random.choice(possible_photos) if possible_photos else None

    percussion_result = resolve_clinical_test(disease_name, "percussion")
    thermal_result = resolve_clinical_test(disease_name, "thermal")

    # Pack the data
    context_data = {
        "xray_image": selected_xray,
        "examine_image": selected_photo,
        "percussion_result": percussion_result,
        "thermal_result": thermal_result
    }

    session_ref = create_chat_session(
        user_id=current_user_id,
        disease_id=disease_id,
        clinical_context=context_data, # <--- Added this
        assignment_id=assignment_id
    )

    print(f"Assignment Session {session_ref.id} started. Disease: {disease_name}")

    return jsonify({
        "ok": True,
        "session_id": session_ref.id,
        "message": "Assignment case started."
    }), 200

@app.route("/classroom", methods=["POST"])
@jwt_required()
def create_classroom():
    """
    Create a new classroom.
    Body JSON: { "name": "...", "university": "...", "course_category": "Endodontics", "join_code": "OPTIONAL" }
    The creator becomes Instructor in that classroom.
    """
    current_user_id = get_jwt_identity()
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

    # creator becomes Instructor
    add_class_membership(current_user_id, ref.id, "Instructor")

    return jsonify({
        "id": ref.id,
        "name": name,
        "university": university,
        "course_category": course_category,
        "join_code": join_code
    }), 201

@app.route("/classroom/join", methods=["POST"])
@jwt_required()
def join_classroom():
    """
    Join a classroom using its join_code.
    Body JSON: { "class_code": "ENDO25G3" }
    """
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

    # optional: also set primary classroom_id on user, if you want
    firebase_db.collection("user").document(current_user_id).update({
        "classroom_id": classroom_id
    })

    return jsonify({
        "message": "Joined classroom",
        "classroom_id": classroom_id,
        "classroom_name": classroom_doc.to_dict().get("name")
    }), 200

@app.route("/classroom/my", methods=["GET"])
@jwt_required()
def get_my_classrooms():
    """
    Return the list of classrooms where the current user is a member.
    """
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

@app.route("/classroom/<classroom_id>/assignments", methods=["POST"])
@jwt_required()
def create_assignment(classroom_id):
    """
    Create an assignment for a classroom.
    Body JSON:
    {
      "title": "...",
      "description": "...",
      "required_sessions": 5,
      "allowed_names": ["Reversible Pulpitis", "Acute Apical Abscess"],
      "start_at": "2026-01-10T00:00:00Z",   # optional
      "due_at": "2026-01-20T23:59:59Z"     # optional
    }
    """
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    required_sessions = int(data.get("required_sessions", 0) or 0)
    allowed_names = data.get("allowed_names") or []

    # dacă vrei allowed_names OBLIGATORIU:
    # if not title or required_sessions <= 0 or not allowed_names:
    #     return jsonify({"error": "title, required_sessions > 0 and allowed_names are required"}), 400

    if not title or required_sessions <= 0:
        return jsonify({"error": "title and required_sessions > 0 are required"}), 400

    # verifică că userul este Instructor în clasa asta
    memb = (
        firebase_db.collection("class_membership")
        .where("classroom_id", "==", classroom_id)
        .where("user_id", "==", current_user_id)
        .where("role_in_class", "==", "Instructor")
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
        "start_at": data.get("start_at"),
        "due_at": data.get("due_at"),
        "created_by": current_user_id,
        "created_at": firestore.SERVER_TIMESTAMP,
    })

    return jsonify({"id": ref.id, "message": "Assignment created"}), 201


@app.route("/classroom/<class_id>/assignments", methods=["GET"])
@jwt_required()
def list_class_assignments(class_id):
    """
    List all assignments for a classroom.
    """
    assignments = firebase_db.collection("assignment") \
        .where("classroom_id", "==", class_id).stream()

    result = []
    for a_doc in assignments:
        a = a_doc.to_dict()
        result.append({
            "id": a_doc.id,
            "title": a.get("title"),
            "description": a.get("description"),
            "required_sessions": int(a.get("required_sessions", 0)),
            "allowed_names": a.get("allowed_names", []),
            "start_at": a.get("start_at"),
            "due_at": a.get("due_at")
        })

    return jsonify(result), 200

@app.route("/classroom/<class_id>/leaderboard", methods=["GET"])
@jwt_required()
def classroom_leaderboard(class_id):
    """
    Leaderboard for a single classroom, based on user XP.
    """
    # 1. Get all members
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
        users_data.append({
            "user_id": user_id,
            "username": u.get("username"),
            "xp": xp_val,
            "streak": int(u.get("streak", 0)),
            "role_in_class": role_in_class
        })

    users_data.sort(key=lambda x: x["xp"], reverse=True)
    for idx, u in enumerate(users_data, start=1):
        u["rank"] = idx
        u["level"] = int(u["xp"] / 1000) + 1

    return jsonify(users_data), 200

@app.route("/assignment/<assignment_id>/progress", methods=["GET"])
@jwt_required()
def assignment_progress(assignment_id):
    """
    Report for an assignment:
    For each student in the classroom: completed/correct/avg time + done/not done.
    """
    ass_doc = firebase_db.collection("assignment").document(assignment_id).get()
    if not ass_doc.exists:
        return jsonify({"error": "Assignment not found"}), 404

    ass = ass_doc.to_dict()
    classroom_id = ass.get("classroom_id")
    required_sessions = int(ass.get("required_sessions", 0))

    # All students in this class
    memberships = firebase_db.collection("class_membership") \
        .where("classroom_id", "==", classroom_id) \
        .where("role_in_class", "==", "Student").stream()

    result = []
    for m_doc in memberships:
        m = m_doc.to_dict()
        user_id = m.get("user_id")

        u_doc = firebase_db.collection("user").document(user_id).get()
        if not u_doc.exists:
            continue
        u = u_doc.to_dict()

        # Progress for this user on this assignment
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

@app.route("/chat/media/<session_id>/<image_type>", methods=["GET"])
def serve_clinical_image(session_id, image_type):
    """
    The frontend calls this: /chat/media/sess_abc123/xray
    The student sees NOTHING about the diagnosis.
    """

    # 1. Look up the session to find out which image was assigned
    session_doc = firebase_db.collection("chat_session").document(session_id).get()

    if not session_doc.exists:
        return abort(404)

    session_data = session_doc.to_dict()
    clinical_context = session_data.get("clinical_context", {})

    # 2. Get the secret filename (e.g., "pulpitis.jpg")
    if image_type == "xray":
        # In the previous step, we stored the URL/Path here.
        # Now we expect just a filename like "pulpitis.jpg"
        filename = clinical_context.get("xray_image")
        subfolder = "xrays"
    elif image_type == "examine":
        filename = clinical_context.get("examine_image")
        subfolder = "examine"
    else:
        return abort(400) # Bad request

    if not filename:
        return abort(404) # No image for this case


    # 3. Securely send the file from the server's hard drive
    # The browser receives the image, but the URL remains generic.
    try:
        return send_from_directory(
            directory=os.path.join(ASSETS_FOLDER, subfolder),
            path=filename
        )
    except FileNotFoundError:
        return abort(404)

@app.route("/chat/submit-treatment", methods=["POST"])
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

if __name__ == "__main__":
    print("Starting DentalSim Backend (Firestore-only) on port 9003...")
    app.run(host="0.0.0.0", port=9003, debug=True)
