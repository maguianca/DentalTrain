# Modificări: Tutorial de bun venit (Onboarding) — notă de predare pentru IT

Acest document descrie toate modificările făcute pentru a adăuga un **tutorial
de bun venit** (ghid pas-cu-pas care evidențiază butoanele) ce apare **automat
o singură dată**, la prima utilizare a unui cont, și care poate fi repornit
oricând dintr-un buton „Ajutor".

> În cod, toate modificările sunt marcate cu comentariile
> `=== ONBOARDING TUTORIAL ===` ... `=== END ONBOARDING TUTORIAL ===`
> (sau eticheta `ONBOARDING TUTORIAL (added)`), deci pot fi găsite ușor cu o căutare.

---

## Pe scurt
- **Frontend:** o componentă nouă de tutorial + integrarea ei în pagina Home și
  în pagina de caz/chat, plus un buton „Ajutor" pe fiecare.
- **Backend:** 2 câmpuri noi pe documentul utilizatorului (Firestore) + 2 endpoint-uri
  noi, ca „am văzut tutorialul" să fie reținut **per cont** (nu per dispozitiv).

---

## FRONTEND — `app/DentalSimFrontend/`

### Fișier NOU: `src/components/GuidedTour.tsx`
Componentă reutilizabilă de tip „coach-mark":
- Întunecă tot ecranul și evidențiază („spotlight") un element țintă.
- Afișează o bulă cu titlu + descriere + contor (ex. `2 / 4`) + butoane Back / Next / X.
- Primește un `steps: TourStep[]` (fiecare pas = selector CSS + titlu + descriere)
  și se controlează prin `isOpen` / `onClose`.
- Țintele sunt găsite prin atribute `data-tour="..."` adăugate în pagini.

### Modificat: `src/pages/HomeTab.tsx`
- `data-tour` adăugat pe: butonul **Begin Case**, cardurile **Cases / Accuracy / Badges**.
- Buton **„Ajutor"** (`?`) în antet, care repornește tutorialul (`setShowTour(true)`).
- Logica de auto-pornire: pornește o singură dată dacă `userInfo.has_seen_home_tutorial === false`
  (valoarea vine din `/auth/profile`). La închidere apelează `POST /auth/tutorial-seen { which: 'home' }`.
- Pașii tutorialului: constanta `HOME_TOUR_STEPS`.

### Modificat: `src/pages/DiagnosisPage.tsx`
- `data-tour` adăugat pe: zona de scris mesaj (**chat-input**), **Examine**,
  **Percussion Test**, **Thermal Test**, **X-Ray**, butonul **Submit**, **cronometrul**.
- Buton **„Ajutor"** (`?`) în antet.
- Logica de auto-pornire: la deschiderea paginii apelează `GET /auth/tutorial-status`
  și pornește tutorialul dacă `chat === false`. La închidere apelează
  `POST /auth/tutorial-seen { which: 'chat' }`.
- Pașii tutorialului: constanta `CHAT_TOUR_STEPS`.

### Modificat: `src/App.tsx`
- Două **rute de previzualizare** publice (fără login), folosite DOAR pentru a vedea
  tutorialul în timpul dezvoltării:
  - `/tour-preview/home`
  - `/tour-preview/chat`
- **OPȚIONAL la deploy:** aceste rute pot fi șterse înainte de producție. Nu expun
  date reale (nu există token → nu se încarcă nimic din backend), dar nu sunt
  necesare pentru utilizatorii finali.

---

## BACKEND — `app/DentalSimBackend/app.py`

Stocare: Firebase Firestore, colecția `user`.

### 1. `create_user(...)` — conturi noi
Adăugate două câmpuri la documentul utilizatorului:
```python
"has_seen_home_tutorial": False,
"has_seen_chat_tutorial": False,
```

### 2. `get_profile()` (`GET /auth/profile`)
Răspunsul include acum:
```python
"has_seen_home_tutorial": user.get("has_seen_home_tutorial", False),
"has_seen_chat_tutorial": user.get("has_seen_chat_tutorial", False),
```
> Conturile vechi nu au aceste câmpuri → `.get(..., False)` întoarce `False`,
> deci vor vedea tutorialul o singură dată (comportament dorit).

### 3. Endpoint-uri NOI
- `GET  /auth/tutorial-status` (necesită JWT) → `{ "home": bool, "chat": bool }`
  (verificare „ușoară", folosită de pagina de chat).
- `POST /auth/tutorial-seen` (necesită JWT), body `{ "which": "home" | "chat" }`
  → setează `True` pe câmpul corespunzător.

---

## Cum se testează
1. Cont **nou** → la prima logare apare tutorialul pe Home; după Done/skip nu mai apare.
2. Primul caz deschis → apare tutorialul de chat; după Done/skip nu mai apare.
3. Butonul **„Ajutor" (`?`)** repornește tutorialul pe orice pagină, oricând.
4. Previzualizare rapidă fără login (doar în dev):
   `http://localhost:5173/app/chatbot/tour-preview/home` și `.../tour-preview/chat`.

## Note
- Nicio modificare nu afectează funcționalitatea existentă; doar se adaugă.
- Verificat: `npx tsc --noEmit` (frontend) și `python -m py_compile app.py` (backend) — fără erori.

---
---

# Modificări: Mod VALIDARE (livrare pe runde + chestionar medical)

Adăugat un „mod validare" pentru medicii care testează acuratețea medicală a AI-ului.
Marcat în cod cu `=== VALIDATION MODE ===` ... `=== END VALIDATION MODE ===`.

## Cum se activează (IMPORTANT)
Comportamentul de validare se activează **per cont**, prin câmpul `role` din Firestore:
- Cont cu `role == "validator"` → primește cazuri pe runde + chestionar după fiecare caz.
- Orice alt rol → comportamentul normal (cazuri random, fără chestionar).

Pentru a face un medic validator: setează `role = "validator"` pe documentul lui din
colecția `user` (din consola Firebase, sau prin `PUT /auth/update-profile`).
Când vor veni studenții, ei rămân cu rolul normal → nicio modificare de cod necesară.

## BACKEND — `app/DentalSimBackend/app.py`
1. **`pick_validation_disease(user_id)`** (funcție nouă): numără de câte ori a terminat
   utilizatorul fiecare boală și alege aleatoriu dintre cele făcute de cele mai puține ori.
   → fiecare caz o dată pe rundă, în ordine aleatorie, fără repetări; apoi runda următoare.
2. **`start_random_chat`**: dacă userul e validator, folosește funcția de mai sus; altfel
   rămâne random. Salvează `round` în sesiune și întoarce `round` / `case_number` / `total_cases`.
3. **`POST /chat/validation-feedback`** (endpoint nou): salvează răspunsurile chestionarului
   în colecția nouă **`validation_response`** (un document per chestionar), cu boala, runda,
   diagnosticul trimis și dacă a fost corect — pentru analiză și acord între evaluatori.

## BACKEND — `app/DentalSimBackend/export_validation.py` (fișier NOU)
Script de export: rulează `python export_validation.py` (în folderul backend, cu
`serviceAccountKey.json` prezent) → produce `validation_export.csv`, un rând per răspuns,
sortat pe boală și rundă, gata de deschis în Excel.

## FRONTEND — `app/DentalSimFrontend/`
- **`src/components/ValidationQuestionnaire.tsx`** (NOU): chestionarul (în română), modal
  cu 8 întrebări (vezi `CHESTIONAR_VALIDARE.md`).
- **`src/pages/DiagnosisPage.tsx`**: pentru validatori, după ecranul de rezultat apare
  butonul „Continuă la chestionar" → chestionarul → trimite la `/chat/validation-feedback`
  → revine la Home. Banner discret cu „Round X · Case Y/Z" (doar pentru validatori).
- **`src/pages/HomeTab.tsx`**: reține în `localStorage` info de progres (rundă/caz) la
  pornirea unui caz, pentru bannerul din pagina de caz.
- **`src/App.tsx`**: rută de previzualizare a chestionarului (fără login):
  `/tour-preview/questionnaire`.

## Cum se testează
1. Setează un cont de test cu `role = "validator"`.
2. Loghează-te → pornește cazuri: vor veni pe rundă, fără repetări (vezi bannerul „Round 1 · Case k/N").
3. La finalul fiecărui caz apare chestionarul; după trimitere, răspunsul apare în `validation_response`.
4. Previzualizare chestionar (dev, fără login): `.../app/chatbot/tour-preview/questionnaire`.
5. Export: `python export_validation.py` → `validation_export.csv`.
