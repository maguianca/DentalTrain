import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('d:/DentalTrain/projects-dentaltrain/app/DentalSimBackend/serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def backfill_stats():
    users = db.collection('user').stream()
    for u_doc in users:
        user_id = u_doc.id
        sessions = db.collection('chat_session').where('user_id', '==', user_id).where('is_completed', '==', 1).stream()
        
        count = 0
        correct = 0
        for s in sessions:
            count += 1
            if s.to_dict().get('was_correct') == 1:
                correct += 1
        
        print(f"Updating user {user_id}: {count} cases, {correct} correct")
        db.collection('user').document(user_id).update({
            'cases_completed': count,
            'cases_correct': correct
        })

if __name__ == "__main__":
    backfill_stats()
